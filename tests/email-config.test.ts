import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEmailIdempotencyKey,
  resolveEmailFrom,
  shouldCreateFallbackFailedEmailEvent,
} from "../src/lib/email";

describe("email config", () => {
  it("uses configured EMAIL_FROM", () => {
    assert.equal(
      resolveEmailFrom({
        EMAIL_FROM: "Returners <shop@example.com>",
        NODE_ENV: "production",
      }),
      "Returners <shop@example.com>",
    );
  });

  it("fails clearly without EMAIL_FROM in production", () => {
    assert.throws(
      () => resolveEmailFrom({ EMAIL_FROM: "", NODE_ENV: "production" }),
      /Missing EMAIL_FROM/,
    );
  });

  it("keeps a development fallback", () => {
    assert.equal(
      resolveEmailFrom({ EMAIL_FROM: "", NODE_ENV: "development" }),
      "Returners <no-reply@returners.com>",
    );
  });

  it("builds stable Resend idempotency keys", () => {
    assert.equal(
      buildEmailIdempotencyKey("order_confirmation", [
        " ORD_123 ",
        "Client+Demo@example.com",
      ]),
      "order_confirmation:ord_123:client-demo-example.com",
    );
    assert.equal(buildEmailIdempotencyKey("shipping_tracking", []), undefined);
    assert.equal(
      buildEmailIdempotencyKey("shipping_tracking", ["x".repeat(300)])?.length,
      256,
    );
  });

  it("creates fallback failed logs when no final failed event was persisted", () => {
    assert.equal(shouldCreateFallbackFailedEmailEvent(null), true);
    assert.equal(shouldCreateFallbackFailedEmailEvent({}), true);
    assert.equal(
      shouldCreateFallbackFailedEmailEvent({ _id: "507f1f77bcf86cd799439011" }),
      false,
    );
  });
});
