"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useConsent } from "@/hooks/use-consent";

type ConsentPreferencesProps = {
  onClose?: () => void;
};

export function ConsentPreferences({ onClose }: ConsentPreferencesProps) {
  const { consent, save } = useConsent();
  const [analytics, setAnalytics] = useState(consent.analytics);
  const [advertising, setAdvertising] = useState(consent.advertising);

  const submit = () => {
    save({ analytics, advertising });
    onClose?.();
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl text-ink">Cookie preferences</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          Necessary cookies keep forms, consent, and security working. Optional analytics and
          advertising tags load only when you choose them.
        </p>
      </div>
      <label className="flex gap-3 rounded-2xl border border-ink/10 p-4">
        <Checkbox checked readOnly />
        <span>
          <span className="block font-semibold text-ink">Necessary</span>
          <span className="text-sm text-ink/65">Always on for core site operation.</span>
        </span>
      </label>
      <label className="flex gap-3 rounded-2xl border border-ink/10 p-4">
        <Checkbox checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} />
        <span>
          <span className="block font-semibold text-ink">Analytics</span>
          <span className="text-sm text-ink/65">Anonymous traffic and journey measurement.</span>
        </span>
      </label>
      <label className="flex gap-3 rounded-2xl border border-ink/10 p-4">
        <Checkbox checked={advertising} onChange={(event) => setAdvertising(event.target.checked)} />
        <span>
          <span className="block font-semibold text-ink">Advertising</span>
          <span className="text-sm text-ink/65">Meta and campaign measurement without PII.</span>
        </span>
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={submit}>Save preferences</Button>
        <Button
          onClick={() => {
            save({ analytics: false, advertising: false });
            onClose?.();
          }}
          variant="secondary"
        >
          Reject optional
        </Button>
      </div>
    </div>
  );
}
