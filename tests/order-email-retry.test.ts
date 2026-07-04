import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getRetryableOrderEmailTypes } from "../src/lib/order-email-retry";
import type { Order } from "../src/lib/types";

function order(overrides: Partial<Order> = {}): Order {
  return {
    _id: "507f1f77bcf86cd799439011",
    stripeSessionId: "cs_test_123",
    status: "paid",
    amountTotal: 1200,
    currency: "eur",
    customerEmail: "client@example.com",
    items: [],
    createdAt: "2026-04-25T10:00:00.000Z",
    updatedAt: "2026-04-25T10:00:00.000Z",
    ...overrides,
  };
}

describe("order email retry helpers", () => {
  it("selects failed or pending order emails older than the cutoff", () => {
    const types = getRetryableOrderEmailTypes(
      order({
        emailStatus: {
          orderConfirmation: {
            status: "failed",
            to: "client@example.com",
            updatedAt: "2026-04-25T09:00:00.000Z",
          },
          shippingTracking: {
            status: "pending",
            to: "client@example.com",
            updatedAt: "2026-04-25T09:05:00.000Z",
          },
        },
        shippingTracking: {
          trackingNumber: "TRACK123",
        },
      }),
      "2026-04-25T09:10:00.000Z",
    );

    assert.deepEqual(types, ["order_confirmation", "shipping_tracking"]);
  });

  it("does not retry recent, final, missing-recipient or tracking-less emails", () => {
    assert.deepEqual(
      getRetryableOrderEmailTypes(
        order({
          customerEmail: undefined,
          emailStatus: {
            orderConfirmation: {
              status: "failed",
              updatedAt: "2026-04-25T09:00:00.000Z",
            },
          },
        }),
        "2026-04-25T09:10:00.000Z",
      ),
      [],
    );

    assert.deepEqual(
      getRetryableOrderEmailTypes(
        order({
          emailStatus: {
            orderConfirmation: {
              status: "sent",
              updatedAt: "2026-04-25T09:00:00.000Z",
            },
            shippingTracking: {
              status: "failed",
              updatedAt: "2026-04-25T09:09:59.000Z",
            },
          },
        }),
        "2026-04-25T09:10:00.000Z",
      ),
      [],
    );
  });
});
