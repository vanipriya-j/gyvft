"use client";
import { useHydrated } from "@/hooks/use-hydrated";
import { useState, useTransition, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { ActionForm, type ActionResult } from "./action-form";
import {
  setPhotoSharing,
  removeGiftPhoto,
  prepareInvitation,
  sendInvitationEmail,
} from "@/app/account/journey-actions";
export function GiftSectionSelect({
  value,
  sections,
}: {
  value: string;
  sections: { id: string; label: string; href: string }[];
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [pending, start] = useTransition();
  const [destination, setDestination] = useState(value);
  return (
    <label className="app-mobile-section" aria-busy={pending}>
      <span className="app-section-label">
        Gift section
        <span
          className="app-pending-slot"
          role={pending ? "status" : undefined}
          aria-label={pending ? "Opening gift section" : undefined}
        >
          <LoaderCircle
            size={15}
            className="app-spinner"
            style={{ visibility: pending ? "visible" : "hidden" }}
          />
        </span>
      </span>
      <select
        className="app-input"
        aria-label="Gift section"
        disabled={!hydrated || pending}
        value={pending ? destination : value}
        onChange={(e) => {
          const selected = e.target.value;
          setDestination(selected);
          start(() =>
            router.push(sections.find((s) => s.id === selected)!.href, {
              scroll: false,
            }),
          );
        }}
      >
        {sections.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}
export function ConfirmForm({
  title,
  trigger,
  children,
  action,
  label,
  primary = false,
  description,
}: {
  title: string;
  trigger: string;
  children: ReactNode;
  action: (f: FormData) => Promise<ActionResult>;
  label: string;
  primary?: boolean;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const hydrated = useHydrated();
  const router = useRouter();
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        disabled={!hydrated}
        className={`app-button ${primary ? "primary" : ""}`}
      >
        {trigger}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="app-dialog-overlay" />
        <Dialog.Content className="app-dialog">
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          <ActionForm
            label={label}
            action={async (f) => {
              const r = await action(f);
              if (r.ok) {
                setOpen(false);
                router.refresh();
              }
              return r;
            }}
          >
            {children}
          </ActionForm>
          <div className="app-actions">
            <Dialog.Close className="app-button">Cancel</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function PhotoActions({
  id,
  caption,
  permitted,
}: {
  id: string;
  caption: string;
  permitted: boolean;
}) {
  const [busy, start] = useTransition(),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <div>
      <ConfirmForm
        title="Photo sharing"
        trigger="Manage sharing"
        label="Save sharing choice"
        description={`Sharing applies only to ${caption || "this photo"}. Withdrawing public permission keeps your private photo.`}
        action={async (f) => {
          const r = await setPhotoSharing(id, f.has("permitted"));
          if (r.ok) router.refresh();
          return r;
        }}
      >
        <label className="app-check">
          <input type="checkbox" name="permitted" defaultChecked={permitted} />
          Allow Aarla to feature this photo publicly
        </label>
      </ConfirmForm>
      <button
        type="button"
        disabled={busy}
        className="app-button quiet"
        onClick={() =>
          start(async () => {
            const r = await removeGiftPhoto(id);
            setMessage(r.message);
            if (r.ok) router.refresh();
          })
        }
      >
        Remove photo
      </button>
      <p role="status" className="app-muted">
        {message}
      </p>
    </div>
  );
}
export function InviteControls({ id }: { id: string }) {
  const hydrated = useHydrated();
  const [busy, start] = useTransition(),
    [message, setMessage] = useState(""),
    [url, setUrl] = useState("");
  return (
    <div>
      <div className="app-actions">
        <button
          className="app-button primary"
          disabled={busy || !hydrated}
          onClick={() =>
            start(async () => {
              const r = await sendInvitationEmail(id);
              setMessage(r.message);
            })
          }
        >
          {busy ? "Preparing…" : "Send invitation"}
        </button>
        <button
          className="app-button"
          disabled={busy || !hydrated}
          onClick={() =>
            start(async () => {
              const r = await prepareInvitation(id);
              setMessage(r.message);
              if ("url" in r && typeof r.url === "string") setUrl(r.url);
            })
          }
        >
          Get invitation link
        </button>
      </div>
      {url && (
        <div>
          <label className="app-label">
            Invitation link
            <input
              className="app-input"
              value={url}
              readOnly
              onFocus={(e) => e.target.select()}
            />
          </label>
          <button
            className="app-button quiet"
            onClick={() => {
              navigator.clipboard
                .writeText(url)
                .then(() => setMessage("Link copied."))
                .catch(() => setMessage("Select the link to copy it."));
            }}
          >
            Copy link
          </button>
        </div>
      )}
      <p role="status" className="app-muted">
        {message}
      </p>
    </div>
  );
}
export function ProfileName({ name }: { name: string }) {
  return <span>{name || "About me"}</span>;
}
export function GiftFilters({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
