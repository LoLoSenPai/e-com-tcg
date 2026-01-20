"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { useCart } from "@/components/cart-context";
import { AnimatedTabs } from "@/components/ui/animated-tabs";

const navLinks = [
  { id: "home", href: "/", label: "Accueil" },
  { id: "catalog", href: "/catalog", label: "Catalogue" },
  { id: "categories", href: "/categories", label: "Categories" },
  { id: "about", href: "/about", label: "A propos" },
  { id: "contact", href: "/contact", label: "Contact" },
];


export function SiteHeader() {
  const { totalItems } = useCart();
  const pathname = usePathname();
  const router = useRouter();

  const activeTab = useMemo(() => {
    if (!pathname) return "home";
    if (pathname === "/") return "home";
    if (pathname.startsWith("/products")) return "catalog";
    if (pathname.startsWith("/categories")) return "categories";
    const match = navLinks
      .filter((link) => link.href !== "/")
      .find((link) => pathname.startsWith(link.href));
    return match?.id ?? "home";
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50">
      <div className="glass border-b border-black/10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="group flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-black text-white font-display text-lg shadow-soft">
              NT
            </span>
            <div className="leading-tight">
              <p className="font-display text-lg">Nebula TCG</p>
              <p className="text-xs text-slate-600">Pokemon + One Piece</p>
            </div>
          </Link>

          <nav className="hidden items-center md:flex">
            <AnimatedTabs
              tabs={navLinks.map((link) => ({
                id: link.id,
                label: link.label,
              }))}
              activeTabId={activeTab}
              onChange={(tabId) => {
                const next = navLinks.find((link) => link.id === tabId);
                if (next) router.push(next.href);
              }}
            />
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/cart"
              className="relative rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold shadow-soft transition hover:-translate-y-0.5"
            >
              Panier
              {totalItems > 0 ? (
                <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[var(--accent)] text-xs text-white">
                  {totalItems}
                </span>
              ) : null}
            </Link>
            <Link
              href="/catalog"
              className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5"
            >
              Commander
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
