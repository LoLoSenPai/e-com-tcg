import { NextRequest, NextResponse } from "next/server";
import { getCheckoutSessionByStripeId } from "@/lib/checkout-sessions";
import { getOrderByStripeSessionId } from "@/lib/orders";
import { getEmailEventsByStripeSessionId } from "@/lib/email-events";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing session_id" },
      { status: 400 },
    );
  }
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: "Missing MONGODB_URI" },
      { status: 500 },
    );
  }

  const [checkoutSession, order, emailEvents] = await Promise.all([
    getCheckoutSessionByStripeId(sessionId),
    getOrderByStripeSessionId(sessionId),
    getEmailEventsByStripeSessionId(sessionId),
  ]);

  return NextResponse.json({
    checkoutSession,
    order,
    emailEvents,
  });
}
