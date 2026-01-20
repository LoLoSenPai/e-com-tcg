export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="mb-10 space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          A propos
        </p>
        <h1 className="font-display text-4xl text-slate-900">
          Une boutique imaginee par des passionnes TCG
        </h1>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4 text-sm text-slate-600">
          <p>
            Nebula TCG est nee pour offrir une experience d'achat aussi
            excitante que l'opening lui-meme. On selectionne chaque drop pour
            les fans de Pokemon et One Piece.
          </p>
          <p>
            Notre equipe organise des openings live, des events communautaires
            et des conseils pour preserver tes cartes.
          </p>
        </div>
        <div className="rounded-[32px] border border-black/10 bg-white p-6 shadow-soft">
          <p className="font-display text-2xl text-slate-900">
            Nos engagements
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>Produits authentiques et scelles</li>
            <li>Expedition rapide partout en France</li>
            <li>Support client passionne et dispo</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
