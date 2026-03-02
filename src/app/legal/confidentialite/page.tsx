import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Confidentialite - Returners",
  description: "Politique de confidentialite et cookies Returners.",
};

export default function ConfidentialitePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <h1 className="font-display text-4xl text-slate-900">
        Politique de confidentialité
      </h1>
      <div className="mt-6 space-y-4 text-sm text-slate-700">
        <p>
          Données collectées: email, adresse de livraison, téléphone, détails
          de commande.
        </p>
        <p>
          Finalités: gestion des commandes, support client, notifications de
          livraison.
        </p>
        <p>
          Droits RGPD: accès, rectification, suppression sur demande via
          support@returners.com.
        </p>
      </div>
    </main>
  );
}
