import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import { createBoxtalShipment, BoxtalApiError } from "@/lib/boxtal";
import { getOrderById, updateOrderFields } from "@/lib/orders";

function isAuthorized(request: NextRequest) {
  const sessionValue = request.cookies.get(adminCookieName)?.value;
  return isAdminSession(sessionValue);
}

export const runtime = "nodejs";

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
    const shipment = await createBoxtalShipment(order, shippingOfferCode);
    const now = new Date().toISOString();

    const updated = await updateOrderFields(id, {
      boxtalShipment: {
        boxtalOrderId: shipment.boxtalOrderId,
        shippingOfferCode: shipment.shippingOfferCode,
        status: shipment.status,
        carrier: shipment.carrier,
        trackingNumber: shipment.trackingNumber,
        trackingUrl: shipment.trackingUrl,
        labelUrl: shipment.labelUrl,
        relayCode: shipment.relayCode,
        createdAt: order.boxtalShipment?.createdAt || now,
        updatedAt: now,
      },
      shippingTracking:
        shipment.trackingNumber || shipment.trackingUrl
          ? {
              carrier: shipment.carrier || order.shippingTracking?.carrier,
              trackingNumber:
                shipment.trackingNumber || order.shippingTracking?.trackingNumber,
              trackingUrl: shipment.trackingUrl || order.shippingTracking?.trackingUrl,
            }
          : order.shippingTracking,
      status:
        shipment.trackingNumber || shipment.trackingUrl ? "shipped" : order.status,
      shippedAt:
        shipment.trackingNumber || shipment.trackingUrl
          ? order.shippedAt || now
          : order.shippedAt,
    });

    return NextResponse.json({
      order: updated,
      shipment,
    });
  } catch (error) {
    const now = new Date().toISOString();
    if (error instanceof BoxtalApiError) {
      await updateOrderFields(id, {
        boxtalShipment: {
          ...(order.boxtalShipment || {}),
          shippingOfferCode:
            shippingOfferCode || order.boxtalShipment?.shippingOfferCode,
          lastError: `${error.message}`,
          updatedAt: now,
        },
      });
      return NextResponse.json(
        {
          error: error.message,
          detail: error.detail,
        },
        { status: error.status || 502 },
      );
    }

    await updateOrderFields(id, {
      boxtalShipment: {
        ...(order.boxtalShipment || {}),
        shippingOfferCode:
          shippingOfferCode || order.boxtalShipment?.shippingOfferCode,
        lastError: "Unknown Boxtal error",
        updatedAt: now,
      },
    });
    return NextResponse.json(
      { error: "Failed to create Boxtal shipment" },
      { status: 502 },
    );
  }
}
