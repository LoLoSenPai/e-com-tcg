"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart-context";
import { formatPrice } from "@/lib/format";
import type { EmailEvent, Order } from "@/lib/types";

type CheckoutStatus = {
  order?: Order | null;
  emailEvents?: EmailEvent[];
};

export function CheckoutSuccessClient({ sessionId }: { sessionId?: string }) {
  const { clear } = useCart();
  const didClear = useRef(false);
  const [status, setStatus] = useState<CheckoutStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(Boolean(sessionId));

  useEffect(() => {
    if (didClear.current) {
      return;
    }
    clear();
    didClear.current = true;
  }, [clear]);

  useEffect(() => {
    if (!sessionId) {
      setLoadingStatus(false);
      return;
    }

    const currentSessionId = sessionId;
    let cancelled = false;
    async function loadStatus() {
      try {
        const response = await fetch(
          `/api/checkout/status?session_id=${encodeURIComponent(currentSessionId)}`,
        );
        const payload = await response.json();
        if (!cancelled && response.ok) {
          setStatus(payload);
        }
      } finally {
        if (!cancelled) {
          setLoadingStatus(false);
        }
      }
    }

    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const latestEmail = status?.emailEvents?.[0];
  const order = status?.order;

  return (
    <section className="manga-panel manga-dot mx-auto max-w-3xl rounded-[28px] bg-white p-6 text-slate-900 md:p-10">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Bravo</p>
      <h1 className="mt-3 font-display text-3xl text-slate-900 md:text-4xl">
        Paiement confirme
      </h1>
      <p className="mt-4 text-sm text-slate-600 md:text-base">
        Merci pour ta commande. On prepare ton colis et tu recevras un email de
        suivi quand il sera expedie.
      </p>
      <div className="mt-6 rounded-2xl border border-black/10 bg-white/80 p-4 text-sm">
        {loadingStatus ? (
          <p className="text-slate-600">Verification de la commande...</p>
        ) : order ? (
          <div className="space-y-2">
            <p className="font-semibold text-slate-900">
              Commande enregistree - {formatPrice(order.amountTotal)}
            </p>
            <p className="text-slate-600">
              {latestEmail?.status === "sent"
                ? "Email de confirmation envoye."
                : latestEmail?.status === "failed"
                  ? "Paiement OK, mais l'email de confirmation a echoue. L'equipe peut le renvoyer depuis l'admin."
                  : "Email de confirmation en cours de traitement."}
            </p>
          </div>
        ) : sessionId ? (
          <p className="text-slate-600">
            Paiement confirme. La commande peut prendre quelques secondes a
            apparaitre apres le webhook Stripe.
          </p>
        ) : (
          <p className="text-slate-600">
            Paiement confirme. Merci pour ta commande.
          </p>
        )}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/catalog"
          className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
        >
          Retour au catalogue
        </Link>
        <Link
          href="/account"
          className="rounded-full border-2 border-black bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5"
        >
          Voir mon compte
        </Link>
      </div>
    </section>
  );
}
