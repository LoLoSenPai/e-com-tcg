import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import { sendTrackedEmail } from "@/lib/email";

function isAuthorized(request: NextRequest) {
  const sessionValue = request.cookies.get(adminCookieName)?.value;
  return isAdminSession(sessionValue);
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const to = normalizeEmail(body?.to);
  if (!isValidEmail(to)) {
    return NextResponse.json({ error: "Invalid recipient email" }, { status: 400 });
  }

  try {
    const event = await sendTrackedEmail({
      type: "test_email",
      to,
      subject: "Test email Returners",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
          <h1 style="font-size:20px;margin:0 0 12px">Email test Returners</h1>
          <p>Si tu lis ce message, Resend et l'adresse expediteur sont operationnels.</p>
          <p style="font-size:12px;color:#6b7280">Envoye depuis l'admin Returners.</p>
        </div>
      `,
    });

    return NextResponse.json({ event });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to send test email",
      },
      { status: 502 },
    );
  }
}
