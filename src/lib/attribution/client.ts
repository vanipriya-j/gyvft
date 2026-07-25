"use client";

export type AttributionSnapshot = {
  anonymousVisitorId: string;
  sessionId: string;
  firstTouchSource?: string | null;
  firstTouchMedium?: string | null;
  firstTouchCampaign?: string | null;
  firstTouchContent?: string | null;
  firstTouchTerm?: string | null;
  firstTouchLandingPage?: string | null;
  firstTouchReferrer?: string | null;
  lastTouchSource?: string | null;
  lastTouchMedium?: string | null;
  lastTouchCampaign?: string | null;
  lastTouchContent?: string | null;
  lastTouchTerm?: string | null;
  lastTouchLandingPage?: string | null;
  deviceCategory?: string | null;
};

const VISITOR_KEY = "gyvft.visitor.v1";
const SESSION_KEY = "gyvft.session.v1";

type StoredTouch = {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;
  landingPage?: string | null;
  referrer?: string | null;
};

type StoredVisitor = {
  anonymousVisitorId: string;
  firstTouch: StoredTouch;
};

type StoredSession = {
  sessionId: string;
  lastTouch: StoredTouch;
  expiresAt: number;
};

function readJson<T>(key: string): T | null {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function collectTouch(): StoredTouch {
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get("utm_source"),
    medium: params.get("utm_medium"),
    campaign: params.get("utm_campaign"),
    content: params.get("utm_content"),
    term: params.get("utm_term"),
    landingPage: `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer || null,
  };
}

function deviceCategory(): string {
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1100) return "tablet";
  return "desktop";
}

export function getAttributionSnapshot(allowAnonymousId: boolean): AttributionSnapshot | undefined {
  if (typeof window === "undefined" || !allowAnonymousId) return undefined;

  const now = Date.now();
  const touch = collectTouch();
  const existingVisitor = readJson<StoredVisitor>(VISITOR_KEY);
  const visitor: StoredVisitor = existingVisitor ?? {
    anonymousVisitorId: crypto.randomUUID(),
    firstTouch: touch,
  };

  const existingSession = readJson<StoredSession>(SESSION_KEY);
  const session: StoredSession =
    existingSession && existingSession.expiresAt > now
      ? { ...existingSession, lastTouch: touch, expiresAt: now + 30 * 60 * 1000 }
      : { sessionId: crypto.randomUUID(), lastTouch: touch, expiresAt: now + 30 * 60 * 1000 };

  window.localStorage.setItem(VISITOR_KEY, JSON.stringify(visitor));
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  return {
    anonymousVisitorId: visitor.anonymousVisitorId,
    sessionId: session.sessionId,
    firstTouchSource: visitor.firstTouch.source,
    firstTouchMedium: visitor.firstTouch.medium,
    firstTouchCampaign: visitor.firstTouch.campaign,
    firstTouchContent: visitor.firstTouch.content,
    firstTouchTerm: visitor.firstTouch.term,
    firstTouchLandingPage: visitor.firstTouch.landingPage,
    firstTouchReferrer: visitor.firstTouch.referrer,
    lastTouchSource: session.lastTouch.source,
    lastTouchMedium: session.lastTouch.medium,
    lastTouchCampaign: session.lastTouch.campaign,
    lastTouchContent: session.lastTouch.content,
    lastTouchTerm: session.lastTouch.term,
    lastTouchLandingPage: session.lastTouch.landingPage,
    deviceCategory: deviceCategory(),
  };
}
