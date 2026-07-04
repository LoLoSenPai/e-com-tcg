import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import { getOrderById } from "@/lib/orders";
import {
  getOrderEmailSendProblem,
  sendOrderEmail,
} from "@/lib/order-email";

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
  const body = await request.json().catch(() => ({}));
  const type =
    body?.type === "shipping_tracking" ? "shipping_tracking" : "order_confirmation";
  const problem = getOrderEmailSendProblem(order, type);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  try {
    const event = await sendOrderEmail(order, type, {
      skipIdempotencyKey: true,
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
