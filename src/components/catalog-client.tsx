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
  const [gridMode, setGridMode] = useState<"3" | "4">("3");

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

  const gridClassName =
    gridMode === "4"
      ? "grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-3 xl:grid-cols-4"
      : "grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-3";

  return (
    <div className="space-y-8">
      <div className="manga-panel manga-dot flex flex-wrap items-center justify-between gap-4 rounded-[28px] bg-white p-4">
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-700">
            {filtered.length} produit{filtered.length > 1 ? "s" : ""} trouve
            {filtered.length > 1 ? "s" : ""}
          </p>
          <div className="inline-flex items-center gap-1 rounded-xl border-2 border-black bg-[#1e1733] p-1">
            <button
              type="button"
              onClick={() => setGridMode("3")}
              aria-label="Grille 1 colonne sur mobile, 3 colonnes sur desktop"
              title="1 colonne mobile / 3 colonnes desktop"
              className={`grid h-9 w-9 place-items-center rounded-md border border-white/20 transition ${
                gridMode === "3"
                  ? "bg-[var(--accent-2)]"
                  : "bg-white/10 hover:bg-white/20"
              }`}
            >
              <span className="grid gap-0.5 sm:hidden">
                {Array.from({ length: 3 }).map((_, index) => (
                  <span
                    key={`grid-mobile-1-${index}`}
                    className="h-1.5 w-4 rounded-[2px] bg-white/90"
                  />
                ))}
              </span>
              <span className="hidden grid-cols-3 gap-0.5 sm:grid">
                {Array.from({ length: 9 }).map((_, index) => (
                  <span
                    key={`grid-3-${index}`}
                    className="h-1.5 w-1.5 rounded-[2px] bg-white/90"
                  />
                ))}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setGridMode("4")}
              aria-label="Grille 2 colonnes sur mobile, 4 colonnes sur desktop"
              title="2 colonnes mobile / 4 colonnes desktop"
              className={`grid h-9 w-9 place-items-center rounded-md border border-white/20 transition ${
                gridMode === "4"
                  ? "bg-[var(--accent-2)]"
                  : "bg-white/10 hover:bg-white/20"
              }`}
            >
              <span className="grid grid-cols-2 gap-0.5 sm:hidden">
                {Array.from({ length: 6 }).map((_, index) => (
                  <span
                    key={`grid-mobile-2-${index}`}
                    className="h-1.5 w-2.5 rounded-[2px] bg-white/90"
                  />
                ))}
              </span>
              <span className="hidden grid-cols-4 gap-0.5 sm:grid">
                {Array.from({ length: 16 }).map((_, index) => (
                  <span
                    key={`grid-4-${index}`}
                    className="h-1 w-1 rounded-[2px] bg-white/90"
                  />
                ))}
              </span>
            </button>
          </div>
        </div>
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
      <div className={gridClassName}>
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
