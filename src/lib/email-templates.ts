import { formatPrice } from "./format";
import type { Order } from "./types";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildOrderConfirmationEmail(order: Order) {
  const customerName = order.customerName
    ? ` ${escapeHtml(order.customerName)}`
    : "";
  const items = order.items
    .map(
      (item) =>
        `<li>${item.quantity}x ${escapeHtml(item.name)} - ${formatPrice(
          item.unitAmount * item.quantity,
        )}</li>`,
    )
    .join("");

  return {
    subject: "Merci pour votre commande Returners",
    html:
      `<p>Bonjour${customerName},</p>` +
      "<p>Merci pour votre commande. Nous preparons votre colis et vous tiendrons informe de l'expedition.</p>" +
      `<p><strong>Total:</strong> ${formatPrice(order.amountTotal)}</p>` +
      `<ul>${items}</ul>`,
  };
}

export function buildTrackingEmail(order: Order) {
  const customerName = order.customerName
    ? ` ${escapeHtml(order.customerName)}`
    : "";
  const trackingNumber =
    order.shippingTracking?.trackingNumber ||
    order.boxtalShipment?.trackingNumber ||
    "Disponible";
  const trackingUrl =
    order.shippingTracking?.trackingUrl || order.boxtalShipment?.trackingUrl;
  const trackingLink = trackingUrl
    ? `<p>Suivi: <a href="${escapeHtml(trackingUrl)}">${escapeHtml(
        trackingUrl,
      )}</a></p>`
    : "";

  return {
    subject: "Votre commande Returners est en route",
    html:
      `<p>Bonjour${customerName},</p>` +
      "<p>Votre commande est en cours d'expedition.</p>" +
      `<p>Numero de suivi: ${escapeHtml(trackingNumber)}</p>` +
      trackingLink,
  };
}
