import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { WebhookEvent, WebhookEventStatus } from "@/lib/types";

const collectionName = "webhook_events";

type DbWebhookEvent = Omit<WebhookEvent, "_id"> & { _id?: ObjectId };

let indexesPromise: Promise<void> | null = null;

function serializeWebhookEvent(doc: DbWebhookEvent | null) {
  if (!doc) return null;
  return {
    ...doc,
    _id: doc._id ? String(doc._id) : undefined,
  };
}

async function ensureIndexes() {
  if (!indexesPromise) {
    indexesPromise = getDb().then(async (db) => {
      await db
        .collection<DbWebhookEvent>(collectionName)
        .createIndex({ provider: 1, eventId: 1 }, { unique: true });
    });
  }
  return indexesPromise;
}

export async function beginWebhookEvent(
  input: Pick<WebhookEvent, "provider" | "eventId" | "eventType" | "objectId">,
) {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date().toISOString();
  const result = await db.collection<DbWebhookEvent>(collectionName).updateOne(
    { provider: input.provider, eventId: input.eventId },
    {
      $setOnInsert: {
        ...input,
        status: "processing",
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );

  const doc = await db.collection<DbWebhookEvent>(collectionName).findOne({
    provider: input.provider,
    eventId: input.eventId,
  });

  return {
    inserted: result.upsertedCount === 1,
    event: serializeWebhookEvent(doc),
  };
}

export async function updateWebhookEvent(
  provider: WebhookEvent["provider"],
  eventId: string,
  status: WebhookEventStatus,
  error?: string,
) {
  const db = await getDb();
  await db.collection<DbWebhookEvent>(collectionName).updateOne(
    { provider, eventId },
    {
      $set: {
        status,
        error,
        updatedAt: new Date().toISOString(),
      },
    },
  );
  const doc = await db
    .collection<DbWebhookEvent>(collectionName)
    .findOne({ provider, eventId });
  return serializeWebhookEvent(doc);
}
