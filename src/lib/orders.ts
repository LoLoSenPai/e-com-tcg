import type { Order, OrderStatus } from "@/lib/types";
import { getDb } from "@/lib/db";
import { ObjectId } from "mongodb";

const collectionName = "orders";
type DbOrder = Omit<Order, "_id"> & { _id?: ObjectId };

function serializeOrder(doc: DbOrder & { _id?: ObjectId }) {
  return {
    ...doc,
    _id: doc._id ? String(doc._id) : undefined,
  };
}

export async function createOrder(order: Order) {
  const db = await getDb();
  const result = await db.collection<DbOrder>(collectionName).insertOne(order as DbOrder);
  return {
    ...order,
    _id: String(result.insertedId),
  };
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
