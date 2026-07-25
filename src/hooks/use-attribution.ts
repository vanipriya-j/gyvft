"use client";

import { useMemo } from "react";
import {
  getAttributionSnapshot,
  type AttributionSnapshot,
} from "@/lib/attribution/client";
import type { ConsentState } from "@/lib/consent/client";

export function useAttribution(consent: ConsentState): AttributionSnapshot | undefined {
  const allowAnonymousId = consent.analytics || consent.advertising;
  return useMemo(() => getAttributionSnapshot(allowAnonymousId), [allowAnonymousId]);
}
