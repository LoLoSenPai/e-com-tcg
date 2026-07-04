import { Resend } from "resend";
import { createEmailEvent, updateEmailEvent } from "@/lib/email-events";
import type { EmailEvent, EmailEventStatus, EmailEventType } from "@/lib/types";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("Missing RESEND_API_KEY.");
  }
  return new Resend(key);
}

export function resolveEmailFrom(
  env: Partial<Pick<NodeJS.ProcessEnv, "EMAIL_FROM" | "NODE_ENV">> = process.env,
) {
  const from = env.EMAIL_FROM?.trim();
  if (from) {
    return from;
  }
  if (env.NODE_ENV === "production") {
    throw new Error("Missing EMAIL_FROM.");
  }
  return "Returners <no-reply@returners.com>";
}

export async function sendEmail({
  to,
  subject,
  html,
  idempotencyKey,
}: {
  to: string;
  subject: string;
  html: string;
  idempotencyKey?: string;
}) {
  const from = resolveEmailFrom();
  const resend = getResend();
  const result = await resend.emails.send(
    {
      from,
      to,
      subject,
      html,
    },
    idempotencyKey ? { idempotencyKey } : undefined,
  );

  if (result.error) {
    throw new Error(result.error.message || "Resend email failed.");
  }

  return {
    providerId: result.data?.id,
  };
}

export function shouldCreateFallbackFailedEmailEvent(
  finalEvent: { _id?: string } | null | undefined,
) {
  return !finalEvent?._id;
}

function buildSyntheticEmailEvent({
  type,
  status,
  orderId,
  stripeSessionId,
  to,
  subject,
  providerId,
  idempotencyKey,
  error,
  previousEvent,
}: {
  type: EmailEventType;
  status: EmailEventStatus;
  orderId?: string;
  stripeSessionId?: string;
  to?: string;
  subject: string;
  providerId?: string;
  idempotencyKey?: string;
  error?: string;
  previousEvent?: EmailEvent | null;
}): EmailEvent {
  const now = new Date().toISOString();
  return {
    _id: previousEvent?._id,
    type,
    status,
    to: to?.toLowerCase(),
    subject,
    orderId,
    stripeSessionId,
    providerId,
    idempotencyKey,
    error,
    createdAt: previousEvent?.createdAt || now,
    updatedAt: now,
  };
}

export async function sendTrackedEmail({
  type,
  orderId,
  stripeSessionId,
  to,
  subject,
  html,
  idempotencyKey,
}: {
  type: EmailEventType;
  orderId?: string;
  stripeSessionId?: string;
  to?: string;
  subject: string;
  html: string;
  idempotencyKey?: string;
}) {
  let pendingEvent: EmailEvent | null = null;
  try {
    pendingEvent = await createEmailEvent({
      type,
      status: to ? "pending" : "skipped",
      to,
      subject,
      orderId,
      stripeSessionId,
      idempotencyKey,
      error: to ? undefined : "Missing recipient email.",
    });
  } catch (error) {
    console.warn(
      "Email event creation failed.",
      error instanceof Error ? error.message : error,
    );
  }

  if (!to) {
    return (
      pendingEvent ||
      buildSyntheticEmailEvent({
        type,
        status: "skipped",
        orderId,
        stripeSessionId,
        to,
        subject,
        idempotencyKey,
        error: "Missing recipient email.",
      })
    );
  }

  try {
    const result = await sendEmail({ to, subject, html, idempotencyKey });
    let sentEvent: EmailEvent | null = null;
    try {
      sentEvent = await updateEmailEvent(pendingEvent?._id, {
        status: "sent",
        providerId: result.providerId,
      });
    } catch (error) {
      console.warn(
        "Email event sent update failed.",
        error instanceof Error ? error.message : error,
      );
    }

    if (!sentEvent) {
      try {
        sentEvent = await createEmailEvent({
          type,
          status: "sent",
          to,
          subject,
          orderId,
          stripeSessionId,
          providerId: result.providerId,
          idempotencyKey,
        });
      } catch (error) {
        console.warn(
          "Email event sent fallback creation failed.",
          error instanceof Error ? error.message : error,
        );
      }
    }

    if (sentEvent) {
      return sentEvent;
    }

    return buildSyntheticEmailEvent({
      type,
      status: "sent",
      orderId,
      stripeSessionId,
      to,
      subject,
      providerId: result.providerId,
      idempotencyKey,
      previousEvent: pendingEvent,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Email delivery failed.";
    let failedEvent: EmailEvent | null = null;
    try {
      failedEvent = await updateEmailEvent(pendingEvent?._id, {
        status: "failed",
        error: message,
      });
    } catch (logError) {
      console.warn(
        "Email event failed update failed.",
        logError instanceof Error ? logError.message : logError,
      );
    }

    if (shouldCreateFallbackFailedEmailEvent(failedEvent)) {
      try {
        await createEmailEvent({
          type,
          status: "failed",
          to,
          subject,
          orderId,
          stripeSessionId,
          idempotencyKey,
          error: message,
        });
      } catch (logError) {
        console.warn(
          "Email event failed fallback creation failed.",
          logError instanceof Error ? logError.message : logError,
        );
      }
    }

    throw error;
  }
}

export function buildEmailIdempotencyKey(
  type: EmailEventType,
  parts: Array<string | number | undefined | null>,
) {
  const normalizedParts = parts
    .map((part) => String(part || "").trim().toLowerCase())
    .filter(Boolean)
    .map((part) => part.replace(/[^a-z0-9._:-]+/g, "-"));

  if (!normalizedParts.length) {
    return undefined;
  }

  return [type, ...normalizedParts].join(":").slice(0, 256);
}
