import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getProducts } from "@/lib/products";
import { formatPrice } from "@/lib/format";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { ProductCard } from "@/components/product-card";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) {
    notFound();
  }
  const outOfStock = (product.stock ?? 0) <= 0;
  const products = await getProducts();
  const related = products
    .filter((item) => item.category === product.category && item.slug !== slug)
    .slice(0, 3);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <Link
        href="/catalog"
        className="text-sm font-semibold text-slate-500"
      >
        &lt; Retour au catalogue
      </Link>

      <div className="mt-6 grid gap-10 md:grid-cols-[1fr_1fr]">
        <div className="card-foil rounded-[32px] border border-black/10 bg-white p-8 shadow-soft">
          <div
            className="grid aspect-[3/4] place-items-center rounded-2xl bg-[linear-gradient(140deg,rgba(255,107,53,0.18),rgba(46,196,182,0.25))] text-sm font-semibold text-slate-600"
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
            {!product.image ? "Artset preview" : ""}
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-500">
            {product.tags?.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-black/10 bg-white px-3 py-1"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            {product.category}
          </p>
          <h1 className="font-display text-4xl text-slate-900">
            {product.name}
          </h1>
          <p className="text-sm text-slate-600">{product.description}</p>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-semibold text-slate-900">
              {formatPrice(product.price)}
            </span>
            {product.badge ? (
              <span className="rounded-full bg-[var(--accent-2)] px-3 py-1 text-xs font-semibold text-white">
                {product.badge}
              </span>
            ) : null}
          </div>
          <AddToCartButton
            slug={product.slug}
            label={outOfStock ? "Rupture de stock" : "Ajouter au panier"}
            disabled={outOfStock}
          />
          <div className="mt-6 rounded-2xl border border-black/10 bg-[var(--surface)] p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Stock & expedition</p>
            <p className="mt-2">
              {product.stock ?? 0} en stock - expedition sous 48h depuis notre
              studio.
            </p>
          </div>
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mt-16 space-y-6">
          <h2 className="font-display text-2xl text-slate-900">
            Encore plus dans cette categorie
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <ProductCard key={item.slug} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
