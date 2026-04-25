import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { EmailEvent, EmailEventStatus } from "@/lib/types";

const collectionName = "email_events";

type DbEmailEvent = Omit<EmailEvent, "_id"> & { _id?: ObjectId };

let indexesPromise: Promise<void> | null = null;

function serializeEmailEvent(doc: DbEmailEvent | null): EmailEvent | null {
  if (!doc) return null;
  return {
    ...doc,
    _id: doc._id ? String(doc._id) : undefined,
  };
}

async function ensureIndexes() {
  if (!indexesPromise) {
    indexesPromise = getDb().then(async (db) => {
      const collection = db.collection<DbEmailEvent>(collectionName);
      await Promise.all([
        collection.createIndex({ orderId: 1, createdAt: -1 }),
        collection.createIndex({ stripeSessionId: 1, createdAt: -1 }),
      ]);
    });
  }
  return indexesPromise;
}

export async function createEmailEvent(
  input: Omit<EmailEvent, "_id" | "createdAt" | "updatedAt">,
) {
  if (!process.env.MONGODB_URI) {
    return null;
  }

  await ensureIndexes();
  const db = await getDb();
  const now = new Date().toISOString();
  const payload: DbEmailEvent = {
    ...input,
    to: input.to?.toLowerCase(),
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection<DbEmailEvent>(collectionName).insertOne(payload);
  return { ...payload, _id: String(result.insertedId) };
}

export async function updateEmailEvent(
  id: string | undefined,
  updates: Partial<Pick<EmailEvent, "providerId" | "error">> & {
    status: EmailEventStatus;
  },
) {
  if (!id || !ObjectId.isValid(id) || !process.env.MONGODB_URI) {
    return null;
  }

  const db = await getDb();
  await db.collection<DbEmailEvent>(collectionName).updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    },
  );
  const doc = await db
    .collection<DbEmailEvent>(collectionName)
    .findOne({ _id: new ObjectId(id) });
  return serializeEmailEvent(doc);
}

export async function getEmailEventsByOrderId(orderId: string) {
  const db = await getDb();
  const docs = await db
    .collection<DbEmailEvent>(collectionName)
    .find({ orderId })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();
  return docs.map(serializeEmailEvent).filter((event): event is EmailEvent => Boolean(event));
}

export async function getEmailEventsByStripeSessionId(stripeSessionId: string) {
  const db = await getDb();
  const docs = await db
    .collection<DbEmailEvent>(collectionName)
    .find({ stripeSessionId })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();
  return docs.map(serializeEmailEvent).filter((event): event is EmailEvent => Boolean(event));
}
