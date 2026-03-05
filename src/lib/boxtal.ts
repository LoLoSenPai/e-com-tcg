import type { Order } from "@/lib/types";

type BoxtalTokenPayload = {
  accessToken?: string;
  access_token?: string;
  token?: string;
  expiresIn?: number;
  expires_in?: number;
};

type BoxtalShippingOfferItem = {
  code: string;
  label: string;
};

type BoxtalShipmentResult = {
  boxtalOrderId?: string;
  shippingOfferCode?: string;
  status?: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  labelUrl?: string;
  relayCode?: string;
  raw?: Record<string, unknown>;
};

let tokenCache: { token: string; expiresAt: number } | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getBoxtalApiBaseUrl() {
  return process.env.BOXTAL_API_BASE_URL || "https://api.boxtal.build/shipping";
}

function getBoxtalTokenUrl() {
  return (
    process.env.BOXTAL_API_TOKEN_URL ||
    process.env.BOXTAL_TOKEN_URL ||
    "https://private-gateway.boxtal.com/iam/account-app/token"
  );
}

function getBoxtalAccessKey() {
  return process.env.BOXTAL_API_ACCESS_KEY || process.env.BOXTAL_ACCESS_KEY || "";
}

function getBoxtalSecretKey() {
  return process.env.BOXTAL_API_SECRET_KEY || process.env.BOXTAL_SECRET_KEY || "";
}

function getCachedToken() {
  if (!tokenCache) return null;
  if (Date.now() >= tokenCache.expiresAt) {
    tokenCache = null;
    return null;
  }
  return tokenCache.token;
}

export class BoxtalApiError extends Error {
  status: number;
  detail?: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "BoxtalApiError";
    this.status = status;
    this.detail = detail;
  }
}

function readToken(payload: BoxtalTokenPayload | null) {
  const token = toNonEmptyString(
    payload?.accessToken || payload?.access_token || payload?.token,
  );
  return token || null;
}

function readTokenExpiration(payload: BoxtalTokenPayload | null) {
  const raw = payload?.expiresIn ?? payload?.expires_in ?? 300;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 300;
}

async function tryFetchBoxtalToken(
  tokenUrl: string,
  basic: string,
): Promise<{ token: string; expiresIn: number; attempt: string }> {
  const attempts: Array<{ label: string; init: RequestInit }> = [
    {
      label: "basic",
      init: {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "User-Agent": "returners/1.0",
        },
        cache: "no-store",
      },
    },
    {
      label: "oauth-form",
      init: {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "User-Agent": "returners/1.0",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
        cache: "no-store",
      },
    },
  ];

  let lastStatus = 502;
  let lastDetail: unknown = "No Boxtal token response";

  for (const attempt of attempts) {
    const response = await fetch(tokenUrl, attempt.init);
    const text = await response.text();
    let payload: BoxtalTokenPayload | null = null;
    try {
      payload = JSON.parse(text) as BoxtalTokenPayload;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      lastStatus = response.status;
      lastDetail = payload || text;
      continue;
    }

    const token = readToken(payload);
    if (!token) {
      lastStatus = 502;
      lastDetail = payload || text;
      continue;
    }

    return {
      token,
      expiresIn: readTokenExpiration(payload),
      attempt: attempt.label,
    };
  }

  throw new BoxtalApiError(
    `Boxtal token failed (${lastStatus})`,
    lastStatus,
    lastDetail,
  );
}

async function getBoxtalAccessToken() {
  const cached = getCachedToken();
  if (cached) {
    return cached;
  }

  const accessKey = getBoxtalAccessKey();
  const secretKey = getBoxtalSecretKey();
  if (!accessKey || !secretKey) {
    throw new BoxtalApiError(
      "Missing API credentials (BOXTAL_API_ACCESS_KEY/BOXTAL_API_SECRET_KEY or BOXTAL_ACCESS_KEY/BOXTAL_SECRET_KEY)",
      400,
    );
  }

  const basic = Buffer.from(`${accessKey}:${secretKey}`).toString("base64");
  const tokenResponse = await tryFetchBoxtalToken(getBoxtalTokenUrl(), basic);
  tokenCache = {
    token: tokenResponse.token,
    expiresAt: Date.now() + Math.max(60, tokenResponse.expiresIn - 60) * 1000,
  };

  return tokenResponse.token;
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

async function boxtalFetch(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const token = await getBoxtalAccessToken();
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("x-token", token);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${getBoxtalApiBaseUrl()}${normalizePath(path)}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    throw new BoxtalApiError(
      `Boxtal API error (${response.status}) on ${normalizePath(path)}`,
      response.status,
      payload,
    );
  }

  return payload;
}

function toNonEmptyString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function findFirstStringByKeys(
  value: unknown,
  keys: readonly string[],
): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstStringByKeys(item, keys);
      if (found) return found;
    }
    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of keys) {
    const direct = toNonEmptyString(value[key]);
    if (direct) {
      return direct;
    }
  }

  for (const nested of Object.values(value)) {
    const found = findFirstStringByKeys(nested, keys);
    if (found) return found;
  }

  return undefined;
}

function getEnvNumber(name: string, fallback: number) {
  const raw = process.env[name];
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function buildShipper() {
  const shipperName = toNonEmptyString(process.env.BOXTAL_SHIPPER_NAME);
  const shipperEmail = toNonEmptyString(process.env.BOXTAL_SHIPPER_EMAIL);
  const shipperPhone = toNonEmptyString(process.env.BOXTAL_SHIPPER_PHONE);
  const shipperLine1 = toNonEmptyString(process.env.BOXTAL_SHIPPER_STREET1);
  const shipperLine2 = toNonEmptyString(process.env.BOXTAL_SHIPPER_STREET2);
  const shipperZipCode = toNonEmptyString(process.env.BOXTAL_SHIPPER_ZIP_CODE);
  const shipperCity = toNonEmptyString(process.env.BOXTAL_SHIPPER_CITY);
  const shipperCountry =
    toNonEmptyString(process.env.BOXTAL_SHIPPER_COUNTRY) || "FR";

  const missing: string[] = [];
  if (!shipperName) missing.push("BOXTAL_SHIPPER_NAME");
  if (!shipperEmail) missing.push("BOXTAL_SHIPPER_EMAIL");
  if (!shipperPhone) missing.push("BOXTAL_SHIPPER_PHONE");
  if (!shipperLine1) missing.push("BOXTAL_SHIPPER_STREET1");
  if (!shipperZipCode) missing.push("BOXTAL_SHIPPER_ZIP_CODE");
  if (!shipperCity) missing.push("BOXTAL_SHIPPER_CITY");

  if (missing.length > 0) {
    throw new BoxtalApiError(
      `Missing shipper env vars: ${missing.join(", ")}`,
      400,
    );
  }

  return {
    name: shipperName,
    email: shipperEmail,
    phone: shipperPhone,
    address: {
      line1: shipperLine1,
      line2: shipperLine2,
      zipCode: shipperZipCode,
      city: shipperCity,
      country: shipperCountry,
    },
  };
}

function getShippingOfferCode(order: Order, overrideOfferCode?: string) {
  const explicit = toNonEmptyString(overrideOfferCode);
  if (explicit) {
    return explicit;
  }
  if (order.shippingRelay?.code) {
    return toNonEmptyString(process.env.BOXTAL_SHIPPING_OFFER_CODE_RELAY);
  }
  return toNonEmptyString(process.env.BOXTAL_SHIPPING_OFFER_CODE_HOME);
}

function buildShipmentPayload(order: Order, overrideOfferCode?: string) {
  const shippingOfferCode = getShippingOfferCode(order, overrideOfferCode);
  if (!shippingOfferCode) {
    throw new BoxtalApiError(
      "Missing shipping offer code. Set BOXTAL_SHIPPING_OFFER_CODE_HOME (and relay if needed).",
      400,
    );
  }

  const recipientLine1 =
    toNonEmptyString(order.shippingAddress?.line1) ||
    toNonEmptyString(order.shippingRelay?.address?.line1);
  const recipientZipCode =
    toNonEmptyString(order.shippingAddress?.postalCode) ||
    toNonEmptyString(order.shippingRelay?.address?.zipCode);
  const recipientCity =
    toNonEmptyString(order.shippingAddress?.city) ||
    toNonEmptyString(order.shippingRelay?.address?.city);
  const recipientCountry =
    toNonEmptyString(order.shippingAddress?.country) ||
    toNonEmptyString(order.shippingRelay?.address?.country) ||
    "FR";

  if (!recipientLine1 || !recipientZipCode || !recipientCity) {
    throw new BoxtalApiError(
      "Recipient address incomplete on order. Missing line1/zipCode/city.",
      400,
    );
  }

  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const baseWeight = getEnvNumber("BOXTAL_DEFAULT_WEIGHT_GRAMS", 220);
  const perItemWeight = getEnvNumber("BOXTAL_ITEM_WEIGHT_GRAMS", 40);
  const weight = Math.max(baseWeight, baseWeight + totalQuantity * perItemWeight);

  const parcel = {
    weight,
    length: getEnvNumber("BOXTAL_DEFAULT_PARCEL_LENGTH_CM", 24),
    width: getEnvNumber("BOXTAL_DEFAULT_PARCEL_WIDTH_CM", 18),
    height: getEnvNumber("BOXTAL_DEFAULT_PARCEL_HEIGHT_CM", 8),
  };

  const recipient = {
    name: toNonEmptyString(order.customerName) || "Client",
    email: toNonEmptyString(order.customerEmail),
    phone: toNonEmptyString(order.customerPhone),
    address: {
      line1: recipientLine1,
      line2: toNonEmptyString(order.shippingAddress?.line2),
      zipCode: recipientZipCode,
      city: recipientCity,
      country: recipientCountry,
    },
  };

  const relayPoint = order.shippingRelay?.code
    ? {
        code: order.shippingRelay.code,
        network: order.shippingRelay.network,
        name: order.shippingRelay.name,
        address: {
          line1: order.shippingRelay.address?.line1,
          zipCode: order.shippingRelay.address?.zipCode,
          city: order.shippingRelay.address?.city,
          country: order.shippingRelay.address?.country,
        },
      }
    : undefined;

  const reference = order._id || order.stripeSessionId;
  const contentCategoryCode = toNonEmptyString(
    process.env.BOXTAL_CONTENT_CATEGORY_CODE,
  );

  return {
    reference,
    shippingOfferCode,
    shipper: buildShipper(),
    recipient,
    relayPoint,
    parcel,
    parcels: [parcel],
    content: contentCategoryCode ? { categoryCode: contentCategoryCode } : undefined,
    metadata: {
      source: "returners",
      orderId: order._id || "",
      stripeSessionId: order.stripeSessionId,
      deliveryMode: order.shippingRelay?.code ? "relay" : "home",
    },
  };
}

function toShippingOffer(item: unknown): BoxtalShippingOfferItem | null {
  if (!isRecord(item)) {
    return null;
  }
  const code = toNonEmptyString(item.code || item.shippingOfferCode || item.id);
  if (!code) {
    return null;
  }
  const label =
    toNonEmptyString(item.label || item.name || item.description) || code;
  return { code, label };
}

export async function getBoxtalShippingOffers() {
  const payload = await boxtalFetch("/v3.1/shipping-offer-code", {
    method: "GET",
  });

  const rawItems = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.shippingOfferCodes)
      ? payload.shippingOfferCodes
      : isRecord(payload) && Array.isArray(payload.items)
        ? payload.items
        : isRecord(payload) && Array.isArray(payload.results)
          ? payload.results
          : [];

  const offers = rawItems
    .map((item) => toShippingOffer(item))
    .filter((item): item is BoxtalShippingOfferItem => item !== null);

  const unique = new Map<string, BoxtalShippingOfferItem>();
  for (const offer of offers) {
    unique.set(offer.code, offer);
  }
  return [...unique.values()];
}

function normalizeShipmentResult(
  payload: unknown,
  shippingOfferCode: string,
  relayCode?: string,
): BoxtalShipmentResult {
  const boxtalOrderId = findFirstStringByKeys(payload, [
    "shippingOrderId",
    "orderId",
    "id",
    "uuid",
  ]);
  const status = findFirstStringByKeys(payload, ["status", "state"]);
  const carrier = findFirstStringByKeys(payload, [
    "carrier",
    "carrierCode",
    "carrierName",
  ]);
  const trackingNumber = findFirstStringByKeys(payload, [
    "trackingNumber",
    "trackingCode",
    "parcelNumber",
  ]);
  const trackingUrl = findFirstStringByKeys(payload, [
    "trackingUrl",
    "trackingLink",
    "trackingUri",
  ]);
  const labelUrl = findFirstStringByKeys(payload, [
    "labelUrl",
    "documentUrl",
    "downloadUrl",
    "labelDownloadUrl",
  ]);

  return {
    boxtalOrderId,
    shippingOfferCode,
    status,
    carrier,
    trackingNumber,
    trackingUrl,
    labelUrl,
    relayCode,
    raw: isRecord(payload) ? payload : undefined,
  };
}

export async function createBoxtalShipment(
  order: Order,
  overrideOfferCode?: string,
) {
  const requestPayload = buildShipmentPayload(order, overrideOfferCode);
  const responsePayload = await boxtalFetch("/v3.1/shipping-order", {
    method: "POST",
    body: JSON.stringify(requestPayload),
  });

  return normalizeShipmentResult(
    responsePayload,
    requestPayload.shippingOfferCode,
    order.shippingRelay?.code,
  );
}
