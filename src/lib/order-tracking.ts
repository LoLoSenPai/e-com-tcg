import type { Order } from "@/lib/types";

export type TrackingDetails = {
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

export function normalizeTrackingUrl(value: unknown) {
  const raw = cleanString(value);
  if (!raw) {
    return undefined;
  }

  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:"
      ? raw
      : undefined;
  } catch {
    return undefined;
  }
}

export function isSafeTrackingUrl(value: unknown) {
  return Boolean(normalizeTrackingUrl(value));
}

export function normalizeTrackingDetails(
  tracking?: TrackingDetails | null,
): TrackingDetails | undefined {
  if (!tracking) {
    return undefined;
  }

  const normalized = {
    carrier: cleanString(tracking.carrier),
    trackingNumber: cleanString(tracking.trackingNumber),
    trackingUrl: normalizeTrackingUrl(tracking.trackingUrl),
  };

  return hasAnyTrackingValue(normalized) ? normalized : undefined;
}

export function hasAnyTrackingValue(tracking?: TrackingDetails | null) {
  return Boolean(
    tracking?.carrier || tracking?.trackingNumber || tracking?.trackingUrl,
  );
}

export function hasTrackingDeliveryDetails(tracking?: TrackingDetails | null) {
  return Boolean(tracking?.trackingNumber || tracking?.trackingUrl);
}

export function hasOrderTrackingDeliveryDetails(
  order: Pick<Order, "shippingTracking" | "boxtalShipment">,
) {
  return (
    hasTrackingDeliveryDetails(order.shippingTracking) ||
    hasTrackingDeliveryDetails(order.boxtalShipment)
  );
}
