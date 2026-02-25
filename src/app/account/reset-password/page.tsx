import { Suspense } from "react";
import { ResetPasswordClient } from "@/components/reset-password-client";

function ResetPasswordFallback() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <div className="mb-8 space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Espace client
        </p>
        <h1 className="font-display text-4xl text-slate-900">
          Nouveau mot de passe
        </h1>
      </div>
      <div className="manga-panel manga-dot mx-auto w-full max-w-md rounded-[28px] bg-white p-6 text-sm text-slate-600">
        Chargement...
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordClient />
    </Suspense>
  );
}
