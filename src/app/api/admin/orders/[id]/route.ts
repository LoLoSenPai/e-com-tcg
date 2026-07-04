import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import { getOrderById, updateOrderFields } from "@/lib/orders";
import { getEmailEventsByOrderId } from "@/lib/email-events";
import { sendOrderEmail } from "@/lib/order-email";
import {
  hasAnyTrackingValue,
  hasTrackingDeliveryDetails,
  isSafeTrackingUrl,
  normalizeTrackingDetails,
  type TrackingDetails,
} from "@/lib/order-tracking";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

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

function cleanOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders },
    );
  }
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: "MONGODB_URI missing" },
      { status: 400, headers: noStoreHeaders },
    );
  }
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: noStoreHeaders },
    );
  }
  const emailEvents = await getEmailEventsByOrderId(id);
  return NextResponse.json({ order, emailEvents }, { headers: noStoreHeaders });
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

  const tracking =
    body?.shippingTracking && typeof body.shippingTracking === "object"
    ? {
        carrier: cleanOptionalString(body.shippingTracking.carrier),
        trackingNumber: cleanOptionalString(body.shippingTracking.trackingNumber),
        trackingUrl: cleanOptionalString(body.shippingTracking.trackingUrl),
      }
    : undefined;
  if (
    tracking?.trackingUrl &&
    !isSafeTrackingUrl(tracking.trackingUrl)
  ) {
    return NextResponse.json(
      { error: "Tracking URL must start with http:// or https://" },
      { status: 400 },
    );
  }
  const normalizedTracking = normalizeTrackingDetails(tracking);

  const { id } = await params;
  const existingOrder = await getOrderById(id);
  if (!existingOrder) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const hasNewTrackingValue = hasAnyTrackingValue(normalizedTracking);
  const hasNewTrackingDetails = hasTrackingDeliveryDetails(normalizedTracking);
  const hasExistingTrackingDetails = hasTrackingDeliveryDetails(
    existingOrder.shippingTracking,
  );
  if (tracking && !hasNewTrackingValue) {
    return NextResponse.json(
      { error: "Tracking carrier, number or URL is required" },
      { status: 400 },
    );
  }
  if (
    (status === "shipped" || status === "delivered") &&
    !hasNewTrackingDetails &&
    !hasExistingTrackingDetails
  ) {
    return NextResponse.json(
      {
        error:
          "Tracking number or URL is required before marking shipped or delivered",
      },
      { status: 400 },
    );
  }

  const payload: {
    status?: OrderStatus;
    shippingTracking?: TrackingDetails;
    shippedAt?: string;
  } = {};
  if (status) {
    payload.status = status;
    if (status === "shipped" || status === "delivered") {
      payload.shippedAt = new Date().toISOString();
    }
  }
  if (tracking) {
    payload.shippingTracking = normalizedTracking;
    if (
      hasNewTrackingDetails &&
      (!status || (status !== "shipped" && status !== "delivered"))
    ) {
      payload.status = "shipped";
      payload.shippedAt = new Date().toISOString();
    }
  }
  const updated = await updateOrderFields(id, payload);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const hasUpdatedTrackingDetails = hasTrackingDeliveryDetails(
    updated.shippingTracking,
  );
  if (
    tracking &&
    (payload.status === "shipped" || payload.status === "delivered") &&
    hasUpdatedTrackingDetails
  ) {
    try {
      await sendOrderEmail(updated, "shipping_tracking", {
        idempotencyParts: [
          updated._id,
          updated.shippingTracking?.trackingNumber ||
          updated.shippingTracking?.trackingUrl,
        ],
      });
    } catch {
      // Non-blocking: the email_events collection records the failure.
    }
  }

  return NextResponse.json({ order: updated });
}
