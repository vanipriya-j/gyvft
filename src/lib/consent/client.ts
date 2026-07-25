"use client";

export const CONSENT_VERSION = "1.0.0";
const STORAGE_KEY = "gyvft.consent.v1";

export type ConsentState = {
  necessary: true;
  analytics: boolean;
  advertising: boolean;
  version: string;
  updatedAt: string;
};

export type ConsentSnapshot = Pick<ConsentState, "analytics" | "advertising" | "version">;

/** In-memory fallback when localStorage is unavailable or throws. */
let memoryConsent: ConsentState | null = null;

export function defaultConsent(): ConsentState {
  return {
    necessary: true,
    analytics: false,
    advertising: false,
    version: CONSENT_VERSION,
    updatedAt: new Date(0).toISOString(),
  };
}

function readStorageRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Stable external-store snapshot for useSyncExternalStore. */
export function getConsentSnapshotKey(): string {
  if (typeof window === "undefined") return "default";
  const raw = readStorageRaw();
  if (raw) return raw;
  if (memoryConsent) return JSON.stringify(memoryConsent);
  return "default";
}

export function readConsent(): ConsentState {
  if (typeof window === "undefined") return defaultConsent();
  const raw = readStorageRaw();
  if (!raw) return memoryConsent ?? defaultConsent();
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    return {
      necessary: true,
      analytics: Boolean(parsed.analytics),
      advertising: Boolean(parsed.advertising),
      version: typeof parsed.version === "string" ? parsed.version : CONSENT_VERSION,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return memoryConsent ?? defaultConsent();
  }
}

export function writeConsent(input: { analytics: boolean; advertising: boolean }): ConsentState {
  const next: ConsentState = {
    necessary: true,
    analytics: input.analytics,
    advertising: input.advertising,
    version: CONSENT_VERSION,
    updatedAt: new Date().toISOString(),
  };
  memoryConsent = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private mode / blocked storage — keep memory copy so the banner can still dismiss.
    }
    window.dispatchEvent(new CustomEvent<ConsentState>("gyvft:consent", { detail: next }));
  }
  return next;
}

export function hasStoredConsent(): boolean {
  if (typeof window === "undefined") return false;
  if (readStorageRaw() !== null) return true;
  return memoryConsent !== null;
}

export function toConsentSnapshot(consent: ConsentState): ConsentSnapshot {
  return {
    analytics: consent.analytics,
    advertising: consent.advertising,
    version: consent.version,
  };
}

/** Test helper — clears both storage and memory fallback. */
export function resetConsentForTests() {
  memoryConsent = null;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
