import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createOrder } from "@/lib/orders";
import { sendOrderEmail } from "@/lib/email";
import type { OrderItem } from "@/lib/types";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 500 },
    );
  }

  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    const items: OrderItem[] = (lineItems.data || []).map((item) => ({
      name: item.description || "Produit",
      quantity: item.quantity || 1,
      unitAmount: item.price?.unit_amount || 0,
    }));

    const db = await getDb();
    const existing = await db
      .collection("orders")
      .findOne({ stripeSessionId: session.id });
    if (existing) {
      return NextResponse.json({ received: true });
    }

    const now = new Date().toISOString();
    await createOrder({
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent?.toString(),
      status: "paid",
      amountTotal: session.amount_total || 0,
      currency: session.currency || "eur",
      customerEmail: session.customer_details?.email || undefined,
      customerName: session.customer_details?.name || undefined,
      customerPhone: session.customer_details?.phone || undefined,
      shippingAddress: session.customer_details?.address
        ? {
            line1: session.customer_details.address.line1 || undefined,
            line2: session.customer_details.address.line2 || undefined,
            postalCode: session.customer_details.address.postal_code || undefined,
            city: session.customer_details.address.city || undefined,
            state: session.customer_details.address.state || undefined,
            country: session.customer_details.address.country || undefined,
          }
        : undefined,
      items,
      createdAt: now,
      updatedAt: now,
    });

    if (session.customer_details?.email) {
      try {
        await sendOrderEmail({
          to: session.customer_details.email,
          subject: "Merci pour votre commande Nebula TCG",
          html: "<p>Merci pour votre commande !</p><p>Nous preparons votre colis et vous tiendrons informe de l'expedition.</p>",
        });
      } catch {
        // Non-blocking: order saved even if email fails.
      }
    }
  }

  return NextResponse.json({ received: true });
}
