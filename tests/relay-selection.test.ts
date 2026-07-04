import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeRelayPointInput,
  signRelayPointSelection,
  verifyRelayPointSelection,
} from "../src/lib/relay-selection";

const relayPoint = {
  code: "FR-12345",
  name: "Relay Store",
  network: "MONR_NETWORK",
  address: {
    line1: "1 rue du Test",
    zipCode: "75001",
    city: "Paris",
    country: "fr",
  },
  latitude: 48.856614,
  longitude: 2.3522219,
};

describe("relay selection signing", () => {
  it("normalizes valid relay point payloads", () => {
    const result = normalizeRelayPointInput(relayPoint);

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.relayPoint, {
        code: "FR-12345",
        name: "Relay Store",
        network: "MONR_NETWORK",
        address: {
          line1: "1 rue du Test",
          zipCode: "75001",
          city: "Paris",
          country: "FR",
        },
        latitude: 48.856614,
        longitude: 2.352222,
      });
    }
  });

  it("verifies a signed relay point", () => {
    const signed = signRelayPointSelection(relayPoint, {
      now: 1_000,
      ttlMs: 60_000,
    });

    assert.equal(signed.ok, true);
    if (signed.ok) {
      const verified = verifyRelayPointSelection(
        { ...signed.relayPoint, selectionToken: signed.token },
        2_000,
      );

      assert.equal(verified.ok, true);
    }
  });

  it("rejects modified relay details", () => {
    const signed = signRelayPointSelection(relayPoint, {
      now: 1_000,
      ttlMs: 60_000,
    });

    assert.equal(signed.ok, true);
    if (signed.ok) {
      const verified = verifyRelayPointSelection(
        {
          ...signed.relayPoint,
          code: "FR-99999",
          selectionToken: signed.token,
        },
        2_000,
      );

      assert.deepEqual(verified, {
        ok: false,
        error: "Relay point selection was modified.",
      });
    }
  });

  it("rejects expired relay selections", () => {
    const signed = signRelayPointSelection(relayPoint, {
      now: 1_000,
      ttlMs: 60_000,
    });

    assert.equal(signed.ok, true);
    if (signed.ok) {
      const verified = verifyRelayPointSelection(
        { ...signed.relayPoint, selectionToken: signed.token },
        70_000,
      );

      assert.deepEqual(verified, {
        ok: false,
        error: "Relay point selection has expired.",
      });
    }
  });
});
