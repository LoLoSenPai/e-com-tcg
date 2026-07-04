import type { Order } from "@/lib/types";
import { normalizeRelayPointInput } from "@/lib/relay-selection";
import type { ShippingRelayPoint } from "@/lib/types";

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

export type BoxtalShipmentResult = {
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

type BoxtalMoneyPayload = {
  value: number;
  currency: "EUR";
};

type BoxtalContactPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company?: string;
};

type BoxtalLocationPayload = {
  street: string;
  city: string;
  countryIsoCode: string;
  postalCode?: string;
  number?: string;
};

type BoxtalAddressPayload = {
  type: "RESIDENTIAL" | "BUSINESS";
  contact: BoxtalContactPayload;
  location: BoxtalLocationPayload;
  additionalInformation?: string;
};

type BoxtalContentPayload = {
  id: string;
  description: string;
};

type BoxtalPackagePayload = {
  type: "PARCEL";
  weight: number;
  length: number;
  width: number;
  height: number;
  value: BoxtalMoneyPayload;
  content: BoxtalContentPayload;
  externalId?: string;
};

type BoxtalShipmentRequestPayload = {
  shippingOfferCode: string;
  shipment: {
    externalId: string;
    content: BoxtalContentPayload;
    fromAddress: BoxtalAddressPayload;
    toAddress: BoxtalAddressPayload;
    returnAddress: BoxtalAddressPayload;
    packages: BoxtalPackagePayload[];
    pickupPointCode?: string;
  };
};

type BoxtalShipperConfig = {
  name: string;
  email: string;
  phone: string;
  line1: string;
  line2?: string;
  postalCode: string;
  city: string;
  country: string;
};

type BoxtalCredentialSource = "api" | "default" | "map";
type BoxtalServerCredentialSource = Exclude<BoxtalCredentialSource, "map">;

type BoxtalCredential = {
  source: BoxtalCredentialSource;
  accessKey: string;
  secretKey: string;
  tokenUrl: string;
};

type BoxtalProbeStatus = {
  ok: boolean;
  status?: number;
  detail?: string;
  attempt?: string;
};

type BoxtalProbeSource = {
  source: BoxtalCredentialSource;
  configured: boolean;
  keyHint?: string;
  tokenUrl?: string;
  token: BoxtalProbeStatus;
  shippingOffer: {
    bearer: BoxtalProbeStatus;
    basic: BoxtalProbeStatus;
  };
};

export type BoxtalAuthProbeReport = {
  timestamp: string;
  apiBaseUrl: string;
  probePath: string;
  sourceOrder: BoxtalCredentialSource[];
  sources: BoxtalProbeSource[];
};

const authProbePath = "/v3.1/content-category?language=fr";

const tokenCache = new Map<
  BoxtalCredentialSource,
  { token: string; expiresAt: number }
>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getBoxtalApiBaseUrl() {
  return process.env.BOXTAL_API_BASE_URL || "https://api.boxtal.build/shipping";
}

function getDefaultTokenUrl(env: Env = process.env) {
  return (
    env.BOXTAL_TOKEN_URL ||
    "https://private-gateway.boxtal.com/iam/account-app/token"
  );
}

function getCachedToken(source: BoxtalCredentialSource) {
  const cached = tokenCache.get(source);
  if (!cached) return null;
  if (Date.now() >= cached.expiresAt) {
    tokenCache.delete(source);
    return null;
  }
  return cached.token;
}

function setCachedToken(
  source: BoxtalCredentialSource,
  token: string,
  expiresInSeconds: number,
) {
  tokenCache.set(source, {
    token,
    expiresAt: Date.now() + Math.max(60, expiresInSeconds - 60) * 1000,
  });
}

function clearCachedToken(source: BoxtalCredentialSource) {
  tokenCache.delete(source);
}

function buildCredential(
  source: BoxtalCredentialSource,
  accessKey: string | undefined,
  secretKey: string | undefined,
  tokenUrl: string | undefined,
  env: Env = process.env,
): BoxtalCredential | null {
  if (!accessKey || !secretKey) {
    return null;
  }
  return {
    source,
    accessKey,
    secretKey,
    tokenUrl: tokenUrl || getDefaultTokenUrl(env),
  };
}

type Env = Record<string, string | undefined>;

function getBoxtalCredential(source: BoxtalCredentialSource, env: Env = process.env) {
  if (source === "api") {
    return buildCredential(
      "api",
      env.BOXTAL_API_ACCESS_KEY,
      env.BOXTAL_API_SECRET_KEY,
      env.BOXTAL_API_TOKEN_URL || env.BOXTAL_TOKEN_URL,
      env,
    );
  }
  if (source === "default") {
    return buildCredential(
      "default",
      env.BOXTAL_ACCESS_KEY,
      env.BOXTAL_SECRET_KEY,
      env.BOXTAL_TOKEN_URL,
      env,
    );
  }
  return buildCredential(
    "map",
    env.BOXTAL_MAP_ACCESS_KEY,
    env.BOXTAL_MAP_SECRET_KEY,
    env.BOXTAL_MAP_TOKEN_URL || env.BOXTAL_TOKEN_URL,
    env,
  );
}

export function getBoxtalServerCredentialSourceOrder(env: Env = process.env) {
  return (["api", "default"] satisfies BoxtalServerCredentialSource[]).filter(
    (source) => Boolean(getBoxtalCredential(source, env)),
  );
}

function getBoxtalCredentialCandidates(options?: {
  dedupe?: boolean;
  env?: Env;
  sources?: readonly BoxtalCredentialSource[];
}): BoxtalCredential[] {
  const dedupe = options?.dedupe ?? true;
  const env = options?.env || process.env;
  const sourceOrder = options?.sources || (["api", "default"] as const);
  const candidates = sourceOrder
    .map((source) => getBoxtalCredential(source, env))
    .filter((candidate): candidate is BoxtalCredential => candidate !== null);

  if (!dedupe) {
    return candidates;
  }

  const unique = new Map<string, BoxtalCredential>();
  for (const candidate of candidates) {
    const key = `${candidate.accessKey}:${candidate.secretKey}:${candidate.tokenUrl}`;
    if (!unique.has(key)) {
      unique.set(key, candidate);
    }
  }

  return [...unique.values()];
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

async function getBoxtalAccessToken(credential: BoxtalCredential) {
  const cached = getCachedToken(credential.source);
  if (cached) {
    return cached;
  }

  const basic = Buffer.from(
    `${credential.accessKey}:${credential.secretKey}`,
  ).toString("base64");
  const tokenResponse = await tryFetchBoxtalToken(credential.tokenUrl, basic);
  setCachedToken(credential.source, tokenResponse.token, tokenResponse.expiresIn);

  return tokenResponse.token;
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function buildRequestHeaders(
  init: RequestInit,
  authHeader: string,
  xToken?: string,
) {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", authHeader);
  if (xToken) {
    headers.set("x-token", xToken);
  }
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

async function executeBoxtalRequest(
  path: string,
  init: RequestInit,
  headers: Headers,
) {
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

  return {
    status: response.status,
    ok: response.ok,
    payload,
  };
}

function truncate(value: string, max = 280) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function detailToString(detail: unknown) {
  if (typeof detail === "string") {
    return truncate(detail.trim());
  }
  try {
    return truncate(JSON.stringify(detail));
  } catch {
    return truncate(String(detail));
  }
}

function maskKey(value: string) {
  if (value.length <= 8) {
    return "***";
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function probeFromError(error: unknown): BoxtalProbeStatus {
  if (error instanceof BoxtalApiError) {
    return {
      ok: false,
      status: error.status,
      detail: detailToString(error.detail || error.message),
    };
  }
  if (error instanceof Error) {
    return {
      ok: false,
      detail: detailToString(error.message),
    };
  }
  return {
    ok: false,
    detail: detailToString(error),
  };
}

export async function debugBoxtalAuthProbe(): Promise<BoxtalAuthProbeReport> {
  const sourceOrder: BoxtalCredentialSource[] = ["api", "default", "map"];
  const sources: BoxtalProbeSource[] = [];

  for (const source of sourceOrder) {
    const credential = getBoxtalCredential(source);
    if (!credential) {
      sources.push({
        source,
        configured: false,
        token: {
          ok: false,
          detail: "Missing access/secret env vars for this source.",
        },
        shippingOffer: {
          bearer: {
            ok: false,
            detail: "Skipped (no credentials).",
          },
          basic: {
            ok: false,
            detail: "Skipped (no credentials).",
          },
        },
      });
      continue;
    }

    const basic = Buffer.from(
      `${credential.accessKey}:${credential.secretKey}`,
    ).toString("base64");

    let token: string | null = null;
    let tokenStatus: BoxtalProbeStatus = { ok: false };
    try {
      const tokenResponse = await tryFetchBoxtalToken(credential.tokenUrl, basic);
      token = tokenResponse.token;
      tokenStatus = {
        ok: true,
        status: 200,
        attempt: tokenResponse.attempt,
      };
    } catch (error) {
      tokenStatus = probeFromError(error);
    }

    let bearerStatus: BoxtalProbeStatus = {
      ok: false,
      detail: "Skipped (token failed).",
    };
    if (token) {
      const bearerHeaders = buildRequestHeaders(
        { method: "GET" },
        `Bearer ${token}`,
        token,
      );
      const bearerResponse = await executeBoxtalRequest(
        authProbePath,
        { method: "GET" },
        bearerHeaders,
      );
      bearerStatus = bearerResponse.ok
        ? { ok: true, status: bearerResponse.status }
        : {
            ok: false,
            status: bearerResponse.status,
            detail: detailToString(bearerResponse.payload),
          };
    }

    const basicHeaders = buildRequestHeaders({ method: "GET" }, `Basic ${basic}`);
    const basicResponse = await executeBoxtalRequest(
      authProbePath,
      { method: "GET" },
      basicHeaders,
    );
    const basicStatus: BoxtalProbeStatus = basicResponse.ok
      ? { ok: true, status: basicResponse.status }
      : {
          ok: false,
          status: basicResponse.status,
          detail: detailToString(basicResponse.payload),
        };

    sources.push({
      source,
      configured: true,
      keyHint: maskKey(credential.accessKey),
      tokenUrl: credential.tokenUrl,
      token: tokenStatus,
      shippingOffer: {
        bearer: bearerStatus,
        basic: basicStatus,
      },
    });
  }

  return {
    timestamp: new Date().toISOString(),
    apiBaseUrl: getBoxtalApiBaseUrl(),
    probePath: authProbePath,
    sourceOrder,
    sources,
  };
}

async function boxtalFetch(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const candidates = getBoxtalCredentialCandidates();
  if (candidates.length === 0) {
    throw new BoxtalApiError(
      "Missing Boxtal credentials. Define BOXTAL_API_* (recommended) or BOXTAL_ACCESS_KEY/BOXTAL_SECRET_KEY.",
      400,
    );
  }

  let lastAuthError: BoxtalApiError | null = null;
  const errorsBySource: Record<string, unknown> = {};

  for (const candidate of candidates) {
    const sourceError: Record<string, unknown> = {};
    let bearerApiError: BoxtalApiError | null = null;

    try {
      const token = await getBoxtalAccessToken(candidate);
      const bearerHeaders = buildRequestHeaders(
        init,
        `Bearer ${token}`,
        token,
      );
      const bearerResponse = await executeBoxtalRequest(path, init, bearerHeaders);
      if (bearerResponse.ok) {
        return bearerResponse.payload;
      }
      sourceError.bearer = {
        status: bearerResponse.status,
        detail: bearerResponse.payload,
      };

      if (bearerResponse.status !== 401 && bearerResponse.status !== 403) {
        bearerApiError = new BoxtalApiError(
          `Boxtal API error (${bearerResponse.status}) on ${normalizePath(path)} [source=${candidate.source}]`,
          bearerResponse.status,
          bearerResponse.payload,
        );
        throw bearerApiError;
      }
      clearCachedToken(candidate.source);
    } catch (error) {
      if (bearerApiError && error === bearerApiError) {
        errorsBySource[candidate.source] = sourceError;
        throw error;
      }
      sourceError.token = error instanceof Error ? error.message : error;
    }

    const basic = Buffer.from(
      `${candidate.accessKey}:${candidate.secretKey}`,
    ).toString("base64");
    const basicHeaders = buildRequestHeaders(init, `Basic ${basic}`);
    const basicResponse = await executeBoxtalRequest(path, init, basicHeaders);
    if (basicResponse.ok) {
      return basicResponse.payload;
    }
    sourceError.basic = {
      status: basicResponse.status,
      detail: basicResponse.payload,
    };
    errorsBySource[candidate.source] = sourceError;

    if (basicResponse.status === 401 || basicResponse.status === 403) {
      lastAuthError = new BoxtalApiError(
        `Boxtal API unauthorized (${basicResponse.status}) [source=${candidate.source}]`,
        basicResponse.status,
        basicResponse.payload,
      );
      continue;
    }

    throw new BoxtalApiError(
      `Boxtal API error (${basicResponse.status}) on ${normalizePath(path)} [source=${candidate.source}]`,
      basicResponse.status,
      basicResponse.payload,
    );
  }

  throw new BoxtalApiError(
    "Boxtal authentication failed for all credential sources. Verify API v3 keys (BOXTAL_API_ACCESS_KEY / BOXTAL_API_SECRET_KEY).",
    lastAuthError?.status || 401,
    {
      attemptedSources: candidates.map((candidate) => candidate.source),
      errorsBySource,
      lastError: lastAuthError?.detail || lastAuthError?.message,
    },
  );
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

function findFirstNumberByKeys(
  value: unknown,
  keys: readonly string[],
): number | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstNumberByKeys(item, keys);
      if (typeof found === "number") return found;
    }
    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of keys) {
    const raw = value[key];
    const direct =
      typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    if (Number.isFinite(direct)) {
      return direct;
    }
  }

  for (const nested of Object.values(value)) {
    const found = findFirstNumberByKeys(nested, keys);
    if (typeof found === "number") return found;
  }

  return undefined;
}

function normalizeCountryIso2(country?: string) {
  const upper = toNonEmptyString(country)?.toUpperCase();
  if (!upper) return "FR";
  const alpha3ToAlpha2: Record<string, string> = {
    BEL: "BE",
    CHE: "CH",
    FRA: "FR",
    LUX: "LU",
  };
  return alpha3ToAlpha2[upper] || upper.slice(0, 2);
}

function getEnvNumber(name: string, fallback: number) {
  const raw = process.env[name];
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function buildConfiguredShippingOffers() {
  const offers: BoxtalShippingOfferItem[] = [];
  const homeCode = toNonEmptyString(process.env.BOXTAL_SHIPPING_OFFER_CODE_HOME);
  const relayCode = toNonEmptyString(process.env.BOXTAL_SHIPPING_OFFER_CODE_RELAY);

  if (homeCode) {
    offers.push({
      code: homeCode,
      label: `Livraison domicile (${homeCode})`,
    });
  }

  if (relayCode) {
    offers.push({
      code: relayCode,
      label: `Point relais (${relayCode})`,
    });
  }

  return offers;
}

function buildShipperConfig(): BoxtalShipperConfig {
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
    name: shipperName!,
    email: shipperEmail!,
    phone: shipperPhone!,
    line1: shipperLine1!,
    line2: shipperLine2,
    postalCode: shipperZipCode!,
    city: shipperCity!,
    country: shipperCountry,
  };
}

function splitCustomerName(name: string | undefined) {
  const raw = toNonEmptyString(name) || "Client Returners";
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "Returners",
    };
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function splitStreetLine(line: string) {
  const normalized = line.trim().replace(/\s+/g, " ");
  const match = normalized.match(/^(\d+[A-Za-z0-9/-]*)\s+(.+)$/);
  if (!match) {
    return {
      street: normalized,
    };
  }
  return {
    number: match[1],
    street: match[2],
  };
}

function normalizePhone(phone: string, country: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) {
    return phone;
  }
  if (phone.trim().startsWith("+")) {
    return `+${digits}`;
  }
  if (country === "FR") {
    if (digits.startsWith("33")) {
      return `+${digits}`;
    }
    if (digits.startsWith("0")) {
      return `+33${digits.slice(1)}`;
    }
    return `+33${digits}`;
  }
  return `+${digits}`;
}

function buildContentPayload() {
  return {
    id:
      toNonEmptyString(process.env.BOXTAL_CONTENT_CATEGORY_CODE) ||
      "content:v1:80100",
    description:
      toNonEmptyString(process.env.BOXTAL_CONTENT_DESCRIPTION) ||
      "Cartes a collectionner et accessoires TCG",
  } satisfies BoxtalContentPayload;
}

function buildPartyAddress(options: {
  type: "RESIDENTIAL" | "BUSINESS";
  company?: string;
  name?: string;
  email: string;
  phone: string;
  line1: string;
  line2?: string;
  postalCode: string;
  city: string;
  country: string;
}): BoxtalAddressPayload {
  const { street, number } = splitStreetLine(options.line1);
  const { firstName, lastName } = splitCustomerName(options.name);
  const address: BoxtalAddressPayload = {
    type: options.type,
    contact: {
      firstName,
      lastName,
      email: options.email,
      phone: normalizePhone(options.phone, options.country),
      company: options.company,
    },
    location: {
      street,
      number,
      postalCode: options.postalCode,
      city: options.city,
      countryIsoCode: options.country,
    },
    additionalInformation: options.line2,
  };
  return address;
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

  const shipper = buildShipperConfig();
  const recipientEmail = toNonEmptyString(order.customerEmail) || shipper.email;
  const recipientPhone = toNonEmptyString(order.customerPhone) || shipper.phone;
  const isRelayDelivery = Boolean(order.shippingRelay?.code);
  const hasCustomerShippingAddress = Boolean(
    toNonEmptyString(order.shippingAddress?.line1) &&
      toNonEmptyString(order.shippingAddress?.postalCode) &&
      toNonEmptyString(order.shippingAddress?.city),
  );
  const useRelayAddressAsDestination =
    isRelayDelivery && !hasCustomerShippingAddress;
  const recipientLine1 = useRelayAddressAsDestination
    ? toNonEmptyString(order.shippingRelay?.address?.line1)
    : toNonEmptyString(order.shippingAddress?.line1);
  const recipientZipCode = useRelayAddressAsDestination
    ? toNonEmptyString(order.shippingRelay?.address?.zipCode)
    : toNonEmptyString(order.shippingAddress?.postalCode);
  const recipientCity = useRelayAddressAsDestination
    ? toNonEmptyString(order.shippingRelay?.address?.city)
    : toNonEmptyString(order.shippingAddress?.city);
  const recipientCountry = useRelayAddressAsDestination
    ? toNonEmptyString(order.shippingRelay?.address?.country) || "FR"
    : toNonEmptyString(order.shippingAddress?.country) || "FR";
  const recipientLine2 = useRelayAddressAsDestination
    ? undefined
    : toNonEmptyString(order.shippingAddress?.line2);

  if (
    !recipientLine1 ||
    !recipientZipCode ||
    !recipientCity ||
    !recipientEmail ||
    !recipientPhone
  ) {
    throw new BoxtalApiError(
      "Recipient contact or address incomplete on order. Missing email/phone/line1/postalCode/city.",
      400,
    );
  }

  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const baseWeight = getEnvNumber("BOXTAL_DEFAULT_WEIGHT_GRAMS", 220);
  const perItemWeight = getEnvNumber("BOXTAL_ITEM_WEIGHT_GRAMS", 40);
  const weight = Math.max(baseWeight, baseWeight + totalQuantity * perItemWeight);
  const content = buildContentPayload();
  const packageValue = Math.max(
    0.01,
    order.items.reduce(
      (sum, item) => sum + item.unitAmount * item.quantity,
      0,
    ) / 100,
  );

  const fromAddress = buildPartyAddress({
    type: "BUSINESS",
    company: shipper.name,
    name: shipper.name,
    email: shipper.email,
    phone: shipper.phone,
    line1: shipper.line1,
    line2: shipper.line2,
    postalCode: shipper.postalCode,
    city: shipper.city,
    country: shipper.country,
  });

  const toAddress = buildPartyAddress({
    type: useRelayAddressAsDestination ? "BUSINESS" : "RESIDENTIAL",
    name: toNonEmptyString(order.customerName) || "Client Returners",
    company: useRelayAddressAsDestination ? order.shippingRelay?.name : undefined,
    email: recipientEmail,
    phone: recipientPhone,
    line1: recipientLine1,
    line2: recipientLine2,
    postalCode: recipientZipCode,
    city: recipientCity,
    country: recipientCountry,
  });

  const packages: BoxtalPackagePayload[] = [
    {
      type: "PARCEL",
      weight: Number((weight / 1000).toFixed(3)),
      length: Math.round(getEnvNumber("BOXTAL_DEFAULT_PARCEL_LENGTH_CM", 24)),
      width: Math.round(getEnvNumber("BOXTAL_DEFAULT_PARCEL_WIDTH_CM", 18)),
      height: Math.round(getEnvNumber("BOXTAL_DEFAULT_PARCEL_HEIGHT_CM", 8)),
      value: {
        value: Number(packageValue.toFixed(2)),
        currency: "EUR",
      },
      content,
      externalId: order._id || order.stripeSessionId,
    },
  ];

  return {
    shippingOfferCode,
    shipment: {
      externalId: order._id || order.stripeSessionId,
      content,
      fromAddress,
      toAddress,
      returnAddress: fromAddress,
      packages,
      pickupPointCode: order.shippingRelay?.code,
    },
  } satisfies BoxtalShipmentRequestPayload;
}

export async function getBoxtalShippingOffers() {
  return buildConfiguredShippingOffers();
}

function getResponseContentArray(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (isRecord(payload) && Array.isArray(payload.content)) {
    return payload.content;
  }
  return [];
}

function getRelayCandidateRecord(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }
  const nested =
    value.parcelpoint ||
    value.parcelPoint ||
    value.parcel_point ||
    value.pickupPoint ||
    value.pickup_point;
  return isRecord(nested) ? nested : value;
}

function relayPointFromBoxtalCandidate(
  candidate: unknown,
  requestedCode: string,
): ShippingRelayPoint | null {
  const record = getRelayCandidateRecord(candidate);
  if (!record) {
    return null;
  }

  const code = findFirstStringByKeys(record, [
    "code",
    "id",
    "parcelPointCode",
    "pickupPointCode",
  ]);
  if (!code || code.toLowerCase() !== requestedCode.toLowerCase()) {
    return null;
  }

  const relayPoint: ShippingRelayPoint = {
    code,
    name:
      findFirstStringByKeys(record, [
        "name",
        "label",
        "commercialName",
        "companyName",
      ]) || code,
    network: findFirstStringByKeys(record, [
      "network",
      "networkCode",
      "carrierCode",
    ]),
    address: {
      line1: findFirstStringByKeys(record, [
        "street",
        "streetName",
        "address",
        "address1",
        "line1",
      ]),
      zipCode: findFirstStringByKeys(record, [
        "zipCode",
        "postalCode",
        "postcode",
      ]),
      city: findFirstStringByKeys(record, ["city", "locality"]),
      country: normalizeCountryIso2(
        findFirstStringByKeys(record, [
          "country",
          "countryIsoCode",
          "countryCode",
        ]),
      ),
    },
    latitude: findFirstNumberByKeys(record, ["latitude", "lat"]),
    longitude: findFirstNumberByKeys(record, ["longitude", "lng", "lon"]),
  };

  const normalized = normalizeRelayPointInput(relayPoint);
  return normalized.ok ? normalized.relayPoint : null;
}

export function findBoxtalRelayPointInPayload(
  payload: unknown,
  requestedCode: string,
) {
  const candidates = getResponseContentArray(payload);
  for (const candidate of candidates.length > 0 ? candidates : [payload]) {
    const relayPoint = relayPointFromBoxtalCandidate(candidate, requestedCode);
    if (relayPoint) {
      return relayPoint;
    }
  }
  return null;
}

function buildRelayPointSearchPath(selection: ShippingRelayPoint) {
  const relayOfferCode = toNonEmptyString(
    process.env.BOXTAL_SHIPPING_OFFER_CODE_RELAY,
  );
  if (!relayOfferCode) {
    throw new BoxtalApiError(
      "Missing BOXTAL_SHIPPING_OFFER_CODE_RELAY.",
      400,
    );
  }

  const params = new URLSearchParams({
    operationType: "ARRIVAL",
    shippingOfferCode: relayOfferCode,
    postalCode: selection.address?.zipCode || "",
    city: selection.address?.city || "",
    countryIsoCode: normalizeCountryIso2(selection.address?.country),
  });

  return `/v3.2/parcel-point-by-shipping-offer?${params.toString()}`;
}

export async function resolveBoxtalRelayPoint(selection: unknown) {
  const normalized = normalizeRelayPointInput(selection);
  if (!normalized.ok) {
    throw new BoxtalApiError(normalized.error, 400);
  }

  const payload = await boxtalFetch(buildRelayPointSearchPath(normalized.relayPoint), {
    method: "GET",
  });
  const relayPoint = findBoxtalRelayPointInPayload(
    payload,
    normalized.relayPoint.code,
  );
  if (!relayPoint) {
    throw new BoxtalApiError(
      "Invalid relay point selection.",
      400,
    );
  }
  return relayPoint;
}

function mergeShipmentResults(
  ...results: Array<Partial<BoxtalShipmentResult> | null | undefined>
): BoxtalShipmentResult {
  const merged: BoxtalShipmentResult = {};

  for (const result of results) {
    if (!result) {
      continue;
    }

    if (result.boxtalOrderId) merged.boxtalOrderId = result.boxtalOrderId;
    if (result.shippingOfferCode) {
      merged.shippingOfferCode = result.shippingOfferCode;
    }
    if (result.status) merged.status = result.status;
    if (result.carrier) merged.carrier = result.carrier;
    if (result.trackingNumber) merged.trackingNumber = result.trackingNumber;
    if (result.trackingUrl) merged.trackingUrl = result.trackingUrl;
    if (result.labelUrl) merged.labelUrl = result.labelUrl;
    if (result.relayCode) merged.relayCode = result.relayCode;
    if (result.raw) merged.raw = result.raw;
  }

  return merged;
}

function normalizeShipmentResult(
  payload: unknown,
  shippingOfferCode?: string,
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

function normalizeTrackingResult(
  payload: unknown,
  shippingOfferCode?: string,
  relayCode?: string,
): BoxtalShipmentResult {
  const items = getResponseContentArray(payload);
  const primary =
    items.find(
      (item) =>
        isRecord(item) &&
        Boolean(
          findFirstStringByKeys(item, [
            "trackingNumber",
            "trackingCode",
            "parcelNumber",
            "packageTrackingUrl",
            "trackingUrl",
          ]),
        ),
    ) || payload;

  return {
    shippingOfferCode,
    status: findFirstStringByKeys(primary, ["status", "state"]),
    carrier: findFirstStringByKeys(primary, [
      "carrier",
      "carrierCode",
      "carrierName",
    ]),
    trackingNumber: findFirstStringByKeys(primary, [
      "trackingNumber",
      "trackingCode",
      "parcelNumber",
    ]),
    trackingUrl: findFirstStringByKeys(primary, [
      "packageTrackingUrl",
      "trackingUrl",
      "trackingLink",
      "trackingUri",
    ]),
    relayCode,
    raw: isRecord(payload) ? payload : undefined,
  };
}

function normalizeDocumentResult(
  payload: unknown,
  shippingOfferCode?: string,
  relayCode?: string,
): BoxtalShipmentResult {
  const documents = getResponseContentArray(payload).filter(isRecord);
  const labelDocument =
    documents.find(
      (document) =>
        toNonEmptyString(document.type) === "LABEL" &&
        toNonEmptyString(document.url),
    ) ||
    documents.find((document) => Boolean(toNonEmptyString(document.url)));

  return {
    shippingOfferCode,
    labelUrl: labelDocument ? toNonEmptyString(labelDocument.url) : undefined,
    relayCode,
    raw: isRecord(payload) ? payload : undefined,
  };
}

function getWebhookPayload(payload: unknown) {
  return isRecord(payload) && "payload" in payload ? payload.payload : payload;
}

function normalizeContentCollection(payload: unknown, key: "trackings" | "documents") {
  if (isRecord(payload) && Array.isArray(payload[key])) {
    return { content: payload[key] };
  }
  return payload;
}

export function hasBoxtalShipmentDetails(
  shipment: Partial<BoxtalShipmentResult> | null | undefined,
) {
  return Boolean(
    shipment?.status ||
      shipment?.carrier ||
      shipment?.trackingNumber ||
      shipment?.trackingUrl ||
      shipment?.labelUrl,
  );
}

export function normalizeBoxtalWebhookShipment(
  payload: unknown,
  seed?: Partial<BoxtalShipmentResult>,
): BoxtalShipmentResult {
  const eventPayload = getWebhookPayload(payload);
  const shippingOfferCode = seed?.shippingOfferCode;
  const relayCode = seed?.relayCode;

  return mergeShipmentResults(
    seed,
    {
      boxtalOrderId: findFirstStringByKeys(payload, [
        "shippingOrderId",
        "orderId",
        "id",
        "uuid",
      ]),
      shippingOfferCode,
      relayCode,
    },
    normalizeShipmentResult(payload, shippingOfferCode, relayCode),
    eventPayload === payload
      ? undefined
      : normalizeShipmentResult(eventPayload, shippingOfferCode, relayCode),
    normalizeTrackingResult(
      normalizeContentCollection(eventPayload, "trackings"),
      shippingOfferCode,
      relayCode,
    ),
    normalizeDocumentResult(
      normalizeContentCollection(eventPayload, "documents"),
      shippingOfferCode,
      relayCode,
    ),
  );
}

async function fetchOptionalBoxtalTracking(
  boxtalOrderId: string,
  shippingOfferCode?: string,
  relayCode?: string,
) {
  try {
    const payload = await boxtalFetch(
      `/v3.1/shipping-order/${encodeURIComponent(boxtalOrderId)}/tracking`,
      { method: "GET" },
    );
    return normalizeTrackingResult(payload, shippingOfferCode, relayCode);
  } catch (error) {
    if (error instanceof BoxtalApiError && error.status === 422) {
      return null;
    }
    throw error;
  }
}

async function fetchOptionalBoxtalDocuments(
  boxtalOrderId: string,
  shippingOfferCode?: string,
  relayCode?: string,
) {
  try {
    const payload = await boxtalFetch(
      `/v3.1/shipping-order/${encodeURIComponent(boxtalOrderId)}/shipping-document`,
      { method: "GET" },
    );
    return normalizeDocumentResult(payload, shippingOfferCode, relayCode);
  } catch (error) {
    if (error instanceof BoxtalApiError && error.status === 422) {
      return null;
    }
    throw error;
  }
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

export async function syncBoxtalShipment(
  order: Pick<Order, "boxtalShipment" | "shippingRelay">,
  seed?: Partial<BoxtalShipmentResult>,
) {
  const boxtalOrderId = seed?.boxtalOrderId || order.boxtalShipment?.boxtalOrderId;
  if (!boxtalOrderId) {
    throw new BoxtalApiError(
      "Missing Boxtal order id. Create a shipment first.",
      400,
    );
  }

  const shippingOfferCode =
    seed?.shippingOfferCode || order.boxtalShipment?.shippingOfferCode;
  const relayCode =
    seed?.relayCode || order.shippingRelay?.code || order.boxtalShipment?.relayCode;

  const baseOrderPayload = await boxtalFetch(
    `/v3.1/shipping-order/${encodeURIComponent(boxtalOrderId)}`,
    { method: "GET" },
  );

  const [trackingResult, documentResult] = await Promise.all([
    fetchOptionalBoxtalTracking(boxtalOrderId, shippingOfferCode, relayCode),
    fetchOptionalBoxtalDocuments(boxtalOrderId, shippingOfferCode, relayCode),
  ]);

  return mergeShipmentResults(
    seed,
    normalizeShipmentResult(baseOrderPayload, shippingOfferCode, relayCode),
    trackingResult,
    documentResult,
  );
}
