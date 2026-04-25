import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { syncBoxtalShipment, BoxtalApiError } from "@/lib/boxtal";
import {
  getOrderByBoxtalOrderId,
  getOrderById,
  getOrderByStripeSessionId,
  updateOrderFields,
} from "@/lib/orders";
import { sendTrackedEmail } from "@/lib/email";
import { buildTrackingEmail } from "@/lib/email-templates";
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

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
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
  const hasTracking = Boolean(shipment.trackingNumber || shipment.trackingUrl);

  return {
    boxtalShipment: {
      ...(order.boxtalShipment || {}),
      boxtalOrderId: shipment.boxtalOrderId || order.boxtalShipment?.boxtalOrderId,
      shippingOfferCode:
        shipment.shippingOfferCode || order.boxtalShipment?.shippingOfferCode,
      status: shipment.status || order.boxtalShipment?.status,
      carrier: shipment.carrier || order.boxtalShipment?.carrier,
      trackingNumber:
        shipment.trackingNumber || order.boxtalShipment?.trackingNumber,
      trackingUrl: shipment.trackingUrl || order.boxtalShipment?.trackingUrl,
      labelUrl: shipment.labelUrl || order.boxtalShipment?.labelUrl,
      relayCode: shipment.relayCode || order.boxtalShipment?.relayCode,
      createdAt: order.boxtalShipment?.createdAt || now,
      updatedAt: now,
      lastError: "",
    },
    shippingTracking:
      hasTracking || order.shippingTracking
        ? {
            carrier: shipment.carrier || order.shippingTracking?.carrier,
            trackingNumber:
              shipment.trackingNumber || order.shippingTracking?.trackingNumber,
            trackingUrl: shipment.trackingUrl || order.shippingTracking?.trackingUrl,
          }
        : order.shippingTracking,
    status: hasTracking ? "shipped" : order.status,
    shippedAt: hasTracking ? order.shippedAt || now : order.shippedAt,
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
  const hasTrackingNow = Boolean(shipment.trackingNumber || shipment.trackingUrl);

  if (!order.customerEmail || hadTrackingBefore || !hasTrackingNow) {
    return;
  }

  const email = buildTrackingEmail({
    ...order,
    shippingTracking: {
      carrier: shipment.carrier || order.shippingTracking?.carrier,
      trackingNumber:
        shipment.trackingNumber || order.shippingTracking?.trackingNumber,
      trackingUrl: shipment.trackingUrl || order.shippingTracking?.trackingUrl,
    },
  });

  await sendTrackedEmail({
    type: "shipping_tracking",
    orderId: order._id,
    stripeSessionId: order.stripeSessionId,
    to: order.customerEmail,
    subject: email.subject,
    html: email.html,
  });
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

  const eventType = readString(payload.type);
  const shipmentExternalId = readString(payload.shipmentExternalId);
  const boxtalOrderId = readString(payload.shippingOrderId);
  const eventId =
    readString(payload.id) ||
    `${eventType || "boxtal-event"}:${shipmentExternalId || boxtalOrderId || rawPayload.slice(0, 64)}`;

  const begin = await beginWebhookEvent({
    provider: "boxtal",
    eventId,
    eventType: eventType || "unknown",
    objectId: shipmentExternalId || boxtalOrderId,
  });
  if (!begin.inserted && begin.event?.status === "processed") {
    return NextResponse.json({ received: true });
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
    const shipment = await syncBoxtalShipment(order, {
      boxtalOrderId,
      relayCode: order.shippingRelay?.code,
    });

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
