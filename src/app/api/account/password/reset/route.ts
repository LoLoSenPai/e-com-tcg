import { NextRequest, NextResponse } from "next/server";
import { consumePasswordResetToken } from "@/lib/password-reset";
import { hashPassword } from "@/lib/customer-password";
import { updateCustomerPasswordById } from "@/lib/customers";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const limit = checkRateLimit({
    key: `reset:${ip}`,
    max: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const token = String(body.token || "");
  const password = String(body.password || "");
  if (!email || !token || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password too short" }, { status: 400 });
  }
  const resetDoc = await consumePasswordResetToken({ email, token });
  if (!resetDoc) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }
  const passwordHash = await hashPassword(password);
  await updateCustomerPasswordById(resetDoc.customerId, passwordHash);
  return NextResponse.json({ ok: true });
}
