import Link from "next/link";
import { categories, franchises } from "@/lib/sample-data";
import type { Product } from "@/lib/types";
import { getProducts } from "@/lib/products";

export const dynamic = "force-dynamic";

type CategoriesPageProps = {
  searchParams: Promise<{ franchise?: string }>;
};

function filterByFranchise(products: Product[], franchise?: string) {
  if (!franchise || franchise === "Tous") return products;
  return products.filter((product) => {
    if (product.franchise === "Both") return true;
    if (product.franchise) return product.franchise === franchise;
    return product.tags?.includes(franchise) ?? true;
  });
}

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  const params = await searchParams;
  const selected =
    params.franchise && franchises.includes(params.franchise as (typeof franchises)[number])
      ? params.franchise
      : "Tous";
  const products = await getProducts();
  const filtered = filterByFranchise(products, selected);
  const categoryCounts = categories.map((category) => ({
    category,
    count: filtered.filter((product) => product.category === category).length,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="mb-10 space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Categories
        </p>
        <h1 className="font-display text-4xl text-slate-900">
          Choisis ton univers TCG
        </h1>
      </div>
      <div className="mb-8 flex flex-wrap gap-2">
        {["Tous", ...franchises].map((franchise) => (
          <Link
            key={franchise}
            href={
              franchise === "Tous"
                ? "/categories"
                : `/categories?franchise=${encodeURIComponent(franchise)}`
            }
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              selected === franchise
                ? "bg-black text-white"
                : "bg-white text-slate-600"
            }`}
          >
            {franchise}
          </Link>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {categoryCounts.map(({ category, count }) => (
          <Link
            key={category}
            href={`/categories/${encodeURIComponent(category)}${
              selected !== "Tous"
                ? `?franchise=${encodeURIComponent(selected)}`
                : ""
            }`}
            className="rounded-[28px] border border-black/10 bg-white p-6 shadow-soft transition hover:-translate-y-1"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Sous categorie
            </p>
            <p className="mt-2 font-display text-2xl text-slate-900">
              {category}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {count} produits disponibles.
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
