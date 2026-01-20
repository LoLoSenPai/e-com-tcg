import { NextRequest, NextResponse } from "next/server";
import { createProduct } from "@/lib/products";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { name, slug, category, price, description, badge, tags, stock, image } =
    body;

  const sessionValue = request.cookies.get(adminCookieName)?.value;
  if (!isAdminSession(sessionValue)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: "MONGODB_URI missing" },
      { status: 400 },
    );
  }

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
    price: Number(price),
    description,
    badge,
    image,
    tags:
      typeof tags === "string"
        ? tags.split(",").map((tag: string) => tag.trim())
        : undefined,
    stock: stock ? Number(stock) : undefined,
  };

  const created = await createProduct(payload);
  return NextResponse.json({ product: created });
}
