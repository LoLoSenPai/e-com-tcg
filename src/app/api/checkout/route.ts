import { NextRequest, NextResponse } from "next/server";
import { BoxtalApiError, resolveBoxtalRelayPoint } from "@/lib/boxtal";
import { getProductsBySlugsStrict, ProductLookupError } from "@/lib/products";
import { getStripe } from "@/lib/stripe";
import { getCustomerFromRequest } from "@/lib/customer-auth";
import type { CheckoutSessionItem, ShippingRelayPoint } from "@/lib/types";
import { getShippingQuotes } from "@/lib/shipping";
import {
  CheckoutStockReservationError,
  createCheckoutSessionRecord,
  markCheckoutSessionStockReservationFailed,
  reserveCheckoutSessionStock,
} from "@/lib/checkout-sessions";
import {
  getCheckoutBaseUrl,
  maxCheckoutItems,
  normalizeCheckoutItems,
} from "@/lib/checkout-validation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getCheckoutSessionExpiresAt } from "@/lib/stripe-checkout";
import { verifyRelayPointSelection } from "@/lib/relay-selection";

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
  const ip = getClientIp(request.headers);
  const limit = checkRateLimit({
    key: `checkout-create:${ip}`,
    max: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many checkout attempts" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)),
        },
      },
    );
  }

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

  const items = normalizeCheckoutItems(body.items);
  if (items.length === 0) {
    return NextResponse.json({ error: "Empty cart" }, { status: 400 });
  }
  if (items.length > maxCheckoutItems) {
    return NextResponse.json(
      { error: `Cart cannot contain more than ${maxCheckoutItems} products` },
      { status: 400 },
    );
  }

  const deliveryMode = body.deliveryMode === "relay" ? "relay" : "home";
  let relayPoint: ShippingRelayPoint | null = null;

  if (deliveryMode === "relay") {
    const verifiedRelay = verifyRelayPointSelection(body.relayPoint);
    if (!verifiedRelay.ok) {
      return NextResponse.json(
        { error: verifiedRelay.error || "Missing relay point selection" },
        { status: 400 },
      );
    }
    try {
      relayPoint = await resolveBoxtalRelayPoint(verifiedRelay.relayPoint);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Relay point validation failed",
        },
        { status: error instanceof BoxtalApiError ? error.status : 502 },
      );
    }
  }

  const slugs = items.map((item) => item.slug);
  let products;
  try {
    products = await getProductsBySlugsStrict(slugs);
  } catch (error) {
    const message =
      error instanceof ProductLookupError
        ? "Catalogue temporairement indisponible. Reessayez dans quelques instants."
        : "Impossible de verifier le catalogue.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
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
  const origin = getCheckoutBaseUrl({
    configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    requestOrigin: request.headers.get("origin"),
    requestUrl: request.url,
    isProduction: process.env.NODE_ENV === "production",
  });
  if (!origin) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_SITE_URL" },
      { status: 500 },
    );
  }

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
        metadata: {
          slug: item.slug,
        },
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

  let stripeSessionIdToExpire: string | undefined;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      expires_at: getCheckoutSessionExpiresAt(),
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart?cancel=1&session_id={CHECKOUT_SESSION_ID}`,
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
    stripeSessionIdToExpire = session.id;

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

    try {
      await reserveCheckoutSessionStock({
        stripeSessionId: session.id,
        items: checkoutItems,
      });
    } catch (error) {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      if (error instanceof CheckoutStockReservationError) {
        await markCheckoutSessionStockReservationFailed({
          stripeSessionId: session.id,
          stockAdjustments: error.adjustments,
          reason: error.message,
        }).catch(() => undefined);
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }

    stripeSessionIdToExpire = undefined;
    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stripe checkout error";
    if (stripeSessionIdToExpire) {
      await stripe.checkout.sessions
        .expire(stripeSessionIdToExpire)
        .catch(() => undefined);
      await markCheckoutSessionStockReservationFailed({
        stripeSessionId: stripeSessionIdToExpire,
        stockAdjustments: [],
        reason: message,
      }).catch(() => undefined);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
