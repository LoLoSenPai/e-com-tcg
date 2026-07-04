import { getOrdersWithRetryableEmailFailures } from "@/lib/orders";
import { sendOrderEmail, type OrderEmailType } from "@/lib/order-email";
import { hasOrderTrackingDeliveryDetails } from "@/lib/order-tracking";
import type { Order, OrderEmailDelivery } from "@/lib/types";

const retryableStatuses = new Set(["failed", "pending"]);

export type OrderEmailRetryAttempt = {
  orderId?: string;
  stripeSessionId: string;
  type: OrderEmailType;
  status: "sent" | "failed" | "skipped";
  error?: string;
};

function isRetryableEmailStatus(
  status: OrderEmailDelivery | undefined,
  cutoffIso: string,
) {
  return Boolean(
    status &&
      retryableStatuses.has(status.status) &&
      status.updatedAt <= cutoffIso,
  );
}

export function getRetryableOrderEmailTypes(
  order: Order,
  cutoffIso: string,
): OrderEmailType[] {
  const types: OrderEmailType[] = [];
  if (
    order.customerEmail &&
    isRetryableEmailStatus(order.emailStatus?.orderConfirmation, cutoffIso)
  ) {
    types.push("order_confirmation");
  }
  if (
    order.customerEmail &&
    hasOrderTrackingDeliveryDetails(order) &&
    isRetryableEmailStatus(order.emailStatus?.shippingTracking, cutoffIso)
  ) {
    types.push("shipping_tracking");
  }
  return types;
}

export async function retryOrderEmailFailures({
  limit = 10,
  minAgeMs = 5 * 60 * 1000,
}: {
  limit?: number;
  minAgeMs?: number;
} = {}) {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 25);
  const cutoffIso = new Date(Date.now() - minAgeMs).toISOString();
  const orders = await getOrdersWithRetryableEmailFailures({
    cutoffIso,
    limit: safeLimit,
  });
  const attempts: OrderEmailRetryAttempt[] = [];

  for (const order of orders) {
    const types = getRetryableOrderEmailTypes(order, cutoffIso);
    for (const type of types) {
      const previousStatus =
        type === "shipping_tracking"
          ? order.emailStatus?.shippingTracking
          : order.emailStatus?.orderConfirmation;

      try {
        await sendOrderEmail(order, type, {
          idempotencyParts: [
            order._id || order.stripeSessionId,
            "retry",
            previousStatus?.updatedAt,
          ],
        });
        attempts.push({
          orderId: order._id,
          stripeSessionId: order.stripeSessionId,
          type,
          status: "sent",
        });
      } catch (error) {
        attempts.push({
          orderId: order._id,
          stripeSessionId: order.stripeSessionId,
          type,
          status: "failed",
          error:
            error instanceof Error ? error.message : "Failed to retry email",
        });
      }
    }
  }

  return {
    checkedOrders: orders.length,
    attempts,
    sent: attempts.filter((attempt) => attempt.status === "sent").length,
    failed: attempts.filter((attempt) => attempt.status === "failed").length,
  };
}
