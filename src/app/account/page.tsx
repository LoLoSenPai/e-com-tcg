import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { customerCookieName, parseCustomerSession } from "@/lib/customer-auth";
import { AccountPageClient } from "@/components/account-page-client";

export default async function AccountPage() {
  const store = await cookies();
  const raw = store.get(customerCookieName)?.value;
  const customerId = parseCustomerSession(raw);
  if (!customerId) {
    redirect("/account/login");
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="mb-8 space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Espace client
        </p>
        <h1 className="font-display text-4xl text-slate-900">Mon compte</h1>
      </div>
      <AccountPageClient />
    </main>
  );
}
