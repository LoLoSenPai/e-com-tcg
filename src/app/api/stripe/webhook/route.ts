import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import {
  createOrderWithStockAdjustments,
  hasFailedStockAdjustment,
  getOrderByStripeSessionId,
} from "@/lib/orders";
import { getEmailEventsByStripeSessionId } from "@/lib/email-events";
import { hasFinalOrderConfirmationAttempt } from "@/lib/email-delivery";
import { isFinalOrderEmailStatus } from "@/lib/order-email-status";
import {
  getCheckoutSessionByStripeId,
  hasActiveCheckoutStockReservation,
  markCheckoutSessionFulfillmentFailed,
  markCheckoutSessionOrderCreated,
  markCheckoutSessionPaymentReceived,
  releaseCheckoutSessionStock,
} from "@/lib/checkout-sessions";
import {
  buildOrderItemsFromStripeLineItems,
  getOrderItemsMissingStockSlug,
  getStockItemsFromOrderItems,
  isCheckoutExpirationEvent,
  isCheckoutFulfillmentEvent,
  shouldFulfillCheckoutSession,
} from "@/lib/stripe-checkout";
import { sendOrderEmail } from "@/lib/order-email";
import { beginWebhookEvent, updateWebhookEvent } from "@/lib/webhook-events";
import type { Order, OrderItem, ShippingRelayPoint } from "@/lib/types";

export const runtime = "nodejs";

async function sendOrderConfirmationIfMissing(order: Order) {
  const emailEvents = await getEmailEventsByStripeSessionId(
    order.stripeSessionId,
  ).catch(() => []);
  const alreadyAttempted = hasFinalOrderConfirmationAttempt(emailEvents);
  const orderEmailStatus = order.emailStatus?.orderConfirmation?.status;
  if (alreadyAttempted || isFinalOrderEmailStatus(orderEmailStatus)) {
    return;
  }

  await sendOrderEmail(order, "order_confirmation");
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

  if (isCheckoutExpirationEvent(event.type)) {
    const session = event.data.object as Stripe.Checkout.Session;
    const begin = await beginWebhookEvent({
      provider: "stripe",
      eventId: event.id,
      eventType: event.type,
      objectId: session.id,
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
      await releaseCheckoutSessionStock({
        stripeSessionId: session.id,
        reason: "stripe_checkout_expired",
      });
      await updateWebhookEvent("stripe", event.id, "processed");
      return NextResponse.json({ received: true });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Stripe checkout expiration processing failed";
      await updateWebhookEvent("stripe", event.id, "failed", message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (isCheckoutFulfillmentEvent(event.type)) {
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

    let stripeSessionIdForFailure: string | undefined;
    try {
      const session = event.data.object as Stripe.Checkout.Session;
      stripeSessionIdForFailure = session.id;
      if (!shouldFulfillCheckoutSession(session.payment_status)) {
        await updateWebhookEvent(
          "stripe",
          event.id,
          "ignored",
          `Checkout session payment_status=${session.payment_status || "unknown"}`,
        );
        return NextResponse.json({
          received: true,
          skipped: "payment_not_paid",
        });
      }

      const existing = await getOrderByStripeSessionId(session.id);
      if (existing) {
        if (hasFailedStockAdjustment(existing.stockAdjustments)) {
          if (existing._id) {
            await markCheckoutSessionOrderCreated({
              stripeSessionId: session.id,
              orderId: existing._id,
              stockAdjustments: existing.stockAdjustments || [],
            }).catch(() => undefined);
          }
          throw new Error(
            `Order ${existing._id || session.id} has failed stock adjustments.`,
          );
        }
        if (existing._id) {
          await markCheckoutSessionOrderCreated({
            stripeSessionId: session.id,
            orderId: existing._id,
            stockAdjustments: existing.stockAdjustments || [],
          }).catch(() => undefined);
        }
        await sendOrderConfirmationIfMissing(existing).catch(() => {
          // Non-blocking: order is already saved and email_events logs failures.
        });
        await updateWebhookEvent("stripe", event.id, "processed");
        return NextResponse.json({ received: true });
      }

      const checkoutSession = await getCheckoutSessionByStripeId(session.id);
      const lineItems = checkoutSession
        ? null
        : await stripe.checkout.sessions.listLineItems(session.id, {
            limit: 100,
            expand: ["data.price.product"],
          });
      const fallbackItems: OrderItem[] = buildOrderItemsFromStripeLineItems(
        lineItems?.data || [],
      );
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

      await markCheckoutSessionPaymentReceived({
        stripeSessionId: session.id,
        amountTotal: session.amount_total || 0,
        shippingAmount,
        customerEmail,
      });

      const hasReservedStock = hasActiveCheckoutStockReservation(checkoutSession);
      const stockItems = hasReservedStock
        ? []
        : checkoutSession?.items || getStockItemsFromOrderItems(fallbackItems);
      const missingStockSlugItems = hasReservedStock
        ? []
        : getOrderItemsMissingStockSlug(checkoutSession?.items || fallbackItems);
      if (missingStockSlugItems.length > 0) {
        throw new Error(
          `Missing product slug for paid checkout items: ${missingStockSlugItems.join(", ")}`,
        );
      }
      const createResult = await createOrderWithStockAdjustments(
        {
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent?.toString(),
          customerId:
            checkoutSession?.customerId || metadata.customerId || undefined,
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
                postalCode:
                  session.customer_details.address.postal_code || undefined,
                city: session.customer_details.address.city || undefined,
                state: session.customer_details.address.state || undefined,
                country: session.customer_details.address.country || undefined,
              }
            : undefined,
          shippingRelay,
          stockAdjustments: hasReservedStock
            ? checkoutSession?.stockAdjustments
            : undefined,
          items,
          createdAt: now,
          updatedAt: now,
        },
        stockItems,
        { persistOnStockFailure: !hasReservedStock },
      );
      const created = createResult.order;
      if (hasFailedStockAdjustment(created.stockAdjustments)) {
        if (created._id) {
          await markCheckoutSessionOrderCreated({
            stripeSessionId: session.id,
            orderId: created._id,
            stockAdjustments: created.stockAdjustments || [],
          }).catch(() => undefined);
        }
        throw new Error(
          `Order ${created._id || session.id} has failed stock adjustments.`,
        );
      }

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
      if (stripeSessionIdForFailure) {
        await markCheckoutSessionFulfillmentFailed({
          stripeSessionId: stripeSessionIdForFailure,
          reason: message,
        }).catch(() => undefined);
      }
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
