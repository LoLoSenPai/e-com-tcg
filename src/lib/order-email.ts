import { buildEmailIdempotencyKey, sendTrackedEmail } from "@/lib/email";
import {
  buildOrderConfirmationEmail,
  buildTrackingEmail,
} from "@/lib/email-templates";
import { updateOrderEmailStatus } from "@/lib/order-email-status";
import { hasOrderTrackingDeliveryDetails } from "@/lib/order-tracking";
import type { EmailEvent, EmailEventType, Order } from "@/lib/types";

export type OrderEmailType = Extract<
  EmailEventType,
  "order_confirmation" | "shipping_tracking"
>;

export function getOrderEmailSendProblem(order: Order, type: OrderEmailType) {
  if (!order.customerEmail) {
    return "Order has no customer email";
  }
  if (type === "shipping_tracking" && !hasOrderTrackingDeliveryDetails(order)) {
    return "Tracking number or URL is required before sending tracking email";
  }
  return null;
}

export function getOrderEmailTemplate(order: Order, type: OrderEmailType) {
  return type === "shipping_tracking"
    ? buildTrackingEmail(order)
    : buildOrderConfirmationEmail(order);
}

function getDefaultIdempotencyParts(order: Order, type: OrderEmailType) {
  if (type === "shipping_tracking") {
    return [
      order._id || order.stripeSessionId,
      order.shippingTracking?.trackingNumber ||
        order.shippingTracking?.trackingUrl ||
        order.boxtalShipment?.trackingNumber ||
        order.boxtalShipment?.trackingUrl,
    ];
  }
  return [order._id || order.stripeSessionId];
}

export async function sendOrderEmail(
  order: Order,
  type: OrderEmailType,
  options: {
    idempotencyParts?: Array<string | number | undefined | null>;
    skipIdempotencyKey?: boolean;
  } = {},
): Promise<EmailEvent> {
  const problem =
    type === "shipping_tracking" && !hasOrderTrackingDeliveryDetails(order)
      ? "Tracking number or URL is required before sending tracking email"
      : null;
  if (problem) {
    throw new Error(problem);
  }

  const template = getOrderEmailTemplate(order, type);
  const idempotencyParts =
    options.idempotencyParts || getDefaultIdempotencyParts(order, type);

  try {
    const event = await sendTrackedEmail({
      type,
      orderId: order._id,
      stripeSessionId: order.stripeSessionId,
      to: order.customerEmail,
      subject: template.subject,
      html: template.html,
      idempotencyKey: options.skipIdempotencyKey
        ? undefined
        : buildEmailIdempotencyKey(type, idempotencyParts),
    });
    await updateOrderEmailStatus(order, type, event).catch(() => undefined);
    return event;
  } catch (error) {
    await updateOrderEmailStatus(order, type, {
      status: "failed",
      to: order.customerEmail,
      error:
        error instanceof Error ? error.message : "Failed to send order email",
    }).catch(() => undefined);
    throw error;
  }
}
