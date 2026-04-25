import crypto from "crypto";
import type { NextRequest } from "next/server";
import { getCustomerById } from "@/lib/customers";

export const customerCookieName = "customer_session";
const maxAgeSeconds = 60 * 60 * 24 * 30;

function getSecret() {
  if (process.env.CUSTOMER_SESSION_SECRET) {
    return process.env.CUSTOMER_SESSION_SECRET;
  }
  if (process.env.NODE_ENV !== "production") {
    return process.env.ADMIN_TOKEN || "dev-secret";
  }
  throw new Error("Missing CUSTOMER_SESSION_SECRET.");
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function createCustomerSession(customerId: string) {
  const ts = Date.now().toString();
  const value = `${customerId}.${ts}`;
  return `${value}.${sign(value)}`;
}

export function parseCustomerSession(raw?: string | null) {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [customerId, ts, signature] = parts;
  const value = `${customerId}.${ts}`;
  if (!safeEqual(signature, sign(value))) return null;
  const ageMs = Date.now() - Number(ts);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > maxAgeSeconds * 1000) {
    return null;
  }
  return customerId;
}

export function getCustomerMaxAge() {
  return maxAgeSeconds;
}

export async function getCustomerFromRequest(request: NextRequest | Request) {
  let raw: string | undefined;
  if ("cookies" in request) {
    raw = request.cookies.get(customerCookieName)?.value;
  } else {
    const cookieHeader = request.headers.get("cookie") ?? "";
    raw = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${customerCookieName}=`))
      ?.split("=")[1];
  }
  const id = parseCustomerSession(raw);
  if (!id) return null;
  try {
    return await getCustomerById(id);
  } catch {
    return null;
  }
}
