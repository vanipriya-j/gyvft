"use client";
import { useRef, useState, type FormEvent } from "react";
import { LoaderCircle, Paperclip, X } from "lucide-react";
import {
  prepareOptionImage,
  type PreparedOptionImage,
} from "@/lib/customer/option-image-upload";
import type { pilotDetail } from "@/lib/customer/pilot-admin";
type Detail = Awaited<ReturnType<typeof pilotDetail>>;
type Perform = (body: Record<string, unknown>) => Promise<boolean>;
export function OfflineApproval({
  detail,
  kind,
  busy,
  perform,
  preview,
}: {
  detail: Detail;
  kind: "proposal" | "design";
  busy: boolean;
  perform: Perform;
  preview: (kind: string, id: string) => Promise<void>;
}) {
  const [images, setImages] = useState<PreparedOptionImage[]>([]),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState("");
  const processing = useRef(false),
    saving = useRef(false);
  const latest = detail.approvals
    .filter((a) => a.kind === kind)
    .sort((a, b) => Number(b.version) - Number(a.version))[0];
  const locked =
    !!detail.project.production_started_at || detail.project.stage >= 7;
  async function add(files: FileList | File[] | null) {
    if (!files || processing.current || saving.current || busy) return;
    const incoming = Array.from(files);
    if (!incoming.length) return;
    setError("");
    if (incoming.length + images.length > 3) {
      setError(
        "Attach at most three screenshots. Existing selections are retained.",
      );
      return;
    }
    processing.current = true;
    setPreparing(true);
    try {
      const added: PreparedOptionImage[] = [];
      for (const file of incoming) added.push(await prepareOptionImage(file));
      setImages((current) => [...current, ...added]);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The screenshot could not be prepared.",
      );
    } finally {
      processing.current = false;
      setPreparing(false);
    }
  }
  async function record(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || processing.current || busy || !latest) return;
    setError("");
    if (!images.length) {
      setError(
        "Attach the customer’s approval screenshot before recording this decision.",
      );
      return;
    }
    const form = event.currentTarget,
      data = new FormData(form);
    saving.current = true;
    try {
      const time = String(data.get("approved_at") || "");
      const ok = await perform({
        op: "record_offline_approval",
        approval_id: latest.id,
        expected_version: Number(latest.version),
        channel: data.get("channel"),
        customer_approved_at: time ? new Date(time).toISOString() : null,
        recorded_by: data.get("recorded_by"),
        note: data.get("note"),
        proof: images.map(({ mime, data }) => ({ mime, data })),
      });
      if (ok) {
        setImages([]);
        form.reset();
      } else
        setError(
          "Approval was not confirmed. Your proof is retained; check the desk message before retrying.",
        );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The approval could not be confirmed.",
      );
    } finally {
      saving.current = false;
    }
  }
  return (
    <section className="app-panel">
      <h2>Offline customer approval</h2>
      <p className="app-muted">
        Record consent received outside GYVFT, with proof for the exact
        published version. Screenshots stay private to Operations.
      </p>
      {!detail.agentOperationsInstalled ? (
        <a className="app-button mt-3 min-h-11" href="/setup/agent-operations">
          Review Operations actions setup
        </a>
      ) : latest?.status === "pending" && !locked ? (
        <form
          className="mt-4 space-y-4"
          onSubmit={record}
          aria-busy={busy || preparing}
        >
          <fieldset
            disabled={busy || preparing}
            className="space-y-4 disabled:opacity-60"
          >
            <p className="app-soft">
              <strong>
                {latest.title} · v{latest.version}
              </strong>
              <br />
              This records the customer’s approval of this version.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="app-label">
                Approval received through
                <select
                  className="app-input min-h-11"
                  name="channel"
                  aria-label="Approval received through"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="in_person">In person</option>
                  <option value="phone">Phone</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="app-label">
                Recorded by
                <input
                  className="app-input min-h-11"
                  name="recorded_by"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Your name"
                />
              </label>
            </div>
            <label className="app-label">
              Customer approved at · optional
              <input
                className="app-input min-h-11"
                type="datetime-local"
                name="approved_at"
              />
              <span className="mt-2 block text-xs text-muted-text">
                Use your local time. Leave blank if the time is unknown.
              </span>
            </label>
            <label className="app-label">
              Approval note · visible to the customer
              <textarea
                className="app-input min-h-24"
                name="note"
                required
                maxLength={2000}
                placeholder="What the customer explicitly approved, as supported by the attached message."
              />
            </label>
            <div
              role="group"
              aria-label="Drop or paste approval proof"
              tabIndex={0}
              className="rounded-xl border-2 border-dashed border-border bg-surface p-4"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void add(event.dataTransfer.files);
              }}
              onPaste={(event) => {
                if (event.clipboardData.files.length) {
                  event.preventDefault();
                  void add(event.clipboardData.files);
                }
              }}
            >
              <p className="flex items-center gap-2 font-medium">
                <Paperclip size={16} />
                Approval proof · {images.length} / 3
              </p>
              <p className="app-note mt-2">
                Choose, drop or paste screenshots. PNG, JPEG or WebP; images are
                optimised for viewing.
              </p>
              <label className="app-label mt-3">
                Attach approval screenshots
                <input
                  className="app-input min-h-11"
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    void add(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
              {preparing && (
                <p role="status" className="mt-2 flex items-center gap-2">
                  <LoaderCircle size={16} className="animate-spin" />
                  Preparing proof…
                </p>
              )}
              <ul className="mt-2 divide-y divide-border">
                {images.map((image) => (
                  <li
                    className="flex items-center justify-between gap-2 py-2"
                    key={image.key}
                  >
                    <span className="min-w-0 flex-1 break-words text-sm">
                      {image.name}
                    </span>
                    <button
                      className="app-button min-h-11"
                      type="button"
                      aria-label={"Remove " + image.name}
                      onClick={() =>
                        setImages((current) =>
                          current.filter((item) => item.key !== image.key),
                        )
                      }
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <button
              className="app-button primary min-h-11"
              disabled={busy || preparing}
            >
              {busy ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : null}
              Record customer approval · v{latest.version}
            </button>
            <p className="app-note">
              Recording approval saves the evidence and updates this version. It
              does not send a customer email.
            </p>
          </fieldset>
        </form>
      ) : (
        <p className="app-note mt-3">
          {locked
            ? "Production has started. Approval decisions are locked."
            : "Publish a version awaiting customer approval to record offline consent."}
        </p>
      )}
      {detail.offlineApprovals
        .filter((a) => a.kind === kind)
        .map((approval) => (
          <article
            key={approval.id}
            className="mt-4 border-t border-border pt-4"
          >
            <p className="font-medium">
              {approval.title} · v{approval.approval_version}
            </p>
            <p className="app-note mt-2">
              Recorded by {approval.recorded_by} from{" "}
              {String(approval.channel).replaceAll("_", " ")} ·{" "}
              {new Date(approval.recorded_at).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}{" "}
              IST
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{approval.note}</p>
            <div className="app-actions mt-3">
              {(approval.files as { id: string; position: number }[]).map(
                (file) => (
                  <button
                    className="app-button min-h-11"
                    type="button"
                    key={file.id}
                    onClick={() =>
                      void preview("offline-approval-proof", file.id)
                    }
                  >
                    View private proof {file.position}
                  </button>
                ),
              )}
            </div>
          </article>
        ))}
      <p className="mt-3 min-h-5 text-sm text-action-text" role="alert">
        {error}
      </p>
    </section>
  );
}
export function PaymentRequestAction({
  detail,
  busy,
  perform,
}: {
  detail: Detail;
  busy: boolean;
  perform: Perform;
}) {
  const [error, setError] = useState("");
  const quote = detail.approvals
    .filter((a) => a.kind === "proposal")
    .sort((a, b) => Number(b.version) - Number(a.version))[0];
  const total = Number(detail.project.total_paise || 0),
    paid = Number(detail.project.paid_paise || 0),
    advance = Math.ceil(total / 2),
    phase = paid < advance ? "advance" : "balance",
    due = Math.max(0, (phase === "advance" ? advance : total) - paid),
    pending = detail.payments.some((p) => p.status === "pending");
  const allowed =
    detail.agentOperationsInstalled &&
    quote?.status === "approved" &&
    detail.project.kind === "project" &&
    due > 0 &&
    !pending &&
    (phase === "advance" || detail.project.stage >= 8);
  return (
    <section className="app-panel">
      <h2>Request payment</h2>
      <p className="app-muted">
        Send the current approved amount with a secure payment page and the
        available UPI QR/instructions.
      </p>
      <p className="mt-3 text-sm">
        {quote?.status !== "approved" || detail.project.kind !== "project"
          ? "Payment amounts unlock after the latest quote is approved."
          : due > 0
            ? `₹${(due / 100).toFixed(2)} ${phase === "advance" ? "advance" : "balance"}`
            : "No payment outstanding."}
        {quote?.status === "approved" && phase === "advance" && total > 0
          ? ` · Remaining ₹${((total - paid - due) / 100).toFixed(2)} due before dispatch.`
          : ""}
      </p>
      <button
        className="app-button primary mt-4 min-h-11"
        disabled={busy || !allowed}
        onClick={() =>
          void (async () => {
            setError("");
            const ok = await perform({
              op: "request_customer_payment",
              approval_id: quote?.id,
              expected_version: Number(quote?.version),
              phase,
              expected_due_paise: due,
              expected_paid_paise: paid,
            });
            if (!ok)
              setError(
                "Payment request was not confirmed. Review the current quote and receipt status before retrying.",
              );
          })()
        }
      >
        {busy ? <LoaderCircle size={16} className="animate-spin" /> : null}
        Request{" "}
        {quote?.status === "approved" && detail.project.kind === "project"
          ? phase
          : "payment"}{" "}
        by email
      </button>
      <p className="app-note mt-3">
        {!detail.agentOperationsInstalled
          ? "Activate Operations actions before sending."
          : pending
            ? "Payment proof is awaiting verification. Do not ask the customer to pay again."
            : quote?.status !== "approved"
              ? "The latest quote must be approved first."
              : phase === "balance" && detail.project.stage < 8
                ? "The balance can be requested once the order is packed for dispatch."
                : "Sending a payment request does not mark money as received."}
      </p>
      <p role="alert" className="min-h-5 text-sm text-action-text">
        {error}
      </p>
    </section>
  );
}
