import { getProducts } from "@/lib/products";
import { categories } from "@/lib/sample-data";
import { CatalogClient } from "@/components/catalog-client";

export default async function CatalogPage() {
  const products = await getProducts();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="mb-10 space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Catalogue
        </p>
        <h1 className="font-display text-4xl text-slate-900">
          Tous les boosters, coffrets et protections
        </h1>
        <p className="text-sm text-slate-600">
          Filtre par sous categorie ou tape un nom pour trouver la perle rare.
        </p>
      </div>
      <CatalogClient
        products={products}
        categories={[...categories]}
      />
    </main>
  );
}
