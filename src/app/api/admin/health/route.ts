import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import { getProductionSiteUrlProblem } from "@/lib/checkout-validation";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type Check = {
  ok: boolean;
  label: string;
  detail?: string;
};

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

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

function requiredConfigured(name: string, label: string, detail: string): Check {
  const check = configured(name, label);
  return check.ok ? check : { ...check, detail };
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

function siteUrlCheck(): Check {
  const label = "Public site URL";
  if (process.env.NODE_ENV === "production") {
    const problem = getProductionSiteUrlProblem(process.env.NEXT_PUBLIC_SITE_URL);
    return problem ? { label, ok: false, detail: problem } : { label, ok: true };
  }

  return validUrl("NEXT_PUBLIC_SITE_URL", label);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders },
    );
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
    siteUrl: siteUrlCheck(),
    blobToken:
      process.env.NODE_ENV === "production"
        ? requiredConfigured(
            "BLOB_READ_WRITE_TOKEN",
            "Vercel Blob token",
            "Required for admin image uploads in production.",
          )
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
    boxtalShipperName: configured("BOXTAL_SHIPPER_NAME", "Boxtal shipper name"),
    boxtalShipperEmail: configured(
      "BOXTAL_SHIPPER_EMAIL",
      "Boxtal shipper email",
    ),
    boxtalShipperPhone: configured(
      "BOXTAL_SHIPPER_PHONE",
      "Boxtal shipper phone",
    ),
    boxtalShipperStreet: configured(
      "BOXTAL_SHIPPER_STREET1",
      "Boxtal shipper street",
    ),
    boxtalShipperZip: configured(
      "BOXTAL_SHIPPER_ZIP_CODE",
      "Boxtal shipper zip code",
    ),
    boxtalShipperCity: configured(
      "BOXTAL_SHIPPER_CITY",
      "Boxtal shipper city",
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

  return NextResponse.json(
    {
      ok,
      environment: process.env.NODE_ENV,
      checkedAt: new Date().toISOString(),
      checks: allChecks,
    },
    { headers: noStoreHeaders },
  );
}
