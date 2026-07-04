import type { Order, OrderItem, OrderStatus, ShippingRelayPoint } from "@/lib/types";
import { normalizeTrackingDetails } from "@/lib/order-tracking";

export type PublicAccountOrder = {
  reference: string;
  status: OrderStatus;
  amountTotal: number;
  shippingAmount?: number;
  shippingRateLabel?: string;
  currency: string;
  shippingAddress?: Order["shippingAddress"];
  shippingTracking?: Order["shippingTracking"];
  shippingRelay?: ShippingRelayPoint;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
};

export function getOrderReference(order: Pick<Order, "_id" | "stripeSessionId">) {
  const raw = order._id || order.stripeSessionId;
  return raw ? raw.slice(-8).toUpperCase() : "EN COURS";
}

export function toPublicAccountOrder(order: Order): PublicAccountOrder {
  return {
    reference: getOrderReference(order),
    status: order.status,
    amountTotal: order.amountTotal,
    shippingAmount: order.shippingAmount,
    shippingRateLabel: order.shippingRateLabel,
    currency: order.currency,
    shippingAddress: order.shippingAddress,
    shippingTracking: normalizeTrackingDetails(order.shippingTracking),
    shippingRelay: order.shippingRelay,
    items: order.items,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function toPublicAccountOrders(orders: Order[] = []) {
  return orders.map(toPublicAccountOrder);
}
