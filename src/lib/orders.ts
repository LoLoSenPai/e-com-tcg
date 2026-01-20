import type { Order, OrderStatus } from "@/lib/types";
import { getDb } from "@/lib/db";
import { ObjectId } from "mongodb";

const collectionName = "orders";

export async function createOrder(order: Order) {
  const db = await getDb();
  await db.collection<Order>(collectionName).insertOne(order);
  return order;
}

export async function getOrders() {
  const db = await getDb();
  const docs = await db
    .collection<Order>(collectionName)
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map((doc) => ({
    ...doc,
    _id: doc._id ? String(doc._id) : undefined,
  }));
}

export async function getOrderById(id: string) {
  const db = await getDb();
  const doc = await db
    .collection<Order>(collectionName)
    .findOne({ _id: new ObjectId(id) });
  if (!doc) {
    return null;
  }
  return { ...doc, _id: doc._id ? String(doc._id) : undefined };
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const db = await getDb();
  const now = new Date().toISOString();
  await db
    .collection<Order>(collectionName)
    .updateOne({ _id: new ObjectId(id) }, { $set: { status, updatedAt: now } });
  const doc = await db
    .collection<Order>(collectionName)
    .findOne({ _id: new ObjectId(id) });
  return doc ? { ...doc, _id: doc._id ? String(doc._id) : undefined } : null;
}

export async function updateOrderFields(
  id: string,
  updates: Partial<Order>,
) {
  const db = await getDb();
  const now = new Date().toISOString();
  await db
    .collection<Order>(collectionName)
    .updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: now } },
    );
  const doc = await db
    .collection<Order>(collectionName)
    .findOne({ _id: new ObjectId(id) });
  return doc ? { ...doc, _id: doc._id ? String(doc._id) : undefined } : null;
}

export async function getOrderStats() {
  const db = await getDb();
  const orders = await db.collection<Order>(collectionName).find({}).toArray();
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
