import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import { isAdminDebugRouteEnabled } from "@/lib/admin-route-flags";
import { debugBoxtalAuthProbe } from "@/lib/boxtal";

export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const sessionValue = request.cookies.get(adminCookieName)?.value;
  return isAdminSession(sessionValue);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminDebugRouteEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const report = await debugBoxtalAuthProbe();
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to run Boxtal auth probe",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
