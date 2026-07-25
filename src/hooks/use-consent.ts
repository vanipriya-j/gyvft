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

function clientMountedSnapshot(): boolean {
  return true;
}

function serverMountedSnapshot(): boolean {
  return false;
}

function subscribeToMount() {
  return () => {};
}

export function useConsent() {
  // Stay false during SSR/hydration so the banner is never in server HTML.
  // That avoids a localStorage-driven hydration mismatch that left an inert banner.
  const isLoaded = useSyncExternalStore(
    subscribeToMount,
    clientMountedSnapshot,
    serverMountedSnapshot,
  );

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
