import { NextRequest, NextResponse } from "next/server";
import { createCustomer, getCustomerByEmail } from "@/lib/customers";
import { createCustomerSession, customerCookieName, getCustomerMaxAge } from "@/lib/customer-auth";
import { hashPassword } from "@/lib/customer-password";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const limit = checkRateLimit({
    key: `account-register:${ip}`,
    max: 6,
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
  const password = String(body.password || "");
  const name = String(body.name || "").trim();
  if (!email || !password) {
    return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password too short" }, { status: 400 });
  }
  const existing = await getCustomerByEmail(email);
  if (existing) {
    return NextResponse.json({ error: "Email already used" }, { status: 409 });
  }
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);
  const created = await createCustomer({
    email,
    name,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  });
  if (!created?._id) {
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
  const response = NextResponse.json({
    customer: { _id: created._id, email: created.email, name: created.name },
  });
  response.cookies.set({
    name: customerCookieName,
    value: createCustomerSession(created._id),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getCustomerMaxAge(),
  });
  return response;
}
