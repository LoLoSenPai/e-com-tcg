const fulfillablePaymentStatuses = new Set(["paid", "no_payment_required"]);
const checkoutFulfillmentEvents = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);
const checkoutExpirationEvents = new Set(["checkout.session.expired"]);
export const checkoutSessionExpirationSeconds = 31 * 60;

type StripeProductLike = {
  metadata?: Record<string, string | undefined> | null;
  deleted?: unknown;
};

export type StripeCheckoutLineItemLike = {
  description?: string | null;
  quantity?: number | null;
  price?: {
    unit_amount?: number | null;
    product?: string | StripeProductLike | null;
  } | null;
};

export function isCheckoutFulfillmentEvent(eventType: string) {
  return checkoutFulfillmentEvents.has(eventType);
}

export function isCheckoutExpirationEvent(eventType: string) {
  return checkoutExpirationEvents.has(eventType);
}

export function shouldFulfillCheckoutSession(
  paymentStatus: string | null | undefined,
) {
  return fulfillablePaymentStatuses.has(paymentStatus || "");
}

export function getCheckoutSessionExpiresAt(nowMs = Date.now()) {
  return Math.floor(nowMs / 1000) + checkoutSessionExpirationSeconds;
}

export function normalizeStripeCheckoutSessionId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.startsWith("cs_") ? normalized : null;
}

function readExpandedProductSlug(lineItem: StripeCheckoutLineItemLike) {
  const product = lineItem.price?.product;
  if (!product || typeof product === "string" || product.deleted) {
    return undefined;
  }

  const slug = product.metadata?.slug?.trim();
  return slug || undefined;
}

export function buildOrderItemsFromStripeLineItems(
  lineItems: StripeCheckoutLineItemLike[],
) {
  return lineItems.map((item) => ({
    slug: readExpandedProductSlug(item),
    name: item.description || "Produit",
    quantity: item.quantity || 1,
    unitAmount: item.price?.unit_amount || 0,
  }));
}

export function getStockItemsFromOrderItems(
  items: Array<{ slug?: string; quantity: number }>,
) {
  return items
    .filter((item): item is { slug: string; quantity: number } =>
      Boolean(item.slug),
    )
    .map((item) => ({
      slug: item.slug,
      quantity: item.quantity,
    }));
}

export function getOrderItemsMissingStockSlug(
  items: Array<{ slug?: string; name: string }>,
) {
  return items
    .filter((item) => !item.slug)
    .map((item) => item.name)
    .filter(Boolean);
}
