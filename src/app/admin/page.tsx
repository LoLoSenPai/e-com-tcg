import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";

export default async function AdminPage() {
  const store = await cookies();
  const sessionValue = store.get(adminCookieName)?.value;
  if (!isAdminSession(sessionValue)) {
    redirect("/admin/login");
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="mb-8 space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Admin
        </p>
        <h1 className="font-display text-4xl text-slate-900">
          Gestion rapide des produits
        </h1>
        <p className="text-sm text-slate-600">
          Protege par token admin. Ajoute, edite et supprime tes produits.
        </p>
      </div>
      <AdminDashboard />
    </main>
  );
}
