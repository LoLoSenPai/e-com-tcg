import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import { AdminOrdersClient } from "@/components/admin-orders-client";

export default async function AdminOrdersPage() {
  const store = await cookies();
  const sessionValue = store.get(adminCookieName)?.value;
  if (!isAdminSession(sessionValue)) {
    redirect("/admin/login");
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="mb-8 space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Orders
        </p>
        <h1 className="font-display text-4xl text-slate-900">
          Suivi des commandes
        </h1>
        <p className="text-sm text-slate-600">
          Gerer les statuts, consulter les details et suivre les ventes.
        </p>
      </div>
      <AdminOrdersClient />
    </main>
  );
}
