import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasFinalOrderConfirmationAttempt } from "../src/lib/email-delivery";
import type { EmailEvent } from "../src/lib/types";

function event(status: EmailEvent["status"]): EmailEvent {
  return {
    type: "order_confirmation",
    status,
    to: "client@example.com",
    subject: "Confirmation",
    stripeSessionId: "cs_test",
    createdAt: "2026-04-25T10:00:00.000Z",
    updatedAt: "2026-04-25T10:00:00.000Z",
  };
}

describe("email delivery helpers", () => {
  it("does not treat pending or failed confirmation as final", () => {
    assert.equal(hasFinalOrderConfirmationAttempt([event("pending")]), false);
    assert.equal(hasFinalOrderConfirmationAttempt([event("failed")]), false);
  });

  it("treats sent and skipped confirmation as final", () => {
    assert.equal(hasFinalOrderConfirmationAttempt([event("sent")]), true);
    assert.equal(hasFinalOrderConfirmationAttempt([event("skipped")]), true);
  });
});
