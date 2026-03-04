"use client";

import { useEffect, useState } from "react";
import type { Order } from "@/lib/types";
import { formatPrice } from "@/lib/format";

type CustomerProfile = {
  _id?: string;
  email: string;
  name?: string;
  phone?: string;
  defaultAddress?: {
    line1?: string;
    line2?: string;
    postalCode?: string;
    city?: string;
    state?: string;
    country?: string;
  };
};

export function AccountPageClient() {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  async function refreshData() {
    setLoading(true);
    const [meRes, ordersRes] = await Promise.all([
      fetch("/api/account/me"),
      fetch("/api/account/orders"),
    ]);
    const mePayload = await meRes.json();
    const ordersPayload = await ordersRes.json();
    setCustomer(mePayload.customer || null);
    setOrders(ordersPayload.orders || []);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      const [meRes, ordersRes] = await Promise.all([
        fetch("/api/account/me"),
        fetch("/api/account/orders"),
      ]);
      const mePayload = await meRes.json();
      const ordersPayload = await ordersRes.json();
      if (cancelled) return;
      setCustomer(mePayload.customer || null);
      setOrders(ordersPayload.orders || []);
      setLoading(false);
    }

    void loadInitialData();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProfile(formData: FormData) {
    const body = {
      name: String(formData.get("name") || ""),
      phone: String(formData.get("phone") || ""),
      defaultAddress: {
        line1: String(formData.get("line1") || ""),
        line2: String(formData.get("line2") || ""),
        postalCode: String(formData.get("postalCode") || ""),
        city: String(formData.get("city") || ""),
        state: String(formData.get("state") || ""),
        country: String(formData.get("country") || ""),
      },
    };
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      setStatus("Echec de sauvegarde.");
      return;
    }
    setStatus("Profil mis a jour.");
    await refreshData();
  }

  async function logout() {
    await fetch("/api/account/logout", { method: "POST" });
    window.location.href = "/account/login";
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Chargement...</p>;
  }

  if (!customer) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Connecte-toi pour voir ton compte.</p>
        <a href="/account/login" className="text-sm font-semibold text-slate-900">
          Aller a la connexion
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="manga-panel rounded-[24px] bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-900">{customer.email}</p>
            <p className="text-sm text-slate-500">Espace client Returners</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-full border-2 border-black px-4 py-2 text-xs font-semibold"
          >
            Se deconnecter
          </button>
        </div>
      </div>

      <form
        onSubmit={async (event) => {
          event.preventDefault();
          await saveProfile(new FormData(event.currentTarget));
        }}
        className="manga-panel manga-dot rounded-[24px] bg-white p-6"
      >
        <p className="mb-4 font-semibold text-slate-900">Profil et adresse</p>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            name="name"
            defaultValue={customer.name || ""}
            placeholder="Nom"
            className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
          />
          <input
            name="phone"
            defaultValue={customer.phone || ""}
            placeholder="Telephone"
            className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
          />
          <input
            name="line1"
            defaultValue={customer.defaultAddress?.line1 || ""}
            placeholder="Adresse ligne 1"
            className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
          />
          <input
            name="line2"
            defaultValue={customer.defaultAddress?.line2 || ""}
            placeholder="Adresse ligne 2"
            className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
          />
          <input
            name="postalCode"
            defaultValue={customer.defaultAddress?.postalCode || ""}
            placeholder="Code postal"
            className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
          />
          <input
            name="city"
            defaultValue={customer.defaultAddress?.city || ""}
            placeholder="Ville"
            className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
          />
          <input
            name="state"
            defaultValue={customer.defaultAddress?.state || ""}
            placeholder="Region"
            className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
          />
          <input
            name="country"
            defaultValue={customer.defaultAddress?.country || "FR"}
            placeholder="Pays"
            className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            className="rounded-full bg-black px-5 py-2 text-xs font-semibold text-white"
          >
            Enregistrer
          </button>
          {status ? <p className="text-xs text-slate-600">{status}</p> : null}
        </div>
      </form>

      <div className="manga-panel rounded-[24px] bg-white p-6">
        <p className="mb-4 font-semibold text-slate-900">Historique commandes</p>
        <div className="space-y-3">
          {orders.map((order) => {
            const id = order._id || order.stripeSessionId;
            const isOpen = openOrderId === id;

            return (
              <div
                key={id}
                className="overflow-hidden rounded-2xl border border-black/10"
              >
                <button
                  type="button"
                  onClick={() => setOpenOrderId(isOpen ? null : id)}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-black/[0.03]"
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {order.status}
                    </p>
                    <p className="font-semibold text-slate-900">
                      {formatPrice(order.amountTotal)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(order.createdAt).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {isOpen ? "Masquer" : "Voir detail"}
                  </span>
                </button>

                {isOpen ? (
                  <div className="space-y-4 border-t border-black/10 bg-black/[0.02] p-4 text-sm text-slate-700">
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                        Produits
                      </p>
                      <div className="space-y-2">
                        {order.items.map((item, index) => (
                          <div
                            key={`${id}-item-${index}`}
                            className="flex items-center justify-between gap-4"
                          >
                            <p className="text-slate-800">
                              {item.name} x{item.quantity}
                            </p>
                            <p className="font-medium text-slate-900">
                              {formatPrice(item.unitAmount * item.quantity)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                      <p>
                        Livraison:{" "}
                        {order.shippingRateLabel || "Standard"}
                        {typeof order.shippingAmount === "number"
                          ? ` (${formatPrice(order.shippingAmount)})`
                          : ""}
                      </p>
                      <p>Session Stripe: {order.stripeSessionId}</p>
                    </div>

                    {order.shippingAddress ? (
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                          Adresse
                        </p>
                        <p className="text-xs text-slate-600">
                          {order.shippingAddress.line1 || ""}
                          {order.shippingAddress.line2
                            ? `, ${order.shippingAddress.line2}`
                            : ""}
                          {order.shippingAddress.postalCode
                            ? `, ${order.shippingAddress.postalCode}`
                            : ""}
                          {order.shippingAddress.city
                            ? ` ${order.shippingAddress.city}`
                            : ""}
                          {order.shippingAddress.country
                            ? ` (${order.shippingAddress.country})`
                            : ""}
                        </p>
                      </div>
                    ) : null}

                    {order.shippingTracking?.trackingNumber ? (
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                          Suivi colis
                        </p>
                        <p className="text-xs text-slate-600">
                          {order.shippingTracking.carrier || "Transporteur"} -{" "}
                          {order.shippingTracking.trackingNumber}
                        </p>
                        {order.shippingTracking.trackingUrl ? (
                          <a
                            href={order.shippingTracking.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-slate-900 underline"
                          >
                            Voir le tracking
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
          {orders.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune commande pour le moment.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
