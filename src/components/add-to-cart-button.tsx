"use client";

import { useCart } from "@/components/cart-context";

type AddToCartButtonProps = {
  slug: string;
  label?: string;
  disabled?: boolean;
};

export function AddToCartButton({
  slug,
  label = "Ajouter",
  disabled,
}: AddToCartButtonProps) {
  const { addItem } = useCart();

  return (
    <button
      type="button"
      onClick={() => addItem(slug, 1)}
      disabled={disabled}
      className="rounded-full bg-black px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  );
}
