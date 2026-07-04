import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOrderItemsFromStripeLineItems,
  checkoutSessionExpirationSeconds,
  getCheckoutSessionExpiresAt,
  getOrderItemsMissingStockSlug,
  getStockItemsFromOrderItems,
  isCheckoutExpirationEvent,
  isCheckoutFulfillmentEvent,
  normalizeStripeCheckoutSessionId,
  shouldFulfillCheckoutSession,
} from "../src/lib/stripe-checkout";

describe("Stripe checkout fulfillment helpers", () => {
  it("recognizes checkout events that can create an order", () => {
    assert.equal(
      isCheckoutFulfillmentEvent("checkout.session.completed"),
      true,
    );
    assert.equal(
      isCheckoutFulfillmentEvent("checkout.session.async_payment_succeeded"),
      true,
    );
    assert.equal(
      isCheckoutFulfillmentEvent("checkout.session.async_payment_failed"),
      false,
    );
  });

  it("recognizes checkout expiration events that should release stock", () => {
    assert.equal(isCheckoutExpirationEvent("checkout.session.expired"), true);
    assert.equal(isCheckoutExpirationEvent("checkout.session.completed"), false);
  });

  it("fulfills only paid or no-payment-required sessions", () => {
    assert.equal(shouldFulfillCheckoutSession("paid"), true);
    assert.equal(shouldFulfillCheckoutSession("no_payment_required"), true);
    assert.equal(shouldFulfillCheckoutSession("unpaid"), false);
    assert.equal(shouldFulfillCheckoutSession(undefined), false);
  });

  it("sets a short Stripe checkout expiration inside Stripe limits", () => {
    const nowMs = Date.UTC(2026, 6, 4, 12, 0, 0);
    assert.equal(checkoutSessionExpirationSeconds, 31 * 60);
    assert.equal(
      getCheckoutSessionExpiresAt(nowMs),
      Math.floor(nowMs / 1000) + 31 * 60,
    );
    assert.equal(checkoutSessionExpirationSeconds >= 30 * 60, true);
    assert.equal(checkoutSessionExpirationSeconds <= 24 * 60 * 60, true);
  });

  it("accepts only concrete Stripe checkout session ids", () => {
    assert.equal(
      normalizeStripeCheckoutSessionId(" cs_test_123 "),
      "cs_test_123",
    );
    assert.equal(normalizeStripeCheckoutSessionId("{CHECKOUT_SESSION_ID}"), null);
    assert.equal(normalizeStripeCheckoutSessionId("pi_123"), null);
    assert.equal(normalizeStripeCheckoutSessionId(undefined), null);
  });

  it("rebuilds fallback order and stock items from expanded line items", () => {
    const orderItems = buildOrderItemsFromStripeLineItems([
      {
        description: "Booster Test",
        quantity: 2,
        price: {
          unit_amount: 590,
          product: {
            metadata: {
              slug: "booster-test",
            },
          },
        },
      },
      {
        description: "Legacy item",
        quantity: 1,
        price: {
          unit_amount: 1290,
          product: "prod_legacy",
        },
      },
    ]);

    assert.deepEqual(orderItems, [
      {
        slug: "booster-test",
        name: "Booster Test",
        quantity: 2,
        unitAmount: 590,
      },
      {
        slug: undefined,
        name: "Legacy item",
        quantity: 1,
        unitAmount: 1290,
      },
    ]);
    assert.deepEqual(getStockItemsFromOrderItems(orderItems), [
      {
        slug: "booster-test",
        quantity: 2,
      },
    ]);
  });

  it("detects paid fallback items that cannot be tied back to stock", () => {
    assert.deepEqual(
      getOrderItemsMissingStockSlug([
        { slug: "booster-test", name: "Booster Test" },
        { name: "Legacy item" },
      ]),
      ["Legacy item"],
    );
  });
});
