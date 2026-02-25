"use client";

import { useState } from "react";

type AccountAuthFormProps = {
  mode: "login" | "register";
};

export function AccountAuthForm({ mode }: AccountAuthFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        mode === "login" ? "/api/account/login" : "/api/account/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: mode === "register" ? name : undefined,
            email,
            password,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Auth failed");
      }
      window.location.href = "/account";
    } catch (err) {
      setError(mode === "login" ? "Connexion impossible." : "Inscription impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="manga-panel manga-dot mx-auto grid w-full max-w-md gap-4 rounded-[28px] bg-white p-6"
    >
      <p className="font-display text-2xl text-slate-900">
        {mode === "login" ? "Connexion client" : "Creation de compte"}
      </p>
      {mode === "register" ? (
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nom"
          className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
        />
      ) : null}
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        type="email"
        required
        className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
      />
      <input
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Mot de passe"
        type="password"
        required
        className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
      />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white disabled:opacity-70"
      >
        {loading
          ? "Chargement..."
          : mode === "login"
            ? "Se connecter"
            : "Creer mon compte"}
      </button>
    </form>
  );
}
