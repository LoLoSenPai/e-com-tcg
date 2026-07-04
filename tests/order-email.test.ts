import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getOrderEmailSendProblem,
  getOrderEmailTemplate,
} from "../src/lib/order-email";
import type { Order } from "../src/lib/types";

function order(overrides: Partial<Order> = {}): Order {
  return {
    _id: "507f1f77bcf86cd799439011",
    stripeSessionId: "cs_test_123",
    status: "paid",
    amountTotal: 1200,
    currency: "eur",
    customerEmail: "client@example.com",
    items: [
      {
        name: "Booster Test",
        quantity: 1,
        unitAmount: 1200,
      },
    ],
    createdAt: "2026-04-25T10:00:00.000Z",
    updatedAt: "2026-04-25T10:00:00.000Z",
    ...overrides,
  };
}

describe("order email helpers", () => {
  it("requires a customer email for manual sends", () => {
    assert.equal(
      getOrderEmailSendProblem(
        order({ customerEmail: undefined }),
        "order_confirmation",
      ),
      "Order has no customer email",
    );
  });

  it("requires tracking details before sending tracking email", () => {
    assert.equal(
      getOrderEmailSendProblem(order(), "shipping_tracking"),
      "Tracking number or URL is required before sending tracking email",
    );
  });

  it("builds a tracking template from Boxtal tracking when present", () => {
    const template = getOrderEmailTemplate(
      order({
        boxtalShipment: {
          trackingNumber: "TRACK123",
          trackingUrl: "https://track.example.test/TRACK123",
        },
      }),
      "shipping_tracking",
    );

    assert.equal(template.subject, "Votre commande Returners est en route");
    assert.equal(template.html.includes("TRACK123"), true);
  });
});
