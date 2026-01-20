"use client";

import { useState } from "react";

export function AdminClient() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [adminToken, setAdminToken] = useState("");

  async function handleSeed() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminToken }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Seed failed");
      }
      setMessage(`Seed OK: ${payload.inserted} produits.`);
    } catch {
      setMessage("Seed impossible. Verifie MONGODB_URI et ADMIN_TOKEN.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch("/api/admin/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, adminToken }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Create failed");
      }
      setMessage("Produit ajoute !");
      event.currentTarget.reset();
    } catch {
      setMessage("Echec de creation. Verifie le token admin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-soft">
        <label className="text-xs font-semibold text-slate-500">
          ADMIN_TOKEN
        </label>
        <input
          value={adminToken}
          onChange={(event) => setAdminToken(event.target.value)}
          placeholder="Token admin"
          className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-2 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={handleSeed}
        disabled={loading}
        className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold shadow-soft"
      >
        Seed produits demo
      </button>
      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-3xl border border-black/10 bg-white p-6 shadow-soft"
      >
        <div className="grid gap-2 md:grid-cols-2">
          <input
            name="name"
            placeholder="Nom du produit"
            required
            className="rounded-2xl border border-black/10 px-4 py-2 text-sm"
          />
          <input
            name="slug"
            placeholder="Slug (ex: booster-cosmos)"
            required
            className="rounded-2xl border border-black/10 px-4 py-2 text-sm"
          />
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            name="category"
            placeholder="Categorie"
            required
            className="rounded-2xl border border-black/10 px-4 py-2 text-sm"
          />
          <input
            name="price"
            type="number"
            placeholder="Prix en centimes"
            required
            className="rounded-2xl border border-black/10 px-4 py-2 text-sm"
          />
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            name="badge"
            placeholder="Badge (optionnel)"
            className="rounded-2xl border border-black/10 px-4 py-2 text-sm"
          />
          <input
            name="stock"
            type="number"
            placeholder="Stock (optionnel)"
            className="rounded-2xl border border-black/10 px-4 py-2 text-sm"
          />
        </div>
        <input
          name="tags"
          placeholder="Tags (ex: Pokemon, Collector)"
          className="rounded-2xl border border-black/10 px-4 py-2 text-sm"
        />
        <textarea
          name="description"
          placeholder="Description courte"
          required
          className="min-h-[120px] rounded-2xl border border-black/10 px-4 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white"
        >
          Ajouter le produit
        </button>
      </form>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
