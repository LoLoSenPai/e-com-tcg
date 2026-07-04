import { ObjectId } from "mongodb";
import { getDb, getDbName, getMongoClient } from "@/lib/db";
import type {
  CheckoutSessionItem,
  CheckoutSessionRecord,
  Product,
  StockAdjustment,
} from "@/lib/types";

const collectionName = "checkout_sessions";
const productsCollectionName = "products";

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
      const collection = db.collection<DbCheckoutSession>(collectionName);
      await Promise.all([
        collection.createIndex({ stripeSessionId: 1 }, { unique: true }),
        collection.createIndex({ status: 1, updatedAt: -1 }),
      ]);
    });
  }
  return indexesPromise;
}

export class CheckoutStockReservationError extends Error {
  adjustments: StockAdjustment[];

  constructor(message: string, adjustments: StockAdjustment[]) {
    super(message);
    this.name = "CheckoutStockReservationError";
    this.adjustments = adjustments;
  }
}

function buildAppliedStockAdjustments(
  items: Array<Pick<CheckoutSessionItem, "slug" | "quantity">>,
): StockAdjustment[] {
  return items.map((item) => ({
    slug: item.slug,
    quantity: item.quantity,
    applied: true,
  }));
}

function buildFailedStockAdjustments(
  items: Array<Pick<CheckoutSessionItem, "slug" | "quantity">>,
  failedSlug?: string,
): StockAdjustment[] {
  return items.map((item) => ({
    slug: item.slug,
    quantity: item.quantity,
    applied: false,
    reason:
      item.slug === failedSlug
        ? "Stock insuffisant ou produit introuvable au lancement du paiement."
        : "Reservation de stock annulee car un autre produit du panier est indisponible.",
  }));
}

export function hasActiveCheckoutStockReservation(
  checkoutSession: Pick<
    CheckoutSessionRecord,
    "stockAdjustments" | "stockReservedAt" | "stockReleasedAt"
  > | null | undefined,
) {
  return Boolean(
    checkoutSession?.stockReservedAt &&
      !checkoutSession.stockReleasedAt &&
      checkoutSession.stockAdjustments?.some((adjustment) => adjustment.applied),
  );
}

export function isCheckoutSessionPaymentLocked(
  status: CheckoutSessionRecord["status"] | null | undefined,
) {
  return (
    status === "paid" ||
    status === "fulfilling" ||
    status === "fulfillment_failed" ||
    status === "order_created"
  );
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

export async function reserveCheckoutSessionStock({
  stripeSessionId,
  items,
}: {
  stripeSessionId: string;
  items: Array<Pick<CheckoutSessionItem, "slug" | "quantity">>;
}) {
  await ensureIndexes();
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const session = client.startSession();
  let adjustments: StockAdjustment[] = [];

  try {
    await session.withTransaction(async () => {
      const checkoutSessionsCollection =
        db.collection<DbCheckoutSession>(collectionName);
      const productsCollection = db.collection<Product>(productsCollectionName);
      const checkoutSession = await checkoutSessionsCollection.findOne(
        { stripeSessionId },
        { session },
      );

      if (!checkoutSession) {
        throw new Error(`Checkout session not found: ${stripeSessionId}`);
      }
      if (hasActiveCheckoutStockReservation(checkoutSession)) {
        adjustments = checkoutSession.stockAdjustments || [];
        return;
      }
      if (checkoutSession.stockReleasedAt) {
        throw new CheckoutStockReservationError(
          "Checkout stock reservation was already released.",
          checkoutSession.stockAdjustments || buildFailedStockAdjustments(items),
        );
      }

      for (const item of items) {
        const update = await productsCollection.updateOne(
          { slug: item.slug, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { session },
        );
        if (update.modifiedCount !== 1) {
          throw new CheckoutStockReservationError(
            "Stock insuffisant pour finaliser ce panier.",
            buildFailedStockAdjustments(items, item.slug),
          );
        }
      }

      adjustments = buildAppliedStockAdjustments(items);
      const now = new Date().toISOString();
      await checkoutSessionsCollection.updateOne(
        { stripeSessionId },
        {
          $set: {
            stockAdjustments: adjustments,
            stockReservedAt: now,
            updatedAt: now,
          },
        },
        { session },
      );
    });

    return adjustments;
  } finally {
    await session.endSession();
  }
}

export async function getCheckoutSessionByStripeId(stripeSessionId: string) {
  const db = await getDb();
  const doc = await db
    .collection<DbCheckoutSession>(collectionName)
    .findOne({ stripeSessionId });
  return serializeCheckoutSession(doc);
}

export async function markCheckoutSessionPaymentReceived({
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
        status: "fulfilling",
        amountTotal,
        shippingAmount,
        customerEmail: customerEmail?.toLowerCase(),
        paidAt: now,
        updatedAt: now,
      },
      $unset: {
        fulfillmentFailedAt: "",
        fulfillmentError: "",
      },
    },
  );
  return getCheckoutSessionByStripeId(stripeSessionId);
}

export async function markCheckoutSessionFulfillmentFailed({
  stripeSessionId,
  reason,
}: {
  stripeSessionId: string;
  reason: string;
}) {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.collection<DbCheckoutSession>(collectionName).updateOne(
    { stripeSessionId },
    {
      $set: {
        status: "fulfillment_failed",
        fulfillmentFailedAt: now,
        fulfillmentError: reason,
        updatedAt: now,
      },
    },
  );
  return getCheckoutSessionByStripeId(stripeSessionId);
}

export async function markCheckoutSessionStockReservationFailed({
  stripeSessionId,
  stockAdjustments,
  reason,
}: {
  stripeSessionId: string;
  stockAdjustments: StockAdjustment[];
  reason: string;
}) {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.collection<DbCheckoutSession>(collectionName).updateOne(
    { stripeSessionId },
    {
      $set: {
        status: "expired",
        stockAdjustments,
        stockReservationFailedAt: now,
        stockReleaseReason: reason,
        updatedAt: now,
      },
    },
  );
  return getCheckoutSessionByStripeId(stripeSessionId);
}

export async function releaseCheckoutSessionStock({
  stripeSessionId,
  reason,
}: {
  stripeSessionId: string;
  reason: string;
}) {
  await ensureIndexes();
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const session = client.startSession();
  let released = false;

  try {
    await session.withTransaction(async () => {
      const checkoutSessionsCollection =
        db.collection<DbCheckoutSession>(collectionName);
      const productsCollection = db.collection<Product>(productsCollectionName);
      const checkoutSession = await checkoutSessionsCollection.findOne(
        { stripeSessionId },
        { session },
      );

      if (!checkoutSession) {
        return;
      }

      const now = new Date().toISOString();
      if (
        isCheckoutSessionPaymentLocked(checkoutSession.status)
      ) {
        return;
      }

      if (
        !checkoutSession.stockReservedAt ||
        checkoutSession.stockReleasedAt ||
        !checkoutSession.stockAdjustments?.some((adjustment) => adjustment.applied)
      ) {
        await checkoutSessionsCollection.updateOne(
          { stripeSessionId },
          {
            $set: {
              status: "expired",
              stockReleaseReason: reason,
              updatedAt: now,
            },
          },
          { session },
        );
        return;
      }

      for (const adjustment of checkoutSession.stockAdjustments) {
        if (!adjustment.applied) {
          continue;
        }
        const update = await productsCollection.updateOne(
          { slug: adjustment.slug },
          { $inc: { stock: adjustment.quantity } },
          { session },
        );
        if (update.modifiedCount !== 1) {
          throw new Error(
            `Stock release failed for product ${adjustment.slug}. Product missing or not updated.`,
          );
        }
      }

      await checkoutSessionsCollection.updateOne(
        { stripeSessionId },
        {
          $set: {
            status: "expired",
            stockReleasedAt: now,
            stockReleaseReason: reason,
            updatedAt: now,
          },
        },
        { session },
      );
      released = true;
    });

    return {
      checkoutSession: await getCheckoutSessionByStripeId(stripeSessionId),
      released,
    };
  } finally {
    await session.endSession();
  }
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
