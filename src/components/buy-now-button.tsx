"use client";

import { useState } from "react";

type BuyNowButtonProps = {
  slug: string;
  disabled?: boolean;
};

export function BuyNowButton({ slug, disabled }: BuyNowButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleBuyNow() {
    if (disabled || loading) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ slug, quantity: 1 }],
          deliveryMode: "home",
        }),
      });
      const payload = await response.json();
      if (payload.url) {
        window.location.href = payload.url;
        return;
      }
      throw new Error(payload.error || "Checkout failed");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible de lancer l'achat direct.";
      setError(message);
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={handleBuyNow}
        disabled={disabled || loading}
        className="rounded-full border-2 border-black bg-[var(--accent-3)] px-5 py-3 text-sm font-semibold uppercase tracking-wide text-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Redirection..." : "Acheter maintenant"}
      </button>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
