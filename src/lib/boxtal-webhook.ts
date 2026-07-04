import { createHash } from "crypto";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function getBoxtalWebhookEnvelope(payload: unknown) {
  const root = isRecord(payload) ? payload : {};
  const nested = isRecord(root.payload) ? root.payload : {};

  return {
    eventType: readString(root.type) || readString(nested.type),
    shipmentExternalId:
      readString(root.shipmentExternalId) ||
      readString(nested.shipmentExternalId) ||
      readString(root.externalId) ||
      readString(nested.externalId),
    boxtalOrderId:
      readString(root.shippingOrderId) ||
      readString(nested.shippingOrderId) ||
      readString(root.boxtalOrderId) ||
      readString(nested.boxtalOrderId) ||
      readString(nested.orderId),
  };
}

export function buildBoxtalWebhookEventId({
  payloadId,
  eventType,
  shipmentExternalId,
  boxtalOrderId,
  rawPayload,
}: {
  payloadId?: unknown;
  eventType?: string;
  shipmentExternalId?: string;
  boxtalOrderId?: string;
  rawPayload: string;
}) {
  const explicitId = readString(payloadId);
  if (explicitId) {
    return explicitId;
  }

  const payloadDigest = createHash("sha256").update(rawPayload).digest("hex");
  const objectId = shipmentExternalId || boxtalOrderId || "payload";
  return `${eventType || "boxtal-event"}:${objectId}:${payloadDigest}`;
}
