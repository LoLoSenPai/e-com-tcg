const faqs = [
  {
    question: "Quand sortent les nouveaux drops ?",
    answer:
      "Chaque semaine, annonce sur Instagram et newsletter. Les stocks partent vite.",
  },
  {
    question: "Livraison et suivi",
    answer:
      "Expedition sous 48h avec suivi par email. Colis securises.",
  },
  {
    question: "Produits authentiques ?",
    answer:
      "Tous nos produits sont neufs, scelles et verifies par notre equipe.",
  },
  {
    question: "Retours",
    answer:
      "Retours acceptes sous 14 jours si le produit est intact.",
  },
];

export default function FaqPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="mb-10 space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">FAQ</p>
        <h1 className="font-display text-4xl text-slate-900">
          On repond a tout
        </h1>
      </div>
      <div className="space-y-4">
        {faqs.map((item) => (
          <div
            key={item.question}
            className="rounded-[28px] border border-black/10 bg-white p-6 shadow-soft"
          >
            <p className="font-semibold text-slate-900">{item.question}</p>
            <p className="mt-2 text-sm text-slate-600">{item.answer}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
