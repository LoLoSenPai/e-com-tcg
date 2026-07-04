import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasBoxtalShipmentDetails,
  normalizeBoxtalWebhookShipment,
} from "../src/lib/boxtal";
import {
  buildBoxtalWebhookEventId,
  getBoxtalWebhookEnvelope,
} from "../src/lib/boxtal-webhook";

describe("Boxtal webhook payload normalization", () => {
  it("extracts tracking details from TRACKING_CHANGED payloads", () => {
    const shipment = normalizeBoxtalWebhookShipment(
      {
        type: "TRACKING_CHANGED",
        payload: {
          trackings: [
            {
              status: "ANNOUNCED",
              carrierCode: "MONR",
              packageId: "966998xx",
              trackingNumber: "966998xx",
              packageTrackingUrl:
                "https://www.mondialrelay.fr/suivi-de-colis/?NumeroExpedition=966998xx",
            },
          ],
        },
        shippingOrderId: "2440000000MONR4IA8FR",
        shipmentExternalId: "order-123",
      },
      {
        shippingOfferCode: "MONR-RELAY",
        relayCode: "FR-12345",
      },
    );

    assert.equal(shipment.boxtalOrderId, "2440000000MONR4IA8FR");
    assert.equal(shipment.shippingOfferCode, "MONR-RELAY");
    assert.equal(shipment.relayCode, "FR-12345");
    assert.equal(shipment.status, "ANNOUNCED");
    assert.equal(shipment.carrier, "MONR");
    assert.equal(shipment.trackingNumber, "966998xx");
    assert.equal(
      shipment.trackingUrl,
      "https://www.mondialrelay.fr/suivi-de-colis/?NumeroExpedition=966998xx",
    );
    assert.equal(hasBoxtalShipmentDetails(shipment), true);
  });

  it("extracts label URLs from DOCUMENT_CREATED payloads", () => {
    const shipment = normalizeBoxtalWebhookShipment({
      type: "DOCUMENT_CREATED",
      payload: {
        documents: [
          {
            url: "https://document.boxtal.com/shipping-label/label.pdf",
            type: "LABEL",
            format: "PDF_A4",
          },
        ],
      },
      shippingOrderId: "2440000000MONR4IA8FR",
      shipmentExternalId: "order-123",
    });

    assert.equal(shipment.boxtalOrderId, "2440000000MONR4IA8FR");
    assert.equal(
      shipment.labelUrl,
      "https://document.boxtal.com/shipping-label/label.pdf",
    );
    assert.equal(hasBoxtalShipmentDetails(shipment), true);
  });

  it("marks identifier-only payloads as insufficient for local webhook updates", () => {
    const shipment = normalizeBoxtalWebhookShipment({
      type: "PING",
      shippingOrderId: "2440000000MONR4IA8FR",
      shipmentExternalId: "order-123",
    });

    assert.equal(shipment.boxtalOrderId, "2440000000MONR4IA8FR");
    assert.equal(hasBoxtalShipmentDetails(shipment), false);
  });

  it("uses a payload digest instead of raw body fragments for fallback event ids", () => {
    const rawPayload = JSON.stringify({
      type: "TRACKING_CHANGED",
      customerEmail: "client@example.com",
    });
    const eventId = buildBoxtalWebhookEventId({
      eventType: "TRACKING_CHANGED",
      rawPayload,
    });

    assert.equal(eventId.startsWith("TRACKING_CHANGED:"), true);
    assert.equal(eventId.includes("client@example.com"), false);
    assert.equal(eventId.length, "TRACKING_CHANGED:payload:".length + 64);
  });

  it("keeps distinct fallback event ids for different payloads on the same shipment", () => {
    const first = buildBoxtalWebhookEventId({
      eventType: "TRACKING_CHANGED",
      shipmentExternalId: "order-123",
      rawPayload: JSON.stringify({ status: "ANNOUNCED" }),
    });
    const second = buildBoxtalWebhookEventId({
      eventType: "TRACKING_CHANGED",
      shipmentExternalId: "order-123",
      rawPayload: JSON.stringify({ status: "DELIVERED" }),
    });

    assert.notEqual(first, second);
    assert.equal(first.startsWith("TRACKING_CHANGED:order-123:"), true);
  });

  it("extracts webhook identifiers from nested payloads", () => {
    const envelope = getBoxtalWebhookEnvelope({
      id: "event_123",
      type: "TRACKING_CHANGED",
      payload: {
        shipmentExternalId: "order-123",
        shippingOrderId: "2440000000MONR4IA8FR",
      },
    });

    assert.deepEqual(envelope, {
      eventType: "TRACKING_CHANGED",
      shipmentExternalId: "order-123",
      boxtalOrderId: "2440000000MONR4IA8FR",
    });
  });
});
