import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Confidentialite - Nebula TCG",
  description: "Politique de confidentialite et cookies Nebula TCG.",
};

export default function ConfidentialitePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <h1 className="font-display text-4xl text-slate-900">
        Politique de confidentialite
      </h1>
      <div className="mt-6 space-y-4 text-sm text-slate-700">
        <p>
          Donnees collectees: email, adresse de livraison, telephone, details
          de commande.
        </p>
        <p>
          Finalites: gestion des commandes, support client, notifications de
          livraison.
        </p>
        <p>
          Droits RGPD: acces, rectification, suppression sur demande via
          support@nebula-tcg.com.
        </p>
      </div>
    </main>
  );
}
