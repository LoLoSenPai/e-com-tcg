"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/components/cart-context";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { ThemeToggle } from "@/components/theme-toggle";

const navLinks = [
  { id: "home", href: "/", label: "Accueil" },
  { id: "catalog", href: "/catalog", label: "Catalogue" },
  { id: "categories", href: "/categories", label: "Categories" },
  { id: "about", href: "/about", label: "A propos" },
  { id: "contact", href: "/contact", label: "Contact" },
];

function AccountIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5c1.8-3.5 4.1-5 7-5s5.2 1.5 7 5" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 4h2l2 11h10l2-8H6.5" />
      <circle cx="10" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function SiteHeader() {
  const { totalItems } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

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

  useEffect(() => {
    setMobileOpen(false);
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

          <div className="flex items-center gap-2 md:gap-3">
            <Link
              href="/account"
              title="Compte"
              aria-label="Compte"
              className="hidden h-10 w-10 cursor-pointer place-items-center rounded-full border border-black/10 bg-white text-slate-700 shadow-soft transition hover:-translate-y-0.5 hover:text-black md:grid"
            >
              <AccountIcon />
              <span className="sr-only">Compte</span>
            </Link>
            <Link
              href="/cart"
              title="Panier"
              aria-label="Panier"
              className="relative grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-black/10 bg-white text-slate-700 shadow-soft transition hover:-translate-y-0.5 hover:text-black"
            >
              <CartIcon />
              <span className="sr-only">Panier</span>
              {totalItems > 0 ? (
                <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border border-white bg-black text-xs font-bold text-white shadow">
                  {totalItems}
                </span>
              ) : null}
            </Link>
            <ThemeToggle />
            <Link
              href="/catalog"
              className="hidden cursor-pointer rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 md:inline-flex"
            >
              Commander
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
              className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-black/10 bg-white text-slate-700 shadow-soft transition hover:-translate-y-0.5 hover:text-black md:hidden"
            >
              {mobileOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
        {mobileOpen ? (
          <div className="border-t border-black/10 px-6 pb-4 pt-3 md:hidden">
            <div className="manga-panel manga-dot rounded-2xl bg-white p-3">
              <nav className="grid gap-2">
                {navLinks.map((link) => {
                  const isActive = activeTab === link.id;
                  return (
                    <Link
                      key={link.id}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                        isActive ? "bg-black text-white" : "text-slate-700"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  href="/account"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700"
                >
                  Compte
                </Link>
                <Link
                  href="/catalog"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl bg-black px-3 py-2 text-center text-sm font-semibold text-white"
                >
                  Commander
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
