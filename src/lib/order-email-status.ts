import { updateOrderEmailDelivery } from "@/lib/orders";
import type {
  EmailEvent,
  EmailEventType,
  Order,
  OrderEmailDelivery,
} from "@/lib/types";

type OrderEmailStatusInput = Partial<
  Pick<OrderEmailDelivery, "to" | "providerId" | "error" | "updatedAt">
> &
  Pick<OrderEmailDelivery, "status">;

function getOrderEmailStatusKey(type: EmailEventType) {
  if (type === "order_confirmation") {
    return "orderConfirmation" as const;
  }
  if (type === "shipping_tracking") {
    return "shippingTracking" as const;
  }
  return null;
}

export function isFinalOrderEmailStatus(status?: string) {
  return status === "sent" || status === "skipped";
}

function buildOrderEmailDeliverySnapshot(
  input: OrderEmailStatusInput | EmailEvent,
) {
  const snapshot: OrderEmailDelivery = {
    status: input.status,
    updatedAt: input.updatedAt || new Date().toISOString(),
  };
  if (input.to) {
    snapshot.to = input.to;
  }
  if (input.providerId) {
    snapshot.providerId = input.providerId;
  }
  if (input.error) {
    snapshot.error = input.error;
  }
  return snapshot;
}

export function buildOrderEmailStatusUpdate(
  order: Pick<Order, "emailStatus">,
  type: EmailEventType,
  input: OrderEmailStatusInput | EmailEvent,
) {
  const key = getOrderEmailStatusKey(type);
  if (!key) {
    return null;
  }

  const snapshot = buildOrderEmailDeliverySnapshot(input);

  return {
    emailStatus: {
      ...(order.emailStatus || {}),
      [key]: snapshot,
    },
  } satisfies Pick<Order, "emailStatus">;
}

export async function updateOrderEmailStatus(
  order: Pick<Order, "_id" | "emailStatus">,
  type: EmailEventType,
  input: OrderEmailStatusInput | EmailEvent,
) {
  if (!order._id) {
    return null;
  }

  const update = buildOrderEmailStatusUpdate(order, type, input);
  const key = getOrderEmailStatusKey(type);
  if (!update || !key) {
    return null;
  }

  return updateOrderEmailDelivery(
    order._id,
    key,
    buildOrderEmailDeliverySnapshot(input),
  );
}
