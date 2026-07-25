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

export function defaultConsent(): ConsentState {
  return {
    necessary: true,
    analytics: false,
    advertising: false,
    version: CONSENT_VERSION,
    updatedAt: new Date(0).toISOString(),
  };
}

export function readConsent(): ConsentState {
  if (typeof window === "undefined") return defaultConsent();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultConsent();
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
    return defaultConsent();
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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent<ConsentState>("gyvft:consent", { detail: next }));
  return next;
}

export function hasStoredConsent(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) !== null;
}

export function toConsentSnapshot(consent: ConsentState): ConsentSnapshot {
  return {
    analytics: consent.analytics,
    advertising: consent.advertising,
    version: consent.version,
  };
}
