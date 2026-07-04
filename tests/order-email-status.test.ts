import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOrderEmailStatusUpdate,
  isFinalOrderEmailStatus,
} from "../src/lib/order-email-status";

describe("order email status helpers", () => {
  it("merges confirmation status without dropping tracking status", () => {
    const update = buildOrderEmailStatusUpdate(
      {
        emailStatus: {
          shippingTracking: {
            status: "sent",
            to: "client@example.com",
            providerId: "email_tracking",
            updatedAt: "2026-04-25T09:00:00.000Z",
          },
        },
      },
      "order_confirmation",
      {
        status: "failed",
        to: "client@example.com",
        error: "Resend rejected sender",
        updatedAt: "2026-04-25T10:00:00.000Z",
      },
    );

    assert.deepEqual(update, {
      emailStatus: {
        shippingTracking: {
          status: "sent",
          to: "client@example.com",
          providerId: "email_tracking",
          updatedAt: "2026-04-25T09:00:00.000Z",
        },
        orderConfirmation: {
          status: "failed",
          to: "client@example.com",
          error: "Resend rejected sender",
          updatedAt: "2026-04-25T10:00:00.000Z",
        },
      },
    });
  });

  it("treats sent and skipped as final order email statuses", () => {
    assert.equal(isFinalOrderEmailStatus("sent"), true);
    assert.equal(isFinalOrderEmailStatus("skipped"), true);
    assert.equal(isFinalOrderEmailStatus("failed"), false);
    assert.equal(isFinalOrderEmailStatus("pending"), false);
  });
});
