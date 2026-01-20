import Link from "next/link";
import { getProducts } from "@/lib/products";
import { categories } from "@/lib/sample-data";
import { ProductCard } from "@/components/product-card";

export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await getProducts();
  const featured = products.filter((product) => product.featured).slice(0, 4);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-20">
      <section className="relative mt-10 grid gap-10 overflow-hidden rounded-[36px] border border-black/10 bg-[var(--surface)] p-10 shadow-soft md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Nouveau drop <span className="text-[var(--accent)]">TCG</span>
          </p>
          <h1 className="font-display text-4xl leading-tight text-slate-900 md:text-5xl">
            La boutique cartes Pokemon & One Piece qui fait vibrer tes pulls.
          </h1>
          <p className="max-w-lg text-base text-slate-600">
            Coffrets collectors, displays competitifs, protections premium et
            promos exclusives. Ouvre des boosters, equipe ton deck, et droppe
            tes hits en live.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/catalog"
              className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5"
            >
              Explorer le shop
            </Link>
            <Link
              href="/categories"
              className="rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5"
            >
              Voir les categories
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4 text-xs text-slate-500">
            <div>
              <p className="font-semibold text-slate-900">+120</p>
              <p>produits dispo</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">48h</p>
              <p>livraison express</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Live</p>
              <p>opening nights</p>
            </div>
          </div>
        </div>

        <div className="relative grid gap-4">
          <div className="grid-spark absolute inset-0 rounded-3xl opacity-60" />
          <div className="relative z-10 grid gap-4">
            <div className="animate-float rounded-3xl border border-black/10 bg-white p-4 shadow-soft">
              <p className="text-xs text-slate-400">Drop du mois</p>
              <p className="mt-1 font-semibold text-slate-900">
                Display Gear 5 Storm
              </p>
              <p className="text-sm text-slate-600">
                24 boosters One Piece edition limitee
              </p>
            </div>
            <div className="animate-float-delayed rounded-3xl border border-black/10 bg-[var(--surface-strong)] p-4 shadow-soft">
              <p className="text-xs text-slate-400">Focus</p>
              <p className="mt-1 font-semibold text-slate-900">
                Elite Trainer Box Luffy
              </p>
              <p className="text-sm text-slate-600">
                Accessoires premium + sleeves holo
              </p>
            </div>
            <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-soft">
              <p className="text-xs text-slate-400">Protection</p>
              <p className="mt-1 font-semibold text-slate-900">
                Hyper Shield Series
              </p>
              <p className="text-sm text-slate-600">
                Sleeves + toploaders ultra clean
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-16 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Sous categories
            </p>
            <h2 className="font-display text-2xl text-slate-900">
              Ton style, ton deck, ton boost
            </h2>
          </div>
          <Link
            href="/catalog"
            className="text-sm font-semibold text-slate-600 transition hover:text-black"
          >
            Voir tout &gt;
          </Link>
        </div>
        <div className="flex flex-wrap gap-3">
          {categories.map((category) => (
            <Link
              key={category}
              href={`/categories/${encodeURIComponent(category)}`}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-soft transition hover:-translate-y-0.5"
            >
              {category}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-16 space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Featured
          </p>
          <h2 className="font-display text-3xl text-slate-900">
            Les hits du moment
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {featured.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      </section>

      <section className="mt-16 grid gap-8 rounded-[32px] border border-black/10 bg-white p-10 shadow-soft md:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Experience
          </p>
          <h3 className="font-display text-3xl text-slate-900">
            Une vibe TCG immersive
          </h3>
          <p className="text-sm text-slate-600">
            Rejoins nos openings lives, recois les alertes de restock et garde
            tes cartes au top niveau.
          </p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>Drops announces chaque semaine</li>
            <li>Packs securises et protections</li>
            <li>Support passionne TCG</li>
          </ul>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {["Legendary", "Mythique", "Shiny", "Treasure"].map((label) => (
            <div
              key={label}
              className="animate-pop rounded-3xl border border-black/10 bg-[var(--surface)] p-5 text-sm text-slate-600 shadow-soft"
            >
              <p className="font-display text-lg text-slate-900">{label}</p>
              <p className="mt-2">
                Series exclusives, boosters premium et artset collectors.
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 grid gap-6 rounded-[32px] border border-black/10 bg-[var(--surface)] p-10 shadow-soft md:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <h3 className="font-display text-3xl text-slate-900">
            Pret pour l&apos;opening party ?
          </h3>
          <p className="text-sm text-slate-600">
            Inscris-toi pour les prochains drops et les night streams. On t&apos;envoie
            les alertes avant tout le monde.
          </p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            placeholder="Ton email"
            className="flex-1 rounded-full border border-black/10 bg-white px-4 py-3 text-sm"
          />
          <button
            type="button"
            className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white"
          >
            Je m&apos;inscris
          </button>
        </div>
      </section>
    </main>
  );
}
