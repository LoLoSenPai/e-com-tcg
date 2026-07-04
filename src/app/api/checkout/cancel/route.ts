import { NextRequest, NextResponse } from "next/server";
import {
  getCheckoutSessionByStripeId,
  isCheckoutSessionPaymentLocked,
  releaseCheckoutSessionStock,
} from "@/lib/checkout-sessions";
import { toPublicCheckoutSessionStatus } from "@/lib/checkout-status";
import { getStripe } from "@/lib/stripe";
import { normalizeStripeCheckoutSessionId } from "@/lib/stripe-checkout";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const stripeSessionId = normalizeStripeCheckoutSessionId(body?.sessionId);
  if (!stripeSessionId) {
    return NextResponse.json(
      { error: "Invalid checkout session id" },
      { status: 400, headers: noStoreHeaders },
    );
  }

  if (!process.env.MONGODB_URI || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Checkout cancellation unavailable" },
      { status: 503, headers: noStoreHeaders },
    );
  }

  const checkoutSession = await getCheckoutSessionByStripeId(stripeSessionId);
  if (!checkoutSession) {
    return NextResponse.json(
      { error: "Checkout session not found" },
      { status: 404, headers: noStoreHeaders },
    );
  }

  if (isCheckoutSessionPaymentLocked(checkoutSession.status)) {
    return NextResponse.json(
      { released: false, skipped: checkoutSession.status },
      { headers: noStoreHeaders },
    );
  }

  const stripe = getStripe();
  try {
    await stripe.checkout.sessions.expire(stripeSessionId);
  } catch {
    const stripeSession = await stripe.checkout.sessions
      .retrieve(stripeSessionId)
      .catch(() => null);

    if (stripeSession?.status === "complete") {
      return NextResponse.json(
        { released: false, skipped: "paid" },
        { headers: noStoreHeaders },
      );
    }

    if (stripeSession?.status !== "expired") {
      return NextResponse.json(
        { error: "Unable to expire checkout session" },
        { status: 502, headers: noStoreHeaders },
      );
    }
  }

  const result = await releaseCheckoutSessionStock({
    stripeSessionId,
    reason: "stripe_checkout_cancelled",
  });

  return NextResponse.json(
    {
      released: result.released,
      checkoutSession: toPublicCheckoutSessionStatus(result.checkoutSession),
    },
    { headers: noStoreHeaders },
  );
}
