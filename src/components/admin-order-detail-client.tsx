"use client";

import { useEffect, useState } from "react";
import type { Order, OrderStatus } from "@/lib/types";
import { formatPrice } from "@/lib/format";

const statusLabels: Record<OrderStatus, string> = {
  paid: "Payee",
  preparation: "Preparation",
  shipped: "Expediee",
  delivered: "Livree",
};

type AdminOrderDetailClientProps = {
  id: string;
};

export function AdminOrderDetailClient({ id }: AdminOrderDetailClientProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [trackingCarrier, setTrackingCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  async function loadOrder() {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/orders/${id}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Load failed");
      }
      setOrder(payload.order);
      setTrackingCarrier(payload.order?.shippingTracking?.carrier || "");
      setTrackingNumber(payload.order?.shippingTracking?.trackingNumber || "");
      setTrackingUrl(payload.order?.shippingTracking?.trackingUrl || "");
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrder();
  }, [id]);

  async function updateStatus(status: OrderStatus) {
    await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadOrder();
  }

  async function updateTracking() {
    await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shippingTracking: {
          carrier: trackingCarrier,
          trackingNumber,
          trackingUrl,
        },
      }),
    });
    await loadOrder();
  }

  if (loading && !order) {
    return (
      <div className="manga-panel rounded-[24px] bg-white p-6 text-sm text-slate-500">
        Chargement...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="manga-panel rounded-[24px] bg-white p-6 text-sm text-slate-500">
        Commande introuvable.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="manga-panel rounded-[24px] bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {order.customerEmail || "Client"}
            </p>
            <p className="font-semibold text-slate-900">
              {formatPrice(order.amountTotal)} - {statusLabels[order.status]}
            </p>
            <p className="text-xs text-slate-500">
              Session: {order.stripeSessionId}
            </p>
          </div>
          <select
            value={order.status}
            onChange={(event) =>
              updateStatus(event.target.value as OrderStatus)
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

      <div className="grid gap-6 md:grid-cols-2">
        <div className="manga-panel rounded-[24px] bg-white p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Adresse
          </p>
          <div className="mt-3 text-sm text-slate-700">
            <p>{order.customerName || "Nom client"}</p>
            <p>{order.shippingAddress?.line1}</p>
            {order.shippingAddress?.line2 ? (
              <p>{order.shippingAddress.line2}</p>
            ) : null}
            <p>
              {order.shippingAddress?.postalCode}{" "}
              {order.shippingAddress?.city}
            </p>
            <p>{order.shippingAddress?.country}</p>
            {order.customerPhone ? <p>{order.customerPhone}</p> : null}
          </div>
        </div>
        <div className="manga-panel rounded-[24px] bg-white p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Paiement
          </p>
          <div className="mt-3 text-sm text-slate-700">
            <p>Montant: {formatPrice(order.amountTotal)}</p>
            <p>Devise: {order.currency.toUpperCase()}</p>
            <p>Stripe PI: {order.stripePaymentIntentId || "-"}</p>
            <p>Creer: {new Date(order.createdAt).toLocaleString("fr-FR")}</p>
            <p>
              Expedie:
              {order.shippedAt
                ? ` ${new Date(order.shippedAt).toLocaleString("fr-FR")}`
                : " -"}
            </p>
          </div>
        </div>
      </div>

      <div className="manga-panel rounded-[24px] bg-white p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Suivi livraison
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={trackingCarrier}
            onChange={(event) => setTrackingCarrier(event.target.value)}
            placeholder="Transporteur"
            className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
          />
          <input
            value={trackingNumber}
            onChange={(event) => setTrackingNumber(event.target.value)}
            placeholder="Numero de suivi"
            className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
          />
          <input
            value={trackingUrl}
            onChange={(event) => setTrackingUrl(event.target.value)}
            placeholder="URL de suivi"
            className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={updateTracking}
            className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
          >
            Enregistrer le suivi
          </button>
          {order.shippingTracking?.trackingUrl ? (
            <a
              href={order.shippingTracking.trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-slate-600"
            >
              Ouvrir le suivi
            </a>
          ) : null}
        </div>
      </div>

      <div className="manga-panel rounded-[24px] bg-white p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Articles
        </p>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          {order.items.map((item) => (
            <div key={`${item.name}-${item.unitAmount}`} className="flex justify-between">
              <span>
                {item.quantity}x {item.name}
              </span>
              <span>{formatPrice(item.unitAmount * item.quantity)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
