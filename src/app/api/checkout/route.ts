import { NextResponse } from "next/server";
import { getProductsBySlugs } from "@/lib/products";
import { getStripe } from "@/lib/stripe";

type CartItem = {
  slug: string;
  quantity: number;
};

export async function POST(request: Request) {
  let body: { items?: CartItem[] };
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

  const items = Array.isArray(body.items)
    ? body.items.filter((item) => item.quantity > 0)
    : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "Empty cart" }, { status: 400 });
  }

  const slugs = items.map((item) => item.slug);
  const products = await getProductsBySlugs(slugs);
  const productMap = new Map(products.map((product) => [product.slug, product]));

  let lineItems;
  try {
    lineItems = items.map((item) => {
      const product = productMap.get(item.slug);
      if (!product) {
        throw new Error(`Product not found: ${item.slug}`);
      }
      return {
        quantity: item.quantity,
        price_data: {
          currency: "eur",
          unit_amount: product.price,
          product_data: {
            name: product.name,
            description: product.description,
          },
        },
      };
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid cart items" },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  const origin =
    request.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    success_url: `${origin}/cart?success=1`,
    cancel_url: `${origin}/cart?cancel=1`,
    shipping_address_collection: {
      allowed_countries: ["FR", "BE", "CH", "LU"],
    },
    phone_number_collection: {
      enabled: true,
    },
  });

  return NextResponse.json({ url: session.url });
}
