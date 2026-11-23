"use client";
import { useEffect, useState } from "react";
import Link from "@/components/ui/navigation-link";
import { LoaderCircle } from "lucide-react";
export function AarlaShop({
  destination,
  email,
}: {
  destination: string;
  email: string;
}) {
  const [attempt, setAttempt] = useState(0),
    [reference, setReference] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const prepare = async () => {
      try {
        const response = await fetch("/api/customer/aarla-shop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ destination }),
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(55000),
          ]),
        });
        const body = await response.json();
        if (
          typeof body.error?.reference === "string" &&
          /^[0-9a-f-]{36}$/i.test(body.error.reference)
        )
          setReference(body.error.reference);
        if (!response.ok || !body.ok)
          throw Error(
            body.error?.message ||
              "Your saving could not be confirmed. Please try again.",
          );
        const url = new URL(body.redirectUrl);
        if (
          url.protocol !== "https:" ||
          url.hostname !== "aarla.in" ||
          !url.pathname.startsWith("/discount/GYVFT5-")
        )
          throw Error("Your saving link could not be confirmed.");
        if (active) window.location.replace(url.href);
      } catch (e) {
        if (active && !controller.signal.aborted)
          setError(
            e instanceof Error
              ? e.message
              : "Your saving could not be confirmed. Please try again.",
          );
      }
    };
    void prepare();
    return () => {
      active = false;
      controller.abort();
    };
  }, [destination, attempt]);
  return (
    <section className="app-panel mx-auto max-w-lg my-6" aria-busy={!error}>
      <h1 className="font-serif text-2xl">A little more from Aarla.</h1>
      {!error ? (
        <div role="status" className="mt-4 flex items-center gap-3">
          <LoaderCircle
            className="app-spinner text-olive"
            aria-hidden="true"
            size={22}
          />
          <p>Getting your 5% saving ready…</p>
        </div>
      ) : (
        <p className="app-alert mt-4" role="alert">
          {error}
        </p>
      )}
      {error && reference && (
        <p className="app-muted mt-2 text-xs break-all">
          Support reference: {reference}
        </p>
      )}
      <p className="app-muted mt-4">
        Your saving is for {email}. Use this email at Aarla checkout.
      </p>
      <p className="app-muted text-sm mt-2">
        Enjoy 5% off every time you shop at Aarla through GYVFT. This code is
        single-use and valid for 24 hours. We’ll open Aarla with the code
        applied once it’s confirmed.
      </p>
      <div className="app-actions mt-5">
        {error && (
          <button
            className="app-button primary"
            onClick={() => {
              setError("");
              setReference("");
              setAttempt((x) => x + 1);
            }}
          >
            Try again
          </button>
        )}
        <Link className="app-button" href="/account">
          Back to My GYVFT
        </Link>
      </div>
    </section>
  );
}
