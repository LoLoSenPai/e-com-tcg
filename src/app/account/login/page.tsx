import Link from "next/link";
import { AccountAuthForm } from "@/components/account-auth-form";

export default function AccountLoginPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <div className="mb-8 space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Espace client
        </p>
        <h1 className="font-display text-4xl text-slate-900">Connexion</h1>
        <p className="text-sm text-slate-600">
          Connecte-toi pour suivre tes commandes et gerer tes infos de livraison.
        </p>
      </div>
      <AccountAuthForm mode="login" />
      <p className="mt-4 text-center text-sm text-slate-600">
        Pas de compte ?{" "}
        <Link href="/account/register" className="font-semibold text-slate-900">
          Creer un compte
        </Link>
      </p>
    </main>
  );
}
