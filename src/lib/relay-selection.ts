import { createHmac, timingSafeEqual } from "crypto";
import type { ShippingRelayPoint } from "@/lib/types";

const defaultTtlMs = 30 * 60 * 1000;
const tokenVersion = 1;

export type SignedShippingRelayPoint = ShippingRelayPoint & {
  selectionToken: string;
};

type RelaySelectionPayload = {
  v: typeof tokenVersion;
  exp: number;
  relay: ShippingRelayPoint;
};

type RelayValidationResult =
  | { ok: true; relayPoint: ShippingRelayPoint }
  | { ok: false; error: string };

function readString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function readNumber(value: unknown, min: number, max: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return undefined;
  }
  if (numberValue < min || numberValue > max) {
    return undefined;
  }
  return Number(numberValue.toFixed(6));
}

function getRelaySecret(env: NodeJS.ProcessEnv = process.env) {
  const secret = env.CUSTOMER_SESSION_SECRET || env.ADMIN_TOKEN;
  if (!secret && env.NODE_ENV === "production") {
    throw new Error("Missing CUSTOMER_SESSION_SECRET for relay selection signing.");
  }
  return secret || "dev-relay-selection-secret";
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string, secret = getRelaySecret()) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function normalizeRelayPointInput(input: unknown): RelayValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Invalid relay point." };
  }

  const value = input as Record<string, unknown>;
  const address =
    value.address && typeof value.address === "object" && !Array.isArray(value.address)
      ? (value.address as Record<string, unknown>)
      : {};

  const code = readString(value.code, 100);
  const name = readString(value.name, 200);
  const network = readString(value.network, 80);
  const zipCode = readString(address.zipCode, 30);
  const city = readString(address.city, 100);
  const country = readString(address.country, 10) || "FR";
  const line1 = readString(address.line1, 250);

  if (!code || !/^[A-Za-z0-9_.:-]{2,100}$/.test(code)) {
    return { ok: false, error: "Invalid relay point code." };
  }
  if (!name) {
    return { ok: false, error: "Relay point name is required." };
  }
  if (!zipCode || !/^[A-Za-z0-9 -]{2,30}$/.test(zipCode)) {
    return { ok: false, error: "Relay point zip code is required." };
  }
  if (!city) {
    return { ok: false, error: "Relay point city is required." };
  }
  if (!/^(FR|FRA|BE|BEL|CH|CHE|LU|LUX)$/i.test(country)) {
    return { ok: false, error: "Relay point country is not supported." };
  }
  if (network && !/^[A-Za-z0-9_.:-]{2,80}$/.test(network)) {
    return { ok: false, error: "Invalid relay point network." };
  }

  const relayPoint: ShippingRelayPoint = {
    code,
    name,
    network,
    address: {
      line1,
      zipCode,
      city,
      country: country.toUpperCase(),
    },
    latitude: readNumber(value.latitude, -90, 90),
    longitude: readNumber(value.longitude, -180, 180),
  };

  return { ok: true, relayPoint };
}

export function signRelayPointSelection(
  relayPoint: ShippingRelayPoint,
  {
    now = Date.now(),
    ttlMs = defaultTtlMs,
  }: {
    now?: number;
    ttlMs?: number;
  } = {},
) {
  const normalized = normalizeRelayPointInput(relayPoint);
  if (!normalized.ok) {
    return normalized;
  }

  const payload: RelaySelectionPayload = {
    v: tokenVersion,
    exp: now + ttlMs,
    relay: normalized.relayPoint,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);

  return {
    ok: true as const,
    relayPoint: normalized.relayPoint,
    token: `${encodedPayload}.${signature}`,
  };
}

export function verifyRelayPointSelection(
  input: unknown,
  now = Date.now(),
): RelayValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Invalid relay point." };
  }

  const value = input as Record<string, unknown>;
  const token = readString(value.selectionToken, 4096);
  if (!token) {
    return { ok: false, error: "Relay point selection is not signed." };
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return { ok: false, error: "Relay point selection token is invalid." };
  }

  const expectedSignature = signPayload(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) {
    return { ok: false, error: "Relay point selection token is invalid." };
  }

  let payload: RelaySelectionPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as RelaySelectionPayload;
  } catch {
    return { ok: false, error: "Relay point selection token is invalid." };
  }

  if (payload.v !== tokenVersion || !payload.exp || payload.exp <= now) {
    return { ok: false, error: "Relay point selection has expired." };
  }

  const normalizedCurrent = normalizeRelayPointInput(value);
  if (!normalizedCurrent.ok) {
    return normalizedCurrent;
  }
  const normalizedPayload = normalizeRelayPointInput(payload.relay);
  if (!normalizedPayload.ok) {
    return { ok: false, error: "Relay point selection token is invalid." };
  }

  if (
    JSON.stringify(normalizedCurrent.relayPoint) !==
    JSON.stringify(normalizedPayload.relayPoint)
  ) {
    return { ok: false, error: "Relay point selection was modified." };
  }

  return { ok: true, relayPoint: normalizedPayload.relayPoint };
}
