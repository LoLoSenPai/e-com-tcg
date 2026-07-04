import type { CartItem } from "@/lib/types";

export const maxCheckoutItems = 100;

export function normalizeCheckoutItems(input: unknown): CartItem[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const quantitiesBySlug = new Map<string, number>();
  for (const item of input) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const raw = item as { slug?: unknown; quantity?: unknown };
    const slug = String(raw.slug || "").trim();
    const quantity = Math.floor(Number(raw.quantity));
    if (!slug || quantity <= 0) {
      continue;
    }

    quantitiesBySlug.set(slug, (quantitiesBySlug.get(slug) || 0) + quantity);
  }

  return Array.from(quantitiesBySlug, ([slug, quantity]) => ({
    slug,
    quantity,
  }));
}

function cleanBaseUrl(value: string | undefined | null) {
  if (!value) {
    return "";
  }
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return "";
  }
}

function isLocalHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local")
  );
}

export function getProductionSiteUrlProblem(value: string | undefined | null) {
  if (!value?.trim()) {
    return "Missing NEXT_PUBLIC_SITE_URL";
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Invalid URL";
  }

  if (url.protocol !== "https:") {
    return "Production URL must use https";
  }
  if (isLocalHostname(url.hostname)) {
    return "Production URL must be public, not localhost";
  }

  return null;
}

export function getCheckoutBaseUrl({
  configuredSiteUrl,
  requestOrigin,
  requestUrl,
  isProduction,
}: {
  configuredSiteUrl?: string;
  requestOrigin?: string | null;
  requestUrl: string;
  isProduction: boolean;
}) {
  const configured = cleanBaseUrl(configuredSiteUrl);
  const origin = cleanBaseUrl(requestOrigin) || cleanBaseUrl(requestUrl);

  if (isProduction) {
    return getProductionSiteUrlProblem(configuredSiteUrl) ? "" : configured;
  }

  return origin || configured || "http://localhost:3000";
}
