import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import { deleteProductBySlug, updateProductBySlug } from "@/lib/products";

function isAuthorized(request: NextRequest) {
  const sessionValue = request.cookies.get(adminCookieName)?.value;
  return isAdminSession(sessionValue);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
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
  const payload = {
    ...body,
    price: body.price ? Number(body.price) : undefined,
    stock: body.stock ? Number(body.stock) : undefined,
    tags:
      typeof body.tags === "string"
        ? body.tags.split(",").map((tag: string) => tag.trim())
        : body.tags,
  };

  const updated = await updateProductBySlug(slug, payload);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ product: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: "MONGODB_URI missing" },
      { status: 400 },
    );
  }
  const deleted = await deleteProductBySlug(slug);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
