"use client";
import { useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
export function AarlaSavingsConnection({
  post,
}: {
  post: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false),
    lock = useRef(false);
  async function check() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const r = await post({ op: "aarla_savings_status" });
      setMessage(String(r.message));
      setFailed(!r.ready);
    } catch (e) {
      setFailed(true);
      setMessage(
        e instanceof Error ? e.message : "Connection could not be confirmed.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 border-t border-border pt-4">
      <h3 className="font-medium">Aarla shopping saving</h3>
      <p className="app-muted mt-2">
        Customers get 5% off each eligible Aarla store purchase started through
        GYVFT. Each code is customer-only, single-use and valid for 24 hours.
        Shopify holds the code and its usage.
      </p>
      <button
        type="button"
        className="app-button app-pending-button mt-3"
        disabled={busy}
        aria-busy={busy}
        aria-label="Check Aarla savings connection"
        onClick={() => void check()}
      >
        <span style={{ visibility: busy ? "hidden" : "visible" }}>
          Check Aarla savings connection
        </span>
        {busy && (
          <span className="app-button-pending">
            <LoaderCircle className="app-spinner" size={16} />
            Checking…
          </span>
        )}
      </button>
      <p role="status" className={failed ? "app-alert mt-2" : "app-muted mt-2"}>
        {message}
      </p>
    </div>
  );
}
