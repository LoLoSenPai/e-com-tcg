"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Order, OrderStatus } from "@/lib/types";
import { formatPrice } from "@/lib/format";

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
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");

  async function loadOrders() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/orders");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Load failed");
      }
      setOrders(payload.orders || []);
      setStats(payload.stats || null);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function updateStatus(id: string, status: OrderStatus) {
    await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadOrders();
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
            className="rounded-full border-2 border-black px-4 py-2 text-sm font-semibold"
          >
            Rafraichir
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {filtered.map((order) => (
          <div
            key={order._id ? String(order._id) : order.stripeSessionId}
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
                {order._id ? (
                  <Link
                    href={`/admin/orders/${order._id}`}
                    className="rounded-full border-2 border-black px-3 py-1 text-xs font-semibold"
                  >
                    Details
                  </Link>
                ) : null}
                <select
                  value={order.status}
                  onChange={(event) =>
                    updateStatus(order._id || "", event.target.value as OrderStatus)
                  }
                  className="rounded-full border-2 border-black px-4 py-2 text-xs font-semibold"
                >
                  <option value="paid">Payee</option>
                  <option value="preparation">Preparation</option>
                  <option value="shipped">Expediee</option>
                  <option value="delivered">Livree</option>
                </select>
              </div>
            </div>
            <div className="mt-3 text-sm text-slate-600">
              {order.items.map((item) => (
                <div key={`${order._id}-${item.name}`}>
                  {item.quantity}x {item.name}
                </div>
              ))}
            </div>
          </div>
        ))}
        {!loading && filtered.length === 0 ? (
          <div className="manga-panel rounded-[24px] bg-white p-6 text-sm text-slate-500">
            Aucune commande pour le moment.
          </div>
        ) : null}
      </div>
    </div>
  );
}
