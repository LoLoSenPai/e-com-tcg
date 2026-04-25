import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import { getOrderById } from "@/lib/orders";
import { sendTrackedEmail } from "@/lib/email";
import {
  buildOrderConfirmationEmail,
  buildTrackingEmail,
} from "@/lib/email-templates";

function isAuthorized(request: NextRequest) {
  const sessionValue = request.cookies.get(adminCookieName)?.value;
  return isAdminSession(sessionValue);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!order.customerEmail) {
    return NextResponse.json(
      { error: "Order has no customer email" },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const type =
    body?.type === "shipping_tracking" ? "shipping_tracking" : "order_confirmation";
  const template =
    type === "shipping_tracking"
      ? buildTrackingEmail(order)
      : buildOrderConfirmationEmail(order);

  try {
    const event = await sendTrackedEmail({
      type,
      orderId: order._id,
      stripeSessionId: order.stripeSessionId,
      to: order.customerEmail,
      subject: template.subject,
      html: template.html,
    });
    return NextResponse.json({ event });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to send order email",
      },
      { status: 502 },
    );
  }
}
