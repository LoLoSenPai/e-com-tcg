import { NextResponse } from "next/server";
import { getCustomerByEmail } from "@/lib/customers";
import { createCustomerSession, customerCookieName, getCustomerMaxAge } from "@/lib/customer-auth";
import { verifyPassword } from "@/lib/customer-password";

export async function POST(request: Request) {
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
