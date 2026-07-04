"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Order, OrderStatus } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { hasOrderTrackingDeliveryDetails } from "@/lib/order-tracking";

type Stats = {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  revenue30Days: number;
};

const statusLabels: Record<OrderStatus, string> = {
  paid: "Payee",
  preparation: "Preparation",
  shipped: "Expediee",
  delivered: "Livree",
};

export function AdminOrdersClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");

  async function loadOrders() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/orders");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Load failed");
      }
      setOrders(payload.orders || []);
      setStats(payload.stats || null);
    } catch (loadError) {
      setOrders([]);
      setStats(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible de charger les commandes.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function updateStatus(id: string, status: OrderStatus) {
    if (!id) {
      setError("Commande invalide.");
      return;
    }

    setUpdatingOrderId(id);
    setError("");
    setStatusMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Mise a jour impossible.");
      }
      setStatusMessage("Statut commande mis a jour.");
      await loadOrders();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Mise a jour impossible.",
      );
    } finally {
      setUpdatingOrderId("");
    }
  }

  const filtered = orders.filter((order) => {
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const text = `${order.customerEmail ?? ""} ${order.customerName ?? ""} ${
      order.stripeSessionId
    }`.toLowerCase();
    const matchesQuery = !query || text.includes(query.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="manga-panel rounded-[24px] bg-white p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            CA total
          </p>
          <p className="mt-2 font-display text-2xl text-slate-900">
            {stats ? formatPrice(stats.totalRevenue) : "-"}
          </p>
        </div>
        <div className="manga-panel rounded-[24px] bg-white p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            CA 30j
          </p>
          <p className="mt-2 font-display text-2xl text-slate-900">
            {stats ? formatPrice(stats.revenue30Days) : "-"}
          </p>
        </div>
        <div className="manga-panel rounded-[24px] bg-white p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Commandes
          </p>
          <p className="mt-2 font-display text-2xl text-slate-900">
            {stats ? stats.totalOrders : "-"}
          </p>
        </div>
        <div className="manga-panel rounded-[24px] bg-white p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Panier moyen
          </p>
          <p className="mt-2 font-display text-2xl text-slate-900">
            {stats ? formatPrice(stats.avgOrderValue) : "-"}
          </p>
        </div>
      </div>

      <div className="manga-panel manga-dot rounded-[24px] bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Recherche email ou session"
            className="w-full max-w-sm rounded-full border-2 border-black px-4 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as OrderStatus | "all")
            }
            className="rounded-full border-2 border-black px-4 py-2 text-sm"
          >
            <option value="all">Tous</option>
            <option value="paid">Payee</option>
            <option value="preparation">Preparation</option>
            <option value="shipped">Expediee</option>
            <option value="delivered">Livree</option>
          </select>
          <button
            type="button"
            onClick={loadOrders}
            disabled={loading}
            className="rounded-full border-2 border-black px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Chargement..." : "Rafraichir"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      {statusMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {statusMessage}
        </div>
      ) : null}

      <div className="grid gap-4">
        {filtered.map((order) => {
          const orderId = order._id ? String(order._id) : "";
          const canSelectShipped =
            order.status === "shipped" || hasOrderTrackingDeliveryDetails(order);
          const canSelectDelivered =
            order.status === "delivered" ||
            order.status === "shipped" ||
            hasOrderTrackingDeliveryDetails(order);

          return (
            <div
              key={orderId || order.stripeSessionId}
              className="manga-panel rounded-[24px] bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {order.customerEmail || "Client"}
                  </p>
                  <p className="font-semibold text-slate-900">
                    {formatPrice(order.amountTotal)} - {statusLabels[order.status]}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(order.createdAt).toLocaleString("fr-FR")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {orderId ? (
                    <Link
                      href={`/admin/orders/${orderId}`}
                      className="rounded-full border-2 border-black px-3 py-1 text-xs font-semibold"
                    >
                      Details
                    </Link>
                  ) : null}
                  <select
                    value={order.status}
                    disabled={updatingOrderId === orderId}
                    onChange={(event) =>
                      updateStatus(orderId, event.target.value as OrderStatus)
                    }
                    className="rounded-full border-2 border-black px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="paid">Payee</option>
                    <option value="preparation">Preparation</option>
                    <option value="shipped" disabled={!canSelectShipped}>
                      Expediee
                    </option>
                    <option value="delivered" disabled={!canSelectDelivered}>
                      Livree
                    </option>
                  </select>
                </div>
              </div>
              <div className="mt-3 text-sm text-slate-600">
                {order.items.map((item) => (
                  <div key={`${orderId || order.stripeSessionId}-${item.name}`}>
                    {item.quantity}x {item.name}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {!loading && !error && filtered.length === 0 ? (
          <div className="manga-panel rounded-[24px] bg-white p-6 text-sm text-slate-500">
            Aucune commande pour le moment.
          </div>
        ) : null}
      </div>
    </div>
  );
}
