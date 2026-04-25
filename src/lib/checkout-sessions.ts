import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { CheckoutSessionRecord, StockAdjustment } from "@/lib/types";

const collectionName = "checkout_sessions";

type DbCheckoutSession = Omit<CheckoutSessionRecord, "_id"> & {
  _id?: ObjectId;
};

let indexesPromise: Promise<void> | null = null;

function serializeCheckoutSession(doc: DbCheckoutSession | null) {
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
        .collection<DbCheckoutSession>(collectionName)
        .createIndex({ stripeSessionId: 1 }, { unique: true });
    });
  }
  return indexesPromise;
}

export async function createCheckoutSessionRecord(
  input: Omit<CheckoutSessionRecord, "_id" | "createdAt" | "updatedAt">,
) {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date().toISOString();
  const payload: DbCheckoutSession = {
    ...input,
    customerEmail: input.customerEmail?.toLowerCase(),
    createdAt: now,
    updatedAt: now,
  };
  await db.collection<DbCheckoutSession>(collectionName).insertOne(payload);
  return getCheckoutSessionByStripeId(input.stripeSessionId);
}

export async function getCheckoutSessionByStripeId(stripeSessionId: string) {
  const db = await getDb();
  const doc = await db
    .collection<DbCheckoutSession>(collectionName)
    .findOne({ stripeSessionId });
  return serializeCheckoutSession(doc);
}

export async function markCheckoutSessionPaid({
  stripeSessionId,
  amountTotal,
  shippingAmount,
  customerEmail,
}: {
  stripeSessionId: string;
  amountTotal: number;
  shippingAmount: number;
  customerEmail?: string;
}) {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.collection<DbCheckoutSession>(collectionName).updateOne(
    { stripeSessionId },
    {
      $set: {
        status: "paid",
        amountTotal,
        shippingAmount,
        customerEmail: customerEmail?.toLowerCase(),
        paidAt: now,
        updatedAt: now,
      },
    },
  );
  return getCheckoutSessionByStripeId(stripeSessionId);
}

export async function markCheckoutSessionOrderCreated({
  stripeSessionId,
  orderId,
  stockAdjustments,
}: {
  stripeSessionId: string;
  orderId: string;
  stockAdjustments: StockAdjustment[];
}) {
  const db = await getDb();
  await db.collection<DbCheckoutSession>(collectionName).updateOne(
    { stripeSessionId },
    {
      $set: {
        status: "order_created",
        orderId,
        stockAdjustments,
        updatedAt: new Date().toISOString(),
      },
    },
  );
  return getCheckoutSessionByStripeId(stripeSessionId);
}
