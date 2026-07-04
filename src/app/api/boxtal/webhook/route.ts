import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import {
  syncBoxtalShipment,
  BoxtalApiError,
  hasBoxtalShipmentDetails,
  normalizeBoxtalWebhookShipment,
} from "@/lib/boxtal";
import {
  buildBoxtalWebhookEventId,
  getBoxtalWebhookEnvelope,
} from "@/lib/boxtal-webhook";
import {
  getOrderByBoxtalOrderId,
  getOrderById,
  getOrderByStripeSessionId,
  updateOrderFields,
} from "@/lib/orders";
import { sendOrderEmail } from "@/lib/order-email";
import {
  normalizeTrackingDetails,
  normalizeTrackingUrl,
} from "@/lib/order-tracking";
import { beginWebhookEvent, updateWebhookEvent } from "@/lib/webhook-events";
import type { Order } from "@/lib/types";

export const runtime = "nodejs";

type ShipmentPatchInput = {
  boxtalOrderId?: string;
  shippingOfferCode?: string;
  status?: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  labelUrl?: string;
  relayCode?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function isValidBoxtalSignature(payload: string, signature: string, secret: string) {
  const normalizedSignature = signature.replace(/^sha256=/i, "").trim();
  const digestHex = createHmac("sha256", secret).update(payload).digest("hex");
  const digestBase64 = createHmac("sha256", secret)
    .update(payload)
    .digest("base64");

  return (
    safeEqual(normalizedSignature, digestHex) ||
    safeEqual(normalizedSignature, digestBase64)
  );
}

function buildOrderPatch(order: Order, shipment: ShipmentPatchInput) {
  const now = new Date().toISOString();
  const normalizedTracking = normalizeTrackingDetails({
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    trackingUrl: shipment.trackingUrl,
  });
  const safeLabelUrl = normalizeTrackingUrl(shipment.labelUrl);
  const hasTracking = Boolean(
    normalizedTracking?.trackingNumber || normalizedTracking?.trackingUrl,
  );
  const shipmentStatus = shipment.status?.toUpperCase();
  const orderStatus =
    shipmentStatus === "DELIVERED"
      ? "delivered"
      : hasTracking
        ? "shipped"
        : order.status;

  return {
    boxtalShipment: {
      ...(order.boxtalShipment || {}),
      boxtalOrderId: shipment.boxtalOrderId || order.boxtalShipment?.boxtalOrderId,
      shippingOfferCode:
        shipment.shippingOfferCode || order.boxtalShipment?.shippingOfferCode,
      status: shipment.status || order.boxtalShipment?.status,
      carrier: normalizedTracking?.carrier || order.boxtalShipment?.carrier,
      trackingNumber:
        normalizedTracking?.trackingNumber || order.boxtalShipment?.trackingNumber,
      trackingUrl: normalizedTracking?.trackingUrl || order.boxtalShipment?.trackingUrl,
      labelUrl: safeLabelUrl || order.boxtalShipment?.labelUrl,
      relayCode: shipment.relayCode || order.boxtalShipment?.relayCode,
      createdAt: order.boxtalShipment?.createdAt || now,
      updatedAt: now,
      lastError: "",
    },
    shippingTracking:
      hasTracking || order.shippingTracking
        ? {
            carrier: normalizedTracking?.carrier || order.shippingTracking?.carrier,
            trackingNumber:
              normalizedTracking?.trackingNumber ||
              order.shippingTracking?.trackingNumber,
            trackingUrl:
              normalizedTracking?.trackingUrl || order.shippingTracking?.trackingUrl,
        }
      : order.shippingTracking,
    status: orderStatus,
    shippedAt:
      (orderStatus === "shipped" || orderStatus === "delivered") && hasTracking
        ? order.shippedAt || now
        : order.shippedAt,
  } satisfies Partial<Omit<Order, "_id">>;
}

async function resolveOrder(
  shipmentExternalId?: string,
  boxtalOrderId?: string,
) {
  if (shipmentExternalId) {
    const byId = await getOrderById(shipmentExternalId);
    if (byId) {
      return byId;
    }

    const byStripeSessionId = await getOrderByStripeSessionId(shipmentExternalId);
    if (byStripeSessionId) {
      return byStripeSessionId;
    }
  }

  if (boxtalOrderId) {
    return getOrderByBoxtalOrderId(boxtalOrderId);
  }

  return null;
}

async function maybeSendTrackingEmail(order: Order, shipment: ShipmentPatchInput) {
  const hadTrackingBefore = Boolean(
    order.shippingTracking?.trackingNumber || order.shippingTracking?.trackingUrl,
  );
  const normalizedTracking = normalizeTrackingDetails({
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    trackingUrl: shipment.trackingUrl,
  });
  const hasTrackingNow = Boolean(
    normalizedTracking?.trackingNumber || normalizedTracking?.trackingUrl,
  );

  if (hadTrackingBefore || !hasTrackingNow) {
    return;
  }

  await sendOrderEmail(
    {
      ...order,
      shippingTracking: {
        carrier: normalizedTracking?.carrier || order.shippingTracking?.carrier,
        trackingNumber:
          normalizedTracking?.trackingNumber ||
          order.shippingTracking?.trackingNumber,
        trackingUrl:
          normalizedTracking?.trackingUrl || order.shippingTracking?.trackingUrl,
      },
    },
    "shipping_tracking",
    {
      idempotencyParts: [
        order._id,
        normalizedTracking?.trackingNumber || normalizedTracking?.trackingUrl,
      ],
    },
  );
}

export async function POST(request: Request) {
  const webhookSecret = process.env.BOXTAL_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing BOXTAL_WEBHOOK_SECRET" },
      { status: 500 },
    );
  }

  const signature = request.headers.get("x-bxt-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing x-bxt-signature" }, { status: 400 });
  }

  const rawPayload = await request.text();
  if (!isValidBoxtalSignature(rawPayload, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!isRecord(payload)) {
    return NextResponse.json({ error: "Invalid event format" }, { status: 400 });
  }

  const { eventType, shipmentExternalId, boxtalOrderId } =
    getBoxtalWebhookEnvelope(payload);
  const eventId = buildBoxtalWebhookEventId({
    payloadId: payload.id,
    eventType,
    shipmentExternalId,
    boxtalOrderId,
    rawPayload,
  });

  const begin = await beginWebhookEvent({
    provider: "boxtal",
    eventId,
    eventType: eventType || "unknown",
    objectId: shipmentExternalId || boxtalOrderId,
  });
  if (!begin.shouldProcess) {
    return NextResponse.json(
      {
        received: true,
        skipped: begin.busy ? "processing" : begin.event?.status,
      },
      { status: begin.busy ? 409 : 200 },
    );
  }

  if (!shipmentExternalId && !boxtalOrderId) {
    await updateWebhookEvent("boxtal", eventId, "ignored");
    return NextResponse.json({ received: true, ignored: "Missing identifiers" });
  }

  const order = await resolveOrder(shipmentExternalId, boxtalOrderId);
  if (!order?._id) {
    await updateWebhookEvent("boxtal", eventId, "ignored");
    return NextResponse.json({ received: true, ignored: "Order not found" });
  }

  try {
    const seed = {
      boxtalOrderId: boxtalOrderId || order.boxtalShipment?.boxtalOrderId,
      shippingOfferCode: order.boxtalShipment?.shippingOfferCode,
      relayCode: order.shippingRelay?.code,
    };
    const webhookShipment = normalizeBoxtalWebhookShipment(payload, seed);
    const shipment = hasBoxtalShipmentDetails(webhookShipment)
      ? webhookShipment
      : await syncBoxtalShipment(order, seed);

    const updated = await updateOrderFields(order._id, buildOrderPatch(order, shipment));
    try {
      await maybeSendTrackingEmail(order, shipment);
    } catch {
      // Non-blocking: Boxtal webhook should remain acknowledged even if email fails.
    }

    await updateWebhookEvent("boxtal", eventId, "processed");

    return NextResponse.json({
      received: true,
      eventType,
      orderId: updated?._id || order._id,
      boxtalOrderId: shipment.boxtalOrderId || boxtalOrderId,
    });
  } catch (error) {
    const message =
      error instanceof BoxtalApiError
        ? error.message
        : "Failed to sync Boxtal webhook event";

    await updateOrderFields(order._id, {
      boxtalShipment: {
        ...(order.boxtalShipment || {}),
        lastError: message,
        updatedAt: new Date().toISOString(),
      },
    });
    await updateWebhookEvent("boxtal", eventId, "failed", message);

    return NextResponse.json(
      {
        error: message,
        detail: error instanceof BoxtalApiError ? error.detail : undefined,
      },
      { status: error instanceof BoxtalApiError ? error.status : 500 },
    );
  }
}
