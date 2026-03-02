"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/product-card";

type LanguageMap = {
  Pokemon: string[];
  "One Piece": string[];
};

type CatalogClientProps = {
  products: Product[];
  categories: string[];
  franchises: string[];
  initialFranchise: string;
  initialLanguage: string;
  languageOptionsByFranchise: LanguageMap;
};

export function CatalogClient({
  products,
  categories,
  franchises,
  initialFranchise,
  initialLanguage,
  languageOptionsByFranchise,
}: CatalogClientProps) {
  const [activeCategory, setActiveCategory] = useState<string>("Tous");
  const [activeFranchise, setActiveFranchise] = useState<string>(
    initialFranchise || "Tous",
  );
  const [activeLanguage, setActiveLanguage] = useState<string>(
    initialLanguage || "Tous",
  );
  const [search, setSearch] = useState("");

  const availableLanguages = useMemo(() => {
    if (activeFranchise === "Pokemon") {
      return languageOptionsByFranchise.Pokemon;
    }
    if (activeFranchise === "One Piece") {
      return languageOptionsByFranchise["One Piece"];
    }
    return Array.from(
      new Set([
        ...languageOptionsByFranchise.Pokemon,
        ...languageOptionsByFranchise["One Piece"],
      ]),
    );
  }, [activeFranchise, languageOptionsByFranchise]);

  useEffect(() => {
    if (
      activeLanguage !== "Tous" &&
      !availableLanguages.includes(activeLanguage)
    ) {
      setActiveLanguage("Tous");
    }
  }, [activeLanguage, availableLanguages]);

  const filtered = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        activeCategory === "Tous" || product.category === activeCategory;
      const matchesFranchise =
        activeFranchise === "Tous" ||
        product.franchise === "Both" ||
        product.franchise === activeFranchise ||
        product.tags?.includes(activeFranchise);
      const matchesLanguage =
        activeLanguage === "Tous" ||
        product.language === activeLanguage ||
        product.tags?.includes(activeLanguage);
      const matchesSearch =
        !search ||
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.description.toLowerCase().includes(search.toLowerCase());
      return (
        matchesCategory &&
        matchesSearch &&
        matchesFranchise &&
        matchesLanguage
      );
    });
  }, [products, activeCategory, activeFranchise, activeLanguage, search]);

  return (
    <div className="space-y-8">
      <div className="manga-panel manga-dot flex flex-wrap items-center justify-between gap-4 rounded-[28px] bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {franchises.map((franchise) => (
            <button
              key={franchise}
              type="button"
              onClick={() => setActiveFranchise(franchise)}
              className={`rounded-full border-2 border-black px-4 py-2 text-sm font-semibold transition ${
                activeFranchise === franchise
                  ? "bg-black text-white shadow-[3px_3px_0_#ffbf69]"
                  : "bg-white text-slate-600 hover:-translate-y-0.5"
              }`}
            >
              {franchise}
            </button>
          ))}
        </div>
        <div className="flex w-full flex-wrap gap-2">
          {["Tous", ...availableLanguages].map((language) => (
            <button
              key={language}
              type="button"
              onClick={() => setActiveLanguage(language)}
              className={`rounded-full border-2 border-black px-4 py-2 text-sm font-semibold transition ${
                activeLanguage === language
                  ? "bg-black text-white shadow-[3px_3px_0_#ff6b35]"
                  : "bg-white text-slate-600 hover:-translate-y-0.5"
              }`}
            >
              {language}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {["Tous", ...categories].map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`rounded-full border-2 border-black px-4 py-2 text-sm font-semibold transition ${
                activeCategory === category
                  ? "bg-black text-white shadow-[3px_3px_0_#2ec4b6]"
                  : "bg-white text-slate-600 hover:-translate-y-0.5"
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
          className="w-full max-w-xs rounded-full border-2 border-black bg-white px-4 py-2 text-sm shadow-soft focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="manga-panel rounded-2xl bg-white p-6 text-center text-sm text-slate-500">
          Aucun produit dans cette selection.
        </div>
      ) : null}
    </div>
  );
}
