"use client";

import { readConsent } from "@/lib/consent/client";
import { analyticsPage, googleParameters } from "./model";
import { analyticsConfiguration } from "./config";
export { analyticsConfiguration } from "./config";

type GoogleWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  __gyvftGoogleId?: string;
  __gyvftPage?: string;
  __gyvftReferrer?: string;
};

function allowedHost() {
  return (
    ["gyvft.com", "www.gyvft.com"].includes(window.location.hostname) ||
    process.env.NEXT_PUBLIC_GA4_DEBUG === "true"
  );
}

export function analyticsAllowedHere() {
  return (
    typeof window !== "undefined" &&
    allowedHost() &&
    analyticsPage(window.location.pathname) !== null
  );
}

export function prepareGoogleAnalytics() {
  if (
    typeof window === "undefined" ||
    !readConsent().analytics ||
    !allowedHost()
  )
    return null;
  const page = analyticsPage(window.location.pathname, window.location.search);
  const config = analyticsConfiguration();
  if (!page || !config) return null;
  const w = window as GoogleWindow;
  w.dataLayer ||= [];
  w.gtag ||= function () {
    // eslint-disable-next-line prefer-rest-params -- Google's documented queue expects an Arguments object.
    w.dataLayer!.push(arguments);
  };
  if (config.mode === "ga4") {
    (window as unknown as Record<string, unknown>)[`ga-disable-${config.id}`] =
      false;
    if (w.__gyvftGoogleId !== config.id) {
      w.gtag("consent", "default", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
      // Google's runtime can initialise a stream at the js command, before config.
      // Set the manual-view policy and safe context before enabling that runtime.
      w.gtag("set", {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: window.location.origin + page.path,
        page_title: page.title,
        page_referrer: safeReferrer(),
      });
      w.gtag("consent", "update", {
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
      w.gtag("js", new Date());
      w.gtag("config", config.id, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        ...(process.env.NEXT_PUBLIC_GA4_DEBUG === "true"
          ? { debug_mode: true }
          : {}),
      });
      w.__gyvftGoogleId = config.id;
    } else {
      w.gtag("consent", "update", {
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
    }
  }
  return config;
}

function safeReferrer() {
  try {
    return document.referrer ? new URL(document.referrer).origin : "";
  } catch {
    return "";
  }
}

export function suspendGoogleAnalytics(clearCookies = false) {
  if (typeof window === "undefined") return;
  const config = analyticsConfiguration(),
    w = window as GoogleWindow;
  if (config?.mode === "ga4")
    (window as unknown as Record<string, unknown>)[`ga-disable-${config.id}`] =
      true;
  w.gtag?.("consent", "update", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  if (clearCookies) {
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.trim().split("=")[0];
      if (!/^_ga(?:_|$)/.test(name)) continue;
      for (const domain of ["", window.location.hostname, ".gyvft.com"]) {
        document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ""}; SameSite=Lax`;
      }
    }
    try {
      if (!readConsent().advertising) {
        localStorage.removeItem("gyvft.visitor.v1");
        localStorage.removeItem("gyvft.session.v1");
      }
    } catch {
      /* Storage may be blocked. */
    }
  }
}

export function trackGoogleEvent(
  name: string,
  input: Record<string, unknown> = {},
) {
  try {
    const config = prepareGoogleAnalytics();
    if (!config) return;
    const page = analyticsPage(
      window.location.pathname,
      window.location.search,
    )!;
    const w = window as GoogleWindow;
    const referrer =
      name === "page_view"
        ? w.__gyvftPage && w.__gyvftPage !== page.path
          ? window.location.origin + w.__gyvftPage
          : safeReferrer()
        : w.__gyvftReferrer || safeReferrer();
    const parameters = {
      ...googleParameters(input),
      page_location: window.location.origin + page.path,
      page_title: page.title,
      page_referrer: referrer,
    };
    if (name === "page_view") {
      w.__gyvftPage = page.path;
      w.__gyvftReferrer = referrer;
      // Automatic engagement events inherit the current sanitised page too.
      if (config.mode === "ga4")
        w.gtag?.("set", {
          page_location: parameters.page_location,
          page_title: parameters.page_title,
          page_referrer: referrer,
        });
    }
    if (config.mode === "ga4")
      w.gtag?.("event", name, { ...parameters, send_to: config.id });
    else
      w.dataLayer?.push({
        event: `gyvft_${name}`,
        ...parameters,
        analytics_consent: true,
      });
  } catch {
    /* Tracking must not interrupt any interaction. */
  }
}
