"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Field, SubmitButton, inputClassName } from "@/components/studio/ui";

const neutralError = "We could not complete that request. Check the details and try again.";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const next = useMemo(() => searchParams.get("next") || "/studio", [searchParams]);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      setMessage(null);
      const email = String(formData.get("email") ?? "");
      const password = String(formData.get("password") ?? "");
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(neutralError);
        return;
      }
      router.replace(next.startsWith("/studio") ? next : "/studio");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <Field label="Email">
        <input className={inputClassName} name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password">
        <input className={inputClassName} name="password" type="password" autoComplete="current-password" required />
      </Field>
      {message ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{message}</p> : null}
      <SubmitButton>{isPending ? "Signing in..." : "Sign in"}</SubmitButton>
      <p className="text-sm text-slate-600">
        Forgot your password?{" "}
        <Link className="font-medium text-slate-950 underline" href="/studio/forgot-password">
          Reset it
        </Link>
        .
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const email = String(formData.get("email") ?? "");
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/studio/reset-password`,
      });
      setMessage("If an account can use Studio, password reset instructions will be sent.");
    });
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <Field label="Email">
        <input className={inputClassName} name="email" type="email" autoComplete="email" required />
      </Field>
      {message ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
      <SubmitButton>{isPending ? "Sending..." : "Send reset instructions"}</SubmitButton>
      <p className="text-sm text-slate-600">
        Remembered it?{" "}
        <Link className="font-medium text-slate-950 underline" href="/studio/login">
          Back to sign in
        </Link>
        .
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      setMessage(null);
      const password = String(formData.get("password") ?? "");
      const confirmPassword = String(formData.get("confirmPassword") ?? "");
      if (password.length < 8 || password !== confirmPassword) {
        setMessage(neutralError);
        return;
      }
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage(neutralError);
        return;
      }
      router.replace("/studio/login");
    });
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <Field label="New password" hint="Use at least 8 characters.">
        <input className={inputClassName} name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirm password">
        <input className={inputClassName} name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>
      {message ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{message}</p> : null}
      <SubmitButton>{isPending ? "Updating..." : "Update password"}</SubmitButton>
    </form>
  );
}
