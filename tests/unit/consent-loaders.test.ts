import { describe, expect, it } from "vitest";
import { defaultConsent, toConsentSnapshot } from "@/lib/consent/client";
import {
  shouldLoadClarity,
  shouldLoadMetaPixel,
} from "@/components/analytics/loaders";

describe("consent controlled loaders", () => {
  it("keeps advertising disabled by default and prevents Meta Pixel loading", () => {
    const snapshot = toConsentSnapshot(defaultConsent());

    expect(snapshot.advertising).toBe(false);
    expect(shouldLoadMetaPixel({ advertising: snapshot.advertising, pixelId: "123" })).toBe(false);
  });

  it("prevents Clarity loading when analytics consent is false", () => {
    expect(shouldLoadClarity({ analytics: false, projectId: "clarity-id", pathname: "/" })).toBe(false);
  });

  it("excludes Studio routes from Clarity even with analytics consent", () => {
    expect(
      shouldLoadClarity({
        analytics: true,
        projectId: "clarity-id",
        pathname: "/studio/opportunities",
      }),
    ).toBe(false);
  });

  it("allows public Clarity loading with analytics consent and project ID", () => {
    expect(shouldLoadClarity({ analytics: true, projectId: "clarity-id", pathname: "/" })).toBe(true);
  });
});
