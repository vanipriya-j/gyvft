"use client";
import { useActionState } from "react";
import {
  runMigrationsAction,
  type MigrationResult,
} from "@/app/studio/settings/migrations/actions";
const initial: MigrationResult = { ok: false, message: "", applied: [] };
export function MigrationsForm({ pendingCount }: { pendingCount: number }) {
  const [state, action, pending] = useActionState(async () => {
    try {
      return await runMigrationsAction();
    } catch {
      return {
        ok: false,
        applied: [],
        message:
          "The request could not complete. Refresh to check migration status before retrying.",
      };
    }
  }, initial);
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-slate-600">
        Apply the pending migrations listed below to this deployment’s database.
        Already applied migrations are skipped.
      </p>
      <button
        type="submit"
        disabled={pending || pendingCount === 0}
        className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? "Running migrations…"
          : pendingCount
            ? `Run ${pendingCount} pending migration${pendingCount === 1 ? "" : "s"}`
            : "Database up to date"}
      </button>
      <p
        role="status"
        className={`text-sm ${state.ok ? "text-emerald-700" : "text-slate-700"}`}
      >
        {state.message}
      </p>
      {state.applied.length > 0 && (
        <ul className="space-y-1 text-xs text-slate-600">
          {state.applied.map((id) => (
            <li className="break-all" key={id}>
              {id}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
