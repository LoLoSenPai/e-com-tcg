"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart-context";
import { formatPrice } from "@/lib/format";
import {
  getOrderConfirmationEmailState,
  shouldPollCheckoutStatus,
  type PublicCheckoutStatus,
} from "@/lib/checkout-status";

const maxStatusChecks = 15;
const statusRetryDelayMs = 3000;

export function CheckoutSuccessClient({ sessionId }: { sessionId?: string }) {
  const { clear } = useCart();
  const didClear = useRef(false);
  const [status, setStatus] = useState<PublicCheckoutStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(Boolean(sessionId));
  const [refreshingStatus, setRefreshingStatus] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setLoadingStatus(false);
      return;
    }

    const currentSessionId = sessionId;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let checks = 0;

    async function loadStatus() {
      checks += 1;
      const isInitialCheck = checks === 1;
      if (!isInitialCheck) {
        setRefreshingStatus(true);
      }
      let shouldRetry = false;
      try {
        const response = await fetch(
          `/api/checkout/status?session_id=${encodeURIComponent(currentSessionId)}`,
          { cache: "no-store" },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "Statut commande indisponible.");
        }
        if (!cancelled && response.ok) {
          setStatus(payload);
          setStatusError("");
          const fulfillmentFailed =
            payload.checkoutSession?.status === "fulfillment_failed";
          shouldRetry =
            checks < maxStatusChecks &&
            !fulfillmentFailed &&
            shouldPollCheckoutStatus({
              order: payload.order,
              emailEvents: payload.emailEvents,
            });
        }
      } catch (error) {
        if (!cancelled) {
          setStatusError(
            error instanceof Error
              ? error.message
              : "Statut commande indisponible.",
          );
          shouldRetry = checks < maxStatusChecks;
        }
      } finally {
        if (!cancelled) {
          setLoadingStatus(false);
          if (shouldRetry) {
            setRefreshingStatus(true);
            timeoutId = setTimeout(loadStatus, statusRetryDelayMs);
          } else {
            setRefreshingStatus(false);
          }
        }
      }
    }

    void loadStatus();
    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [sessionId]);

  const order = status?.order;
  const fulfillmentFailed =
    status?.checkoutSession?.status === "fulfillment_failed";
  const emailState = getOrderConfirmationEmailState(
    status?.emailEvents,
    order?.emailStatus,
  );

  useEffect(() => {
    if (didClear.current || !order) {
      return;
    }
    clear();
    didClear.current = true;
  }, [clear, order]);

  const heading = !sessionId
    ? "Statut de paiement introuvable"
    : fulfillmentFailed
      ? "Paiement confirme, verification necessaire"
      : order
      ? "Paiement confirme"
      : "Paiement en cours de verification";
  const intro = !sessionId
    ? "Aucune reference Stripe n'a ete fournie. Verifie ton compte ou contacte l'equipe si tu viens de payer."
    : fulfillmentFailed
      ? "Le paiement est bien recu, mais la commande demande une verification manuelle. L'equipe peut la retrouver dans l'admin."
      : order
      ? "Merci pour ta commande. On prepare ton colis et tu recevras un email de suivi quand il sera expedie."
      : "Merci pour ta commande. On verifie encore la creation de la commande avec Stripe.";

  return (
    <section className="manga-panel manga-dot mx-auto max-w-3xl rounded-[28px] bg-white p-6 text-slate-900 md:p-10">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
        Commande
      </p>
      <h1 className="mt-3 font-display text-3xl text-slate-900 md:text-4xl">
        {heading}
      </h1>
      <p className="mt-4 text-sm text-slate-600 md:text-base">
        {intro}
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
              {fulfillmentFailed
                ? "Paiement OK. La confirmation email peut attendre la verification manuelle de la commande."
                : emailState === "sent"
                ? "Email de confirmation envoye."
                : emailState === "failed"
                  ? "Paiement OK, mais l'email de confirmation a echoue. L'equipe peut le renvoyer depuis l'admin."
                  : emailState === "skipped"
                    ? "Paiement OK, mais aucun destinataire email n'a ete trouve pour cette commande."
                    : "Email de confirmation en cours de traitement."}
            </p>
            {refreshingStatus ? (
              <p className="text-xs text-slate-500">
                Actualisation du statut en cours...
              </p>
            ) : null}
          </div>
        ) : statusError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
            Impossible de verifier la commande pour le moment: {statusError}
          </div>
        ) : sessionId && refreshingStatus ? (
          <div className="space-y-2">
            <p className="text-slate-600">
              Commande en cours de synchronisation avec Stripe.
            </p>
            <p className="text-xs text-slate-500">
              Actualisation du statut en cours...
            </p>
          </div>
        ) : sessionId ? (
          <p className="text-slate-600">
            Paiement en cours de confirmation. La commande peut prendre quelques
            secondes a apparaitre apres le webhook Stripe.
          </p>
        ) : (
          <p className="text-slate-600">
            Aucune reference de paiement a verifier.
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
