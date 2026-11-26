"use client";
import { useEffect, useState } from "react";
import Link from "@/components/ui/navigation-link";
import {
  pendingDetails,
  onDetailsChange,
  syncDetails,
  retryDetails,
  type PendingDetails,
} from "@/lib/customer/private-details-outbox";
export function PrivateDetailsSync({ accountId }: { accountId: string }) {
  const [items, setItems] = useState<PendingDetails[]>([]);
  useEffect(() => {
    const update = () => setItems(pendingDetails(accountId));
    const sync = () => {
      update();
      if (document.visibilityState === "visible") void syncDetails(accountId);
    };
    update();
    sync();
    const unbind = onDetailsChange(update),
      timer = setInterval(sync, 2000);
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      unbind();
      clearInterval(timer);
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [accountId]);
  if (!items.length) return null;
  return (
    <aside
      className="fixed bottom-24 right-4 z-50 max-h-[40vh] w-[min(22rem,calc(100vw-2rem))] overflow-auto rounded-xl border border-border bg-paper p-4 shadow-md md:bottom-4"
      aria-label="Pending saves"
    >
      <p className="text-sm font-semibold" role="status">
        {items.length} {items.length === 1 ? "change" : "changes"} kept in this
        tab · {items.some((p) => p.blocked) ? "review needed" : "sync pending"}
      </p>
      <p className="mt-1 text-xs text-muted-text">
        Keep this tab open until GYVFT confirms the save.
      </p>
      <ul className="my-2 text-sm">
        {items.map((p) => (
          <li className="py-1" key={`${p.kind}:${p.id}`}>
            <Link href={p.href} className="underline">
              Review {p.kind === "person" ? "person’s notes" : p.kind}
            </Link>
            {p.message && (
              <p className="text-xs text-muted-text">{p.message}</p>
            )}
          </li>
        ))}
      </ul>
      {items.some((p) => !p.blocked) && (
        <button className="app-button" onClick={() => retryDetails(accountId)}>
          Try syncing now
        </button>
      )}
    </aside>
  );
}
