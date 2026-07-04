import { MongoServerError, ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { sampleProducts } from "@/lib/sample-data";
import type { CheckoutSessionItem, Product, StockAdjustment } from "@/lib/types";

const collectionName = "products";

type ProductDocument = Omit<Product, "_id"> & { _id?: ObjectId | string };

let indexesPromise: Promise<void> | null = null;

export class DuplicateProductSlugError extends Error {
  constructor(slug: string) {
    super(`Product slug already exists: ${slug}`);
    this.name = "DuplicateProductSlugError";
  }
}

export class ProductLookupError extends Error {
  constructor(message = "Product catalog unavailable.") {
    super(message);
    this.name = "ProductLookupError";
  }
}

function isDuplicateKeyError(error: unknown) {
  return error instanceof MongoServerError && error.code === 11000;
}

async function ensureIndexes() {
  if (!indexesPromise) {
    indexesPromise = getDb().then(async (db) => {
      try {
        await db
          .collection<ProductDocument>(collectionName)
          .createIndex({ slug: 1 }, { unique: true });
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          console.warn(
            "Products slug unique index could not be created because duplicates already exist.",
          );
          return;
        }
        throw error;
      }
    });
  }
  return indexesPromise;
}

function normalizeProduct(doc: ProductDocument): Product {
  return {
    ...doc,
    _id: doc._id ? String(doc._id) : undefined,
    price: Number(doc.price),
    stock: doc.stock ?? 0,
  };
}

const sampleBySlug = new Map(sampleProducts.map((item) => [item.slug, item]));

function canUseSampleProducts() {
  return process.env.NODE_ENV !== "production";
}

function applySampleFallback(product: Product): Product {
  if (!canUseSampleProducts()) {
    return product;
  }

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
    if (canUseSampleProducts()) {
      return sampleProducts;
    }
    throw new ProductLookupError("Missing MONGODB_URI.");
  }
  try {
    const db = await getDb();
    const docs = await db
      .collection<ProductDocument>(collectionName)
      .find({})
      .toArray();
    if (docs.length === 0) {
      return canUseSampleProducts() ? sampleProducts : [];
    }
    return docs.map(normalizeProduct).map(applySampleFallback);
  } catch (error) {
    if (canUseSampleProducts()) {
      return sampleProducts;
    }
    throw new ProductLookupError(
      error instanceof Error ? error.message : undefined,
    );
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (!process.env.MONGODB_URI) {
    if (canUseSampleProducts()) {
      return sampleProducts.find((item) => item.slug === slug) ?? null;
    }
    throw new ProductLookupError("Missing MONGODB_URI.");
  }
  try {
    const db = await getDb();
    const doc = await db
      .collection<ProductDocument>(collectionName)
      .findOne({ slug });
    if (doc) {
      return applySampleFallback(normalizeProduct(doc));
    }
    return canUseSampleProducts()
      ? sampleProducts.find((item) => item.slug === slug) ?? null
      : null;
  } catch (error) {
    if (canUseSampleProducts()) {
      return sampleProducts.find((item) => item.slug === slug) ?? null;
    }
    throw new ProductLookupError(
      error instanceof Error ? error.message : undefined,
    );
  }
}

export async function getProductsBySlugs(slugs: string[]): Promise<Product[]> {
  if (!process.env.MONGODB_URI) {
    if (canUseSampleProducts()) {
      return sampleProducts.filter((item) => slugs.includes(item.slug));
    }
    throw new ProductLookupError("Missing MONGODB_URI.");
  }
  try {
    const db = await getDb();
    const docs = await db
      .collection<ProductDocument>(collectionName)
      .find({ slug: { $in: slugs } })
      .toArray();
    if (docs.length === 0) {
      return canUseSampleProducts()
        ? sampleProducts.filter((item) => slugs.includes(item.slug))
        : [];
    }
    return docs.map(normalizeProduct).map(applySampleFallback);
  } catch (error) {
    if (canUseSampleProducts()) {
      return sampleProducts.filter((item) => slugs.includes(item.slug));
    }
    throw new ProductLookupError(
      error instanceof Error ? error.message : undefined,
    );
  }
}

export async function getProductsBySlugsStrict(
  slugs: string[],
): Promise<Product[]> {
  if (!process.env.MONGODB_URI) {
    throw new ProductLookupError("Missing MONGODB_URI.");
  }

  try {
    const db = await getDb();
    const docs = await db
      .collection<ProductDocument>(collectionName)
      .find({ slug: { $in: slugs } })
      .toArray();
    return docs.map(normalizeProduct);
  } catch (error) {
    if (error instanceof ProductLookupError) {
      throw error;
    }
    throw new ProductLookupError(
      error instanceof Error ? error.message : undefined,
    );
  }
}

export async function createProduct(product: Product) {
  await ensureIndexes();
  const db = await getDb();
  const collection = db.collection<ProductDocument>(collectionName);
  const payload = normalizeProduct(product);
  const duplicate = await collection.findOne({ slug: payload.slug });
  if (duplicate) {
    throw new DuplicateProductSlugError(payload.slug);
  }

  const insertPayload: ProductDocument = { ...payload };
  delete insertPayload._id;
  try {
    const result = await collection.insertOne(insertPayload);
    return normalizeProduct({ ...insertPayload, _id: result.insertedId });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new DuplicateProductSlugError(payload.slug);
    }
    throw error;
  }
}

export async function updateProductBySlug(
  slug: string,
  updates: Partial<Product>,
) {
  await ensureIndexes();
  const db = await getDb();
  const collection = db.collection<ProductDocument>(collectionName);
  const current = await collection.findOne({ slug });
  if (!current) {
    return null;
  }

  const payload: Partial<Product> = { ...updates };
  if (typeof payload.price === "number") {
    payload.price = Number(payload.price);
  }
  if (typeof payload.stock === "number") {
    payload.stock = Number(payload.stock);
  }
  delete payload._id;

  if (payload.slug && payload.slug !== slug) {
    const duplicate = await collection.findOne({ slug: payload.slug });
    if (duplicate && String(duplicate._id) !== String(current._id)) {
      throw new DuplicateProductSlugError(payload.slug);
    }
  }

  try {
    const setPayload: Record<string, unknown> = {};
    const unsetPayload: Record<string, ""> = {};
    for (const [field, value] of Object.entries(payload)) {
      if (value === undefined) {
        unsetPayload[field] = "";
      } else {
        setPayload[field] = value;
      }
    }

    const update: {
      $set?: Record<string, unknown>;
      $unset?: Record<string, "">;
    } = {};
    if (Object.keys(setPayload).length > 0) {
      update.$set = setPayload;
    }
    if (Object.keys(unsetPayload).length > 0) {
      update.$unset = unsetPayload;
    }
    if (Object.keys(update).length === 0) {
      return normalizeProduct(current);
    }

    await collection.updateOne({ _id: current._id }, update);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new DuplicateProductSlugError(payload.slug || slug);
    }
    throw error;
  }
  const doc = await collection.findOne({ _id: current._id });
  return doc ? normalizeProduct(doc) : null;
}

export async function deleteProductBySlug(slug: string) {
  const db = await getDb();
  const collection = db.collection<ProductDocument>(collectionName);
  const doc = await collection.findOne({ slug });
  if (!doc) {
    return null;
  }
  await collection.deleteOne({ _id: doc._id });
  return doc ? normalizeProduct(doc) : null;
}

export async function decrementProductStocks(
  items: Array<Pick<CheckoutSessionItem, "slug" | "quantity">>,
): Promise<StockAdjustment[]> {
  const db = await getDb();
  const adjustments: StockAdjustment[] = [];

  for (const item of items) {
    const result = await db.collection<ProductDocument>(collectionName).updateOne(
      { slug: item.slug, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } },
    );

    adjustments.push({
      slug: item.slug,
      quantity: item.quantity,
      applied: result.modifiedCount === 1,
      reason:
        result.modifiedCount === 1
          ? undefined
          : "Stock insuffisant ou produit introuvable au moment du paiement.",
    });
  }

  return adjustments;
}

export async function seedProducts() {
  await ensureIndexes();
  const db = await getDb();
  const collection = db.collection<ProductDocument>(collectionName);
  const existing = await collection.countDocuments();
  if (existing > 0) {
    return { inserted: 0 };
  }
  const payload = sampleProducts.map(normalizeProduct);
  const result = await collection.insertMany(payload);
  return { inserted: result.insertedCount };
}
