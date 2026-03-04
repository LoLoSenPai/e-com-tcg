import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import { BoxtalApiError, getBoxtalShippingOffers } from "@/lib/boxtal";

function isAuthorized(request: NextRequest) {
  const sessionValue = request.cookies.get(adminCookieName)?.value;
  return isAdminSession(sessionValue);
}

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const offers = await getBoxtalShippingOffers();
    return NextResponse.json({ offers });
  } catch (error) {
    if (error instanceof BoxtalApiError) {
      return NextResponse.json(
        {
          error: error.message,
          detail: error.detail,
        },
        { status: error.status || 502 },
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch Boxtal shipping offers" },
      { status: 502 },
    );
  }
}
