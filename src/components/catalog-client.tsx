"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/product-card";

type CatalogClientProps = {
  products: Product[];
  categories: string[];
  franchises: string[];
  initialFranchise: string;
};

export function CatalogClient({
  products,
  categories,
  franchises,
  initialFranchise,
}: CatalogClientProps) {
  const [activeCategory, setActiveCategory] = useState<string>("Tous");
  const [activeFranchise, setActiveFranchise] = useState<string>(
    initialFranchise || "Tous",
  );
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        activeCategory === "Tous" || product.category === activeCategory;
      const matchesFranchise =
        activeFranchise === "Tous" ||
        product.franchise === "Both" ||
        product.franchise === activeFranchise ||
        product.tags?.includes(activeFranchise);
      const matchesSearch =
        !search ||
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.description.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch && matchesFranchise;
    });
  }, [products, activeCategory, activeFranchise, search]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {franchises.map((franchise) => (
            <button
              key={franchise}
              type="button"
              onClick={() => setActiveFranchise(franchise)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeFranchise === franchise
                  ? "bg-black text-white"
                  : "bg-white text-slate-600"
              }`}
            >
              {franchise}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {["Tous", ...categories].map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeCategory === category
                  ? "bg-black text-white"
                  : "bg-white text-slate-600"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher un produit..."
          className="w-full max-w-xs rounded-full border border-black/10 bg-white px-4 py-2 text-sm shadow-soft focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white p-6 text-center text-sm text-slate-500">
          Aucun produit dans cette selection.
        </div>
      ) : null}
    </div>
  );
}
