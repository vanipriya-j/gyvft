"use client";
import { useRef, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { BrandLogo } from "@/components/public/BrandLogo";
export function AgentConsent({
  request,
  scopes,
}: {
  request: string;
  scopes: string[];
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const secret = useRef<HTMLInputElement>(null),
    lock = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/mcp/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, secret: secret.current?.value }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await response.json();
      if (!response.ok || !data.ok)
        throw Error(
          "Operator access or the connection request could not be verified. Try again, or restart from ChatGPT.",
        );
      const url = new URL(data.redirect);
      if (url.origin !== "https://chatgpt.com")
        throw Error("The return address could not be verified.");
      if (secret.current) secret.current.value = "";
      window.location.assign(url.href);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The connection could not be confirmed.",
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <BrandLogo />
      <h1 className="mt-8 font-serif text-3xl">
        Connect GPT to your gifting desk
      </h1>
      <p className="mt-3 text-muted-text">
        Authorise ChatGPT to help prepare gift options in GYVFT.
      </p>
      <section className="mt-6 rounded-xl border border-border bg-paper p-5">
        <h2 className="font-medium">Access you are granting</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {scopes.includes("gyvft:requests:read") && (
            <li>Read submitted customer briefs and their gift options.</li>
          )}
          {scopes.includes("gyvft:options:write") && (
            <li>
              Create and edit private option drafts, including attached images.
            </li>
          )}
        </ul>
        <p className="mt-4 text-sm">
          You review and publish in Operations. Revoke this connection anytime
          under Settings & connections.
        </p>
      </section>
      <form onSubmit={submit} className="mt-6 space-y-4" aria-busy={busy}>
        <label className="block text-sm font-medium">
          Operations secret
          <input
            ref={secret}
            type="password"
            required
            minLength={11}
            maxLength={1024}
            autoComplete="off"
            disabled={busy}
            className="mt-2 min-h-11 w-full rounded-lg border border-border bg-paper px-3 py-3"
          />
        </label>
        <p className="text-xs text-muted-text">
          Enter it only on this GYVFT page. ChatGPT receives a separate,
          revocable access token.
        </p>
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-action px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
          disabled={busy}
        >
          {busy && <LoaderCircle size={16} className="animate-spin" />}Connect
          ChatGPT
        </button>
      </form>
      <p role="alert" className="mt-4 text-sm text-action-text">
        {message}
      </p>
    </main>
  );
}
