import { notFound } from "next/navigation";
import { categories } from "@/lib/sample-data";
import { getProducts } from "@/lib/products";
import { ProductCard } from "@/components/product-card";

export const dynamic = "force-dynamic";

type CategoryPageProps = {
  params: Promise<{ category: string }>;
};

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;
  const decoded = decodeURIComponent(category);
  if (!categories.includes(decoded as (typeof categories)[number])) {
    notFound();
  }
  const products = await getProducts();
  const filtered = products.filter((product) => product.category === decoded);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="mb-10 space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Sous categorie
        </p>
        <h1 className="font-display text-4xl text-slate-900">{decoded}</h1>
        <p className="text-sm text-slate-600">
          {filtered.length} produits dans cette selection.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-black/10 bg-white p-6 text-center text-sm text-slate-500">
          Aucun produit disponible pour le moment.
        </div>
      ) : null}
    </main>
  );
}
