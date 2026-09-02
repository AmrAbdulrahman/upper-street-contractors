import nodemailer, { type Transporter } from "nodemailer";

let cached: Transporter | null = null;

/**
 * Lazily builds a singleton nodemailer transport from SMTP_* env vars
 * (Resend SMTP: host `smtp.resend.com`, user the literal string `resend`,
 * password the Resend API key). Throws if credentials are missing so the API
 * route can return a clear error instead of crashing.
 *
 * Provider-agnostic on purpose — the swap off Gmail was four env values and
 * no code at all.
 */
export function getTransport(): Transporter {
  if (cached) return cached;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP is not configured — set SMTP_HOST, SMTP_USER and SMTP_PASS in .env.local.",
    );
  }

  cached = nodemailer.createTransport({
    host,
    port,
    secure: (process.env.SMTP_SECURE ?? "true") === "true" || port === 465,
    auth: { user, pass },
  });

  return cached;
}
