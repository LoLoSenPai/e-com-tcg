"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/account/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setDone(true);
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
        <h1 className="font-display text-4xl text-slate-900">Mot de passe oublie</h1>
      </div>
      <form
        onSubmit={handleSubmit}
        className="manga-panel manga-dot mx-auto grid w-full max-w-md gap-4 rounded-[28px] bg-white p-6"
      >
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          type="email"
          required
          className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white disabled:opacity-70"
        >
          {loading ? "Envoi..." : "Envoyer le lien"}
        </button>
        {done ? (
          <p className="text-sm text-slate-600">
            Si cet email existe, un lien de reinitialisation a ete envoye.
          </p>
        ) : null}
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        <Link href="/account/login" className="font-semibold text-slate-900">
          Retour connexion
        </Link>
      </p>
    </main>
  );
}
