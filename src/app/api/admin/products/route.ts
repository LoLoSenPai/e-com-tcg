import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import {
  createProduct,
  DuplicateProductSlugError,
  ProductLookupError,
  getProducts,
} from "@/lib/products";
import { validateAdminProductInput } from "@/lib/product-validation";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

function isAuthorized(request: NextRequest) {
  const sessionValue = request.cookies.get(adminCookieName)?.value;
  return isAdminSession(sessionValue);
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
      { error: "MONGODB_URI missing" },
      { status: 400, headers: noStoreHeaders },
    );
  }
  try {
    const products = await getProducts();
    return NextResponse.json({ products }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof ProductLookupError) {
      return NextResponse.json(
        { error: "Product catalog unavailable" },
        { status: 503, headers: noStoreHeaders },
      );
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: "MONGODB_URI missing" },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const validation = validateAdminProductInput(body);
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 },
    );
  }

  try {
    const created = await createProduct(validation.product as Product);
    return NextResponse.json({ product: created });
  } catch (error) {
    if (error instanceof DuplicateProductSlugError) {
      return NextResponse.json(
        { error: "Product slug already exists" },
        { status: 409 },
      );
    }
    throw error;
  }
}
