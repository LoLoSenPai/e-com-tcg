import { getProducts } from "@/lib/products";
import { CartClient } from "@/components/cart-client";

export default async function CartPage() {
  const products = await getProducts();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="mb-8 space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Panier
        </p>
        <h1 className="font-display text-4xl text-slate-900">
          Finaliser ta commande
        </h1>
      </div>
      <CartClient products={products} />
    </main>
  );
}
