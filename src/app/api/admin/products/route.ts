import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import { createProduct, getProducts } from "@/lib/products";

function isAuthorized(request: NextRequest) {
  const sessionValue = request.cookies.get(adminCookieName)?.value;
  return isAdminSession(sessionValue);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: "MONGODB_URI missing" },
      { status: 400 },
    );
  }
  const products = await getProducts();
  return NextResponse.json({ products });
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
  const {
    name,
    slug,
    category,
    franchise,
    price,
    description,
    badge,
    tags,
    stock,
    image,
  } = body;

  if (!name || !slug || !category || !price || !description) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const payload = {
    name,
    slug,
    category,
    franchise,
    price: Number(price),
    description,
    badge,
    image,
    tags:
      typeof tags === "string"
        ? tags.split(",").map((tag: string) => tag.trim())
        : Array.isArray(tags)
          ? tags
          : undefined,
    stock: stock ? Number(stock) : undefined,
  };

  const created = await createProduct(payload);
  return NextResponse.json({ product: created });
}
