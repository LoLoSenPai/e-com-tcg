import type {
  CheckoutSessionRecord,
  EmailDeliveryStatus,
  EmailEvent,
  EmailEventType,
  Order,
} from "@/lib/types";

type CheckoutOrderEmailTarget = {
  customerEmail?: string;
  hasCustomerEmail?: boolean;
  emailStatus?: PublicOrderEmailStatus;
} | null | undefined;

type CheckoutStatusEmailEvent = Pick<
  EmailEvent,
  "type" | "status" | "createdAt" | "updatedAt"
>;

type PublicOrderEmailDelivery = {
  status: EmailDeliveryStatus;
  updatedAt: string;
};

export type PublicOrderEmailStatus = {
  orderConfirmation?: PublicOrderEmailDelivery;
};

export type PublicCheckoutStatusOrder = {
  status: Order["status"];
  amountTotal: number;
  currency: string;
  hasCustomerEmail: boolean;
  emailStatus?: PublicOrderEmailStatus;
  createdAt: string;
  updatedAt: string;
};

export type PublicCheckoutSessionStatus = {
  status: CheckoutSessionRecord["status"];
  createdAt: string;
  updatedAt: string;
  stockReleasedAt?: string;
};

export type PublicCheckoutStatus = {
  checkoutSession?: PublicCheckoutSessionStatus | null;
  order?: PublicCheckoutStatusOrder | null;
  emailEvents?: CheckoutStatusEmailEvent[];
};

export type OrderConfirmationEmailState =
  | "none"
  | "pending"
  | "sent"
  | "failed"
  | "skipped";

export function getLatestOrderConfirmationEvent(
  events: CheckoutStatusEmailEvent[] = [],
) {
  return [...events]
    .filter((event) => event.type === "order_confirmation")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

export function getOrderConfirmationEmailState(
  events: CheckoutStatusEmailEvent[] = [],
  orderEmailStatus?: PublicOrderEmailStatus,
): OrderConfirmationEmailState {
  return (
    getLatestOrderConfirmationEvent(events)?.status ||
    orderEmailStatus?.orderConfirmation?.status ||
    "none"
  );
}

export function shouldPollCheckoutStatus({
  order,
  emailEvents,
}: {
  order: CheckoutOrderEmailTarget;
  emailEvents?: CheckoutStatusEmailEvent[];
}) {
  if (!order) {
    return true;
  }
  if (!order.customerEmail && !order.hasCustomerEmail) {
    return false;
  }

  const emailState = getOrderConfirmationEmailState(
    emailEvents,
    order.emailStatus,
  );
  return emailState === "none" || emailState === "pending";
}

function getPublicOrderEmailStatus(
  order?: Order | null,
): PublicOrderEmailStatus | undefined {
  const orderConfirmation = order?.emailStatus?.orderConfirmation;
  if (!orderConfirmation) {
    return undefined;
  }

  return {
    orderConfirmation: {
      status: orderConfirmation.status,
      updatedAt: orderConfirmation.updatedAt,
    },
  };
}

export function toPublicCheckoutSessionStatus(
  checkoutSession?: CheckoutSessionRecord | null,
): PublicCheckoutSessionStatus | null {
  if (!checkoutSession) {
    return null;
  }

  return {
    status: checkoutSession.status,
    createdAt: checkoutSession.createdAt,
    updatedAt: checkoutSession.updatedAt,
    stockReleasedAt: checkoutSession.stockReleasedAt,
  };
}

export function toPublicCheckoutEmailEvents(
  events: EmailEvent[] = [],
  type: EmailEventType = "order_confirmation",
): CheckoutStatusEmailEvent[] {
  return events
    .filter((event) => event.type === type)
    .map((event) => ({
      type: event.type,
      status: event.status,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    }));
}

export function toPublicCheckoutStatus({
  checkoutSession,
  order,
  emailEvents,
}: {
  checkoutSession?: CheckoutSessionRecord | null;
  order?: Order | null;
  emailEvents?: EmailEvent[];
}): PublicCheckoutStatus {
  return {
    checkoutSession: toPublicCheckoutSessionStatus(checkoutSession),
    order: order
      ? {
          status: order.status,
          amountTotal: order.amountTotal,
          currency: order.currency,
          hasCustomerEmail: Boolean(order.customerEmail),
          emailStatus: getPublicOrderEmailStatus(order),
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        }
      : null,
    emailEvents: toPublicCheckoutEmailEvents(emailEvents),
  };
}
