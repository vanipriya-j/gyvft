"use client";

import { useEffect } from "react";
import { useAttribution } from "@/hooks/use-attribution";
import { useConsent } from "@/hooks/use-consent";
import { toConsentSnapshot } from "@/lib/consent/client";
import { ClarityLoader, GA4Loader, GTMLoader, MetaPixelLoader } from "./loaders";

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

export async function trackPublicEvent(
  eventName: PublicEventName,
  properties: Record<string, string | number | boolean | null> = {},
) {
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        properties,
        sourceRoute: window.location.pathname,
      }),
      keepalive: true,
    });
  } catch {
    // Analytics should never interrupt public flows.
  }
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { consent } = useConsent();
  useAttribution(consent);

  useEffect(() => {
    void trackPublicEvent("page_view", {
      path: window.location.pathname,
      consentAnalytics: toConsentSnapshot(consent).analytics,
    });
  }, [consent]);

  return (
    <>
      {children}
      <GTMLoader analytics={consent.analytics} advertising={consent.advertising} />
      <GA4Loader analytics={consent.analytics} advertising={consent.advertising} />
      <MetaPixelLoader analytics={consent.analytics} advertising={consent.advertising} />
      <ClarityLoader analytics={consent.analytics} advertising={consent.advertising} />
    </>
  );
}
