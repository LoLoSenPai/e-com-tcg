"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useCart } from "@/components/cart-context";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import Image from "next/image";

const navLinks = [
  { id: "home", href: "/", label: "Accueil" },
  { id: "catalog", href: "/catalog", label: "Catalogue" },
  { id: "categories", href: "/categories", label: "Catégories" },
  { id: "about", href: "/about", label: "À propos" },
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
  const [mobileOpenPath, setMobileOpenPath] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const currentPath = pathname || "/";
  const mobileOpen = mobileOpenPath === currentPath;

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
    const onScroll = () => {
      const y = window.scrollY;
      setIsScrolled(y > 24);
      setScrollProgress(Math.min(1, y / 120));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpenPath(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  const primaryCta = useMemo(() => {
    if (pathname?.startsWith("/cart")) {
      return { href: "/catalog", label: "Continuer" };
    }
    if (
      pathname?.startsWith("/catalog") ||
      pathname?.startsWith("/products") ||
      pathname?.startsWith("/categories")
    ) {
      return { href: "/cart", label: "Voir panier" };
    }
    return { href: "/catalog", label: "Commander" };
  }, [pathname]);

  const headerGlassStyle = useMemo(
    () =>
      ({
        "--glass-opacity": (0.72 + scrollProgress * 0.18).toFixed(3),
        "--glass-blur": `${14 + scrollProgress * 10}px`,
        "--glass-shadow": `0 ${4 + scrollProgress * 6}px ${20 + scrollProgress * 24}px -16px rgba(15, 23, 42, ${0.1 + scrollProgress * 0.18})`,
      }) as CSSProperties,
    [scrollProgress],
  );

  return (
    <header className="sticky top-0 z-50">
      <div className="glass border-b border-black/10" style={headerGlassStyle}>
        <div
          className={`mx-auto flex w-full max-w-6xl items-center justify-between transition-all duration-300 ${
            isScrolled ? "px-4 py-1 sm:px-6 sm:py-0" : "px-4 py-3 sm:px-6 sm:py-2"
          }`}
        >
          <Link href="/" className="group flex items-center gap-2.5 md:gap-3">
            <Image src="/logo-tr.png" alt="Returners Logo" width={120} height={120} />
            {/* <div className="leading-tight">
              <p
                className={`font-display transition-all duration-300 ${
                  isScrolled ? "text-sm md:text-base" : "text-base md:text-lg"
                }`}
              >
                Returners
              </p>
              <p
                className={`hidden text-xs text-slate-600 transition-opacity duration-300 md:block ${
                  isScrolled ? "opacity-60" : "opacity-100"
                }`}
              >
                Pokemon + One Piece
              </p>
            </div> */}
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
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
            <Link
              href={primaryCta.href}
              className={`hidden cursor-pointer rounded-full bg-black font-semibold text-white shadow-soft transition hover:-translate-y-0.5 md:inline-flex ${
                isScrolled ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
              }`}
            >
              {primaryCta.label}
            </Link>
            <button
              type="button"
              onClick={() =>
                setMobileOpenPath((prev) =>
                  prev === currentPath ? null : currentPath,
                )
              }
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
              className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-black/10 bg-white text-slate-700 shadow-soft transition hover:-translate-y-0.5 hover:text-black md:hidden"
            >
              {mobileOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </div>
      <div
        aria-hidden={!mobileOpen}
        className={`fixed inset-0 z-[70] md:hidden ${
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <button
          type="button"
          aria-label="Fermer le menu mobile"
          onClick={() => setMobileOpenPath(null)}
          className={`absolute inset-0 transition duration-300 ${
            mobileOpen
              ? "bg-black/45 opacity-100 backdrop-blur-[2px]"
              : "bg-black/0 opacity-0"
          }`}
        />
        <aside
          className={`manga-dot absolute inset-y-0 right-0 flex w-[88vw] max-w-[360px] flex-col border-l-2 border-black bg-[var(--surface)] p-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-out ${
            mobileOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src="/logo-tr.png" alt="Returners Logo" width={32} height={32} />
              <p className="font-display text-base text-slate-900">
                Menu Returners
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpenPath(null)}
              aria-label="Fermer"
              className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white text-slate-700"
            >
              <CloseIcon />
            </button>
          </div>

          <nav className="mt-5 grid gap-2">
            {navLinks.map((link) => {
              const isActive = activeTab === link.id;
              return (
                <Link
                  key={link.id}
                  href={link.href}
                  onClick={() => setMobileOpenPath(null)}
                  className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${
                    isActive
                      ? "manga-panel bg-black text-white"
                      : "border border-black/10 bg-white text-slate-700"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3">
            <div className="manga-panel flex items-center justify-between rounded-2xl bg-white px-3 py-2">
              <p className="text-sm font-semibold text-slate-700">Theme</p>
              <ThemeToggle />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/account"
                onClick={() => setMobileOpenPath(null)}
                className="rounded-xl border border-black/10 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700"
              >
                Compte
              </Link>
              <Link
                href="/catalog"
                onClick={() => setMobileOpenPath(null)}
                className="rounded-xl bg-black px-3 py-2 text-center text-sm font-semibold text-white"
              >
                {primaryCta.label}
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </header>
  );
}
