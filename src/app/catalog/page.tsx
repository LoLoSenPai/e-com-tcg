import { getProducts } from "@/lib/products";
import {
  categories,
  franchiseLanguages,
  franchises,
} from "@/lib/sample-data";
import { CatalogClient } from "@/components/catalog-client";
import type { Product } from "@/lib/types";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Catalogue - Returners",
  description: "Parcours le catalogue complet Pokemon et One Piece.",
};

type CatalogPageProps = {
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

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const selected =
    params.franchise && franchises.includes(params.franchise as (typeof franchises)[number])
      ? params.franchise
      : "Tous";
  const allowedLanguages: string[] =
    selected === "Pokemon"
      ? [...franchiseLanguages.Pokemon]
      : selected === "One Piece"
        ? [...franchiseLanguages["One Piece"]]
        : Array.from(
          new Set([
            ...franchiseLanguages.Pokemon,
            ...franchiseLanguages["One Piece"],
          ]),
        );
  const selectedLanguage =
    params.language && allowedLanguages.includes(params.language)
      ? params.language
      : "Tous";
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
          Filtre par sous catégorie ou tape un nom pour trouver la perle rare.
        </p>
      </div>
      <CatalogClient
        products={filterByFranchise(products, selected)}
        categories={[...categories]}
        franchises={["Tous", ...franchises]}
        initialFranchise={selected}
        initialLanguage={selectedLanguage}
        languageOptionsByFranchise={{
          Pokemon: [...franchiseLanguages.Pokemon],
          "One Piece": [...franchiseLanguages["One Piece"]],
        }}
      />
    </main>
  );
}
