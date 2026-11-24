// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  analyticsConfiguration,
  prepareGoogleAnalytics,
  suspendGoogleAnalytics,
  trackGoogleEvent,
} from "@/lib/analytics/browser";
import { resetConsentForTests, writeConsent } from "@/lib/consent/client";
type TestWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  __gyvftGoogleId?: string;
  __gyvftPage?: string;
  __gyvftReferrer?: string;
};
const w = window as TestWindow;
const commands = () =>
  (w.dataLayer || [])
    .filter((e) => typeof e === "object" && e && "length" in e)
    .map((e) => Array.from(e as ArrayLike<unknown>));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "G-TEST12345");
  vi.stubEnv("NEXT_PUBLIC_GTM_ID", "");
  vi.stubEnv("NEXT_PUBLIC_GA4_DEBUG", "true");
  delete w.dataLayer;
  delete w.gtag;
  delete w.__gyvftGoogleId;
  delete w.__gyvftPage;
  delete w.__gyvftReferrer;
  resetConsentForTests();
  history.replaceState({}, "", "/");
  Object.defineProperty(document, "referrer", {
    configurable: true,
    value: "https://example.com/private?email=person@example.com",
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("GA4 transport", () => {
  it("uses the owner-supplied stream by default and respects an explicit opt-out", () => {
    vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", undefined);
    expect(analyticsConfiguration()).toEqual({
      mode: "ga4",
      id: "G-XFWQJZM0RN",
    });
    vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "");
    expect(analyticsConfiguration()).toBeNull();
  });
  it("sends nothing before analytics consent", () => {
    trackGoogleEvent("page_view");
    expect(w.dataLayer).toBeUndefined();
  });
  it("configures once and forwards one explicit page view without private parameters", () => {
    writeConsent({ analytics: true, advertising: false });
    history.replaceState(
      {},
      "",
      "/account/projects/private-id?view=quote&token=secret",
    );
    trackGoogleEvent("page_view", {
      email: "private@example.com",
      title: "Private gift title",
    });
    prepareGoogleAnalytics();
    expect(commands().filter((c) => c[0] === "config")).toHaveLength(1);
    expect(commands().find((c) => c[0] === "config")?.[2]).toMatchObject({
      send_page_view: false,
    });
    expect(commands().find((c) => c[0] === "set")?.[1]).toMatchObject({
      send_page_view: false,
      page_location:
        window.location.origin + "/account/projects/[id]?view=quote",
      page_referrer: "https://example.com",
    });
    const queued = commands();
    expect(queued.findIndex((c) => c[0] === "set")).toBeLessThan(
      queued.findIndex((c) => c[0] === "js"),
    );
    expect(commands().filter((c) => c[0] === "event")).toHaveLength(1);
    const text = JSON.stringify(commands());
    expect(text).toContain("/account/projects/[id]?view=quote");
    for (const privateValue of [
      "private-id",
      "secret",
      "private@example.com",
      "Private gift title",
    ])
      expect(text).not.toContain(privateValue);
  });
  it("prefers direct GA4 over a second Google Tag Manager installation", () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "GTM-TEST1234");
    expect(analyticsConfiguration()).toEqual({
      mode: "ga4",
      id: "G-TEST12345",
    });
    vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "");
    expect(analyticsConfiguration()).toEqual({
      mode: "gtm",
      id: "GTM-TEST1234",
    });
  });
  it("suppresses operator events and test-host collection by default", () => {
    writeConsent({ analytics: true, advertising: false });
    history.replaceState({}, "", "/operations/requests?request=private");
    trackGoogleEvent("page_view");
    expect(w.dataLayer).toBeUndefined();
    history.replaceState({}, "", "/");
    vi.stubEnv("NEXT_PUBLIC_GA4_DEBUG", "false");
    trackGoogleEvent("page_view");
    expect(w.dataLayer).toBeUndefined();
  });
  it("withdraws tracking consent without removing customer authentication", () => {
    writeConsent({ analytics: true, advertising: false });
    trackGoogleEvent("page_view");
    document.cookie = "_ga=test; Path=/";
    document.cookie = "gyvft_customer_session=keep; Path=/";
    writeConsent({ analytics: false, advertising: false });
    suspendGoogleAnalytics(true);
    expect(
      (window as unknown as Record<string, unknown>)["ga-disable-G-TEST12345"],
    ).toBe(true);
    expect(document.cookie).not.toMatch(/(?:^|; )_ga=/);
    expect(document.cookie).toContain("gyvft_customer_session=keep");
    const before = commands().filter((c) => c[0] === "event").length;
    trackGoogleEvent("sign_up");
    expect(commands().filter((c) => c[0] === "event")).toHaveLength(before);
  });
});
