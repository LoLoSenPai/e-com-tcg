import { Resend } from "resend";
import { createEmailEvent, updateEmailEvent } from "@/lib/email-events";
import type { EmailEventType } from "@/lib/types";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("Missing RESEND_API_KEY.");
  }
  return new Resend(key);
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const from = process.env.EMAIL_FROM || "Returners <no-reply@returners.com>";
  const resend = getResend();
  const result = await resend.emails.send({
    from,
    to,
    subject,
    html,
  });

  if (result.error) {
    throw new Error(result.error.message || "Resend email failed.");
  }

  return {
    providerId: result.data?.id,
  };
}

export async function sendTrackedEmail({
  type,
  orderId,
  stripeSessionId,
  to,
  subject,
  html,
}: {
  type: EmailEventType;
  orderId?: string;
  stripeSessionId?: string;
  to?: string;
  subject: string;
  html: string;
}) {
  let pendingEvent = null;
  try {
    pendingEvent = await createEmailEvent({
      type,
      status: to ? "pending" : "skipped",
      to,
      subject,
      orderId,
      stripeSessionId,
      error: to ? undefined : "Missing recipient email.",
    });
  } catch (error) {
    console.warn(
      "Email event creation failed.",
      error instanceof Error ? error.message : error,
    );
  }

  if (!to) {
    return pendingEvent;
  }

  try {
    const result = await sendEmail({ to, subject, html });
    try {
      const sentEvent = await updateEmailEvent(pendingEvent?._id, {
        status: "sent",
        providerId: result.providerId,
      });
      return sentEvent || pendingEvent;
    } catch (error) {
      console.warn(
        "Email event sent update failed.",
        error instanceof Error ? error.message : error,
      );
      return pendingEvent;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Email delivery failed.";
    try {
      await updateEmailEvent(pendingEvent?._id, {
        status: "failed",
        error: message,
      });
    } catch (logError) {
      console.warn(
        "Email event failed update failed.",
        logError instanceof Error ? logError.message : logError,
      );
    }
    throw error;
  }
}
