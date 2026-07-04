import { MongoServerError, ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { Customer } from "@/lib/types";

const collectionName = "customers";
type DbCustomer = Omit<Customer, "_id"> & { _id?: ObjectId };

let indexesPromise: Promise<void> | null = null;

export class DuplicateCustomerEmailError extends Error {
  constructor(email: string) {
    super(`Customer email already exists: ${email}`);
    this.name = "DuplicateCustomerEmailError";
  }
}

export function normalizeCustomerEmail(email: string) {
  return email.trim().toLowerCase();
}

function isDuplicateKeyError(error: unknown) {
  return error instanceof MongoServerError && error.code === 11000;
}

async function ensureIndexes() {
  if (!indexesPromise) {
    indexesPromise = getDb().then(async (db) => {
      try {
        await db
          .collection<DbCustomer>(collectionName)
          .createIndex({ email: 1 }, { unique: true });
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          console.warn(
            "Customers email unique index could not be created because duplicates already exist.",
          );
          return;
        }
        throw error;
      }
    });
  }
  return indexesPromise;
}

function toPublicCustomer(doc: DbCustomer | null) {
  if (!doc) return null;
  return {
    ...doc,
    _id: doc._id ? String(doc._id) : undefined,
  };
}

export async function getCustomerByEmail(email: string) {
  const db = await getDb();
  const doc = await db
    .collection<DbCustomer>(collectionName)
    .findOne({ email: normalizeCustomerEmail(email) });
  return toPublicCustomer(doc);
}

export async function getCustomerById(id: string) {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  const db = await getDb();
  const doc = await db
    .collection<DbCustomer>(collectionName)
    .findOne({ _id: new ObjectId(id) });
  return toPublicCustomer(doc);
}

export async function createCustomer(input: Omit<Customer, "_id">) {
  await ensureIndexes();
  const db = await getDb();
  const payload: DbCustomer = {
    ...input,
    email: normalizeCustomerEmail(input.email),
  };
  try {
    await db.collection<DbCustomer>(collectionName).insertOne(payload);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new DuplicateCustomerEmailError(payload.email);
    }
    throw error;
  }
  return getCustomerByEmail(input.email);
}

export function buildCustomerUpdateDocument(
  updates: Partial<Omit<Customer, "_id">>,
) {
  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      unset[key] = "";
    } else {
      set[key] =
        key === "email" && typeof value === "string"
          ? normalizeCustomerEmail(value)
          : value;
    }
  }

  const update: {
    $set?: Record<string, unknown>;
    $unset?: Record<string, "">;
  } = {};
  if (Object.keys(set).length > 0) {
    update.$set = set;
  }
  if (Object.keys(unset).length > 0) {
    update.$unset = unset;
  }
  return update;
}

export async function updateCustomerById(
  id: string,
  updates: Partial<Omit<Customer, "_id">>,
) {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  const db = await getDb();
  const update = buildCustomerUpdateDocument(updates);
  if (!update.$set && !update.$unset) {
    return getCustomerById(id);
  }

  await db
    .collection<DbCustomer>(collectionName)
    .updateOne({ _id: new ObjectId(id) }, update);
  return getCustomerById(id);
}

export async function updateCustomerPasswordById(id: string, passwordHash: string) {
  const now = new Date().toISOString();
  return updateCustomerById(id, { passwordHash, updatedAt: now });
}
