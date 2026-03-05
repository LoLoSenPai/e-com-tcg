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

type BoxtalShippingOffer = {
  code: string;
  label: string;
};

function stringifyDetail(detail: unknown) {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

export function AdminOrderDetailClient({ id }: AdminOrderDetailClientProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [trackingCarrier, setTrackingCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [shippingOffers, setShippingOffers] = useState<BoxtalShippingOffer[]>([]);
  const [shippingOfferCode, setShippingOfferCode] = useState("");
  const [loadingShippingOffers, setLoadingShippingOffers] = useState(false);
  const [shippingOffersError, setShippingOffersError] = useState("");
  const [creatingShipment, setCreatingShipment] = useState(false);
  const [shipmentMessage, setShipmentMessage] = useState("");
  const [shipmentError, setShipmentError] = useState("");

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
      setShippingOfferCode(
        (current) => current || payload.order?.boxtalShipment?.shippingOfferCode || "",
      );
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadShippingOffers() {
    setLoadingShippingOffers(true);
    setShippingOffersError("");
    try {
      const response = await fetch("/api/admin/boxtal/shipping-offers");
      const payload = await response.json();
      if (!response.ok) {
        const detail = stringifyDetail(payload?.detail);
        throw new Error(
          detail
            ? `${payload?.error || "Load shipping offers failed"} - ${detail}`
            : payload?.error || "Load shipping offers failed",
        );
      }
      setShippingOffers(payload.offers || []);
      setShippingOfferCode(
        (current) =>
          current || payload.offers?.[0]?.code || order?.boxtalShipment?.shippingOfferCode || "",
      );
    } catch (error) {
      setShippingOffers([]);
      setShippingOffersError(
        error instanceof Error ? error.message : "Echec chargement offres Boxtal",
      );
    } finally {
      setLoadingShippingOffers(false);
    }
  }

  useEffect(() => {
    loadOrder();
    loadShippingOffers();
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

  async function createShipment() {
    setCreatingShipment(true);
    setShipmentMessage("");
    setShipmentError("");
    try {
      const response = await fetch(`/api/admin/orders/${id}/boxtal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingOfferCode: shippingOfferCode || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = stringifyDetail(payload?.detail);
        throw new Error(
          detail
            ? `${payload?.error || "Boxtal shipment failed"} - ${detail}`
            : payload?.error || "Boxtal shipment failed",
        );
      }
      setShipmentMessage("Expedition Boxtal creee.");
      if (payload?.shipment?.carrier) {
        setTrackingCarrier(payload.shipment.carrier);
      }
      if (payload?.shipment?.trackingNumber) {
        setTrackingNumber(payload.shipment.trackingNumber);
      }
      if (payload?.shipment?.trackingUrl) {
        setTrackingUrl(payload.shipment.trackingUrl);
      }
      await loadOrder();
    } catch (error) {
      setShipmentError(
        error instanceof Error ? error.message : "Echec creation expedition Boxtal",
      );
    } finally {
      setCreatingShipment(false);
    }
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
          {order.shippingRelay ? (
            <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.02] p-3 text-xs text-slate-700">
              <p className="font-semibold">Point relais</p>
              <p>
                {order.shippingRelay.name} ({order.shippingRelay.code})
              </p>
              <p>
                {order.shippingRelay.address?.line1
                  ? `${order.shippingRelay.address.line1}, `
                  : ""}
                {order.shippingRelay.address?.zipCode || ""}{" "}
                {order.shippingRelay.address?.city || ""}
                {order.shippingRelay.address?.country
                  ? ` (${order.shippingRelay.address.country})`
                  : ""}
              </p>
              {order.shippingRelay.network ? (
                <p>Reseau: {order.shippingRelay.network}</p>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="manga-panel rounded-[24px] bg-white p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Paiement
          </p>
          <div className="mt-3 text-sm text-slate-700">
            <p>Montant: {formatPrice(order.amountTotal)}</p>
            <p>Livraison: {formatPrice(order.shippingAmount || 0)}</p>
            <p>Methode: {order.shippingRateLabel || "-"}</p>
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
          Expedition Boxtal (API v3)
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr]">
          <select
            value={shippingOfferCode}
            onChange={(event) => setShippingOfferCode(event.target.value)}
            className="rounded-2xl border-2 border-black px-4 py-2 text-sm"
          >
            <option value="">Code offre auto (env)</option>
            {shippingOffers.map((offer) => (
              <option key={offer.code} value={offer.code}>
                {offer.code} - {offer.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={createShipment}
            disabled={creatingShipment}
            className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creatingShipment ? "Creation..." : "Creer expedition Boxtal"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {loadingShippingOffers
            ? "Chargement des offres transport..."
            : shippingOffers.length > 0
              ? `${shippingOffers.length} offre(s) transport chargee(s).`
              : "Aucune offre chargee (verification API/credentials requise)."}
        </p>
        {shippingOffersError ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {shippingOffersError}
          </div>
        ) : null}
        {shipmentMessage ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {shipmentMessage}
          </div>
        ) : null}
        {shipmentError ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {shipmentError}
          </div>
        ) : null}
        {order.boxtalShipment ? (
          <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.02] p-4 text-xs text-slate-700">
            <p className="font-semibold">Boxtal</p>
            <p>ID exp.: {order.boxtalShipment.boxtalOrderId || "-"}</p>
            <p>Offre: {order.boxtalShipment.shippingOfferCode || "-"}</p>
            <p>Statut: {order.boxtalShipment.status || "-"}</p>
            <p>Carrier: {order.boxtalShipment.carrier || "-"}</p>
            <p>Tracking: {order.boxtalShipment.trackingNumber || "-"}</p>
            {order.boxtalShipment.trackingUrl ? (
              <a
                href={order.boxtalShipment.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-slate-700 underline"
              >
                Ouvrir suivi transporteur
              </a>
            ) : null}
            {order.boxtalShipment.labelUrl ? (
              <div>
                <a
                  href={order.boxtalShipment.labelUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-slate-700 underline"
                >
                  Ouvrir etiquette transport
                </a>
              </div>
            ) : null}
            {order.boxtalShipment.lastError ? (
              <p className="mt-2 text-rose-700">
                Derniere erreur: {order.boxtalShipment.lastError}
              </p>
            ) : null}
          </div>
        ) : null}
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
