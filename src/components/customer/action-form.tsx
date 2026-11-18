"use client";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
export type ActionResult = { message: string; ok: boolean };
function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="app-button primary mt-4">
      {pending ? "Sending…" : label}
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
  const [state, submit] = useActionState(
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
    <form action={submit}>
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
