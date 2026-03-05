import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import {
  createBoxtalShipment,
  syncBoxtalShipment,
  BoxtalApiError,
} from "@/lib/boxtal";
import { getOrderById, updateOrderFields } from "@/lib/orders";
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

  const body = await request.json().catch(() => ({}));
  const shippingOfferCode =
    typeof body?.shippingOfferCode === "string" ? body.shippingOfferCode : undefined;

  try {
    const createdShipment = await createBoxtalShipment(order, shippingOfferCode);
    let shipment = createdShipment;
    let warning: string | undefined;

    if (createdShipment.boxtalOrderId) {
      try {
        shipment = await syncBoxtalShipment(order, createdShipment);
      } catch (error) {
        warning =
          "Expedition creee, mais la synchronisation Boxtal n'est pas encore disponible. Reessaie dans quelques instants ou attends le webhook.";
        if (!(error instanceof BoxtalApiError)) {
          throw error;
        }
      }
    }

    const updated = await persistShipmentUpdate(id, order, shipment);

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
