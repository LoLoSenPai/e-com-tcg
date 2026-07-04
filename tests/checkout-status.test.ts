import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getLatestOrderConfirmationEvent,
  getOrderConfirmationEmailState,
  shouldPollCheckoutStatus,
  toPublicCheckoutStatus,
} from "../src/lib/checkout-status";
import type { CheckoutSessionRecord, EmailEvent, Order } from "../src/lib/types";

function emailEvent(
  type: EmailEvent["type"],
  status: EmailEvent["status"],
  createdAt: string,
  to = "client@example.com",
): EmailEvent {
  return {
    type,
    status,
    to,
    subject: "Email",
    createdAt,
    updatedAt: createdAt,
  };
}

describe("checkout status helpers", () => {
  it("uses the latest order confirmation event only", () => {
    const olderConfirmation = emailEvent(
      "order_confirmation",
      "failed",
      "2026-04-25T10:00:00.000Z",
    );
    const latestTracking = emailEvent(
      "shipping_tracking",
      "sent",
      "2026-04-25T12:00:00.000Z",
    );
    const latestConfirmation = emailEvent(
      "order_confirmation",
      "sent",
      "2026-04-25T11:00:00.000Z",
    );

    assert.equal(
      getLatestOrderConfirmationEvent([
        olderConfirmation,
        latestTracking,
        latestConfirmation,
      ]),
      latestConfirmation,
    );
    assert.equal(
      getOrderConfirmationEmailState([
        olderConfirmation,
        latestTracking,
        latestConfirmation,
      ]),
      "sent",
    );
  });

  it("polls while the order or confirmation email is still pending", () => {
    assert.equal(shouldPollCheckoutStatus({ order: null }), true);
    assert.equal(
      shouldPollCheckoutStatus({
        order: { customerEmail: "client@example.com" },
        emailEvents: [],
      }),
      true,
    );
    assert.equal(
      shouldPollCheckoutStatus({
        order: {
          customerEmail: "client@example.com",
          emailStatus: {
            orderConfirmation: {
              status: "pending",
              updatedAt: "2026-04-25T10:00:00.000Z",
            },
          },
        },
        emailEvents: [],
      }),
      true,
    );
    assert.equal(
      shouldPollCheckoutStatus({
        order: { customerEmail: "client@example.com" },
        emailEvents: [
          emailEvent(
            "order_confirmation",
            "pending",
            "2026-04-25T10:00:00.000Z",
          ),
        ],
      }),
      true,
    );
  });

  it("stops polling once no email is needed or email state is final", () => {
    assert.equal(shouldPollCheckoutStatus({ order: {} }), false);
    assert.equal(
      shouldPollCheckoutStatus({
        order: {
          customerEmail: "client@example.com",
          emailStatus: {
            orderConfirmation: {
              status: "failed",
              updatedAt: "2026-04-25T10:00:00.000Z",
            },
          },
        },
        emailEvents: [],
      }),
      false,
    );
    assert.equal(
      shouldPollCheckoutStatus({
        order: { customerEmail: "client@example.com" },
        emailEvents: [
          emailEvent(
            "order_confirmation",
            "failed",
            "2026-04-25T10:00:00.000Z",
          ),
        ],
      }),
      false,
    );
    assert.equal(
      shouldPollCheckoutStatus({
        order: { customerEmail: "client@example.com" },
        emailEvents: [
          emailEvent(
            "order_confirmation",
            "sent",
            "2026-04-25T10:00:00.000Z",
          ),
        ],
      }),
      false,
    );
    assert.equal(
      shouldPollCheckoutStatus({
        order: {},
        emailEvents: [
          emailEvent(
            "order_confirmation",
            "skipped",
            "2026-04-25T10:00:00.000Z",
            undefined,
          ),
        ],
      }),
      false,
    );
  });

  it("uses the order email snapshot when no email events are available", () => {
    assert.equal(
      getOrderConfirmationEmailState([], {
        orderConfirmation: {
          status: "failed",
          updatedAt: "2026-04-25T10:00:00.000Z",
        },
      }),
      "failed",
    );
  });

  it("projects checkout status without leaking customer or provider details", () => {
    const checkoutSession: CheckoutSessionRecord = {
      stripeSessionId: "cs_test_123",
      stripeSessionUrl: "https://checkout.stripe.test/session",
      status: "created",
      customerId: "customer_123",
      customerEmail: "client@example.com",
      deliveryMode: "relay",
      shippingRelay: {
        code: "relay_1",
        name: "Relay Secret",
        address: {
          line1: "1 rue privee",
          zipCode: "75001",
          city: "Paris",
        },
      },
      cartSubtotal: 1000,
      items: [
        {
          slug: "display-secret",
          name: "Display Secret",
          quantity: 1,
          unitAmount: 1000,
        },
      ],
      createdAt: "2026-04-25T10:00:00.000Z",
      updatedAt: "2026-04-25T10:00:00.000Z",
    };
    const order: Order = {
      _id: "order_123",
      stripeSessionId: "cs_test_123",
      stripePaymentIntentId: "pi_secret",
      customerId: "customer_123",
      status: "paid",
      amountTotal: 1200,
      shippingAmount: 200,
      currency: "eur",
      customerEmail: "client@example.com",
      customerName: "Client Prive",
      customerPhone: "+33600000000",
      shippingAddress: {
        line1: "1 rue privee",
        postalCode: "75001",
        city: "Paris",
        country: "FR",
      },
      emailStatus: {
        orderConfirmation: {
          status: "failed",
          to: "client@example.com",
          providerId: "resend_secret",
          error: "Provider secret error",
          updatedAt: "2026-04-25T10:01:00.000Z",
        },
      },
      items: [
        {
          slug: "display-secret",
          name: "Display Secret",
          quantity: 1,
          unitAmount: 1000,
        },
      ],
      createdAt: "2026-04-25T10:00:00.000Z",
      updatedAt: "2026-04-25T10:01:00.000Z",
    };

    const publicStatus = toPublicCheckoutStatus({
      checkoutSession,
      order,
      emailEvents: [
        {
          type: "order_confirmation",
          status: "failed",
          to: "client@example.com",
          subject: "Commande",
          providerId: "resend_secret",
          idempotencyKey: "email_secret",
          error: "Provider secret error",
          createdAt: "2026-04-25T10:01:00.000Z",
          updatedAt: "2026-04-25T10:01:00.000Z",
        },
        {
          type: "shipping_tracking",
          status: "sent",
          to: "client@example.com",
          subject: "Tracking",
          providerId: "resend_tracking_secret",
          createdAt: "2026-04-25T10:02:00.000Z",
          updatedAt: "2026-04-25T10:02:00.000Z",
        },
      ],
    });

    assert.deepEqual(publicStatus, {
      checkoutSession: {
        status: "created",
        createdAt: "2026-04-25T10:00:00.000Z",
        updatedAt: "2026-04-25T10:00:00.000Z",
        stockReleasedAt: undefined,
      },
      order: {
        status: "paid",
        amountTotal: 1200,
        currency: "eur",
        hasCustomerEmail: true,
        emailStatus: {
          orderConfirmation: {
            status: "failed",
            updatedAt: "2026-04-25T10:01:00.000Z",
          },
        },
        createdAt: "2026-04-25T10:00:00.000Z",
        updatedAt: "2026-04-25T10:01:00.000Z",
      },
      emailEvents: [
        {
          type: "order_confirmation",
          status: "failed",
          createdAt: "2026-04-25T10:01:00.000Z",
          updatedAt: "2026-04-25T10:01:00.000Z",
        },
      ],
    });
    const serialized = JSON.stringify(publicStatus);
    assert.equal(serialized.includes("client@example.com"), false);
    assert.equal(serialized.includes("1 rue privee"), false);
    assert.equal(serialized.includes("+33600000000"), false);
    assert.equal(serialized.includes("resend_secret"), false);
    assert.equal(serialized.includes("Provider secret error"), false);
    assert.equal(serialized.includes("https://checkout.stripe.test/session"), false);
    assert.equal(serialized.includes("display-secret"), false);
  });
});
