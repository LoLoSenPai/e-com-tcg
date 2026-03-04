"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useCart } from "@/components/cart-context";

export function CheckoutSuccessClient() {
  const { clear } = useCart();
  const didClear = useRef(false);

  useEffect(() => {
    if (didClear.current) {
      return;
    }
    clear();
    didClear.current = true;
  }, [clear]);

  return (
    <section className="manga-panel manga-dot mx-auto max-w-3xl rounded-[28px] bg-white p-6 md:p-10">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Bravo</p>
      <h1 className="mt-3 font-display text-3xl text-slate-900 md:text-4xl">
        Paiement confirme
      </h1>
      <p className="mt-4 text-sm text-slate-600 md:text-base">
        Merci pour ta commande. On prepare ton colis et tu recevras un email de
        suivi quand il sera expedie.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/catalog"
          className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
        >
          Retour au catalogue
        </Link>
        <Link
          href="/account"
          className="rounded-full border-2 border-black px-6 py-3 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5"
        >
          Voir mon compte
        </Link>
      </div>
    </section>
  );
}
