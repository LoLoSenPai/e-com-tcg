import Link from "next/link";
import { categories } from "@/lib/sample-data";

export default function CategoriesPage() {
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
      <div className="grid gap-6 md:grid-cols-2">
        {categories.map((category) => (
          <Link
            key={category}
            href={`/categories/${encodeURIComponent(category)}`}
            className="rounded-[28px] border border-black/10 bg-white p-6 shadow-soft transition hover:-translate-y-1"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Sous categorie
            </p>
            <p className="mt-2 font-display text-2xl text-slate-900">
              {category}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Explorer les derniers drops {category.toLowerCase()}.
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
