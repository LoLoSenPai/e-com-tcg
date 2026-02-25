import Link from "next/link";
import { AccountAuthForm } from "@/components/account-auth-form";

export default function AccountRegisterPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <div className="mb-8 space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Espace client
        </p>
        <h1 className="font-display text-4xl text-slate-900">Creer un compte</h1>
        <p className="text-sm text-slate-600">
          Enregistre tes infos pour un checkout plus rapide et un suivi de commandes.
        </p>
      </div>
      <AccountAuthForm mode="register" />
      <p className="mt-4 text-center text-sm text-slate-600">
        Deja inscrit ?{" "}
        <Link href="/account/login" className="font-semibold text-slate-900">
          Se connecter
        </Link>
      </p>
    </main>
  );
}
