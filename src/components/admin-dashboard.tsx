"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";

type FormState = {
  name: string;
  slug: string;
  category: string;
  franchise: string;
  price: string;
  description: string;
  badge: string;
  tags: string;
  stock: string;
  image: string;
};

const emptyForm: FormState = {
  name: "",
  slug: "",
  category: "",
  franchise: "Pokemon",
  price: "",
  description: "",
  badge: "",
  tags: "",
  stock: "",
  image: "",
};

export function AdminDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function loadProducts() {
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/products");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Load failed");
      }
      setProducts(payload.products || []);
    } catch {
      setStatus("Impossible de charger les produits.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return products;
    const needle = search.toLowerCase();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(needle) ||
        product.slug.toLowerCase().includes(needle) ||
        product.category.toLowerCase().includes(needle),
    );
  }, [products, search]);

  function handleEdit(product: Product) {
    const fallbackFranchise =
      product.franchise ||
      (product.tags?.includes("One Piece") ? "One Piece" : "Pokemon");
    setEditingSlug(product.slug);
    setEditingId(product._id ?? null);
    setForm({
      name: product.name,
      slug: product.slug,
      category: product.category,
      franchise: fallbackFranchise,
      price: String(product.price),
      description: product.description,
      badge: product.badge ?? "",
      tags: product.tags?.join(", ") ?? "",
      stock: product.stock ? String(product.stock) : "",
      image: product.image ?? "",
    });
  }

  function handleReset() {
    setEditingSlug(null);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    const payload = {
      ...form,
      price: Number(form.price),
      stock: form.stock ? Number(form.stock) : undefined,
    };
    const targetSlug = editingSlug || form.slug;
    const useUpdate = Boolean(editingId);
    try {
      const response = await fetch(
        useUpdate ? `/api/admin/products/${targetSlug}` : "/api/admin/products",
        {
          method: useUpdate ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Save failed");
      }
      setStatus(useUpdate ? "Produit mis a jour." : "Produit ajoute.");
      handleReset();
      await loadProducts();
    } catch {
      setStatus("Echec de sauvegarde.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(slug: string) {
    if (!confirm("Supprimer ce produit ?")) return;
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch(`/api/admin/products/${slug}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Delete failed");
      }
      setStatus("Produit supprime.");
      await loadProducts();
    } catch {
      setStatus("Echec de suppression.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSeed() {
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch("/api/seed", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Seed failed");
      }
      setStatus(`Seed OK: ${data.inserted} produits.`);
      await loadProducts();
    } catch {
      setStatus("Seed impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMigrateFranchise() {
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/migrate-franchise", {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Migration failed");
      }
      setStatus(`Migration OK: ${data.updated} produits.`);
      await loadProducts();
    } catch {
      setStatus("Migration impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setStatus("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }
      setForm((prev) => ({ ...prev, image: data.url }));
      setStatus("Image uploadee.");
    } catch {
      setStatus("Upload impossible.");
    } finally {
      setUploading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="manga-panel rounded-[28px] bg-white px-6 py-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Manga pop
          </p>
          <p className="font-display text-2xl text-slate-900">
            Back office
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSeed}
            disabled={loading}
            className="rounded-full border-2 border-black bg-white px-4 py-2 text-sm font-semibold shadow-[4px_4px_0_#111827]"
          >
            Seed demo
          </button>
          <button
            type="button"
            onClick={handleMigrateFranchise}
            disabled={loading}
            className="rounded-full border-2 border-black bg-white px-4 py-2 text-sm font-semibold shadow-[4px_4px_0_#111827]"
          >
            Migrer franchise
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow-[4px_4px_0_#ff6b35]"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="manga-panel manga-dot rounded-[28px] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold text-slate-900">Produits</p>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Recherche..."
                className="w-full max-w-xs rounded-full border-2 border-black px-4 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid gap-3">
            {filtered.map((product) => (
              <div
                key={product.slug}
                className="manga-panel rounded-[24px] bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {product.category}
                    </p>
                    <p className="font-semibold text-slate-900">
                      {product.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatPrice(product.price)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(product)}
                      className="rounded-full border-2 border-black px-3 py-1 text-xs font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(product.slug)}
                      className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!loading && filtered.length === 0 ? (
              <div className="manga-panel rounded-[24px] bg-white p-6 text-sm text-slate-500">
                Aucun produit.
              </div>
            ) : null}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="manga-panel manga-dot rounded-[28px] bg-white p-6 space-y-4"
        >
          <p className="font-semibold text-slate-900">
            {editingSlug ? "Edition produit" : "Nouveau produit"}
          </p>
          <div className="grid gap-3">
            <input
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="Nom"
              required
              className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
            />
            <input
              value={form.slug}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, slug: event.target.value }))
              }
              placeholder="Slug"
              required
              className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
            />
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={form.category}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, category: event.target.value }))
              }
              placeholder="Categorie"
              required
              className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
            />
            <select
              value={form.franchise}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, franchise: event.target.value }))
              }
              className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
            >
              <option value="Pokemon">Pokemon</option>
              <option value="One Piece">One Piece</option>
              <option value="Both">Both</option>
            </select>
          </div>
          <input
            value={form.price}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, price: event.target.value }))
            }
            placeholder="Prix (centimes)"
            type="number"
            required
            className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
          />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={form.badge}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, badge: event.target.value }))
                }
                placeholder="Badge"
                className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
              />
              <input
                value={form.stock}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, stock: event.target.value }))
                }
                placeholder="Stock"
                type="number"
                className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
              />
            </div>
            <input
              value={form.tags}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, tags: event.target.value }))
              }
              placeholder="Tags (comma)"
              className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
            />
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Description"
              required
              className="min-h-[120px] rounded-2xl border-2 border-black px-4 py-2 text-sm"
            />
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Visuel
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="rounded-2xl border-2 border-black px-3 py-2 text-sm"
              />
              {form.image ? (
                <div className="rounded-2xl border-2 border-black bg-white p-2">
                  <div
                    className="mx-auto w-full max-w-[240px] overflow-hidden rounded-xl border-2 border-black bg-white"
                    style={{ aspectRatio: "3 / 4" }}
                  >
                    <img
                      src={form.image}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loading || uploading}
              className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white shadow-[4px_4px_0_#ffbf69] disabled:opacity-70"
            >
              {editingSlug ? "Mettre a jour" : "Ajouter"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full border-2 border-black px-6 py-3 text-sm font-semibold"
            >
              Reset
            </button>
          </div>
          {status ? <p className="text-sm text-slate-600">{status}</p> : null}
        </form>
      </div>
    </div>
  );
}
