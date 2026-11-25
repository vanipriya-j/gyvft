"use client";
import { useEffect } from "react";
import Link from "next/link";
export default function RewardVerificationLanding() {
  useEffect(() => {
    const token = new URLSearchParams(location.hash.slice(1)).get("verify");
    if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
      sessionStorage.setItem("gyvft-reward-proof", token);
      history.replaceState(null, "", location.pathname);
    }
  }, []);
  return (
    <main className="mx-auto max-w-lg px-5 py-16">
      <p className="text-sm text-olive-dark">GYVFT × Aarla</p>
      <h1 className="mt-4 font-serif text-3xl">
        Your rewards. Yours to enjoy.
      </h1>
      <p className="mt-4">
        Continue to your GYVFT account, then confirm your email to connect your
        own Aarla rewards. Sign in with the email that received this secure
        link.
      </p>
      <Link
        href="/account/rewards"
        className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-red px-5 font-medium text-white"
      >
        Continue to GYVFT
      </Link>
    </main>
  );
}
