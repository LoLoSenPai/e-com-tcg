"use client";

/* eslint-disable @next/next/no-img-element -- Admin previews must support local and Blob URLs entered from the CMS. */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import {
  categories as defaultCategories,
  franchiseLanguages,
} from "@/lib/sample-data";

type FormState = {
  name: string;
  slug: string;
  category: string;
  franchise: string;
  language: string;
  price: string;
  description: string;
  badge: string;
  tags: string;
  stock: string;
  image: string;
};

type HealthPayload = {
  ok: boolean;
  checkedAt: string;
  checks: Record<string, { ok: boolean; label: string; detail?: string }>;
};

const emptyForm: FormState = {
  name: "",
  slug: "",
  category: "",
  franchise: "Pokemon",
  language: "",
  price: "",
  description: "",
  badge: "",
  tags: "",
  stock: "",
  image: "",
};

export function AdminDashboard() {
  const showDevTools = process.env.NODE_ENV !== "production";
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingDeleteSlug, setPendingDeleteSlug] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const allLanguageOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...franchiseLanguages.Pokemon,
          ...franchiseLanguages["One Piece"],
        ]),
      ) as string[],
    [],
  );

  function getLanguageOptions(franchise: string) {
    if (franchise === "One Piece") {
      return [...franchiseLanguages["One Piece"]] as string[];
    }
    if (franchise === "Both") {
      return allLanguageOptions;
    }
    return [...franchiseLanguages.Pokemon] as string[];
  }

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

  const categoryOptions = useMemo(() => {
    const fromProducts = products.map((product) => product.category.trim());
    const unique = new Set<string>([...defaultCategories, ...fromProducts]);
    if (form.category.trim()) {
      unique.add(form.category.trim());
    }
    return [...unique].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [products, form.category]);

  function handleEdit(product: Product) {
    const fallbackFranchise =
      product.franchise ||
      (product.tags?.includes("One Piece") ? "One Piece" : "Pokemon");
    const fallbackLanguage =
      product.language ||
      product.tags?.find((tag) =>
        allLanguageOptions.includes(tag),
      ) ||
      "";
    setEditingSlug(product.slug);
    setEditingId(product._id ?? null);
    setIsNewCategory(false);
    setNewCategory("");
    setForm({
      name: product.name,
      slug: product.slug,
      category: product.category,
      franchise: fallbackFranchise,
      language: fallbackLanguage,
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
    setIsNewCategory(false);
    setNewCategory("");
    setForm(emptyForm);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    const resolvedCategory = (
      isNewCategory ? newCategory : form.category
    ).trim();
    if (!resolvedCategory) {
      setStatus("Choisis une categorie ou cree-en une nouvelle.");
      setLoading(false);
      return;
    }
    const payload = {
      ...form,
      category: resolvedCategory,
      language: form.language || undefined,
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
      setPendingDeleteSlug(null);
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

  async function loadHealth() {
    setHealthLoading(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/health");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Health failed");
      }
      setHealth(payload);
    } catch {
      setStatus("Healthcheck impossible.");
    } finally {
      setHealthLoading(false);
    }
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
          <Link
            href="/admin/orders"
            className="rounded-full border-2 border-black bg-white px-4 py-2 text-sm font-semibold shadow-[4px_4px_0_#111827]"
          >
            Orders
          </Link>
          <button
            type="button"
            onClick={loadHealth}
            disabled={healthLoading}
            className="rounded-full border-2 border-black bg-white px-4 py-2 text-sm font-semibold shadow-[4px_4px_0_#111827]"
          >
            {healthLoading ? "Check..." : "Health"}
          </button>
          {showDevTools ? (
            <button
              type="button"
              onClick={handleSeed}
              disabled={loading}
              className="rounded-full border-2 border-black bg-white px-4 py-2 text-sm font-semibold shadow-[4px_4px_0_#111827]"
            >
              Seed demo
            </button>
          ) : null}
          {showDevTools ? (
            <button
              type="button"
              onClick={handleMigrateFranchise}
              disabled={loading}
              className="rounded-full border-2 border-black bg-white px-4 py-2 text-sm font-semibold shadow-[4px_4px_0_#111827]"
            >
              Migrer franchise
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow-[4px_4px_0_#ff6b35]"
          >
            Logout
          </button>
        </div>
      </div>

      {health ? (
        <div
          className={`manga-panel rounded-[24px] bg-white p-4 text-sm ${
            health.ok ? "text-emerald-800" : "text-rose-800"
          }`}
        >
          <p className="font-semibold">
            Healthcheck {health.ok ? "OK" : "a corriger"} -{" "}
            {new Date(health.checkedAt).toLocaleString("fr-FR")}
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {Object.entries(health.checks).map(([key, check]) => (
              <div
                key={key}
                className="rounded-xl border border-black/10 bg-white px-3 py-2"
              >
                <p className="font-semibold text-slate-900">
                  {check.ok ? "OK" : "KO"} - {check.label}
                </p>
                {check.detail ? (
                  <p className="text-xs text-slate-600">{check.detail}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

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
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-12 overflow-hidden rounded-lg border border-black/10 bg-slate-100">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-[10px] text-slate-400">
                          no img
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        {product.category}
                        {product.language ? ` - ${product.language}` : ""}
                      </p>
                      <p className="font-semibold text-slate-900">
                        {product.name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatPrice(product.price)}
                      </p>
                    </div>
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
                      onClick={() => setPendingDeleteSlug(product.slug)}
                      className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {pendingDeleteSlug === product.slug ? (
                  <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                    <p className="font-semibold">
                      Confirmer la suppression de ce produit ?
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(product.slug)}
                        disabled={loading}
                        className="rounded-full bg-rose-700 px-3 py-1 font-semibold text-white"
                      >
                        Supprimer
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteSlug(null)}
                        className="rounded-full border border-rose-300 px-3 py-1 font-semibold"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : null}
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
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-2">
              {isNewCategory ? (
                <input
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  placeholder="Nouvelle categorie"
                  required
                  className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
                />
              ) : (
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, category: event.target.value }))
                  }
                  required
                  className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
                >
                  <option value="" disabled>
                    Choisir une categorie
                  </option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsNewCategory((prev) => !prev);
                  setNewCategory("");
                }}
                className="w-fit rounded-full border-2 border-black px-3 py-1 text-xs font-semibold"
              >
                {isNewCategory ? "Choisir existante" : "Nouvelle categorie"}
              </button>
            </div>
            <select
              value={form.franchise}
              onChange={(event) =>
                setForm((prev) => {
                  const nextFranchise = event.target.value;
                  const allowedLanguages = getLanguageOptions(nextFranchise);
                  const nextLanguage = allowedLanguages.includes(prev.language)
                    ? prev.language
                    : "";
                  return {
                    ...prev,
                    franchise: nextFranchise,
                    language: nextLanguage,
                  };
                })
              }
              className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
            >
              <option value="Pokemon">Pokemon</option>
              <option value="One Piece">One Piece</option>
              <option value="Both">Both</option>
            </select>
            <select
              value={form.language}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, language: event.target.value }))
              }
              className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
            >
              <option value="">Neutre / non applicable</option>
              {getLanguageOptions(form.franchise).map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
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
