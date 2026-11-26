"use client";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  queueDetails,
  pendingDetails,
  onDetailsChange,
  detailKey,
  type PendingDetails,
} from "@/lib/customer/private-details-outbox";
export function PrivateDetailsForm({
  accountId,
  kind,
  id,
  version,
  label,
  successHref,
  isNew,
  children,
}: {
  accountId: string;
  kind: PendingDetails["kind"];
  id: string;
  version: string | null;
  label: string;
  successHref?: string;
  isNew?: boolean;
  children: ReactNode;
}) {
  const form = useRef<HTMLFormElement>(null),
    base = useRef(version),
    router = useRouter();
  const [pending, setPending] = useState<PendingDetails | null>(null),
    [message, setMessage] = useState("");
  const recordKey = detailKey({ kind, id });
  useEffect(() => {
    const update = (e?: Event) => {
      setPending(
        pendingDetails(accountId).find((p) => detailKey(p) === recordKey) ||
          null,
      );
      const saved = (e as CustomEvent | undefined)?.detail;
      if (saved?.saved === recordKey) {
        base.current = saved.version;
        setMessage("Saved to GYVFT.");
        if (successHref) {
          router.push(successHref);
          router.refresh();
        }
      }
    };
    update();
    return onDetailsChange(update);
  }, [accountId, recordKey, router, successHref]);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget),
      document: Record<string, unknown> = Object.fromEntries(data);
    if (kind === "profile") document.share_profile = data.has("share_profile");
    if (kind === "occasion") {
      document.repeats_annually = data.has("repeats_annually");
      document.person_id = data.get("person_id") || null;
    }
    const href =
      kind === "profile"
        ? "/account/profile"
        : `/account/${kind === "person" ? "people" : "occasions"}${isNew ? `?add=1&draft=${id}` : `/${id}?edit=1`}`;
    try {
      queueDetails({
        accountId,
        kind,
        id,
        version: base.current,
        document,
        href,
      });
      setMessage("Kept in this tab · syncing to GYVFT…");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Keep this form open and try again.",
      );
    }
  }
  function restore() {
    if (!pending || !form.current) return;
    for (const [name, value] of Object.entries(pending.document)) {
      const control = form.current.elements.namedItem(name);
      if (control instanceof HTMLInputElement && control.type === "checkbox")
        control.checked = value === true;
      else if (
        control instanceof HTMLInputElement ||
        control instanceof HTMLTextAreaElement ||
        control instanceof HTMLSelectElement
      )
        control.value = String(value ?? "");
    }
    // Explicit review uses the freshly rendered server version. The stored retry
    // retains its original version until the customer actually submits again.
    base.current = version;
    setMessage("Draft restored. Review these fields, then save your changes.");
  }
  return (
    <form ref={form} onSubmit={submit}>
      {pending && (
        <div className="app-note mb-4">
          <p>
            A submitted draft is kept in this tab.
            {pending.blocked
              ? " Review the latest fields below before restoring and saving your draft."
              : " It will sync when a connection is available."}
          </p>
          <button type="button" className="app-button mt-2" onClick={restore}>
            Restore submitted draft
          </button>
        </div>
      )}
      {children}
      <button className="app-button primary mt-4" type="submit">
        {label}
      </button>
      <p className="mt-3 text-sm text-muted-text" role="status">
        {message || pending?.message}
      </p>
    </form>
  );
}
