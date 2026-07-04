import type {
  CheckoutSessionItem,
  Customer,
  Order,
  OrderEmailDelivery,
  OrderEmailStatus,
  OrderStatus,
  Product,
  StockAdjustment,
} from "@/lib/types";
import { getDb, getDbName, getMongoClient } from "@/lib/db";
import { ObjectId } from "mongodb";

const collectionName = "orders";
const orderLocksCollectionName = "order_locks";
const productsCollectionName = "products";
type DbOrder = Omit<Order, "_id"> & { _id?: ObjectId };
type DbOrderLock = {
  _id: string;
  stripeSessionId: string;
  createdAt: string;
};

let indexesPromise: Promise<void> | null = null;

type CreateOrderOnceResult = {
  order: Order;
  inserted: boolean;
};

type CreateOrderWithStockResult = CreateOrderOnceResult & {
  stockAdjustments: StockAdjustment[];
};

export class OrderStockAdjustmentError extends Error {
  adjustments: StockAdjustment[];

  constructor(message: string, adjustments: StockAdjustment[]) {
    super(message);
    this.name = "OrderStockAdjustmentError";
    this.adjustments = adjustments;
  }
}

export function hasFailedStockAdjustment(adjustments: StockAdjustment[] = []) {
  return adjustments.some((adjustment) => !adjustment.applied);
}

function serializeOrder(doc: DbOrder & { _id?: ObjectId }) {
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

async function ensureIndexes() {
  if (!indexesPromise) {
    indexesPromise = getDb().then(async (db) => {
      const collection = db.collection<DbOrder>(collectionName);
      try {
        await collection.createIndex(
          { stripeSessionId: 1 },
          { unique: true, name: "orders_stripeSessionId_unique" },
        );
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          console.warn(
            "orders_stripeSessionId_unique not created: duplicate Stripe sessions exist.",
          );
        } else {
          throw error;
        }
      }
      await Promise.all([
        collection.createIndex({ customerEmail: 1, createdAt: -1 }),
        collection.createIndex({ customerId: 1, createdAt: -1 }),
        collection.createIndex({ createdAt: -1 }),
      ]);
    });
  }
  return indexesPromise;
}

export async function createOrderOnce(order: Order): Promise<CreateOrderOnceResult> {
  await ensureIndexes();
  const existingOrder = await getOrderByStripeSessionId(order.stripeSessionId);
  if (existingOrder) {
    return {
      order: existingOrder,
      inserted: false,
    };
  }

  const db = await getDb();
  try {
    const result = await db.collection<DbOrder>(collectionName).insertOne(order as DbOrder);
    return {
      order: {
        ...order,
        _id: String(result.insertedId),
      },
      inserted: true,
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const existing = await getOrderByStripeSessionId(order.stripeSessionId);
      if (existing) {
        return {
          order: existing,
          inserted: false,
        };
      }
    }
    throw error;
  }
}

export async function createOrderWithStockAdjustments(
  order: Order,
  stockItems: Array<Pick<CheckoutSessionItem, "slug" | "quantity">> = [],
  options: { persistOnStockFailure?: boolean } = {},
): Promise<CreateOrderWithStockResult> {
  await ensureIndexes();
  const existingOrder = await getOrderByStripeSessionId(order.stripeSessionId);
  if (existingOrder) {
    return {
      order: existingOrder,
      inserted: false,
      stockAdjustments: existingOrder.stockAdjustments || [],
    };
  }

  const client = await getMongoClient();
  const db = client.db(getDbName());
  const session = client.startSession();
  let createdOrder: Order | null = null;
  let stockAdjustments: StockAdjustment[] = order.stockAdjustments || [];

  try {
    await session.withTransaction(async () => {
      const ordersCollection = db.collection<DbOrder>(collectionName);
      const orderLocksCollection = db.collection<DbOrderLock>(
        orderLocksCollectionName,
      );
      const productsCollection = db.collection<Product>(productsCollectionName);
      const transactionStockAdjustments: StockAdjustment[] = [];
      await orderLocksCollection.insertOne(
        {
          _id: order.stripeSessionId,
          stripeSessionId: order.stripeSessionId,
          createdAt: order.createdAt,
        },
        { session },
      );
      const result = await ordersCollection.insertOne(order as DbOrder, {
        session,
      });
      const orderId = String(result.insertedId);

      for (const item of stockItems) {
        const update = await productsCollection.updateOne(
          { slug: item.slug, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { session },
        );
        const applied = update.modifiedCount === 1;

        transactionStockAdjustments.push({
          slug: item.slug,
          quantity: item.quantity,
          applied,
          reason:
            applied
              ? undefined
              : "Stock insuffisant ou produit introuvable au moment du paiement.",
        });

        if (!applied) {
          if (options.persistOnStockFailure) {
            continue;
          }
          throw new OrderStockAdjustmentError(
            `Stock adjustment failed for product ${item.slug}.`,
            transactionStockAdjustments,
          );
        }
      }

      const updatedAt = new Date().toISOString();
      if (transactionStockAdjustments.length > 0) {
        await ordersCollection.updateOne(
          { _id: result.insertedId },
          { $set: { stockAdjustments: transactionStockAdjustments, updatedAt } },
          { session },
        );
        stockAdjustments = transactionStockAdjustments;
      }

      createdOrder = {
        ...order,
        _id: orderId,
        stockAdjustments:
          transactionStockAdjustments.length > 0
            ? transactionStockAdjustments
            : order.stockAdjustments,
        updatedAt: transactionStockAdjustments.length > 0 ? updatedAt : order.updatedAt,
      };
    });

    if (!createdOrder) {
      throw new Error("Order transaction did not create an order.");
    }

    return {
      order: createdOrder,
      inserted: true,
      stockAdjustments,
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const existing = await getOrderByStripeSessionId(order.stripeSessionId);
      if (existing) {
        return {
          order: existing,
          inserted: false,
          stockAdjustments: existing.stockAdjustments || [],
        };
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function createOrder(order: Order) {
  const result = await createOrderOnce(order);
  return result.order;
}

export async function getOrders() {
  const db = await getDb();
  const docs = await db
    .collection<DbOrder>(collectionName)
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(serializeOrder);
}

export async function getOrdersByCustomerEmail(email: string) {
  const db = await getDb();
  const docs = await db
    .collection<DbOrder>(collectionName)
    .find({ customerEmail: email.toLowerCase() })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(serializeOrder);
}

export function buildCustomerOrdersFilter(
  customer: Pick<Customer, "_id"> | null | undefined,
) {
  return customer?._id ? { customerId: customer._id } : null;
}

export async function getOrdersByCustomer(
  customer: Pick<Customer, "_id"> | null | undefined,
) {
  const filter = buildCustomerOrdersFilter(customer);
  if (!filter) {
    return [];
  }

  const db = await getDb();
  const docs = await db
    .collection<DbOrder>(collectionName)
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(serializeOrder);
}

export async function getOrdersWithRetryableEmailFailures({
  cutoffIso,
  limit = 10,
}: {
  cutoffIso: string;
  limit?: number;
}) {
  const db = await getDb();
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 25);
  const docs = await db
    .collection<DbOrder>(collectionName)
    .find({
      customerEmail: { $type: "string", $ne: "" },
      $or: [
        {
          "emailStatus.orderConfirmation.status": {
            $in: ["failed", "pending"],
          },
          "emailStatus.orderConfirmation.updatedAt": { $lte: cutoffIso },
        },
        {
          "emailStatus.shippingTracking.status": {
            $in: ["failed", "pending"],
          },
          "emailStatus.shippingTracking.updatedAt": { $lte: cutoffIso },
        },
      ],
    })
    .sort({ updatedAt: -1 })
    .limit(safeLimit)
    .toArray();
  return docs.map(serializeOrder);
}

export async function getOrderById(id: string) {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  const db = await getDb();
  const doc = await db
    .collection<DbOrder>(collectionName)
    .findOne({ _id: new ObjectId(id) });
  if (!doc) {
    return null;
  }
  return serializeOrder(doc);
}

export async function getOrderByStripeSessionId(stripeSessionId: string) {
  const db = await getDb();
  const doc = await db
    .collection<DbOrder>(collectionName)
    .findOne({ stripeSessionId });
  return doc ? serializeOrder(doc) : null;
}

export async function getOrderByBoxtalOrderId(boxtalOrderId: string) {
  const db = await getDb();
  const doc = await db
    .collection<DbOrder>(collectionName)
    .findOne({ "boxtalShipment.boxtalOrderId": boxtalOrderId });
  return doc ? serializeOrder(doc) : null;
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const db = await getDb();
  const now = new Date().toISOString();
  await db
    .collection<DbOrder>(collectionName)
    .updateOne({ _id: new ObjectId(id) }, { $set: { status, updatedAt: now } });
  const doc = await db
    .collection<DbOrder>(collectionName)
    .findOne({ _id: new ObjectId(id) });
  return doc ? serializeOrder(doc) : null;
}

export async function updateOrderFields(
  id: string,
  updates: Partial<Omit<Order, "_id">>,
) {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  const db = await getDb();
  const now = new Date().toISOString();
  await db
    .collection<DbOrder>(collectionName)
    .updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: now } },
    );
  const doc = await db
    .collection<DbOrder>(collectionName)
    .findOne({ _id: new ObjectId(id) });
  return doc ? serializeOrder(doc) : null;
}

export async function updateOrderEmailDelivery(
  id: string | undefined,
  key: keyof OrderEmailStatus,
  delivery: OrderEmailDelivery,
) {
  if (!id || !ObjectId.isValid(id)) {
    return null;
  }
  const db = await getDb();
  const now = new Date().toISOString();
  await db.collection<DbOrder>(collectionName).updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        [`emailStatus.${key}`]: delivery,
        updatedAt: now,
      },
    },
  );
  const doc = await db
    .collection<DbOrder>(collectionName)
    .findOne({ _id: new ObjectId(id) });
  return doc ? serializeOrder(doc) : null;
}

export async function getOrderStats() {
  const db = await getDb();
  const orders = await db.collection<DbOrder>(collectionName).find({}).toArray();
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, order) => sum + order.amountTotal, 0);
  const avgOrderValue = totalOrders ? Math.round(totalRevenue / totalOrders) : 0;
  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);
  const revenue30Days = orders
    .filter((order) => new Date(order.createdAt) >= last30Days)
    .reduce((sum, order) => sum + order.amountTotal, 0);
  return { totalOrders, totalRevenue, avgOrderValue, revenue30Days };
}
