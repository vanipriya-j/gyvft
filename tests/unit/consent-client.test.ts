/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import {
  hasStoredConsent,
  readConsent,
  resetConsentForTests,
  writeConsent,
} from "@/lib/consent/client";

afterEach(() => {
  resetConsentForTests();
});

describe("consent client storage", () => {
  it("persists a choice and reports hasStoredConsent", () => {
    expect(hasStoredConsent()).toBe(false);

    const next = writeConsent({ analytics: true, advertising: false });

    expect(next.analytics).toBe(true);
    expect(next.advertising).toBe(false);
    expect(hasStoredConsent()).toBe(true);
    expect(readConsent().analytics).toBe(true);
  });

  it("keeps an in-memory choice when localStorage throws", () => {
    const original = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw new Error("quota");
    };

    try {
      writeConsent({ analytics: false, advertising: true });
      expect(hasStoredConsent()).toBe(true);
      expect(readConsent().advertising).toBe(true);
    } finally {
      window.localStorage.setItem = original;
    }
  });
});
