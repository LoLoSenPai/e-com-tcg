import { NextRequest, NextResponse } from "next/server";
import {
  adminCookieName,
  createAdminSession,
  getAdminMaxAge,
  verifyAdminToken,
} from "@/lib/admin-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const limit = checkRateLimit({
    key: `admin-login:${ip}`,
    max: 8,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          ...noStoreHeaders,
          "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)),
        },
      },
    );
  }
  const body = await request.json().catch(() => ({}));
  if (!verifyAdminToken(body?.token)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const response = NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  response.cookies.set({
    name: adminCookieName,
    value: createAdminSession(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getAdminMaxAge(),
  });
  return response;
}
