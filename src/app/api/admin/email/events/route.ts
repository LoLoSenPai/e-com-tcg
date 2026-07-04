import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import { getRecentEmailEvents } from "@/lib/email-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

function isAuthorized(request: NextRequest) {
  const sessionValue = request.cookies.get(adminCookieName)?.value;
  return isAdminSession(sessionValue);
}

function parseLimit(value: string | null) {
  if (!value) {
    return 20;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 20;
  }
  return Math.min(Math.max(Math.floor(parsed), 1), 50);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: "Missing MONGODB_URI" },
      { status: 503, headers: noStoreHeaders },
    );
  }

  try {
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
    const events = await getRecentEmailEvents(limit);
    return NextResponse.json({ events }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load email events",
      },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
