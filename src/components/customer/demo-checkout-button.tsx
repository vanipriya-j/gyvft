"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
export function DemoCheckoutButton({ intent }: { intent: string }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    lock = useRef(false),
    router = useRouter();
  async function complete() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/customer/rewards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "demo-checkout", intent }),
          signal: AbortSignal.timeout(30000),
        }),
        data = await response.json();
      if (!response.ok || !data.ok)
        throw Error(
          data.error?.message || "The sample checkout could not complete.",
        );
      router.push("/account/rewards");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Try the sample again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="app-button primary mt-5"
        disabled={busy}
        onClick={() => void complete()}
      >
        {busy && (
          <LoaderCircle
            size={16}
            className="animate-spin motion-reduce:animate-none"
          />
        )}
        {busy ? "Completing sample…" : "Complete sample checkout"}
      </button>
      <p role="status" className="mt-3 text-sm">
        {message}
      </p>
    </>
  );
}
