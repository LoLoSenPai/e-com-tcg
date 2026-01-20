export default function ContactPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <div className="mb-10 space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Contact
        </p>
        <h1 className="font-display text-4xl text-slate-900">
          Besoin d'aide pour un drop ?
        </h1>
        <p className="text-sm text-slate-600">
          Ecris-nous, on repond en moins de 24h.
        </p>
      </div>
      <form className="grid gap-4 rounded-[32px] border border-black/10 bg-white p-6 shadow-soft">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            placeholder="Prenom"
            className="rounded-2xl border border-black/10 px-4 py-2 text-sm"
          />
          <input
            placeholder="Email"
            className="rounded-2xl border border-black/10 px-4 py-2 text-sm"
          />
        </div>
        <input
          placeholder="Sujet"
          className="rounded-2xl border border-black/10 px-4 py-2 text-sm"
        />
        <textarea
          placeholder="Ton message"
          className="min-h-[140px] rounded-2xl border border-black/10 px-4 py-2 text-sm"
        />
        <button
          type="button"
          className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white"
        >
          Envoyer
        </button>
      </form>
    </main>
  );
}
