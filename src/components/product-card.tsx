import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { AddToCartButton } from "@/components/add-to-cart-button";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const outOfStock = (product.stock ?? 0) <= 0;
  const franchiseLabel = product.franchise || product.tags?.[0];

  return (
    <div className="card-foil group rounded-3xl border border-black/10 bg-white p-5 shadow-soft transition hover:-translate-y-1">
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold text-slate-700">
          {product.category}
        </span>
        {product.badge ? (
          <span className="rounded-full bg-[var(--accent-2)] px-3 py-1 text-xs font-semibold text-white">
            {product.badge}
          </span>
        ) : null}
      </div>
      {franchiseLabel ? (
        <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          {franchiseLabel}
        </div>
      ) : null}
      <Link href={`/products/${product.slug}`}>
        <div
          className="mt-6 grid aspect-[3/4] place-items-center rounded-2xl bg-[linear-gradient(130deg,rgba(255,107,53,0.15),rgba(46,196,182,0.25))] text-center text-sm font-semibold text-slate-600"
          style={
            product.image
              ? {
                  backgroundImage: `url(${product.image})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          {!product.image ? "Booster art preview" : ""}
        </div>
        <h3 className="mt-4 text-lg font-semibold text-slate-900">
          {product.name}
        </h3>
      </Link>
      <p className="mt-2 text-sm text-slate-600">
        {product.description}
      </p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-lg font-semibold text-slate-900">
          {formatPrice(product.price)}
        </span>
        <AddToCartButton
          slug={product.slug}
          label={outOfStock ? "Rupture" : "Ajouter"}
          disabled={outOfStock}
        />
      </div>
    </div>
  );
}
