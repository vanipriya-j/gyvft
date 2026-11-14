"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
export function CustomerAuth() {
  const router = useRouter();
  const [mode, setMode] = useState<
    "login" | "signup" | "recover" | "verify" | "reset"
  >("login");
  const [email, setEmail] = useState("");
  const [verification, setVerification] = useState<"signup" | "recovery">(
    "signup",
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(data: FormData) {
    setBusy(true);
    setMessage("");
    try {
      const auth = createSupabaseBrowserClient().auth;
      const password = String(data.get("password") ?? "");
      if (mode === "signup") {
        const { error } = await auth.signUp({ email, password });
        if (error) throw error;
        setVerification("signup");
        setMode("verify");
        setMessage("Check your email for your verification code.");
      } else if (mode === "recover") {
        const { error } = await auth.resetPasswordForEmail(email);
        if (error) throw error;
        setVerification("recovery");
        setMode("verify");
        setMessage(
          "If an account exists, a recovery code will arrive by email.",
        );
      } else if (mode === "verify") {
        const { error } = await auth.verifyOtp({
          email,
          token: String(data.get("code") ?? "").trim(),
          type: verification,
        });
        if (error) throw error;
        if (verification === "recovery") setMode("reset");
        else {
          router.replace("/account");
          router.refresh();
        }
      } else {
        const result =
          mode === "reset"
            ? await auth.updateUser({ password })
            : await auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        router.replace("/account");
        router.refresh();
      }
    } catch {
      setMessage(
        "We couldn’t complete that request. Check your details or code and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const input =
    "mt-2 w-full rounded-xl border border-border bg-paper px-4 py-3";
  return (
    <div>
      <div className="mb-7 flex gap-5 border-b border-border pb-4">
        {(["login", "signup"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={
              mode === value ? "font-semibold underline" : "text-muted-text"
            }
            onClick={() => {
              setMode(value);
              setMessage("");
            }}
          >
            {value === "login" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      <form action={submit} className="space-y-5">
        <label className="block text-sm font-medium">
          Email used for your enquiry
          <input
            className={input}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={mode === "verify" || mode === "reset"}
          />
        </label>
        {mode === "verify" ? (
          <label className="block text-sm font-medium">
            Email verification code
            <input
              className={input}
              name="code"
              autoComplete="one-time-code"
              inputMode="numeric"
              required
            />
          </label>
        ) : mode !== "recover" ? (
          <label className="block text-sm font-medium">
            {mode === "reset" ? "New password" : "Password"}
            <input
              className={input}
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "login" ? 1 : 12}
              required
            />
            {mode !== "login" && (
              <span className="text-xs text-muted-text">
                Use at least 12 characters.
              </span>
            )}
          </label>
        ) : null}
        <p role="status" className="text-sm text-muted-text">
          {message}
        </p>
        <button
          disabled={busy}
          className="w-full rounded-xl bg-olive-dark px-5 py-3 text-white disabled:opacity-50"
        >
          {busy
            ? "Please wait…"
            : {
                login: "Sign in to My GYVFT",
                signup: "Create your account",
                recover: "Send recovery code",
                verify: "Verify email",
                reset: "Set new password",
              }[mode]}
        </button>
        {mode === "login" && (
          <button
            type="button"
            className="text-sm underline"
            onClick={() => {
              setMode("recover");
              setMessage("");
            }}
          >
            Forgot password?
          </button>
        )}
      </form>
    </div>
  );
}
