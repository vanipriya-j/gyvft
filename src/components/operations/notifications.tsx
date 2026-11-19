"use client";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { NotificationStatus } from "@/lib/customer/notification-status";
import { deliveryLabel } from "@/lib/customer/notification-model";
export function OperationsNotifications({
  post,
}: {
  post: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
}) {
  const [data, setData] = useState<NotificationStatus | null>(null),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState("");
  const locked = useRef(false),
    testId = useRef("");
  useEffect(() => {
    let active = true;
    post({ op: "notification_status" })
      .then((result) => {
        if (active) setData(result.notifications as NotificationStatus);
      })
      .catch((error) => {
        if (active)
          setMessage(
            error instanceof Error
              ? error.message
              : "Could not load email status.",
          );
      });
    return () => {
      active = false;
    };
  }, [post]);
  async function run(op: string) {
    if (locked.current) return;
    locked.current = true;
    setBusy(op);
    setMessage("");
    try {
      if (!testId.current) testId.current = crypto.randomUUID();
      const result = await post({ op, request_id: testId.current });
      if (op === "test_notification_email") testId.current = "";
      if (result.message) setMessage(String(result.message));
      const status =
        op === "notification_status"
          ? result
          : await post({ op: "notification_status" });
      setData(status.notifications as NotificationStatus);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load notifications.",
      );
    } finally {
      locked.current = false;
      setBusy("");
    }
  }
  return (
    <section className="app-panel mb-4">
      <h2>Email updates</h2>
      <p className="app-note">
        Manual Operations updates trigger the same customer notifications as the
        gifting workflow. Configuration alone does not confirm delivery.
      </p>
      <div className="app-actions mt-3">
        {[
          ["notification_status", "Check notification status"],
          ["test_notification_email", "Send test email to team inbox"],
          ["retry_all_notifications", "Process due notifications"],
        ].map(([op, label]) => (
          <button
            key={op}
            aria-label={label}
            className="app-button app-pending-button"
            disabled={!!busy}
            onClick={() => void run(op)}
            aria-busy={busy === op}
          >
            <span style={{ visibility: busy === op ? "hidden" : "visible" }}>
              {label}
            </span>
            {busy === op && (
              <span className="app-button-pending">
                <LoaderCircle className="app-spinner" size={16} />
                Working…
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="app-note" role="status">
        {message}
      </p>
      {data && (
        <>
          <dl className="mt-3">
            <div className="app-row">
              <dt>Email sending</dt>
              <dd>
                {data.emailConfigured
                  ? "Configured · test inbox delivery"
                  : "Not configured"}
              </dd>
            </div>
            <div className="app-row">
              <dt>Recovery job</dt>
              <dd>
                {data.retryConfigured
                  ? "Secret configured · deployed schedule is daily"
                  : "CRON_SECRET missing"}
              </dd>
            </div>
          </dl>
          <h3 className="mt-4">Latest notifications</h3>
          <p className="app-note">
            {data.summary.queued} queued · {data.summary.sending} sending ·{" "}
            {data.summary.attention} need attention
          </p>
          {!data.notifications.length && (
            <p className="app-muted">
              No notification events recorded yet. Fictional demo gifts never
              send messages.
            </p>
          )}
          {data.notifications.map((n) => (
            <div className="app-row" key={n.id}>
              <div>
                <p>
                  {"Email"} · {n.destination === "team" ? "Team" : "Customer"}
                </p>
                <p className="app-note">
                  {deliveryLabel(n.state, n.can_retry)} · {n.attempts} attempts
                </p>
              </div>
              <time className="app-note">
                {new Date(n.created_at).toLocaleString("en-IN")}
              </time>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
