"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useConsent } from "@/hooks/use-consent";
import { ConsentPreferences } from "./ConsentPreferences";

export function ConsentBanner() {
  const { hasChoice, isLoaded, save } = useConsent();
  const [showPreferences, setShowPreferences] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!isLoaded || hasChoice || dismissed) return null;

  const choose = (input: { analytics: boolean; advertising: boolean }) => {
    save(input);
    setDismissed(true);
  };

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-5xl rounded-xl border border-ink/15 bg-paper/95 p-4 shadow-xl backdrop-blur md:bottom-5"
      role="region"
      aria-label="Privacy choices"
    >
      {showPreferences ? (
        <ConsentPreferences
          onClose={() => setShowPreferences(false)}
          onSaved={() => setDismissed(true)}
        />
      ) : (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
          <div>
            <p className="text-sm font-semibold text-ink">Privacy choices</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink/70">
              Necessary cookies keep GYVFT working. Optional analytics and
              advertising load only with your permission.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              className="px-3"
              onClick={() => choose({ analytics: true, advertising: true })}
            >
              Accept all
            </Button>
            <Button
              className="px-3"
              onClick={() => choose({ analytics: false, advertising: false })}
              variant="secondary"
            >
              Reject optional
            </Button>
            <Button
              className="px-3"
              onClick={() => setShowPreferences(true)}
              variant="ghost"
            >
              Manage
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
