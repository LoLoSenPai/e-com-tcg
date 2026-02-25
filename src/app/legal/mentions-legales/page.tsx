import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions legales - Nebula TCG",
  description: "Mentions legales du site Nebula TCG.",
};

export default function MentionsLegalesPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <h1 className="font-display text-4xl text-slate-900">Mentions legales</h1>
      <div className="mt-6 space-y-4 text-sm text-slate-700">
        <p>Editeur: Nebula TCG</p>
        <p>Contact: support@nebula-tcg.com</p>
        <p>Hebergeur: Vercel</p>
        <p>
          Remplace ces informations par les donnees reelles de l&apos;entreprise avant
          mise en production.
        </p>
      </div>
    </main>
  );
}
