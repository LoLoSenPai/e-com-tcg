import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import {
  createBoxtalShipment,
  syncBoxtalShipment,
  BoxtalApiError,
} from "@/lib/boxtal";
import { getOrderById, updateOrderFields } from "@/lib/orders";
import {
  hasOrderTrackingDeliveryDetails,
  hasTrackingDeliveryDetails,
  normalizeTrackingDetails,
  normalizeTrackingUrl,
} from "@/lib/order-tracking";
import { sendOrderEmail } from "@/lib/order-email";
import type { Order } from "@/lib/types";

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

function isAuthorized(request: NextRequest) {
  const sessionValue = request.cookies.get(adminCookieName)?.value;
  return isAdminSession(sessionValue);
}

export const runtime = "nodejs";

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

async function persistShipmentUpdate(
  orderId: string,
  order: Order,
  shipment: ShipmentPatchInput,
) {
  return updateOrderFields(orderId, buildOrderPatch(order, shipment));
}

async function persistBoxtalError(
  orderId: string,
  order: Order,
  message: string,
  shippingOfferCode?: string,
) {
  const now = new Date().toISOString();
  return updateOrderFields(orderId, {
    boxtalShipment: {
      ...(order.boxtalShipment || {}),
      shippingOfferCode:
        shippingOfferCode || order.boxtalShipment?.shippingOfferCode,
      lastError: message,
      updatedAt: now,
    },
  });
}

async function sendTrackingEmailIfNew(order: Order, shipment: ShipmentPatchInput) {
  if (hasOrderTrackingDeliveryDetails(order)) {
    return;
  }

  const tracking = normalizeTrackingDetails({
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    trackingUrl: shipment.trackingUrl,
  });
  if (!hasTrackingDeliveryDetails(tracking)) {
    return;
  }

  await sendOrderEmail(
    {
      ...order,
      shippingTracking: {
        carrier: tracking?.carrier || order.shippingTracking?.carrier,
        trackingNumber:
          tracking?.trackingNumber || order.shippingTracking?.trackingNumber,
        trackingUrl: tracking?.trackingUrl || order.shippingTracking?.trackingUrl,
      },
    },
    "shipping_tracking",
    {
      idempotencyParts: [
        order._id,
        tracking?.trackingNumber || tracking?.trackingUrl,
      ],
    },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: "MONGODB_URI missing" },
      { status: 400 },
    );
  }

  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.boxtalShipment?.boxtalOrderId) {
    return NextResponse.json(
      {
        error: "A Boxtal shipment already exists for this order",
        shipment: order.boxtalShipment,
      },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const shippingOfferCode =
    typeof body?.shippingOfferCode === "string" ? body.shippingOfferCode : undefined;

  try {
    const createdShipment = await createBoxtalShipment(order, shippingOfferCode);
    let shipment = createdShipment;
    let warning: string | undefined;
    let persistedOrder = order;
    let syncFailedAfterCreation = false;

    if (createdShipment.boxtalOrderId) {
      persistedOrder =
        (await persistShipmentUpdate(id, order, createdShipment)) || order;
      try {
        shipment = await syncBoxtalShipment(persistedOrder, createdShipment);
      } catch (error) {
        warning =
          "Expedition creee, mais la synchronisation Boxtal n'est pas encore disponible. Reessaie dans quelques instants ou attends le webhook.";
        syncFailedAfterCreation = true;
        await persistBoxtalError(
          id,
          persistedOrder,
          error instanceof Error ? error.message : "Boxtal sync failed",
          shippingOfferCode,
        );
      }
    }

    const updated = syncFailedAfterCreation
      ? await getOrderById(id)
      : await persistShipmentUpdate(id, persistedOrder, shipment);
    await sendTrackingEmailIfNew(order, shipment).catch(() => {
      // Non-blocking: the email_events collection records the failure.
    });

    return NextResponse.json({
      order: updated,
      shipment,
      warning,
    });
  } catch (error) {
    if (error instanceof BoxtalApiError) {
      await persistBoxtalError(id, order, `${error.message}`, shippingOfferCode);
      return NextResponse.json(
        {
          error: error.message,
          detail: error.detail,
        },
        { status: error.status || 502 },
      );
    }

    await persistBoxtalError(id, order, "Unknown Boxtal error", shippingOfferCode);
    return NextResponse.json(
      { error: "Failed to create Boxtal shipment" },
      { status: 502 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: "MONGODB_URI missing" },
      { status: 400 },
    );
  }

  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  try {
    const shipment = await syncBoxtalShipment(order);
    const updated = await persistShipmentUpdate(id, order, shipment);
    await sendTrackingEmailIfNew(order, shipment).catch(() => {
      // Non-blocking: the email_events collection records the failure.
    });
    return NextResponse.json({
      order: updated,
      shipment,
    });
  } catch (error) {
    if (error instanceof BoxtalApiError) {
      await persistBoxtalError(id, order, `${error.message}`);
      return NextResponse.json(
        {
          error: error.message,
          detail: error.detail,
        },
        { status: error.status || 502 },
      );
    }

    await persistBoxtalError(id, order, "Unknown Boxtal sync error");
    return NextResponse.json(
      { error: "Failed to sync Boxtal shipment" },
      { status: 502 },
    );
  }
}
