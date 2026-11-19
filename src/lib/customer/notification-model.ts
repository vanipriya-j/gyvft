export function notificationUrl(projectId: string, destination: string) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://www.gyvft.com"
      : "http://localhost:3000");
  return new URL(
    destination === "team"
      ? `/operations/requests?request=${projectId}`
      : `/account/projects/${projectId}`,
    base,
  ).href;
}
export function notificationText(url: string) {
  return `There is an update to your GYVFT request. Sign in to view it securely:\n\n${url}\n\nYour story. Our telling.`;
}
export function deliveryLabel(state: string, canRetry = true) {
  if (state === "sent")
    return "Accepted by email provider · inbox delivery unconfirmed";
  if (!canRetry) return "Needs a delivery check · not resent automatically";
  if (state === "sending") return "Sending";
  if (state === "failed") return "Send failed · queued for recovery";
  return "Queued";
}
