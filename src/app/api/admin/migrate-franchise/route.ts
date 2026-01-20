import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import type { Product } from "@/lib/types";

function isAuthorized(request: NextRequest) {
  const sessionValue = request.cookies.get(adminCookieName)?.value;
  return isAdminSession(sessionValue);
}

function inferFranchise(product: Product) {
  const haystack = `${product.name} ${product.slug} ${product.tags?.join(" ") ?? ""}`
    .toLowerCase();
  if (haystack.includes("one piece")) {
    return "One Piece";
  }
  if (haystack.includes("pokemon")) {
    return "Pokemon";
  }
  if (product.category.toLowerCase() === "protection") {
    return "Both";
  }
  return "Pokemon";
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

  const db = await getDb();
  const collection = db.collection<Product>("products");
  const docs = await collection.find({ franchise: { $exists: false } }).toArray();
  let updated = 0;

  for (const doc of docs) {
    const franchise = inferFranchise(doc);
    await collection.updateOne(
      { _id: doc._id },
      { $set: { franchise } },
    );
    updated += 1;
  }

  return NextResponse.json({ updated });
}
