import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toPublicAccountOrder } from "../src/lib/account-orders";
import type { Order } from "../src/lib/types";

describe("account order projection", () => {
  it("keeps account order payloads customer-visible only", () => {
    const order: Order = {
      _id: "507f1f77bcf86cd799439011",
      stripeSessionId: "cs_test_secret_session",
      stripePaymentIntentId: "pi_secret",
      customerId: "customer_secret",
      status: "shipped",
      amountTotal: 2500,
      shippingAmount: 500,
      shippingRateLabel: "Point relais",
      currency: "eur",
      customerEmail: "client@example.com",
      customerName: "Client Secret",
      customerPhone: "+33600000000",
      shippingAddress: {
        line1: "1 rue publique",
        postalCode: "75001",
        city: "Paris",
        country: "FR",
      },
      shippingTracking: {
        carrier: "Colissimo",
        trackingNumber: "TRACK123",
        trackingUrl: "https://track.example.com/TRACK123",
      },
      shippingRelay: {
        code: "relay_1",
        name: "Relay",
      },
      boxtalShipment: {
        boxtalOrderId: "boxtal_secret",
        raw: "not part of the public type" as never,
      },
      stockAdjustments: [
        {
          slug: "secret-stock",
          quantity: 1,
          applied: true,
        },
      ],
      emailStatus: {
        orderConfirmation: {
          status: "sent",
          to: "client@example.com",
          providerId: "resend_secret",
          updatedAt: "2026-04-25T10:00:00.000Z",
        },
      },
      items: [
        {
          slug: "display-public",
          name: "Display public",
          quantity: 1,
          unitAmount: 2000,
        },
      ],
      createdAt: "2026-04-25T10:00:00.000Z",
      updatedAt: "2026-04-25T11:00:00.000Z",
    };

    const publicOrder = toPublicAccountOrder(order);

    assert.equal(publicOrder.reference, "99439011");
    assert.deepEqual(publicOrder.items, order.items);
    assert.deepEqual(publicOrder.shippingTracking, order.shippingTracking);
    assert.deepEqual(publicOrder.shippingAddress, order.shippingAddress);

    const serialized = JSON.stringify(publicOrder);
    assert.equal(serialized.includes("cs_test_secret_session"), false);
    assert.equal(serialized.includes("507f1f77bcf86cd799439011"), false);
    assert.equal(serialized.includes("pi_secret"), false);
    assert.equal(serialized.includes("customer_secret"), false);
    assert.equal(serialized.includes("client@example.com"), false);
    assert.equal(serialized.includes("+33600000000"), false);
    assert.equal(serialized.includes("resend_secret"), false);
    assert.equal(serialized.includes("boxtal_secret"), false);
    assert.equal(serialized.includes("secret-stock"), false);
  });

  it("removes unsafe tracking URLs from customer order payloads", () => {
    const order: Order = {
      stripeSessionId: "cs_test_123",
      status: "shipped",
      amountTotal: 2500,
      currency: "eur",
      shippingTracking: {
        carrier: "Carrier",
        trackingNumber: "TRACK123",
        trackingUrl: "javascript:alert(1)",
      },
      items: [],
      createdAt: "2026-04-25T10:00:00.000Z",
      updatedAt: "2026-04-25T11:00:00.000Z",
    };

    const publicOrder = toPublicAccountOrder(order);

    assert.deepEqual(publicOrder.shippingTracking, {
      carrier: "Carrier",
      trackingNumber: "TRACK123",
      trackingUrl: undefined,
    });
  });
});
