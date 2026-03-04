export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="mb-10 space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          À propos
        </p>
        <h1 className="font-display text-4xl text-slate-900">
          Une boutique imaginée par des passionnés TCG
        </h1>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="manga-panel manga-dot rounded-[32px] bg-white p-6 text-sm text-slate-600">
          <p>
            Returners est né pour offrir une expérience d&apos;achat aussi
            excitante que l&apos;opening lui-même. On sélectionne chaque drop pour
            les fans de Pokémon et One Piece.
          </p>
          <p>
            Notre équipe organise des openings live, des events communautaires
            et des conseils pour préserver tes cartes.
          </p>
        </div>
        <div className="manga-panel manga-dot rounded-[32px] bg-white p-6">
          <p className="font-display text-2xl text-slate-900">
            Nos engagements
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>Produits authentiques et scellés</li>
            <li>Expédition rapide partout en France</li>
            <li>Support client passionné et disponible</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
