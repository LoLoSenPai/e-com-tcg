import type { EmailEvent } from "@/lib/types";

export function hasFinalOrderConfirmationAttempt(events: EmailEvent[]) {
  return events.some(
    (event) =>
      event.type === "order_confirmation" &&
      (event.status === "sent" || event.status === "skipped"),
  );
}
