"use client";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
export type ActionResult = { message: string; ok: boolean };
function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="mt-4 rounded-full bg-olive-dark px-6 py-3 text-sm text-white disabled:opacity-50"
    >
      {pending ? "Sending…" : label}
    </button>
  );
}
export function ActionForm({
  action,
  label,
  children,
}: {
  action: (data: FormData) => Promise<ActionResult>;
  label: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [state, submit] = useActionState(
    async (_: ActionResult, data: FormData) => {
      try {
        const result = await action(data);
        if (result.ok) router.refresh();
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
        role="status"
        className={`mt-3 text-sm ${state.ok ? "text-olive" : "text-muted-text"}`}
      >
        {state.message}
      </p>
    </form>
  );
}
