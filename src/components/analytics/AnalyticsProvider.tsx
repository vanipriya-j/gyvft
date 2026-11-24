"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useConsent } from "@/hooks/use-consent";
import { readConsent } from "@/lib/consent/client";
import { getAttributionSnapshot } from "@/lib/attribution/client";
import { analyticsPage, googleParameters } from "@/lib/analytics/model";
import {
  analyticsAllowedHere,
  suspendGoogleAnalytics,
  trackGoogleEvent,
} from "@/lib/analytics/browser";
import {
  ClarityLoader,
  GA4Loader,
  GTMLoader,
  MetaPixelLoader,
} from "./loaders";

export type PublicEventName =
  | "page_view"
  | "cta_clicked"
  | "story_form_started"
  | "story_step_viewed"
  | "story_step_completed"
  | "story_step_back"
  | "story_form_reviewed"
  | "story_form_error"
  | "story_form_submitted"
  | "partner_page_viewed"
  | "partner_form_started"
  | "partner_step_completed"
  | "partner_form_submitted"
  | "brief_upload_started"
  | "brief_upload_completed"
  | "brief_upload_failed"
  | "discovery_form_started"
  | "discovery_requested"
  | "whatsapp_clicked"
  | "email_clicked"
  | "landing_page_viewed";

export type ConversionEvent =
  | "sign_up"
  | "login"
  | "gift_brief_started"
  | "gift_brief_saved"
  | "gift_brief_submitted"
  | "gift_quote_requested"
  | "shop_aarla";
export function trackConversionEvent(event: ConversionEvent) {
  trackGoogleEvent(
    event,
    event === "sign_up" || event === "login"
      ? { method: "email" }
      : event.startsWith("gift_brief")
        ? { form_name: "gift_brief" }
        : {},
  );
}

export async function trackPublicEvent(
  eventName: PublicEventName,
  properties: Record<string, string | number | boolean | null> = {},
) {
  if (
    typeof window === "undefined" ||
    !readConsent().analytics ||
    !analyticsAllowedHere()
  )
    return;
  const page = analyticsPage(window.location.pathname, window.location.search);
  if (!page) return;
  const lead = [
    "story_form_submitted",
    "partner_form_submitted",
    "discovery_requested",
  ].includes(eventName);
  trackGoogleEvent(lead ? "generate_lead" : eventName, {
    ...properties,
    form_name: eventName.startsWith("partner")
      ? "partner"
      : eventName.startsWith("discovery")
        ? "discovery"
        : "story",
  });
  try {
    let attribution: ReturnType<typeof getAttributionSnapshot>;
    try {
      attribution = getAttributionSnapshot(true);
    } catch {
      /* Optional storage. */
    }
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        properties: { ...googleParameters(properties), consentAnalytics: true },
        sourceRoute: page.path.split("?")[0],
        anonymousVisitorId: attribution?.anonymousVisitorId,
        sessionId: attribution?.sessionId,
      }),
      keepalive: true,
    });
  } catch {
    // Analytics should never interrupt public flows.
  }
}

function RouteAnalytics() {
  const pathname = usePathname(),
    params = useSearchParams();
  const { consent } = useConsent();
  const last = useRef("");
  const query = params.toString();
  useEffect(() => {
    const page = analyticsPage(pathname, query);
    if (!consent.analytics || !page) {
      last.current = "";
      suspendGoogleAnalytics(!consent.analytics);
      return;
    }
    if (last.current === page.path) return;
    last.current = page.path;
    void trackPublicEvent("page_view");
    if (pathname === "/account/gifts/new")
      trackConversionEvent("gift_brief_started");
  }, [pathname, query, consent.analytics]);
  return null;
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { consent } = useConsent();
  const allowed = analyticsPage(pathname) !== null;
  useEffect(() => {
    if (!consent.analytics || !allowed) return;
    function clicked(event: MouseEvent) {
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (!link) return;
      const url = new URL(link.getAttribute("href")!, window.location.origin);
      const cta =
        url.pathname === "/account/login"
          ? url.searchParams.get("mode") === "signup"
            ? "create_account"
            : "sign_in"
          : url.pathname === "/account/gifts/new"
            ? "start_gift"
            : url.pathname.startsWith("/stories/")
              ? "view_story"
              : null;
      if (cta) void trackPublicEvent("cta_clicked", { cta_name: cta });
    }
    document.addEventListener("click", clicked);
    return () => document.removeEventListener("click", clicked);
  }, [allowed, consent.analytics]);

  return (
    <>
      {children}
      <Suspense fallback={null}>
        <RouteAnalytics />
      </Suspense>
      <GTMLoader
        analytics={allowed && consent.analytics}
        advertising={allowed && consent.advertising}
      />
      <GA4Loader
        analytics={allowed && consent.analytics}
        advertising={allowed && consent.advertising}
      />
      {!pathname.startsWith("/account") && allowed ? (
        <>
          <MetaPixelLoader
            analytics={consent.analytics}
            advertising={consent.advertising}
          />
          <ClarityLoader
            analytics={consent.analytics}
            advertising={consent.advertising}
          />
        </>
      ) : null}
    </>
  );
}
