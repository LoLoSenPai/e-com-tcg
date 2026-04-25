export type Product = {
  _id?: string;
  name: string;
  slug: string;
  category: string;
  franchise?: "Pokemon" | "One Piece" | "Both";
  language?: "Francais" | "Japonnais" | "Coreen" | "Chinois";
  price: number;
  description: string;
  image?: string;
  badge?: string;
  tags?: string[];
  featured?: boolean;
  stock?: number;
};

export type CartItem = {
  slug: string;
  quantity: number;
};

export type OrderStatus = "paid" | "preparation" | "shipped" | "delivered";
export type DeliveryMode = "home" | "relay";

export type OrderItem = {
  slug?: string;
  name: string;
  quantity: number;
  unitAmount: number;
};

export type ShippingRelayPoint = {
  code: string;
  name: string;
  network?: string;
  address?: {
    line1?: string;
    zipCode?: string;
    city?: string;
    country?: string;
  };
  latitude?: number;
  longitude?: number;
};

export type BoxtalShipment = {
  boxtalOrderId?: string;
  shippingOfferCode?: string;
  status?: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  labelUrl?: string;
  relayCode?: string;
  createdAt?: string;
  updatedAt?: string;
  lastError?: string;
};

export type StockAdjustment = {
  slug: string;
  quantity: number;
  applied: boolean;
  reason?: string;
};

export type Order = {
  _id?: string;
  stripeSessionId: string;
  stripePaymentIntentId?: string;
  customerId?: string;
  status: OrderStatus;
  amountTotal: number;
  shippingAmount?: number;
  shippingRateLabel?: string;
  currency: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  shippingAddress?: {
    line1?: string;
    line2?: string;
    postalCode?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  shippingTracking?: {
    carrier?: string;
    trackingNumber?: string;
    trackingUrl?: string;
  };
  boxtalShipment?: BoxtalShipment;
  shippingRelay?: ShippingRelayPoint;
  shippedAt?: string;
  stockAdjustments?: StockAdjustment[];
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
};

export type Customer = {
  _id?: string;
  email: string;
  name?: string;
  phone?: string;
  passwordHash: string;
  defaultAddress?: {
    line1?: string;
    line2?: string;
    postalCode?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type CheckoutSessionItem = {
  slug: string;
  name: string;
  description?: string;
  quantity: number;
  unitAmount: number;
};

export type CheckoutSessionRecord = {
  _id?: string;
  stripeSessionId: string;
  stripeSessionUrl?: string | null;
  status: "created" | "paid" | "order_created" | "expired";
  customerId?: string;
  customerEmail?: string;
  deliveryMode: DeliveryMode;
  shippingRelay?: ShippingRelayPoint;
  cartSubtotal: number;
  amountTotal?: number;
  shippingAmount?: number;
  orderId?: string;
  paidAt?: string;
  stockAdjustments?: StockAdjustment[];
  items: CheckoutSessionItem[];
  createdAt: string;
  updatedAt: string;
};

export type EmailEventType = "order_confirmation" | "shipping_tracking";
export type EmailEventStatus = "pending" | "sent" | "failed" | "skipped";

export type EmailEvent = {
  _id?: string;
  type: EmailEventType;
  status: EmailEventStatus;
  to?: string;
  subject: string;
  orderId?: string;
  stripeSessionId?: string;
  providerId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type WebhookEventStatus = "processing" | "processed" | "failed" | "ignored";

export type WebhookEvent = {
  _id?: string;
  provider: "stripe" | "boxtal";
  eventId: string;
  eventType: string;
  objectId?: string;
  status: WebhookEventStatus;
  error?: string;
  createdAt: string;
  updatedAt: string;
};
