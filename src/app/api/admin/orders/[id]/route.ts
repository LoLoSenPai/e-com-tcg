import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import { getOrderById, updateOrderFields } from "@/lib/orders";
import { sendOrderEmail } from "@/lib/email";
import type { OrderStatus } from "@/lib/types";

function isAuthorized(request: NextRequest) {
  const sessionValue = request.cookies.get(adminCookieName)?.value;
  return isAdminSession(sessionValue);
}

const validStatuses: OrderStatus[] = [
  "paid",
  "preparation",
  "shipped",
  "delivered",
];

export async function GET(
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
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ order });
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
  const body = await request.json().catch(() => ({}));
  const status = body?.status as OrderStatus | undefined;
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const tracking = body?.shippingTracking
    ? {
        carrier: body.shippingTracking.carrier,
        trackingNumber: body.shippingTracking.trackingNumber,
        trackingUrl: body.shippingTracking.trackingUrl,
      }
    : undefined;

  const { id } = await params;
  const payload: {
    status?: OrderStatus;
    shippingTracking?: typeof tracking;
    shippedAt?: string;
  } = {};
  if (status) {
    payload.status = status;
    if (status === "shipped") {
      payload.shippedAt = new Date().toISOString();
    }
  }
  if (tracking) {
    payload.shippingTracking = tracking;
    if (!status || status !== "shipped") {
      payload.status = "shipped";
      payload.shippedAt = new Date().toISOString();
    }
  }
  const updated = await updateOrderFields(id, payload);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (status === "shipped" && updated.customerEmail) {
    try {
      await sendOrderEmail({
        to: updated.customerEmail,
        subject: "Votre commande a ete expediee",
        html:
          "<p>Bonne nouvelle ! Votre commande est expediee.</p>" +
          (tracking?.trackingUrl
            ? `<p>Suivi: <a href="${tracking.trackingUrl}">${tracking.trackingUrl}</a></p>`
            : ""),
      });
    } catch {
      // Ignore email failures in admin flow.
    }
  }

  return NextResponse.json({ order: updated });
}
