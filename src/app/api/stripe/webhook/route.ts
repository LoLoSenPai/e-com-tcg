import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import {
  createOrderWithStockAdjustments,
  getOrderByStripeSessionId,
} from "@/lib/orders";
import { sendTrackedEmail } from "@/lib/email";
import { getEmailEventsByStripeSessionId } from "@/lib/email-events";
import { hasFinalOrderConfirmationAttempt } from "@/lib/email-delivery";
import {
  getCheckoutSessionByStripeId,
  markCheckoutSessionOrderCreated,
  markCheckoutSessionPaid,
} from "@/lib/checkout-sessions";
import { buildOrderConfirmationEmail } from "@/lib/email-templates";
import { beginWebhookEvent, updateWebhookEvent } from "@/lib/webhook-events";
import type { Order, OrderItem, ShippingRelayPoint } from "@/lib/types";

export const runtime = "nodejs";

async function sendOrderConfirmationIfMissing(order: Order) {
  if (!order.customerEmail) {
    return;
  }

  const emailEvents = await getEmailEventsByStripeSessionId(
    order.stripeSessionId,
  ).catch(() => []);
  const alreadyAttempted = hasFinalOrderConfirmationAttempt(emailEvents);
  if (alreadyAttempted) {
    return;
  }

  const email = buildOrderConfirmationEmail(order);
  await sendTrackedEmail({
    type: "order_confirmation",
    orderId: order._id,
    stripeSessionId: order.stripeSessionId,
    to: order.customerEmail,
    subject: email.subject,
    html: email.html,
  });
}

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
    if (!begin.shouldProcess) {
      return NextResponse.json(
        {
          received: true,
          skipped: begin.busy ? "processing" : begin.event?.status,
        },
        { status: begin.busy ? 409 : 200 },
      );
    }

    try {
      const session = event.data.object as Stripe.Checkout.Session;
      const existing = await getOrderByStripeSessionId(session.id);
      if (existing) {
        await sendOrderConfirmationIfMissing(existing).catch(() => {
          // Non-blocking: order is already saved and email_events logs failures.
        });
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
      const customerEmail = (
        session.customer_details?.email ||
        session.customer_email ||
        checkoutSession?.customerEmail ||
        undefined
      )?.toLowerCase();
      const shippingAmount = session.total_details?.amount_shipping || 0;

      await markCheckoutSessionPaid({
        stripeSessionId: session.id,
        amountTotal: session.amount_total || 0,
        shippingAmount,
        customerEmail,
      });

      const createResult = await createOrderWithStockAdjustments({
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
      }, checkoutSession?.items || []);
      const created = createResult.order;

      if (!createResult.inserted) {
        if (created._id) {
          await markCheckoutSessionOrderCreated({
            stripeSessionId: session.id,
            orderId: created._id,
            stockAdjustments: created.stockAdjustments || [],
          });
        }
        await sendOrderConfirmationIfMissing(created).catch(() => {
          // Non-blocking: order is already saved and email_events logs failures.
        });
        await updateWebhookEvent("stripe", event.id, "processed");
        return NextResponse.json({ received: true });
      }

      if (created._id) {
        await markCheckoutSessionOrderCreated({
          stripeSessionId: session.id,
          orderId: created._id,
          stockAdjustments: createResult.stockAdjustments,
        });
      }

      try {
        await sendOrderConfirmationIfMissing(created);
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
    if (!begin.shouldProcess) {
      return NextResponse.json(
        {
          received: true,
          skipped: begin.busy ? "processing" : begin.event?.status,
        },
        { status: begin.busy ? 409 : 200 },
      );
    }
    if (begin.inserted || begin.shouldProcess) {
      await updateWebhookEvent("stripe", event.id, "ignored");
    }
  }

  return NextResponse.json({ received: true });
}
