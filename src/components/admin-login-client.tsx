"use client";

import { useState } from "react";

export function AdminLoginClient() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        throw new Error("Unauthorized");
      }
      window.location.href = "/admin";
    } catch {
      setError("Token invalide. Reessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-[32px] border-2 border-black bg-white p-8 shadow-[6px_6px_0_#111827]"
    >
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Admin access
        </p>
        <h1 className="font-display text-3xl text-slate-900">
          Manga Pop Control
        </h1>
      </div>
      <input
        value={token}
        onChange={(event) => setToken(event.target.value)}
        placeholder="ADMIN_TOKEN"
        className="rounded-2xl border-2 border-black px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white shadow-[4px_4px_0_#ffbf69] transition hover:-translate-y-0.5 disabled:opacity-70"
      >
        {loading ? "Connexion..." : "Se connecter"}
      </button>
    </form>
  );
}
