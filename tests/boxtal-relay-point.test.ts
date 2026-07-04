import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findBoxtalRelayPointInPayload } from "../src/lib/boxtal";

describe("Boxtal relay point resolution", () => {
  it("finds and canonicalizes relay points from Boxtal payloads", () => {
    const relayPoint = findBoxtalRelayPointInPayload(
      {
        content: [
          {
            parcelpoint: {
              code: "FR-12345",
              name: "Relay Store",
              networkCode: "MONR_NETWORK",
              location: {
                address: {
                  street: "1 rue du Test",
                  zipCode: "75001",
                  city: "Paris",
                  countryIsoCode: "FRA",
                },
                position: {
                  latitude: 48.856614,
                  longitude: 2.352222,
                },
              },
            },
          },
        ],
      },
      "FR-12345",
    );

    assert.deepEqual(relayPoint, {
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
  });

  it("returns null when the requested code is not returned", () => {
    const relayPoint = findBoxtalRelayPointInPayload(
      {
        content: [
          {
            parcelpoint: {
              code: "FR-12345",
              name: "Relay Store",
              location: {
                address: {
                  zipCode: "75001",
                  city: "Paris",
                },
              },
            },
          },
        ],
      },
      "FR-99999",
    );

    assert.equal(relayPoint, null);
  });
});
