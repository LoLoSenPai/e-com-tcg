import { NextResponse } from "next/server";
import { createCustomer, getCustomerByEmail } from "@/lib/customers";
import { createCustomerSession, customerCookieName, getCustomerMaxAge } from "@/lib/customer-auth";
import { hashPassword } from "@/lib/customer-password";

export async function POST(request: Request) {
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
