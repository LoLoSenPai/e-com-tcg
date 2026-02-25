import Image from "next/image";
import Link from "next/link";
import { getProducts } from "@/lib/products";
import { ProductCard } from "@/components/product-card";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Nebula TCG - Accueil",
  description:
    "Decouvre les meilleurs produits Pokemon et One Piece TCG, avec drops et offres exclusives.",
};

export default async function Home() {
  const products = await getProducts();
  const featured = products.filter((product) => product.featured).slice(0, 4);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-20">
      <section className="manga-panel manga-dot relative mt-10 grid gap-10 overflow-hidden rounded-[36px] bg-[var(--surface)] p-10 md:grid-cols-[1.1fr_0.9fr]">
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
            <div className="manga-panel animate-float rounded-3xl bg-white p-4">
              <p className="text-xs text-slate-400">Drop du mois</p>
              <p className="mt-1 font-semibold text-slate-900">
                Display Gear 5 Storm
              </p>
              <p className="text-sm text-slate-600">
                24 boosters One Piece edition limitee
              </p>
            </div>
            <div className="manga-panel animate-float-delayed rounded-3xl bg-[var(--surface-strong)] p-4">
              <p className="text-xs text-slate-400">Focus</p>
              <p className="mt-1 font-semibold text-slate-900">
                Elite Trainer Box Luffy
              </p>
              <p className="text-sm text-slate-600">
                Accessoires premium + sleeves holo
              </p>
            </div>
            <div className="manga-panel rounded-3xl bg-white p-4">
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
              Univers
            </p>
            <h2 className="font-display text-2xl text-slate-900">
              Choisis ta vibe TCG
            </h2>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Link
            href="/catalog?franchise=Pokemon"
            className="vibe-card vibe-card-pokemon manga-panel manga-card group relative flex min-h-[250px] items-start overflow-hidden rounded-[32px] p-6 sm:min-h-[260px] sm:p-8 md:items-center md:p-10"
          >
            <div className="absolute inset-0 opacity-60">
              <div className="vibe-glow absolute -left-12 -top-12 h-40 w-40 rounded-full bg-white/50 blur-2xl" />
              <div className="vibe-glow absolute bottom-6 left-8 h-16 w-32 rounded-full bg-white/40 blur-xl" />
            </div>
            <div className="relative z-10 max-w-[62%] space-y-2 sm:max-w-[60%] sm:space-y-3 md:max-w-xs">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Pokemon
              </p>
              <h3 className="font-display text-2xl text-slate-900 sm:text-3xl">
                Boosters &amp; etb legendaires
              </h3>
              <p className="text-sm text-slate-600">
                Sets collectors, promos shiny et packs competitifs.
              </p>
              <span className="inline-flex rounded-full bg-black px-3 py-2 text-[11px] font-semibold text-white sm:px-4 sm:text-xs">
                Explorer Pokemon
              </span>
            </div>
            <div className="pointer-events-none absolute -right-4 bottom-0 h-[160px] w-[160px] sm:h-[195px] sm:w-[195px] md:-right-6 md:h-[240px] md:w-[240px]">
              <Image
                src="/images/pokemon-cat.png"
                alt="Pokemon"
                fill
                className="object-contain"
                sizes="(max-width: 640px) 160px, (max-width: 768px) 195px, 240px"
              />
            </div>
          </Link>
          <Link
            href="/catalog?franchise=One%20Piece"
            className="vibe-card vibe-card-onepiece manga-panel manga-card group relative flex min-h-[250px] items-start overflow-hidden rounded-[32px] p-6 sm:min-h-[260px] sm:p-8 md:items-center md:p-10"
          >
            <div className="absolute inset-0 opacity-60">
              <div className="vibe-glow absolute -right-12 -top-10 h-44 w-44 rounded-full bg-white/50 blur-2xl" />
              <div className="vibe-glow absolute bottom-6 left-10 h-16 w-32 rounded-full bg-white/40 blur-xl" />
            </div>
            <div className="relative z-10 max-w-[62%] space-y-2 sm:max-w-[60%] sm:space-y-3 md:max-w-xs">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                One Piece
              </p>
              <h3 className="font-display text-2xl text-slate-900 sm:text-3xl">
                Coffrets &amp; displays pirates
              </h3>
              <p className="text-sm text-slate-600">
                Drops de la Grand Line, boosters et accessoires premium.
              </p>
              <span className="inline-flex rounded-full bg-black px-3 py-2 text-[11px] font-semibold text-white sm:px-4 sm:text-xs">
                Explorer One Piece
              </span>
            </div>
            <div className="pointer-events-none absolute -right-2 bottom-0 h-[158px] w-[158px] sm:h-[200px] sm:w-[200px] md:-right-4 md:h-[250px] md:w-[250px]">
              <Image
                src="/images/onepiece-cat.png"
                alt="One Piece"
                fill
                className="object-contain"
                sizes="(max-width: 640px) 158px, (max-width: 768px) 200px, 250px"
              />
            </div>
          </Link>
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

      <section className="manga-panel manga-dot mt-16 grid gap-8 rounded-[32px] bg-white p-10 md:grid-cols-[1fr_1.1fr]">
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
              className="manga-panel animate-pop rounded-3xl bg-[var(--surface)] p-5 text-sm text-slate-600"
            >
              <p className="font-display text-lg text-slate-900">{label}</p>
              <p className="mt-2">
                Series exclusives, boosters premium et artset collectors.
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="manga-panel manga-dot mt-16 grid gap-6 rounded-[32px] bg-[var(--surface)] p-10 md:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <h3 className="font-display text-3xl text-slate-900">
            Pret pour l&apos;opening party ?
          </h3>
          <p className="text-sm text-slate-600">
            Inscris-toi pour les prochains drops et les night streams. On t&apos;envoie
            les alertes avant tout le monde.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
          <input
            placeholder="Ton email"
            className="w-full rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm md:w-[220px]"
          />
          <button
            type="button"
            className="rounded-full bg-black px-5 py-2.5 text-xs font-semibold text-white md:whitespace-nowrap"
          >
            Je m&apos;inscris
          </button>
        </div>
      </section>
    </main>
  );
}
