import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminCookieName, isAdminSession } from "@/lib/admin-auth";
import { AdminLoginClient } from "@/components/admin-login-client";

export default async function AdminLoginPage() {
  const store = await cookies();
  const sessionValue = store.get(adminCookieName)?.value;
  if (isAdminSession(sessionValue)) {
    redirect("/admin");
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-20">
      <div className="grid gap-8 rounded-[36px] border-2 border-black bg-[var(--surface)] p-10 shadow-[10px_10px_0_#111827]">
        <div className="manga-dot rounded-[28px] border-2 border-black bg-white p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Secure zone
          </p>
          <p className="font-display text-2xl text-slate-900">
            Bienvenue dans le staff room
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Entre le token admin pour gerer les stocks, prices et visuels.
          </p>
        </div>
        <AdminLoginClient />
      </div>
    </main>
  );
}
