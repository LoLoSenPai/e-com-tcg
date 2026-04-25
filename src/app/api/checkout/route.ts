import { NextRequest, NextResponse } from "next/server";
import { getProductsBySlugs } from "@/lib/products";
import { getStripe } from "@/lib/stripe";
import { getCustomerFromRequest } from "@/lib/customer-auth";
import type { CheckoutSessionItem, ShippingRelayPoint } from "@/lib/types";
import { getShippingQuotes } from "@/lib/shipping";
import { createCheckoutSessionRecord } from "@/lib/checkout-sessions";

type CartItem = {
  slug: string;
  quantity: number;
};

type CheckoutBody = {
  items?: CartItem[];
  deliveryMode?: "home" | "relay";
  relayPoint?: ShippingRelayPoint | null;
};

function cleanMetadataValue(value: string, maxLength = 250) {
  return value.slice(0, maxLength);
}

export async function POST(request: NextRequest) {
  let body: CheckoutBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY" },
      { status: 500 },
    );
  }
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: "Missing MONGODB_URI" },
      { status: 500 },
    );
  }

  const items = Array.isArray(body.items)
    ? body.items
        .map((item) => ({
          slug: String(item.slug || "").trim(),
          quantity: Math.floor(Number(item.quantity)),
        }))
        .filter((item) => item.slug && item.quantity > 0)
    : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "Empty cart" }, { status: 400 });
  }

  const deliveryMode = body.deliveryMode === "relay" ? "relay" : "home";
  const relayPoint =
    deliveryMode === "relay" && body.relayPoint
      ? body.relayPoint
      : null;

  if (deliveryMode === "relay" && (!relayPoint || !relayPoint.code)) {
    return NextResponse.json(
      { error: "Missing relay point selection" },
      { status: 400 },
    );
  }

  const slugs = items.map((item) => item.slug);
  const products = await getProductsBySlugs(slugs);
  const productMap = new Map(products.map((product) => [product.slug, product]));

  let checkoutItems: CheckoutSessionItem[];
  try {
    checkoutItems = items.map((item) => {
      const product = productMap.get(item.slug);
      if (!product) {
        throw new Error(`Product not found: ${item.slug}`);
      }
      const stock = product.stock ?? 0;
      if (stock <= 0 || item.quantity > stock) {
        throw new Error(`Stock insuffisant pour ${product.name}`);
      }
      return {
        slug: product.slug,
        name: product.name,
        description: product.description,
        quantity: item.quantity,
        unitAmount: product.price,
      };
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid cart items";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const stripe = getStripe();
  const customer = await getCustomerFromRequest(request);
  const origin =
    request.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  const subtotal = checkoutItems.reduce(
    (total, item) => total + item.unitAmount * item.quantity,
    0,
  );
  const lineItems = checkoutItems.map((item) => ({
    quantity: item.quantity,
    price_data: {
      currency: "eur",
      unit_amount: item.unitAmount,
      product_data: {
        name: item.name,
        description: item.description,
      },
    },
  }));

  const metadata: Record<string, string> = {
    deliveryMode,
    cartSubtotal: String(subtotal),
  };

  if (customer?._id) {
    metadata.customerId = cleanMetadataValue(customer._id);
  }

  if (relayPoint) {
    metadata.relayCode = cleanMetadataValue(relayPoint.code, 100);
    if (relayPoint.name) {
      metadata.relayName = cleanMetadataValue(relayPoint.name, 200);
    }
    if (relayPoint.network) {
      metadata.relayNetwork = cleanMetadataValue(relayPoint.network, 100);
    }
    if (relayPoint.address?.line1) {
      metadata.relayLine1 = cleanMetadataValue(relayPoint.address.line1, 250);
    }
    if (relayPoint.address?.zipCode) {
      metadata.relayZipCode = cleanMetadataValue(relayPoint.address.zipCode, 30);
    }
    if (relayPoint.address?.city) {
      metadata.relayCity = cleanMetadataValue(relayPoint.address.city, 100);
    }
    if (relayPoint.address?.country) {
      metadata.relayCountry = cleanMetadataValue(relayPoint.address.country, 10);
    }
    if (typeof relayPoint.latitude === "number") {
      metadata.relayLat = String(relayPoint.latitude);
    }
    if (typeof relayPoint.longitude === "number") {
      metadata.relayLng = String(relayPoint.longitude);
    }
  }

  const shippingOptions = getShippingQuotes(deliveryMode, { subtotal }).map(
    (quote) => ({
      shipping_rate_data: {
        type: "fixed_amount" as const,
        display_name: quote.label,
        fixed_amount: { amount: quote.amount, currency: "eur" },
        delivery_estimate: {
          minimum: {
            unit: "business_day" as const,
            value: quote.estimateMinBusinessDays,
          },
          maximum: {
            unit: "business_day" as const,
            value: quote.estimateMaxBusinessDays,
          },
        },
      },
    }),
  );

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart?cancel=1`,
      customer_email: customer?.email || undefined,
      metadata,
      shipping_options: shippingOptions,
      shipping_address_collection: {
        allowed_countries: ["FR", "BE", "CH", "LU"],
      },
      phone_number_collection: {
        enabled: true,
      },
    });

    await createCheckoutSessionRecord({
      stripeSessionId: session.id,
      stripeSessionUrl: session.url,
      status: "created",
      customerId: customer?._id,
      customerEmail: customer?.email,
      deliveryMode,
      shippingRelay: relayPoint || undefined,
      cartSubtotal: subtotal,
      items: checkoutItems,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stripe checkout error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
