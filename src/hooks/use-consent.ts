"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
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

export function useConsent() {
  // useEffect mount gate — never SSR the banner, avoiding localStorage hydration mismatches.
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    setIsLoaded(true);
  }, []);

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
