import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasAnyTrackingValue,
  hasOrderTrackingDeliveryDetails,
  hasTrackingDeliveryDetails,
  normalizeTrackingDetails,
  normalizeTrackingUrl,
} from "../src/lib/order-tracking";

describe("order tracking helpers", () => {
  it("distinguishes any tracking value from deliverable tracking details", () => {
    assert.equal(hasAnyTrackingValue({}), false);
    assert.equal(hasTrackingDeliveryDetails({}), false);

    assert.equal(hasAnyTrackingValue({ carrier: "Colissimo" }), true);
    assert.equal(
      hasTrackingDeliveryDetails({ carrier: "Colissimo" }),
      false,
    );

    assert.equal(
      hasTrackingDeliveryDetails({ trackingNumber: "1Z999" }),
      true,
    );
    assert.equal(
      hasTrackingDeliveryDetails({ trackingUrl: "https://tracking.test" }),
      true,
    );
  });

  it("detects sendable tracking details on orders", () => {
    assert.equal(
      hasOrderTrackingDeliveryDetails({
        shippingTracking: { carrier: "Colissimo" },
      }),
      false,
    );
    assert.equal(
      hasOrderTrackingDeliveryDetails({
        shippingTracking: { trackingNumber: "1Z999" },
      }),
      true,
    );
    assert.equal(
      hasOrderTrackingDeliveryDetails({
        boxtalShipment: { trackingUrl: "https://tracking.test" },
      }),
      true,
    );
  });

  it("accepts only http and https tracking URLs", () => {
    assert.equal(
      normalizeTrackingUrl("https://carrier.example/track/123"),
      "https://carrier.example/track/123",
    );
    assert.equal(
      normalizeTrackingUrl("http://carrier.example/track/123"),
      "http://carrier.example/track/123",
    );
    assert.equal(normalizeTrackingUrl("javascript:alert(1)"), undefined);
    assert.equal(normalizeTrackingUrl("data:text/html,hello"), undefined);
    assert.equal(normalizeTrackingUrl("/relative-tracking"), undefined);
  });

  it("drops unsafe URLs while preserving carrier and tracking number", () => {
    assert.deepEqual(
      normalizeTrackingDetails({
        carrier: " Colissimo ",
        trackingNumber: " 1Z999 ",
        trackingUrl: "javascript:alert(1)",
      }),
      {
        carrier: "Colissimo",
        trackingNumber: "1Z999",
        trackingUrl: undefined,
      },
    );
    assert.equal(
      normalizeTrackingDetails({ trackingUrl: "javascript:alert(1)" }),
      undefined,
    );
  });
});
