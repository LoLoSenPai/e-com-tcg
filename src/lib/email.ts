import { Resend } from "resend";

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
  await resend.emails.send({
    from,
    to,
    subject,
    html,
  });
}

export async function sendOrderEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  return sendEmail(params);
}
