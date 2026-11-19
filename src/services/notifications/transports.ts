import "server-only";

export class NotificationTransportError extends Error {
  constructor(
    public code: string,
    public retryable = false,
  ) {
    super(code);
  }
}
export async function sendNotificationEmail(input: {
  id: string;
  to: string;
  subject: string;
  text: string;
}) {
  const token = process.env.RESEND_API_KEY?.trim();
  if (!token) throw new NotificationTransportError("EMAIL_NOT_CONFIGURED");
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "aarla@aarla.in";
  // Customer updates require a verified sender. No testing-domain fallback.
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `gyvft-notification-${input.id}`,
    },
    body: JSON.stringify({
      from: `${process.env.RESEND_FROM_NAME?.trim() || "GYVFT by Aarla"} <${from}>`,
      to: [input.to],
      subject: input.subject,
      text: input.text,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new NotificationTransportError(
      `EMAIL_HTTP_${response.status}`,
      response.status === 429 || response.status >= 500,
    );
  if (typeof data.id !== "string" || !data.id)
    throw new NotificationTransportError("EMAIL_RESPONSE_UNCERTAIN", true);
  return data.id as string;
}
