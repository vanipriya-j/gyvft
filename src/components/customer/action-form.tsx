"use client";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
export type ActionResult = { message: string; ok: boolean };
function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      aria-busy={pending}
      className="app-button primary app-pending-button mt-4"
    >
      <span style={{ visibility: pending ? "hidden" : "visible" }}>
        {label}
      </span>
      {pending && (
        <span className="app-button-pending" aria-hidden="true">
          <LoaderCircle size={16} className="app-spinner" />
          Working…
        </span>
      )}
      {pending && <span className="sr-only">{label} in progress</span>}
    </button>
  );
}
export function ActionForm({
  action,
  label,
  children,
  successHref,
}: {
  action: (data: FormData) => Promise<ActionResult>;
  label: string;
  successHref?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [state, submit, pending] = useActionState(
    async (_: ActionResult, data: FormData) => {
      try {
        const result = await action(data);
        if (result.ok && successHref) router.push(successHref);
        return result;
      } catch {
        return {
          message:
            "We couldn’t save that just now. Refresh to check before trying again.",
          ok: false,
        };
      }
    },
    { message: "", ok: false },
  );
  return (
    <form action={submit} aria-busy={pending}>
      {children}
      <Submit label={label} />
      <p
        role={state.message && !state.ok ? "alert" : "status"}
        className={`mt-3 text-sm ${state.ok ? "text-olive" : "text-muted-text"}`}
      >
        {state.message}
      </p>
    </form>
  );
}
