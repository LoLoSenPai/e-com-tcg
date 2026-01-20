import crypto from "crypto";

export const adminCookieName = "admin_session";
const maxAgeSeconds = 60 * 60 * 24 * 7;

function getAdminSecret() {
  const secret = process.env.ADMIN_TOKEN;
  if (!secret) {
    throw new Error("Missing ADMIN_TOKEN.");
  }
  return secret;
}

function signSession(timestamp: number, secret: string) {
  return crypto
    .createHmac("sha256", secret)
    .update(String(timestamp))
    .digest("hex");
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function createAdminSession() {
  const secret = getAdminSecret();
  const timestamp = Date.now();
  const signature = signSession(timestamp, secret);
  return `${timestamp}.${signature}`;
}

export function isAdminSession(value?: string | null) {
  if (!value) {
    return false;
  }
  const parts = value.split(".");
  if (parts.length !== 2) {
    return false;
  }
  const [timestampRaw, signature] = parts;
  const timestamp = Number(timestampRaw);
  if (!Number.isFinite(timestamp)) {
    return false;
  }
  const ageMs = Date.now() - timestamp;
  if (ageMs < 0 || ageMs > maxAgeSeconds * 1000) {
    return false;
  }
  let secret: string;
  try {
    secret = getAdminSecret();
  } catch {
    return false;
  }
  const expected = signSession(timestamp, secret);
  return safeEqual(signature, expected);
}

export function getAdminMaxAge() {
  return maxAgeSeconds;
}
