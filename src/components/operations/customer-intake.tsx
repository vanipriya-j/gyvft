"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { LoaderCircle, Plus, Upload, UserPlus, X, Mail } from "lucide-react";
import { prepareOptionImage } from "@/lib/customer/option-image-upload";
import {
  MAX_REQUIREMENT_FILES,
  MAX_REQUIREMENT_FILE_BYTES,
  MAX_REQUIREMENT_TOTAL_BYTES,
  type IntakeCustomerSummary,
  type IntakeResult,
} from "@/lib/customer/operations-intake-model";

export type IntakePost = (
  body: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<Record<string, unknown>>;
type Customer = Pick<IntakeCustomerSummary, "id" | "email" | "name">;
type FileEntry = {
  key: string;
  filename: string;
  mime: string;
  data: string;
  size: number;
};
const button = "app-button min-h-11";

export function CustomerSetupEmail({
  accountId,
  post,
}: {
  accountId: string;
  post: IntakePost;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [sent, setSent] = useState(false),
    [expired, setExpired] = useState(false);
  const key = useRef<string | null>(null),
    lock = useRef(false);
  async function send() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    if (!key.current || expired) {
      key.current = crypto.randomUUID();
      setExpired(false);
    }
    try {
      const result = await post({
        op: "send_setup_email",
        account_id: accountId,
        request_id: key.current,
      });
      setMessage(String(result.message));
      setSent(result.state === "sent");
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : "The email could not be confirmed. Retry this email.";
      setMessage(text);
      setExpired(text.includes("expired"));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        className={button}
        disabled={busy || sent}
        onClick={() => void send()}
      >
        {busy ? (
          <LoaderCircle size={16} className="animate-spin" />
        ) : (
          <Mail size={16} />
        )}{" "}
        {busy
          ? "Sending setup email…"
          : sent
            ? "Setup email accepted"
            : expired
              ? "Send a new setup link"
              : "Send setup email"}
      </button>
      <p className="app-note mt-2 max-w-lg" role="status">
        {message ||
          "The customer chooses their own password. The link expires in one hour."}
      </p>
    </div>
  );
}

export function OperationsCustomerIntake({
  post,
  initialCustomer,
  withRequirement = false,
  onSaved,
  onOpenRequest,
}: {
  post: IntakePost;
  initialCustomer?: Customer;
  withRequirement?: boolean;
  onSaved: () => Promise<void>;
  onOpenRequest: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [installed, setInstalled] = useState<boolean | null>(null),
    [busy, setBusy] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState("");
  const [kind, setKind] = useState<"new" | "existing">(
      initialCustomer ? "existing" : withRequirement ? "existing" : "new",
    ),
    [selected, setSelected] = useState<Customer | null>(
      initialCustomer || null,
    ),
    [query, setQuery] = useState(""),
    [matches, setMatches] = useState<IntakeCustomerSummary[]>([]),
    [searched, setSearched] = useState(false);
  const [addRequirement, setAddRequirement] = useState(withRequirement),
    [company, setCompany] = useState(false),
    [files, setFiles] = useState<FileEntry[]>([]),
    [result, setResult] = useState<IntakeResult | null>(null);
  const saveKey = useRef<{ body: string; id: string } | null>(null),
    processing = useRef(false),
    saving = useRef(false),
    querySequence = useRef(0),
    group = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    post({ op: "status" }, abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setInstalled(!!value.installed);
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setError(
            "Customer intake could not load. Close this window and try again.",
          );
      });
    return () => abort.abort();
  }, [open, post]);
  async function search() {
    if (query.trim().length < 2) {
      setError("Enter at least two characters of their name or email.");
      return;
    }
    const sequence = ++querySequence.current;
    setBusy(true);
    setError("");
    try {
      const value = await post({ op: "customers", query: query.trim() });
      if (sequence === querySequence.current) {
        setMatches(value.customers as IntakeCustomerSummary[]);
        setSearched(true);
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Customer search failed.",
      );
    } finally {
      if (sequence === querySequence.current) setBusy(false);
    }
  }
  async function addFiles(input: FileList | File[] | null) {
    if (!input || processing.current || saving.current || busy) return;
    const incoming = Array.from(input);
    if (!incoming.length) return;
    setError("");
    if (files.length + incoming.length > MAX_REQUIREMENT_FILES) {
      setError("Attach at most six files. Your current files are retained.");
      return;
    }
    processing.current = true;
    setPreparing(true);
    try {
      const additions: FileEntry[] = [];
      for (const file of incoming) {
        const filename =
          file.name.replace(/[\x00-\x1f\x7f/\\]/g, "_").slice(0, 160) ||
          "requirement";
        if (file.type === "application/pdf") {
          if (!file.size || file.size > MAX_REQUIREMENT_FILE_BYTES)
            throw Error("Use PDFs under 2 MB each.");
          const bytes = new Uint8Array(await file.arrayBuffer());
          if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-")
            throw Error("This PDF could not be read. Choose a valid PDF file.");
          const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1]);
            reader.onerror = () =>
              reject(Error("This file could not be read."));
            reader.readAsDataURL(file);
          });
          additions.push({
            key: crypto.randomUUID(),
            filename,
            mime: file.type,
            data,
            size: file.size,
          });
        } else {
          const prepared = await prepareOptionImage(file);
          additions.push({
            key: prepared.key,
            filename,
            mime: prepared.mime,
            data: prepared.data,
            size: Math.floor((prepared.data.length * 3) / 4),
          });
        }
      }
      if (
        [...files, ...additions].reduce((total, file) => total + file.size, 0) >
        MAX_REQUIREMENT_TOTAL_BYTES
      )
        throw Error(
          "Keep all attached files together under 2.5 MB. Your current files are retained.",
        );
      setFiles((current) => [...current, ...additions]);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Files could not be prepared.",
      );
    } finally {
      processing.current = false;
      setPreparing(false);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || processing.current || busy) return;
    setError("");
    if (kind === "existing" && !selected) {
      setError("Choose an existing customer first.");
      return;
    }
    const form = new FormData(event.currentTarget),
      get = (name: string) => String(form.get(name) || "").trim();
    const body = {
      customer:
        kind === "new"
          ? { kind, name: get("name"), email: get("email") }
          : { kind, id: selected!.id, email: selected!.email },
      ...(addRequirement
        ? {
            requirement: {
              title: get("title"),
              story: get("story"),
              customer_type: company ? "b2b" : "b2c",
              organisation_name: company ? get("organisation_name") : "",
              ...(get("recipients")
                ? { recipients: Number(get("recipients")) }
                : {}),
              budget: get("budget"),
              budget_basis: get("budget_basis") || "per_recipient",
              city: get("city"),
              phone: get("phone"),
              occasion: get("occasion"),
              occasion_date: get("occasion_date") || null,
              delivery_date: get("delivery_date") || null,
            },
            files: files.map(({ filename, mime, data }) => ({
              filename,
              mime,
              data,
            })),
          }
        : {}),
    };
    const encoded = JSON.stringify(body);
    if (saveKey.current?.body !== encoded)
      saveKey.current = { body: encoded, id: crypto.randomUUID() };
    saving.current = true;
    setBusy(true);
    try {
      const value = await post({
        op: "create",
        ...body,
        request_id: saveKey.current.id,
      });
      setResult(value.result as IntakeResult);
      void onSaved().catch(() =>
        setError("Saved successfully. Refresh Operations to update the list."),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The save could not be confirmed. Your entries are retained.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const disabled = busy || preparing;
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (disabled) return;
        if (value) {
          setInstalled(null);
          setKind(
            initialCustomer ? "existing" : withRequirement ? "existing" : "new",
          );
          setSelected(initialCustomer || null);
          setQuery("");
          setMatches([]);
          setSearched(false);
          setAddRequirement(withRequirement);
          setCompany(false);
          setFiles([]);
          setResult(null);
          setError("");
          saveKey.current = null;
        }
        setOpen(value);
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={button + (initialCustomer ? "" : " primary")}
        >
          <span aria-hidden="true">
            {withRequirement ? <Plus size={16} /> : <UserPlus size={16} />}
          </span>
          {withRequirement ? "Add requirement" : "Add customer"}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="app-dialog-overlay" />
        <Dialog.Content
          className="app-dialog !max-w-3xl"
          onEscapeKeyDown={(event) => {
            if (disabled) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (disabled) event.preventDefault();
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title>
              {withRequirement
                ? "Add a customer requirement"
                : "Add a customer"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className={button}
                disabled={disabled}
                aria-label="Close customer intake"
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description>
            Record the customer and their requirement together. Setup emails are
            sent separately when you choose.
          </Dialog.Description>
          {installed === null && !error && (
            <p role="status" className="mt-5 flex items-center gap-2">
              <LoaderCircle size={16} className="animate-spin" />
              Checking customer intake…
            </p>
          )}
          {installed === false && (
            <div className="app-soft mt-5">
              <p>
                This flow needs its reviewed database update. Existing customers
                and requests are preserved.
              </p>
              <a className={button + " mt-3"} href="/setup/operations-intake">
                Review Operations intake setup
              </a>
            </div>
          )}
          {installed && result ? (
            <div
              className="mt-5 space-y-5"
              role="region"
              aria-label="Saved customer intake"
            >
              <div className="app-soft">
                <h3 className="font-medium">
                  {result.project_id ? "Requirement saved" : "Customer saved"}
                </h3>
                <p className="mt-2 break-words">
                  {result.name || result.email}
                </p>
                <p className="app-note break-all">{result.email}</p>
                <p className="mt-3 text-sm">
                  {result.created_account
                    ? "A new customer account was created."
                    : "The existing customer account was used."}{" "}
                  No email was sent by this save.
                </p>
              </div>
              {result.setup_pending && (
                <CustomerSetupEmail accountId={result.account_id} post={post} />
              )}
              <div className="app-actions">
                {result.project_id && (
                  <button
                    type="button"
                    className={button + " primary"}
                    onClick={() => {
                      setOpen(false);
                      void onOpenRequest(result.project_id!);
                    }}
                  >
                    Open request →
                  </button>
                )}
                <Dialog.Close className={button}>Done</Dialog.Close>
              </div>
            </div>
          ) : (
            installed && (
              <form
                onSubmit={save}
                onInvalidCapture={(event) => {
                  const details = (event.target as HTMLElement).closest(
                    "details",
                  );
                  if (details) details.open = true;
                }}
                className="mt-5 space-y-5"
                aria-busy={disabled}
              >
                <fieldset
                  disabled={disabled}
                  className="space-y-5 disabled:opacity-60"
                >
                  <fieldset className="space-y-3">
                    <legend className="mb-2 font-medium">Customer</legend>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex min-h-11 items-center gap-2">
                        <input
                          type="radio"
                          name="customer_kind"
                          checked={kind === "new"}
                          onChange={() => {
                            setKind("new");
                            setError("");
                          }}
                        />
                        New customer
                      </label>
                      <label className="flex min-h-11 items-center gap-2">
                        <input
                          type="radio"
                          name="customer_kind"
                          checked={kind === "existing"}
                          onChange={() => {
                            setKind("existing");
                            setError("");
                          }}
                        />
                        Existing customer
                      </label>
                    </div>
                    {kind === "new" ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="app-label">
                          Customer name
                          <input
                            className="app-input"
                            name="name"
                            required
                            minLength={2}
                            maxLength={120}
                            autoComplete="off"
                          />
                        </label>
                        <label className="app-label">
                          Customer email
                          <input
                            className="app-input"
                            name="email"
                            type="email"
                            required
                            maxLength={254}
                            autoComplete="off"
                          />
                        </label>
                      </div>
                    ) : selected ? (
                      <div className="app-soft">
                        <p className="break-words font-medium">
                          {selected.name || selected.email}
                        </p>
                        <p className="app-note break-all">{selected.email}</p>
                        <button
                          type="button"
                          className={button + " mt-3"}
                          onClick={() => {
                            setSelected(null);
                            setMatches([]);
                            setSearched(false);
                          }}
                        >
                          Choose another customer
                        </button>
                      </div>
                    ) : (
                      <div>
                        <label className="app-label">
                          Find customer
                          <input
                            className="app-input"
                            value={query}
                            maxLength={120}
                            onChange={(event) => {
                              setQuery(event.target.value);
                              setSearched(false);
                              setMatches([]);
                              querySequence.current++;
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void search();
                              }
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className={button + " mt-3"}
                          onClick={() => void search()}
                        >
                          Find customer
                        </button>
                        {searched && !matches.length && (
                          <p className="app-note mt-3">
                            No customers found. Check the email or choose New
                            customer.
                          </p>
                        )}
                        <ul className="mt-3 divide-y divide-border">
                          {matches.map((customer) => (
                            <li
                              key={customer.id}
                              className="flex flex-wrap items-center justify-between gap-2 py-3"
                            >
                              <div className="min-w-0">
                                <p className="break-words">
                                  {customer.name || customer.email}
                                </p>
                                <p className="app-note break-all">
                                  {customer.email}
                                  {!customer.is_active ? " · Inactive" : ""}
                                </p>
                              </div>
                              <button
                                type="button"
                                className={button}
                                disabled={!customer.is_active}
                                onClick={() => setSelected(customer)}
                              >
                                Use customer
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="app-note">
                      Customers choose their own password through a secure email
                      link. Existing account credentials are preserved.
                    </p>
                  </fieldset>
                  <label className="flex min-h-11 items-center gap-3 font-medium">
                    <input
                      type="checkbox"
                      checked={addRequirement}
                      onChange={(event) =>
                        setAddRequirement(event.target.checked)
                      }
                    />
                    Add a gifting requirement now
                  </label>
                  {addRequirement && (
                    <section
                      className="space-y-4 border-t border-border pt-4"
                      aria-label="Customer requirement"
                    >
                      <label className="app-label">
                        Request title
                        <input
                          className="app-input"
                          name="title"
                          required
                          minLength={2}
                          maxLength={160}
                          placeholder="For example, team appreciation gifts"
                        />
                      </label>
                      <label className="app-label">
                        Requirement
                        <textarea
                          className="app-input min-h-36"
                          name="story"
                          maxLength={20000}
                          aria-label="Requirement"
                          placeholder="Paste the customer's brief, email or notes. You can also attach their document below."
                        />
                      </label>
                      <div
                        ref={group}
                        role="group"
                        tabIndex={0}
                        aria-label="Drop or paste requirement files"
                        className="rounded-xl border-2 border-dashed border-border bg-surface p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          void addFiles(event.dataTransfer.files);
                        }}
                        onPaste={(event) => {
                          if (event.clipboardData.files.length) {
                            event.preventDefault();
                            void addFiles(event.clipboardData.files);
                          }
                        }}
                      >
                        <p className="flex items-center gap-2 font-medium">
                          <Upload size={17} />
                          Requirement files{" "}
                          <span className="ml-auto text-sm">
                            {files.length} / 6
                          </span>
                        </p>
                        <p className="app-note mt-2">
                          Drop PDFs or images here, choose files, or focus this
                          area and paste an image. Up to six files; PDFs under 2
                          MB each, 2.5 MB combined after image optimisation.
                        </p>
                        <label className="app-label mt-3">
                          Choose requirement files
                          <input
                            className="app-input mt-2"
                            name="requirement_files"
                            type="file"
                            multiple
                            accept="application/pdf,image/png,image/jpeg,image/webp"
                            onChange={(event) => {
                              void addFiles(event.target.files);
                              event.target.value = "";
                            }}
                          />
                        </label>
                        {preparing && (
                          <p
                            role="status"
                            className="mt-3 flex items-center gap-2"
                          >
                            <LoaderCircle size={16} className="animate-spin" />
                            Preparing files…
                          </p>
                        )}
                        <ul className="mt-3 divide-y divide-border">
                          {files.map((file) => (
                            <li
                              key={file.key}
                              className="flex items-center justify-between gap-2 py-2"
                            >
                              <div className="min-w-0">
                                <p className="break-words text-sm">
                                  {file.filename}
                                </p>
                                <p className="app-note">
                                  {Math.ceil(file.size / 1024)} KB
                                </p>
                              </div>
                              <button
                                type="button"
                                className={button}
                                aria-label={"Remove " + file.filename}
                                onClick={() =>
                                  setFiles((current) =>
                                    current.filter(
                                      (item) => item.key !== file.key,
                                    ),
                                  )
                                }
                              >
                                <X size={16} />
                              </button>
                            </li>
                          ))}
                        </ul>
                        <p className="app-note mt-2">
                          These attachments will be visible to this customer.
                          Images are optimised for viewing; retain original
                          artwork separately.
                        </p>
                      </div>
                      <details>
                        <summary className="flex min-h-11 cursor-pointer items-center font-medium">
                          Add known details · optional
                        </summary>
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                          <label className="app-label">
                            Purchase context
                            <select
                              className="app-select"
                              aria-label="Purchase context"
                              value={company ? "b2b" : "b2c"}
                              onChange={(event) =>
                                setCompany(event.target.value === "b2b")
                              }
                            >
                              <option value="b2c">Personal gifting</option>
                              <option value="b2b">Organisation gifting</option>
                            </select>
                          </label>
                          {company && (
                            <label className="app-label">
                              Organisation name
                              <input
                                className="app-input"
                                name="organisation_name"
                                required
                                maxLength={160}
                              />
                            </label>
                          )}
                          <label className="app-label">
                            Number of recipients
                            <input
                              className="app-input"
                              name="recipients"
                              type="number"
                              min={1}
                              max={10000}
                            />
                          </label>
                          <label className="app-label">
                            Budget (₹)
                            <input
                              className="app-input"
                              name="budget"
                              maxLength={120}
                              placeholder="For example, 1000–1200"
                            />
                          </label>
                          <label className="app-label">
                            Budget basis
                            <select
                              className="app-select"
                              name="budget_basis"
                              aria-label="Budget basis"
                            >
                              <option value="per_recipient">
                                Per recipient
                              </option>
                              <option value="total">Total budget</option>
                            </select>
                          </label>
                          <label className="app-label">
                            City or cities
                            <input
                              className="app-input"
                              name="city"
                              maxLength={120}
                            />
                          </label>
                          <label className="app-label">
                            Contact phone
                            <input
                              className="app-input"
                              name="phone"
                              type="tel"
                              maxLength={40}
                            />
                          </label>
                          <label className="app-label">
                            Occasion
                            <input
                              className="app-input"
                              name="occasion"
                              maxLength={120}
                            />
                          </label>
                          <label className="app-label">
                            Occasion date
                            <input
                              className="app-input"
                              name="occasion_date"
                              type="date"
                            />
                          </label>
                          <label className="app-label">
                            Requested delivery date
                            <input
                              className="app-input"
                              name="delivery_date"
                              type="date"
                            />
                          </label>
                        </div>
                      </details>
                    </section>
                  )}
                  <div className="app-actions">
                    <button
                      className={button + " primary"}
                      disabled={disabled || (kind === "existing" && !selected)}
                    >
                      {busy ? (
                        <LoaderCircle size={16} className="animate-spin" />
                      ) : null}
                      {busy
                        ? "Saving…"
                        : addRequirement
                          ? "Save customer & requirement"
                          : "Save customer"}
                    </button>
                    <Dialog.Close
                      type="button"
                      className={button}
                      disabled={disabled}
                    >
                      Cancel
                    </Dialog.Close>
                  </div>
                  <p className="app-note">
                    Saving does not send an email. You can send the setup
                    invitation after checking the saved record.
                  </p>
                </fieldset>
              </form>
            )
          )}
          <p role="alert" className="mt-3 min-h-5 text-sm text-action-text">
            {error}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
