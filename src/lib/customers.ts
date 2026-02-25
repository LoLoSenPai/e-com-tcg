import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { Customer } from "@/lib/types";

const collectionName = "customers";
type DbCustomer = Omit<Customer, "_id"> & { _id?: ObjectId };

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
    .findOne({ email: email.toLowerCase() });
  return toPublicCustomer(doc);
}

export async function getCustomerById(id: string) {
  const db = await getDb();
  const doc = await db
    .collection<DbCustomer>(collectionName)
    .findOne({ _id: new ObjectId(id) });
  return toPublicCustomer(doc);
}

export async function createCustomer(input: Omit<Customer, "_id">) {
  const db = await getDb();
  const payload: DbCustomer = {
    ...input,
    email: input.email.toLowerCase(),
  };
  await db.collection<DbCustomer>(collectionName).insertOne(payload);
  return getCustomerByEmail(input.email);
}

export async function updateCustomerById(
  id: string,
  updates: Partial<Omit<Customer, "_id">>,
) {
  const db = await getDb();
  await db
    .collection<DbCustomer>(collectionName)
    .updateOne({ _id: new ObjectId(id) }, { $set: updates });
  return getCustomerById(id);
}

export async function updateCustomerPasswordById(id: string, passwordHash: string) {
  const now = new Date().toISOString();
  return updateCustomerById(id, { passwordHash, updatedAt: now });
}
