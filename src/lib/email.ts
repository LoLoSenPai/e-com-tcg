import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("Missing RESEND_API_KEY.");
  }
  return new Resend(key);
}

export async function sendOrderEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const from = process.env.EMAIL_FROM || "Nebula TCG <no-reply@nebula-tcg.com>";
  const resend = getResend();
  await resend.emails.send({
    from,
    to,
    subject,
    html,
  });
}
