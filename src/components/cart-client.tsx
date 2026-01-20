"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Product } from "@/lib/types";
import { useCart } from "@/components/cart-context";
import { formatPrice } from "@/lib/format";

type CartClientProps = {
  products: Product[];
};

export function CartClient({ products }: CartClientProps) {
  const { items, updateItem, removeItem, clear } = useCart();
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const checkoutSuccess = searchParams.get("success");
  const checkoutCancel = searchParams.get("cancel");

  const lines = useMemo(() => {
    const map = new Map(products.map((product) => [product.slug, product]));
    return items
      .map((item) => ({
        item,
        product: map.get(item.slug),
      }))
      .filter((line) => line.product);
  }, [items, products]);

  const subtotal = lines.reduce((total, line) => {
    if (!line.product) return total;
    return total + line.product.price * line.item.quantity;
  }, 0);

  async function handleCheckout() {
    setLoading(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const payload = await response.json();
      if (payload.url) {
        window.location.href = payload.url;
      } else {
        throw new Error(payload.error || "Checkout failed");
      }
    } catch (error) {
      console.error(error);
      alert("Impossible de lancer le checkout pour le moment.");
    } finally {
      setLoading(false);
    }
  }

  if (lines.length === 0) {
    return (
      <div className="space-y-4">
        {checkoutSuccess ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Paiement confirme. Merci pour ta commande !
          </div>
        ) : null}
        {checkoutCancel ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Paiement annule. Ton panier est toujours la.
          </div>
        ) : null}
        <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center">
          <p className="text-sm text-slate-600">
            Ton panier est vide. Ajoute des boosters et coffrets !
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {checkoutSuccess ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Paiement confirme. Merci pour ta commande !
        </div>
      ) : null}
      {checkoutCancel ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Paiement annule. Ton panier est toujours la.
        </div>
      ) : null}
      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          {lines.map((line) => (
            <div
              key={line.item.slug}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-black/10 bg-white p-4 shadow-soft"
            >
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {line.product?.category}
              </p>
              <p className="font-semibold text-slate-900">
                {line.product?.name}
              </p>
              <p className="text-sm text-slate-500">
                {formatPrice(line.product?.price ?? 0)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  updateItem(line.item.slug, line.item.quantity - 1)
                }
                className="h-8 w-8 rounded-full border border-black/10"
              >
                -
              </button>
              <span className="min-w-[2rem] text-center text-sm">
                {line.item.quantity}
              </span>
              <button
                type="button"
                onClick={() =>
                  updateItem(line.item.slug, line.item.quantity + 1)
                }
                className="h-8 w-8 rounded-full border border-black/10"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => removeItem(line.item.slug)}
                className="ml-2 text-xs text-slate-500"
              >
                Retirer
              </button>
            </div>
          </div>
        ))}
      </div>

        <div className="space-y-4 rounded-3xl border border-black/10 bg-white p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Sous-total</span>
          <span className="font-semibold">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Livraison</span>
          <span>Calculee a l'etape suivante</span>
        </div>
        <div className="border-t border-black/10 pt-4">
          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading}
            className="w-full rounded-full bg-black px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Redirection..." : "Payer avec Stripe"}
          </button>
          <button
            type="button"
            onClick={clear}
            className="mt-3 w-full rounded-full border border-black/10 px-6 py-3 text-sm font-semibold text-slate-600"
          >
            Vider le panier
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
