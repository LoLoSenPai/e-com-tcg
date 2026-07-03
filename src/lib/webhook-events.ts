import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { WebhookEvent, WebhookEventStatus } from "@/lib/types";

const collectionName = "webhook_events";
const staleProcessingMs = 5 * 60 * 1000;

type DbWebhookEvent = Omit<WebhookEvent, "_id"> & { _id?: ObjectId | string };

let indexesPromise: Promise<void> | null = null;

function serializeWebhookEvent(doc: DbWebhookEvent | null) {
  if (!doc) return null;
  return {
    ...doc,
    _id: doc._id ? String(doc._id) : undefined,
  };
}

function isDuplicateKeyError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000,
  );
}

export function isWebhookEventBusy(
  event: Pick<WebhookEvent, "status" | "updatedAt"> | null | undefined,
  now = new Date(),
) {
  if (!event || event.status !== "processing") {
    return false;
  }

  const updatedAt = Date.parse(event.updatedAt);
  if (Number.isNaN(updatedAt)) {
    return false;
  }

  return now.getTime() - updatedAt < staleProcessingMs;
}

async function ensureIndexes() {
  if (!indexesPromise) {
    indexesPromise = getDb().then(async (db) => {
      try {
        await db
          .collection<DbWebhookEvent>(collectionName)
          .createIndex({ provider: 1, eventId: 1 }, { unique: true });
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          console.warn(
            "webhook_events provider/eventId unique index not created: duplicate webhook events exist.",
          );
        } else {
          throw error;
        }
      }
    });
  }
  return indexesPromise;
}

function webhookDocumentId(provider: WebhookEvent["provider"], eventId: string) {
  return `${provider}:${eventId}`;
}

export async function beginWebhookEvent(
  input: Pick<WebhookEvent, "provider" | "eventId" | "eventType" | "objectId">,
) {
  await ensureIndexes();
  const db = await getDb();
  const collection = db.collection<DbWebhookEvent>(collectionName);
  const now = new Date().toISOString();

  const existingDoc = await collection.findOne({
    $or: [
      { _id: webhookDocumentId(input.provider, input.eventId) },
      { provider: input.provider, eventId: input.eventId },
    ],
  });
  const existing = serializeWebhookEvent(existingDoc);
  if (existing && existingDoc) {
    if (existing.status === "processed" || existing.status === "ignored") {
      return {
        inserted: false,
        event: existing,
        shouldProcess: false,
        busy: false,
      };
    }

    if (isWebhookEventBusy(existing)) {
      return {
        inserted: false,
        event: existing,
        shouldProcess: false,
        busy: true,
      };
    }

    const staleCutoff = new Date(Date.now() - staleProcessingMs).toISOString();
    const claimedDoc = await collection.findOneAndUpdate(
      {
        _id: existingDoc._id,
        $or: [
          { status: "failed" },
          { status: "processing", updatedAt: { $lte: staleCutoff } },
        ],
      },
      {
        $set: {
          ...input,
          status: "processing",
          updatedAt: now,
        },
        $unset: { error: "" },
      },
      { returnDocument: "after" },
    );
    const claimed = serializeWebhookEvent(claimedDoc);

    return {
      inserted: false,
      event: claimed || existing,
      shouldProcess: Boolean(claimed),
      busy: !claimed,
    };
  }

  try {
    const result = await collection.insertOne({
      ...input,
      _id: webhookDocumentId(input.provider, input.eventId),
      status: "processing",
      createdAt: now,
      updatedAt: now,
    });
    const event = serializeWebhookEvent({
      ...input,
      _id: result.insertedId,
      status: "processing",
      createdAt: now,
      updatedAt: now,
    });

    return {
      inserted: true,
      event,
      shouldProcess: true,
      busy: false,
    };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
  }

  const racedDoc = await collection.findOne({
    $or: [
      { _id: webhookDocumentId(input.provider, input.eventId) },
      { provider: input.provider, eventId: input.eventId },
    ],
  });
  const raced = serializeWebhookEvent(racedDoc);

  if (!raced || !racedDoc) {
    return {
      inserted: false,
      event: null,
      shouldProcess: false,
      busy: true,
    };
  }

  if (raced.status === "processed" || raced.status === "ignored") {
    return {
      inserted: false,
      event: raced,
      shouldProcess: false,
      busy: false,
    };
  }

  if (isWebhookEventBusy(raced)) {
    return {
      inserted: false,
      event: raced,
      shouldProcess: false,
      busy: true,
    };
  }

  const staleCutoff = new Date(Date.now() - staleProcessingMs).toISOString();
  const claimedDoc = await collection.findOneAndUpdate(
    {
      _id: racedDoc._id,
      $or: [
        { status: "failed" },
        { status: "processing", updatedAt: { $lte: staleCutoff } },
      ],
    },
    {
      $set: {
        ...input,
        status: "processing",
        updatedAt: now,
      },
      $unset: { error: "" },
    },
    { returnDocument: "after" },
  );
  const claimed = serializeWebhookEvent(claimedDoc);

  return {
    inserted: false,
    event: claimed || raced,
    shouldProcess: Boolean(claimed),
    busy: !claimed,
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
