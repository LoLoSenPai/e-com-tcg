import { NextRequest, NextResponse } from "next/server";
import { getCustomerByEmail } from "@/lib/customers";
import { createCustomerSession, customerCookieName, getCustomerMaxAge } from "@/lib/customer-auth";
import { verifyPassword } from "@/lib/customer-password";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const limit = checkRateLimit({
    key: `account-login:${ip}`,
    max: 8,
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
  if (!email || !password) {
    return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
  }
  const customer = await getCustomerByEmail(email);
  if (!customer || !customer.passwordHash) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const valid = await verifyPassword(password, customer.passwordHash);
  if (!valid || !customer._id) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const response = NextResponse.json({
    customer: { _id: customer._id, email: customer.email, name: customer.name },
  });
  response.cookies.set({
    name: customerCookieName,
    value: createCustomerSession(customer._id),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getCustomerMaxAge(),
  });
  return response;
}
