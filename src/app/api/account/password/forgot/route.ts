import { NextRequest, NextResponse } from "next/server";
import { getCustomerByEmail } from "@/lib/customers";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const limit = checkRateLimit({
    key: `forgot:${ip}`,
    max: 5,
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
  if (!email) {
    return NextResponse.json({ ok: true });
  }
  try {
    const customer = await getCustomerByEmail(email);
    if (customer?._id) {
      const token = await createPasswordResetToken({
        customerId: customer._id,
        email: customer.email,
      });
      const origin =
        request.headers.get("origin") ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000";
      const resetUrl = `${origin}/account/reset-password?email=${encodeURIComponent(
        customer.email,
      )}&token=${encodeURIComponent(token)}`;
      await sendEmail({
        to: customer.email,
        subject: "Reinitialisation mot de passe - Nebula TCG",
        html: `<p>Tu as demande une reinitialisation de mot de passe.</p><p><a href="${resetUrl}">Reinitialiser mon mot de passe</a></p><p>Ce lien expire dans 1 heure.</p>`,
      });
    }
  } catch {
    // Keep response generic to avoid account enumeration.
  }
  return NextResponse.json({ ok: true });
}
