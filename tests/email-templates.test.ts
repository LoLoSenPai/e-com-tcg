import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOrderConfirmationEmail,
  buildTrackingEmail,
} from "../src/lib/email-templates";
import type { Order } from "../src/lib/types";

const baseOrder: Order = {
  _id: "order_123",
  stripeSessionId: "cs_test_123",
  status: "paid",
  amountTotal: 12990,
  currency: "eur",
  customerEmail: "client@example.com",
  customerName: "Client <TCG>",
  items: [
    {
      slug: "display-test",
      name: "Display <Pokemon>",
      quantity: 1,
      unitAmount: 12990,
    },
  ],
  createdAt: "2026-04-25T10:00:00.000Z",
  updatedAt: "2026-04-25T10:00:00.000Z",
};

describe("email templates", () => {
  it("renders escaped order confirmation content", () => {
    const email = buildOrderConfirmationEmail(baseOrder);
    assert.equal(email.subject, "Merci pour votre commande Returners");
    assert.match(email.html, /130/);
    assert.match(email.html, /Client &lt;TCG&gt;/);
    assert.match(email.html, /Display &lt;Pokemon&gt;/);
  });

  it("renders tracking details from shipping tracking", () => {
    const email = buildTrackingEmail({
      ...baseOrder,
      shippingTracking: {
        carrier: "Carrier",
        trackingNumber: "TRACK123",
        trackingUrl: "https://tracking.example/TRACK123",
      },
    });
    assert.equal(email.subject, "Votre commande Returners est en route");
    assert.match(email.html, /TRACK123/);
    assert.match(email.html, /https:\/\/tracking.example\/TRACK123/);
  });
});
