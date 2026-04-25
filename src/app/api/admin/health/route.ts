import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";

type Check = {
  ok: boolean;
  label: string;
  detail?: string;
};

function isAuthorized(request: NextRequest) {
  const sessionValue = request.cookies.get(adminCookieName)?.value;
  return isAdminSession(sessionValue);
}

function configured(name: string, label = name): Check {
  return {
    label,
    ok: Boolean(process.env[name]?.trim()),
  };
}

function validUrl(name: string, label = name): Check {
  const raw = process.env[name];
  if (!raw) {
    return { label, ok: false };
  }
  try {
    new URL(raw);
    return { label, ok: true };
  } catch {
    return { label, ok: false, detail: "Invalid URL" };
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checks: Record<string, Check> = {
    mongoEnv: configured("MONGODB_URI", "MongoDB URI"),
    mongoDbName: {
      ok: true,
      label: "MongoDB database",
      detail: process.env.MONGODB_DB ? undefined : "Default: nebula_tcg",
    },
    stripeKey: configured("STRIPE_SECRET_KEY", "Stripe secret key"),
    stripeWebhook: configured("STRIPE_WEBHOOK_SECRET", "Stripe webhook secret"),
    resendKey: configured("RESEND_API_KEY", "Resend API key"),
    emailFrom: configured("EMAIL_FROM", "Email sender"),
    customerSecret: configured(
      "CUSTOMER_SESSION_SECRET",
      "Customer session secret",
    ),
    siteUrl: validUrl("NEXT_PUBLIC_SITE_URL", "Public site URL"),
    blobToken:
      process.env.NODE_ENV === "production"
        ? configured("BLOB_READ_WRITE_TOKEN", "Vercel Blob token")
        : { ok: true, label: "Vercel Blob token", detail: "Optional in development" },
    boxtalApiKey: configured("BOXTAL_API_ACCESS_KEY", "Boxtal API access key"),
    boxtalApiSecret: configured("BOXTAL_API_SECRET_KEY", "Boxtal API secret key"),
    boxtalMapKey: configured("BOXTAL_MAP_ACCESS_KEY", "Boxtal map access key"),
    boxtalMapSecret: configured(
      "BOXTAL_MAP_SECRET_KEY",
      "Boxtal map secret key",
    ),
    boxtalWebhook: configured("BOXTAL_WEBHOOK_SECRET", "Boxtal webhook secret"),
    boxtalHomeOffer: configured(
      "BOXTAL_SHIPPING_OFFER_CODE_HOME",
      "Boxtal home offer",
    ),
    boxtalRelayOffer: configured(
      "BOXTAL_SHIPPING_OFFER_CODE_RELAY",
      "Boxtal relay offer",
    ),
  };

  let mongoPing: Check = { label: "MongoDB ping", ok: false };
  if (checks.mongoEnv.ok) {
    try {
      const db = await getDb();
      await db.command({ ping: 1 });
      mongoPing = { label: "MongoDB ping", ok: true };
    } catch (error) {
      mongoPing = {
        label: "MongoDB ping",
        ok: false,
        detail: error instanceof Error ? error.message : "MongoDB ping failed",
      };
    }
  }

  const allChecks = { ...checks, mongoPing };
  const ok = Object.values(allChecks).every((check) => check.ok);

  return NextResponse.json({
    ok,
    environment: process.env.NODE_ENV,
    checkedAt: new Date().toISOString(),
    checks: allChecks,
  });
}
