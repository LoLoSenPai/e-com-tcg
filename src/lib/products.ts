import { getDb } from "@/lib/db";
import { sampleProducts } from "@/lib/sample-data";
import type { Product } from "@/lib/types";

const collectionName = "products";

function normalizeProduct(doc: Product): Product {
  return {
    ...doc,
    _id: doc._id ? String(doc._id) : undefined,
    price: Number(doc.price),
    stock: doc.stock ?? 0,
  };
}

const sampleBySlug = new Map(sampleProducts.map((item) => [item.slug, item]));

function applySampleFallback(product: Product): Product {
  const sample = sampleBySlug.get(product.slug);
  if (!sample) return product;
  return {
    ...sample,
    ...product,
    image: product.image || sample.image,
    badge: product.badge || sample.badge,
    tags: product.tags?.length ? product.tags : sample.tags,
  };
}

export async function getProducts(): Promise<Product[]> {
  if (!process.env.MONGODB_URI) {
    return sampleProducts;
  }
  try {
    const db = await getDb();
    const docs = await db
      .collection<Product>(collectionName)
      .find({})
      .toArray();
    if (docs.length === 0) {
      return sampleProducts;
    }
    return docs.map(normalizeProduct).map(applySampleFallback);
  } catch {
    return sampleProducts;
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (!process.env.MONGODB_URI) {
    return sampleProducts.find((item) => item.slug === slug) ?? null;
  }
  try {
    const db = await getDb();
    const doc = await db
      .collection<Product>(collectionName)
      .findOne({ slug });
    if (doc) {
      return applySampleFallback(normalizeProduct(doc));
    }
    return sampleProducts.find((item) => item.slug === slug) ?? null;
  } catch {
    return sampleProducts.find((item) => item.slug === slug) ?? null;
  }
}

export async function getProductsBySlugs(slugs: string[]): Promise<Product[]> {
  if (!process.env.MONGODB_URI) {
    return sampleProducts.filter((item) => slugs.includes(item.slug));
  }
  try {
    const db = await getDb();
    const docs = await db
      .collection<Product>(collectionName)
      .find({ slug: { $in: slugs } })
      .toArray();
    if (docs.length === 0) {
      return sampleProducts.filter((item) => slugs.includes(item.slug));
    }
    return docs.map(normalizeProduct).map(applySampleFallback);
  } catch {
    return sampleProducts.filter((item) => slugs.includes(item.slug));
  }
}

export async function createProduct(product: Product) {
  const db = await getDb();
  const payload = normalizeProduct(product);
  await db.collection<Product>(collectionName).insertOne(payload);
  return payload;
}

export async function updateProductBySlug(
  slug: string,
  updates: Partial<Product>,
) {
  const db = await getDb();
  const payload: Partial<Product> = { ...updates };
  if (typeof payload.price === "number") {
    payload.price = Number(payload.price);
  }
  if (typeof payload.stock === "number") {
    payload.stock = Number(payload.stock);
  }
  await db
    .collection<Product>(collectionName)
    .updateOne({ slug }, { $set: payload });
  const doc = await db.collection<Product>(collectionName).findOne({ slug });
  return doc ? normalizeProduct(doc) : null;
}

export async function deleteProductBySlug(slug: string) {
  const db = await getDb();
  const doc = await db.collection<Product>(collectionName).findOne({ slug });
  await db.collection<Product>(collectionName).deleteOne({ slug });
  return doc ? normalizeProduct(doc) : null;
}

export async function seedProducts() {
  const db = await getDb();
  const existing = await db.collection<Product>(collectionName).countDocuments();
  if (existing > 0) {
    return { inserted: 0 };
  }
  const payload = sampleProducts.map(normalizeProduct);
  const result = await db.collection<Product>(collectionName).insertMany(payload);
  return { inserted: result.insertedCount };
}
