"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  defaultConsent,
  getConsentSnapshotKey,
  readConsent,
  writeConsent,
} from "@/lib/consent/client";

function subscribeToConsent(notify: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("gyvft:consent", notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener("gyvft:consent", notify);
    window.removeEventListener("storage", notify);
  };
}

function subscribeNoop() {
  return () => {};
}

export function useConsent() {
  // Client-only mount flag via useSyncExternalStore:
  // server snapshot is false, so the banner is never SSR'd and cannot
  // hydrate-mismatch against a localStorage-backed hasChoice.
  const isLoaded = useSyncExternalStore(subscribeNoop, () => true, () => false);

  const snapshotKey = useSyncExternalStore(
    subscribeToConsent,
    getConsentSnapshotKey,
    () => "default",
  );

  const consent = useMemo(
    () => (snapshotKey === "default" ? defaultConsent() : readConsent()),
    [snapshotKey],
  );

  const save = useCallback((input: { analytics: boolean; advertising: boolean }) => {
    writeConsent(input);
  }, []);

  return {
    consent,
    hasChoice: isLoaded && snapshotKey !== "default",
    isLoaded,
    save,
  };
}
