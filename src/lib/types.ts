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

export type OrderItem = {
  name: string;
  quantity: number;
  unitAmount: number;
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
  shippedAt?: string;
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
