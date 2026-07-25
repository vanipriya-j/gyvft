"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useConsent } from "@/hooks/use-consent";
import { ConsentPreferences } from "./ConsentPreferences";

export function ConsentBanner() {
  const { hasChoice, isLoaded, save } = useConsent();
  const [showPreferences, setShowPreferences] = useState(false);

  if (!isLoaded || hasChoice) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-4xl rounded-[1.5rem] border border-ink/15 bg-paper/95 p-5 shadow-2xl backdrop-blur md:bottom-6">
      {showPreferences ? (
        <ConsentPreferences onClose={() => setShowPreferences(false)} />
      ) : (
        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-copper-deep">
              Privacy choices
            </p>
            <h2 className="mt-2 font-display text-2xl text-ink">We use careful measurement.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/70">
              Necessary cookies keep the site working. Analytics and advertising tags load only
              with consent, and public form events avoid personal information.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
            <Button onClick={() => save({ analytics: true, advertising: true })}>Accept all</Button>
            <Button onClick={() => save({ analytics: false, advertising: false })} variant="secondary">
              Reject optional
            </Button>
            <Button onClick={() => setShowPreferences(true)} variant="ghost">
              Manage
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
