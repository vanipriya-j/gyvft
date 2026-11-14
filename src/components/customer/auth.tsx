"use client";

import { startTransition, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import {
  registerCustomerAction,
  loginCustomerAction,
  requestCustomerPasswordResetAction,
  resetCustomerPasswordAction,
} from "@/app/account/auth-actions";

type AuthMode = "login" | "signup" | "recover" | "reset";

export function CustomerAuth({ resetToken }: { resetToken?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(resetToken ? "reset" : "login");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [successful, setSuccessful] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const submitting = useRef(false);

  function changeMode(next: AuthMode) {
    if (submitting.current) return;
    setMode(next);
    setMessage("");
    setSuccessful(false);
    setShowPassword(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const data = new FormData(event.currentTarget);
    const submittedMode = mode;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    setSuccessful(false);
    startTransition(async () => {
      try {
        const action = {
          login: loginCustomerAction,
          signup: registerCustomerAction,
          recover: requestCustomerPasswordResetAction,
          reset: resetCustomerPasswordAction,
        }[submittedMode];
        const result = await action(data);
        setMessage(result.message);
        setSuccessful(result.ok);
        if (!result.ok) return;
        if (
          result.redirectTo === "/account" ||
          result.redirectTo === "/account/login"
        ) {
          router.replace(result.redirectTo);
        } else if (submittedMode === "reset") {
          setMode("login");
          setShowPassword(false);
        }
      } catch {
        setMessage("We couldn’t complete that request. Please try again.");
      } finally {
        submitting.current = false;
        setBusy(false);
      }
    });
  }

  const input =
    "mt-2 w-full rounded-xl border border-border bg-paper px-4 py-3 outline-none focus:border-olive focus:ring-2 focus:ring-olive/20";
  const labels: Record<AuthMode, string> = {
    login: "Sign in to My GYVFT",
    signup: "Create your account",
    recover: "Send password reset link",
    reset: "Save new password",
  };

  return (
    <div>
      {mode === "login" || mode === "signup" ? (
        <div className="mb-7 flex gap-5 border-b border-border pb-4">
          {(["login", "signup"] as const).map((value) => (
            <button
              key={value}
              type="button"
              disabled={busy}
              aria-pressed={mode === value}
              className={
                mode === value
                  ? "font-semibold underline underline-offset-8"
                  : "text-muted-text"
              }
              onClick={() => changeMode(value)}
            >
              {value === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
      ) : (
        <p className="mb-6 text-sm leading-relaxed text-muted-text">
          {mode === "recover"
            ? "Enter your account email and we’ll send a link to choose a new password."
            : "Choose a new password for your GYVFT account."}
        </p>
      )}

      <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
        <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
          {mode !== "reset" && (
            <label
              className="block text-sm font-medium"
              htmlFor="customer-email"
            >
              Email used for your enquiry
              <input
                id="customer-email"
                className={input}
                name="email"
                type="email"
                autoComplete="username"
                maxLength={254}
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          )}
          {mode === "reset" && (
            <input name="token" type="hidden" value={resetToken ?? ""} />
          )}
          {mode !== "recover" && (
            <div>
              <label
                className="block text-sm font-medium"
                htmlFor="customer-password"
              >
                {mode === "reset" ? "New password" : "Password"}
              </label>
              <div className="relative">
                <input
                  key={mode}
                  id="customer-password"
                  className={`${input} pr-14`}
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  minLength={8}
                  maxLength={128}
                  required
                  aria-describedby={
                    mode === "login" ? undefined : "customer-password-help"
                  }
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-1 mt-2 flex min-w-11 items-center justify-center rounded-lg text-muted-text focus:outline-none focus:ring-2 focus:ring-olive/40"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {mode !== "login" && (
                <p
                  id="customer-password-help"
                  className="mt-2 text-xs text-muted-text"
                >
                  Use between 8 and 128 characters.
                </p>
              )}
            </div>
          )}
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-olive-dark px-5 py-3 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Please wait…
              </>
            ) : (
              labels[mode]
            )}
          </button>
        </fieldset>

        {message && (
          <p
            role={successful ? "status" : "alert"}
            className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
              successful
                ? "bg-emerald-50 text-emerald-800"
                : "bg-amber-50 text-amber-900"
            }`}
          >
            {message}
          </p>
        )}
        {mode === "login" ? (
          <button
            type="button"
            disabled={busy}
            className="text-sm underline underline-offset-4 disabled:opacity-50"
            onClick={() => changeMode("recover")}
          >
            Forgot password?
          </button>
        ) : mode === "recover" || mode === "reset" ? (
          <button
            type="button"
            disabled={busy}
            className="text-sm underline underline-offset-4 disabled:opacity-50"
            onClick={() => changeMode("login")}
          >
            Back to sign in
          </button>
        ) : null}
      </form>
    </div>
  );
}
