"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  defaultConsent,
  hasStoredConsent,
  readConsent,
  writeConsent,
} from "@/lib/consent/client";

function consentSnapshotKey(): string {
  if (typeof window === "undefined") return "default";
  return window.localStorage.getItem("gyvft.consent.v1") ?? "default";
}

export function useConsent() {
  const snapshotKey = useSyncExternalStore(
    (notify) => {
      window.addEventListener("gyvft:consent", notify);
      window.addEventListener("storage", notify);
      return () => {
        window.removeEventListener("gyvft:consent", notify);
        window.removeEventListener("storage", notify);
      };
    },
    consentSnapshotKey,
    () => "default",
  );
  const consent = useMemo(
    () => (snapshotKey === "default" ? defaultConsent() : readConsent()),
    [snapshotKey],
  );

  const save = (input: { analytics: boolean; advertising: boolean }) => {
    writeConsent(input);
  };

  return { consent, hasChoice: hasStoredConsent(), isLoaded: true, save };
}
