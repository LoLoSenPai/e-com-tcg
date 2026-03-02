import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions legales - Returners",
  description: "Mentions legales du site Returners.",
};

export default function MentionsLegalesPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <h1 className="font-display text-4xl text-slate-900">Mentions légales</h1>
      <div className="mt-6 space-y-4 text-sm text-slate-700">
        <p>Éditeur: Returners</p>
        <p>Contact: support@returners.com</p>
        <p>Hébergeur: Vercel</p>
        <p>
          Remplacer ces informations par les données réelles de l&apos;entreprise.
        </p>
      </div>
    </main>
  );
}
