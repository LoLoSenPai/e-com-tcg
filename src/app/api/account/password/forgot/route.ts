import { NextRequest, NextResponse } from "next/server";
import { getCustomerByEmail } from "@/lib/customers";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getCheckoutBaseUrl } from "@/lib/checkout-validation";

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
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)),
        },
      },
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
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
      const origin = getCheckoutBaseUrl({
        configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        requestOrigin: request.headers.get("origin"),
        requestUrl: request.url,
        isProduction: process.env.NODE_ENV === "production",
      });
      if (!origin) {
        throw new Error("Missing NEXT_PUBLIC_SITE_URL.");
      }
      const resetUrl = `${origin}/account/reset-password?email=${encodeURIComponent(
        customer.email,
      )}&token=${encodeURIComponent(token)}`;
      await sendEmail({
        to: customer.email,
        subject: "Reinitialisation mot de passe - Returners",
        html: `<p>Tu as demande une reinitialisation de mot de passe.</p><p><a href="${resetUrl}">Reinitialiser mon mot de passe</a></p><p>Ce lien expire dans 1 heure.</p>`,
      });
    }
  } catch (error) {
    console.warn(
      "Password reset email failed.",
      error instanceof Error ? error.message : error,
    );
    // Keep response generic to avoid account enumeration.
  }
  return NextResponse.json({ ok: true });
}
