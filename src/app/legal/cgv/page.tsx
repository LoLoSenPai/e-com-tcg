import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CGV - Returners",
  description: "Conditions generales de vente Returners.",
};

export default function CgvPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <h1 className="font-display text-4xl text-slate-900">CGV</h1>
      <div className="mt-6 space-y-4 text-sm text-slate-700">
        <p>Conditions generales de vente (version modele).</p>
        <p>
          Ajoute ici: prix, paiement, livraison, retours, garantie, droit de
          retractation, litiges.
        </p>
        <p>
          Fait valider juridiquement avant publication officielle.
        </p>
      </div>
    </main>
  );
}
