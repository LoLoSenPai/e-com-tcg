import { NextRequest, NextResponse } from "next/server";
import { getCheckoutSessionByStripeId } from "@/lib/checkout-sessions";
import { getOrderByStripeSessionId } from "@/lib/orders";
import { getEmailEventsByStripeSessionId } from "@/lib/email-events";
import { toPublicCheckoutStatus } from "@/lib/checkout-status";
import { normalizeStripeCheckoutSessionId } from "@/lib/stripe-checkout";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

export async function GET(request: NextRequest) {
  const sessionId = normalizeStripeCheckoutSessionId(
    request.nextUrl.searchParams.get("session_id"),
  );
  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing or invalid session_id" },
      { status: 400, headers: noStoreHeaders },
    );
  }
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: "Missing MONGODB_URI" },
      { status: 500, headers: noStoreHeaders },
    );
  }

  const [checkoutSession, order, emailEvents] = await Promise.all([
    getCheckoutSessionByStripeId(sessionId),
    getOrderByStripeSessionId(sessionId),
    getEmailEventsByStripeSessionId(sessionId),
  ]);

  if (!checkoutSession && !order) {
    return NextResponse.json(
      { error: "Checkout session not found" },
      { status: 404, headers: noStoreHeaders },
    );
  }

  return NextResponse.json(
    toPublicCheckoutStatus({ checkoutSession, order, emailEvents }),
    { headers: noStoreHeaders },
  );
}
