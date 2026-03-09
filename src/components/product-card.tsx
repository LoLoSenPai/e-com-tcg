import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatLanguageCode, formatPrice } from "@/lib/format";
import { AddToCartButton } from "@/components/add-to-cart-button";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const outOfStock = (product.stock ?? 0) <= 0;
  const franchiseLabel = product.franchise || product.tags?.[0];

  return (
    <div className="card-foil manga-panel manga-card manga-dot group rounded-[24px] bg-white p-4 md:rounded-[28px] md:p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-full border border-black/10 bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold text-slate-700">
          {product.category}
        </span>
        {product.badge ? (
          <span className="rounded-full bg-[var(--accent-2)] px-3 py-1 text-xs font-semibold text-white">
            {product.badge}
          </span>
        ) : null}
      </div>
      {franchiseLabel ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          <span>{franchiseLabel}</span>
          {product.language ? (
            <span className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[10px] tracking-[0.15em]">
              {formatLanguageCode(product.language)}
            </span>
          ) : null}
        </div>
      ) : null}
      <Link href={`/products/${product.slug}`}>
        <div
          className="manga-dot mt-4 grid aspect-[3/4] place-items-center rounded-2xl border border-black/10 bg-[linear-gradient(130deg,rgba(255,107,53,0.15),rgba(46,196,182,0.25))] text-center text-sm font-semibold text-slate-600 md:mt-6"
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
        <h3
          className="mt-4 h-[3.95rem] overflow-hidden text-[1.05rem] font-semibold leading-[1.25] text-slate-900 md:h-[4.2rem] md:text-lg"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          }}
        >
          {product.name}
        </h3>
      </Link>
      <div className="mt-2 hidden md:block">
        <p
          className="min-h-[3.75rem] overflow-hidden text-sm text-slate-600"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          }}
        >
          {product.description}
        </p>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="shrink-0 text-lg font-semibold text-slate-900">
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
