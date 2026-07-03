import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isWebhookEventBusy } from "../src/lib/webhook-events";

describe("webhook event helpers", () => {
  it("treats recent processing events as busy", () => {
    const now = new Date("2026-04-25T10:00:00.000Z");
    assert.equal(
      isWebhookEventBusy(
        {
          status: "processing",
          updatedAt: "2026-04-25T09:58:00.000Z",
        },
        now,
      ),
      true,
    );
  });

  it("allows stale processing events to be reclaimed", () => {
    const now = new Date("2026-04-25T10:00:00.000Z");
    assert.equal(
      isWebhookEventBusy(
        {
          status: "processing",
          updatedAt: "2026-04-25T09:50:00.000Z",
        },
        now,
      ),
      false,
    );
  });

  it("does not treat final events as busy", () => {
    const now = new Date("2026-04-25T10:00:00.000Z");
    assert.equal(
      isWebhookEventBusy(
        {
          status: "processed",
          updatedAt: "2026-04-25T09:59:00.000Z",
        },
        now,
      ),
      false,
    );
  });
});
