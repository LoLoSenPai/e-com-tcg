import { NextRequest, NextResponse } from "next/server";
import { seedProducts } from "@/lib/products";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import { isAdminMaintenanceRouteEnabled } from "@/lib/admin-route-flags";

export async function POST(request: NextRequest) {
  const sessionValue = request.cookies.get(adminCookieName)?.value;
  if (!isAdminSession(sessionValue)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }
  if (!isAdminMaintenanceRouteEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: "MONGODB_URI missing" },
      { status: 400 },
    );
  }
  const result = await seedProducts();
  return NextResponse.json(result);
}
