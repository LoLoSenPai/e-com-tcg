import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasActiveCheckoutStockReservation,
  isCheckoutSessionPaymentLocked,
} from "../src/lib/checkout-sessions";

describe("checkout stock reservation helpers", () => {
  it("detects active stock reservations only before release", () => {
    assert.equal(
      hasActiveCheckoutStockReservation({
        stockReservedAt: "2026-07-04T10:00:00.000Z",
        stockAdjustments: [{ slug: "booster", quantity: 1, applied: true }],
      }),
      true,
    );

    assert.equal(
      hasActiveCheckoutStockReservation({
        stockReservedAt: "2026-07-04T10:00:00.000Z",
        stockReleasedAt: "2026-07-04T10:05:00.000Z",
        stockAdjustments: [{ slug: "booster", quantity: 1, applied: true }],
      }),
      false,
    );

    assert.equal(
      hasActiveCheckoutStockReservation({
        stockReservedAt: "2026-07-04T10:00:00.000Z",
        stockAdjustments: [{ slug: "booster", quantity: 1, applied: false }],
      }),
      false,
    );
  });

  it("locks stock release once payment fulfillment has started", () => {
    assert.equal(isCheckoutSessionPaymentLocked("created"), false);
    assert.equal(isCheckoutSessionPaymentLocked("expired"), false);
    assert.equal(isCheckoutSessionPaymentLocked("fulfilling"), true);
    assert.equal(isCheckoutSessionPaymentLocked("fulfillment_failed"), true);
    assert.equal(isCheckoutSessionPaymentLocked("paid"), true);
    assert.equal(isCheckoutSessionPaymentLocked("order_created"), true);
  });
});
