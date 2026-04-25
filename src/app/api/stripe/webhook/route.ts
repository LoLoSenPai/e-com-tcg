import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createOrder, getOrderByStripeSessionId, updateOrderFields } from "@/lib/orders";
import { sendTrackedEmail } from "@/lib/email";
import {
  getCheckoutSessionByStripeId,
  markCheckoutSessionOrderCreated,
  markCheckoutSessionPaid,
} from "@/lib/checkout-sessions";
import { buildOrderConfirmationEmail } from "@/lib/email-templates";
import { decrementProductStocks } from "@/lib/products";
import { beginWebhookEvent, updateWebhookEvent } from "@/lib/webhook-events";
import type { OrderItem, ShippingRelayPoint } from "@/lib/types";

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
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const begin = await beginWebhookEvent({
      provider: "stripe",
      eventId: event.id,
      eventType: event.type,
      objectId: (event.data.object as Stripe.Checkout.Session).id,
    });
    if (!begin.inserted && begin.event?.status === "processed") {
      return NextResponse.json({ received: true });
    }

    try {
      const session = event.data.object as Stripe.Checkout.Session;
      const existing = await getOrderByStripeSessionId(session.id);
      if (existing) {
        await updateWebhookEvent("stripe", event.id, "processed");
        return NextResponse.json({ received: true });
      }

      const checkoutSession = await getCheckoutSessionByStripeId(session.id);
      const lineItems = checkoutSession
        ? null
        : await stripe.checkout.sessions.listLineItems(session.id);
      const fallbackItems: OrderItem[] = (lineItems?.data || []).map((item) => ({
        name: item.description || "Produit",
        quantity: item.quantity || 1,
        unitAmount: item.price?.unit_amount || 0,
      }));
      const items: OrderItem[] =
        checkoutSession?.items.map((item) => ({
          slug: item.slug,
          name: item.name,
          quantity: item.quantity,
          unitAmount: item.unitAmount,
        })) || fallbackItems;

      const now = new Date().toISOString();
      let shippingRateLabel: string | undefined;
      if (session.shipping_cost?.shipping_rate) {
        try {
          const rate = await stripe.shippingRates.retrieve(
            session.shipping_cost.shipping_rate.toString(),
          );
          shippingRateLabel = rate.display_name || undefined;
        } catch {
          shippingRateLabel = undefined;
        }
      }

      const metadata = session.metadata || {};
      const shippingRelay: ShippingRelayPoint | undefined =
        checkoutSession?.shippingRelay ||
        (metadata.deliveryMode === "relay" && metadata.relayCode
          ? {
              code: metadata.relayCode,
              name: metadata.relayName || metadata.relayCode,
              network: metadata.relayNetwork || undefined,
              address: {
                line1: metadata.relayLine1 || undefined,
                zipCode: metadata.relayZipCode || undefined,
                city: metadata.relayCity || undefined,
                country: metadata.relayCountry || undefined,
              },
              latitude: metadata.relayLat ? Number(metadata.relayLat) : undefined,
              longitude: metadata.relayLng ? Number(metadata.relayLng) : undefined,
            }
          : undefined);
      const customerEmail = session.customer_details?.email?.toLowerCase();
      const shippingAmount = session.total_details?.amount_shipping || 0;

      await markCheckoutSessionPaid({
        stripeSessionId: session.id,
        amountTotal: session.amount_total || 0,
        shippingAmount,
        customerEmail,
      });

      const created = await createOrder({
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent?.toString(),
        customerId: checkoutSession?.customerId || metadata.customerId || undefined,
        status: "paid",
        amountTotal: session.amount_total || 0,
        shippingAmount,
        shippingRateLabel,
        currency: session.currency || "eur",
        customerEmail,
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
        shippingRelay,
        items,
        createdAt: now,
        updatedAt: now,
      });

      const stockAdjustments = checkoutSession?.items.length
        ? await decrementProductStocks(checkoutSession.items)
        : [];
      const order =
        created._id && stockAdjustments.length > 0
          ? await updateOrderFields(created._id, { stockAdjustments })
          : created;

      if (created._id) {
        await markCheckoutSessionOrderCreated({
          stripeSessionId: session.id,
          orderId: created._id,
          stockAdjustments,
        });
      }

      const emailOrder = order || created;
      const email = buildOrderConfirmationEmail(emailOrder);
      try {
        await sendTrackedEmail({
          type: "order_confirmation",
          orderId: created._id,
          stripeSessionId: session.id,
          to: customerEmail,
          subject: email.subject,
          html: email.html,
        });
      } catch {
        // Non-blocking: order saved and email_events contains the failure.
      }

      await updateWebhookEvent("stripe", event.id, "processed");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Stripe webhook processing failed";
      await updateWebhookEvent("stripe", event.id, "failed", message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  } else {
    const begin = await beginWebhookEvent({
      provider: "stripe",
      eventId: event.id,
      eventType: event.type,
      objectId: "id" in event.data.object ? String(event.data.object.id) : undefined,
    });
    if (begin.inserted) {
      await updateWebhookEvent("stripe", event.id, "ignored");
    }
  }

  return NextResponse.json({ received: true });
}
