"use client";
export type PendingDetails = {
  accountId: string;
  kind: "profile" | "person" | "occasion";
  id: string;
  version: string | null;
  document: Record<string, unknown>;
  submission: string;
  savedAt: number;
  attempts: number;
  nextAt: number;
  blocked?: boolean;
  message?: string;
  href: string;
};
const prefix = "gyvft-private-details-v1:",
  eventName = "gyvft-details-sync";
const running = new Set<string>();
const key = (account: string) => prefix + account;
export const detailKey = (item: Pick<PendingDetails, "kind" | "id">) =>
  `${item.kind}:${item.id}`;
export function pendingDetails(account: string): PendingDetails[] {
  try {
    const raw = sessionStorage.getItem(key(account));
    if (!raw || raw.length > 80000) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p) =>
          p &&
          p.accountId === account &&
          ["profile", "person", "occasion"].includes(p.kind) &&
          typeof p.id === "string" &&
          typeof p.savedAt === "number" &&
          Date.now() - p.savedAt < 86400000,
      )
      .slice(0, 10);
  } catch {
    return [];
  }
}
function changed(detail?: unknown) {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}
function write(account: string, items: PendingDetails[]) {
  const raw = JSON.stringify(items);
  if (raw.length > 64000)
    throw Error(
      "This tab’s draft storage is full. Keep the form open and try saving when connected.",
    );
  if (items.length) sessionStorage.setItem(key(account), raw);
  else sessionStorage.removeItem(key(account));
  changed();
}
export function queueDetails(
  item: Omit<PendingDetails, "submission" | "savedAt" | "attempts" | "nextAt">,
) {
  const items = pendingDetails(item.accountId),
    index = items.findIndex((p) => detailKey(p) === detailKey(item));
  if (index < 0 && items.length >= 10)
    throw Error("Sync the pending changes in this tab before adding another.");
  const next = {
    ...item,
    submission: crypto.randomUUID(),
    savedAt: Date.now(),
    attempts: 0,
    nextAt: 0,
    blocked: false,
    message: undefined,
  };
  if (index < 0) items.push(next);
  else items[index] = next;
  write(item.accountId, items);
  void syncDetails(item.accountId);
}
export function retryDetails(account: string) {
  write(
    account,
    pendingDetails(account).map((p) =>
      p.blocked ? p : { ...p, attempts: 0, nextAt: 0 },
    ),
  );
  void syncDetails(account);
}
export function clearPrivateDetails() {
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const k = sessionStorage.key(i);
    if (k?.startsWith(prefix)) sessionStorage.removeItem(k);
  }
  changed();
}
export function onDetailsChange(listener: (event: Event) => void) {
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
}
/** Only idempotent private metadata enters this queue. No approvals, files or payments. */
export async function syncDetails(account: string) {
  if (running.has(account) || !navigator.onLine) return;
  running.add(account);
  try {
    // One write at a time per tab; combine repeated edits to the same record.
    for (let count = 0; count < 10; count++) {
      const item = pendingDetails(account).find(
        (p) => !p.blocked && p.nextAt <= Date.now(),
      );
      if (!item) break;
      let success = false,
        version: string | null = null,
        blocked = false,
        message =
          "Waiting for a connection. Your changes are kept in this tab.",
        retryAfter = 0;
      try {
        const r = await fetch("/api/customer/private-details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: account,
            kind: item.kind,
            id: item.id,
            version: item.version,
            document: item.document,
          }),
          signal: AbortSignal.timeout(15000),
        });
        const result = await r.json();
        success = r.ok && result.ok === true;
        version = result.version ?? null;
        if (!success) {
          blocked =
            result.error?.code === "SETUP_REQUIRED" ||
            ![429, 502, 503, 504].includes(r.status);
          message =
            result.error?.message || "Review this draft before trying again.";
          const seconds = Number(r.headers.get("Retry-After"));
          if (Number.isFinite(seconds))
            retryAfter = Math.min(60000, Math.max(0, seconds * 1000));
        }
      } catch {
        /* Unknown result is safe to replay: the server compares the desired document. */
      }
      const items = pendingDetails(account),
        index = items.findIndex((p) => detailKey(p) === detailKey(item));
      if (index < 0) continue; // Sign-out may have cleared this tab while the request ran.
      const current = items[index];
      if (success) {
        if (current.submission === item.submission) items.splice(index, 1);
        else current.version = version;
        write(account, items);
        changed({
          saved: detailKey(item),
          version,
          submission: item.submission,
        });
      } else {
        // A newer local edit takes precedence over the failed older attempt.
        if (current.submission !== item.submission) continue;
        current.attempts++;
        current.blocked = blocked || current.attempts >= 6;
        current.message =
          current.attempts >= 6 && !blocked
            ? "Automatic retries paused. Your draft is kept in this tab. Review it to try again."
            : message;
        current.nextAt =
          Date.now() +
          Math.max(
            retryAfter,
            Math.min(30000, 1000 * 2 ** current.attempts) +
              Math.floor(Math.random() * 1000),
          );
        write(account, items);
        break;
      }
    }
  } finally {
    running.delete(account);
  }
}
