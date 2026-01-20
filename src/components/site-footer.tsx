import Link from "next/link";
import { categories } from "@/lib/sample-data";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-black/10 bg-[var(--surface)]">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-12 md:grid-cols-[1.2fr_1fr_1fr]">
        <div className="space-y-3">
          <p className="font-display text-2xl">Nebula TCG</p>
          <p className="text-sm text-slate-600">
            Boutique TCG francaise pour les fans de Pokemon et One Piece. Drops
            reguliers, opening nights et protections premium.
          </p>
          <div className="flex gap-3 text-sm">
            <span className="rounded-full border border-black/10 px-3 py-1">
              Paiement securise
            </span>
            <span className="rounded-full border border-black/10 px-3 py-1">
              Livraison rapide
            </span>
          </div>
        </div>
        <div>
          <p className="mb-3 font-semibold">Navigation</p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>
              <Link href="/catalog">Catalogue complet</Link>
            </li>
            <li>
              <Link href="/faq">FAQ</Link>
            </li>
            <li>
              <Link href="/contact">Support</Link>
            </li>
            <li>
              <Link href="/admin">Admin</Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-3 font-semibold">Sous categories</p>
          <ul className="grid grid-cols-2 gap-2 text-sm text-slate-600">
            {categories.map((cat) => (
              <li key={cat}>
                <Link href={`/categories/${encodeURIComponent(cat)}`}>
                  {cat}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-black/10 px-6 py-4 text-center text-xs text-slate-500">
        (c) 2026 Nebula TCG. Tous droits reserves.
      </div>
    </footer>
  );
}
