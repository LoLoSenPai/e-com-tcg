"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/account/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Reset failed");
      }
      setDone(true);
    } catch {
      setError("Lien invalide ou expire.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <div className="mb-8 space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Espace client
        </p>
        <h1 className="font-display text-4xl text-slate-900">
          Nouveau mot de passe
        </h1>
      </div>
      <form
        onSubmit={handleSubmit}
        className="manga-panel manga-dot mx-auto grid w-full max-w-md gap-4 rounded-[28px] bg-white p-6"
      >
        <input
          value={email}
          readOnly
          className="rounded-2xl border-2 border-black bg-slate-50 px-4 py-2 text-sm"
        />
        <input
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Nouveau mot de passe (min 8)"
          type="password"
          autoComplete="new-password"
          required
          className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading || !token}
          className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white disabled:opacity-70"
        >
          {loading ? "Validation..." : "Mettre a jour"}
        </button>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {done ? (
          <p className="text-sm text-slate-600">
            Mot de passe modifie. Tu peux te connecter.
          </p>
        ) : null}
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        <Link href="/account/login" className="font-semibold text-slate-900">
          Aller a la connexion
        </Link>
      </p>
    </main>
  );
}

