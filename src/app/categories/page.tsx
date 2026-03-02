import Link from "next/link";
import {
  categories,
  franchiseLanguages,
  franchises,
} from "@/lib/sample-data";
import type { Product } from "@/lib/types";
import { getProducts } from "@/lib/products";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Catégories - Returners",
  description:
    "Explore les catégories de produits Pokemon et One Piece sur Returners.",
};

type CategoriesPageProps = {
  searchParams: Promise<{ franchise?: string; language?: string }>;
};

function filterByFranchise(products: Product[], franchise?: string) {
  if (!franchise || franchise === "Tous") return products;
  return products.filter((product) => {
    if (product.franchise === "Both") return true;
    if (product.franchise) return product.franchise === franchise;
    return product.tags?.includes(franchise) ?? true;
  });
}

function filterByLanguage(products: Product[], language?: string) {
  if (!language || language === "Tous") return products;
  return products.filter(
    (product) => product.language === language || product.tags?.includes(language),
  );
}

function getAllowedLanguages(franchise: string) {
  if (franchise === "Pokemon") return [...franchiseLanguages.Pokemon];
  if (franchise === "One Piece") return [...franchiseLanguages["One Piece"]];
  return Array.from(
    new Set([
      ...franchiseLanguages.Pokemon,
      ...franchiseLanguages["One Piece"],
    ]),
  );
}

function buildCategoriesHref(franchise: string, language: string) {
  const query = new URLSearchParams();
  if (franchise !== "Tous") query.set("franchise", franchise);
  if (language !== "Tous") query.set("language", language);
  const queryString = query.toString();
  return queryString ? `/categories?${queryString}` : "/categories";
}

function buildCategoryHref(
  category: string,
  franchise: string,
  language: string,
) {
  const query = new URLSearchParams();
  if (franchise !== "Tous") query.set("franchise", franchise);
  if (language !== "Tous") query.set("language", language);
  const queryString = query.toString();
  return `/categories/${encodeURIComponent(category)}${
    queryString ? `?${queryString}` : ""
  }`;
}

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  const params = await searchParams;
  const selectedFranchise =
    params.franchise &&
    franchises.includes(params.franchise as (typeof franchises)[number])
      ? params.franchise
      : "Tous";
  const allowedLanguages: string[] = getAllowedLanguages(selectedFranchise);
  const selectedLanguage =
    params.language && allowedLanguages.includes(params.language)
      ? params.language
      : "Tous";
  const products = await getProducts();
  const filtered = filterByLanguage(
    filterByFranchise(products, selectedFranchise),
    selectedLanguage,
  );
  const categoryCounts = categories.map((category) => ({
    category,
    count: filtered.filter((product) => product.category === category).length,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="mb-10 space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Catégories
        </p>
        <h1 className="font-display text-4xl text-slate-900">
          Choisis ton univers TCG
        </h1>
      </div>
      <div className="manga-panel manga-dot mb-6 flex flex-wrap gap-2 rounded-[24px] bg-white p-4">
        {["Tous", ...franchises].map((franchise) => (
          <Link
            key={franchise}
            href={buildCategoriesHref(franchise, selectedLanguage)}
            className={`rounded-full border-2 border-black px-4 py-2 text-sm font-semibold transition ${
              selectedFranchise === franchise
                ? "bg-black text-white shadow-[3px_3px_0_#ffbf69]"
                : "bg-white text-slate-600 hover:-translate-y-0.5"
            }`}
          >
            {franchise}
          </Link>
        ))}
      </div>
      <div className="manga-panel manga-dot mb-8 flex flex-wrap gap-2 rounded-[24px] bg-white p-4">
        {["Tous", ...allowedLanguages].map((language) => (
          <Link
            key={language}
            href={buildCategoriesHref(selectedFranchise, language)}
            className={`rounded-full border-2 border-black px-4 py-2 text-sm font-semibold transition ${
              selectedLanguage === language
                ? "bg-black text-white shadow-[3px_3px_0_#ff6b35]"
                : "bg-white text-slate-600 hover:-translate-y-0.5"
            }`}
          >
            {language}
          </Link>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {categoryCounts.map(({ category, count }) => (
          <Link
            key={category}
            href={buildCategoryHref(category, selectedFranchise, selectedLanguage)}
            className="manga-panel manga-card manga-dot rounded-[28px] bg-white p-6"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Sous catégorie
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
