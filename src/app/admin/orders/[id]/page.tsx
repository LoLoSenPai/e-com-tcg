import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import { AdminOrderDetailClient } from "@/components/admin-order-detail-client";

type AdminOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminOrderDetailPage({
  params,
}: AdminOrderDetailPageProps) {
  const store = await cookies();
  const sessionValue = store.get(adminCookieName)?.value;
  if (!isAdminSession(sessionValue)) {
    redirect("/admin/login");
  }
  const { id } = await params;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="mb-8 space-y-3">
        <Link href="/admin/orders" className="text-sm text-slate-500">
          <- Retour aux commandes
        </Link>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Order detail
        </p>
        <h1 className="font-display text-4xl text-slate-900">
          Detail commande
        </h1>
      </div>
      <AdminOrderDetailClient id={id} />
    </main>
  );
}
