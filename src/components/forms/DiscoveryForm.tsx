"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { submitDiscoveryAction } from "@/actions/public-forms";
import { trackPublicEvent } from "@/components/analytics/AnalyticsProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAttribution } from "@/hooks/use-attribution";
import { useConsent } from "@/hooks/use-consent";
import { toConsentSnapshot } from "@/lib/consent/client";
import { discoveryFormSchema, type DiscoveryFormInput } from "@/lib/validation/discovery-form";

const DRAFT_KEY = "gyvft.discovery-form.v1";

function defaults(): DiscoveryFormInput {
  return {
    full_name: "",
    organisation_name: "",
    email: "",
    phone: "",
    discussion_topic: "",
    occasion_or_requirement: "",
    timeline: "",
    preferred_contact_method: "email",
    communication_consent: true,
    honeypot: "",
    idempotency_key: crypto.randomUUID(),
  };
}

export function DiscoveryForm() {
  const router = useRouter();
  const { consent } = useConsent();
  const attribution = useAttribution(consent);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<DiscoveryFormInput>({
    resolver: zodResolver(discoveryFormSchema),
    defaultValues: useMemo(() => defaults(), []),
    mode: "onTouched",
  });
  const { control, formState, handleSubmit, register, reset, setValue } = form;
  const draftValues = useWatch({ control });

  useEffect(() => {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = discoveryFormSchema.partial().parse(JSON.parse(raw));
      reset({ ...defaults(), ...draft, idempotency_key: draft.idempotency_key ?? crypto.randomUUID() });
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, [reset]);

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draftValues));
  }, [draftValues]);

  useEffect(() => {
    void trackPublicEvent("discovery_form_started", { started: true });
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    setIsSubmitting(true);
    setMessage(null);
    const result = await submitDiscoveryAction({
      ...values,
      attribution,
      consent: toConsentSnapshot(consent),
      honeypot: values.honeypot ?? "",
    });
    setIsSubmitting(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    window.localStorage.removeItem(DRAFT_KEY);
    void trackPublicEvent("discovery_requested", { submitted: true });
    router.push("/thank-you");
  });

  return (
    <form className="paper-panel grid gap-5 rounded-[2rem] p-5 md:grid-cols-2 md:p-8" onSubmit={onSubmit}>
      <input
        aria-hidden="true"
        className="hidden"
        name="website/company_url"
        tabIndex={-1}
        type="text"
        onChange={(event) => setValue("honeypot", event.target.value)}
      />
      <input type="hidden" {...register("honeypot")} />
      <input type="hidden" {...register("idempotency_key")} />
      <Field error={formState.errors.full_name?.message} label="Full name">
        <Input {...register("full_name")} />
      </Field>
      <Field error={formState.errors.organisation_name?.message} label="Organisation">
        <Input {...register("organisation_name")} />
      </Field>
      <Field error={formState.errors.email?.message} label="Email">
        <Input type="email" {...register("email")} />
      </Field>
      <Field error={formState.errors.phone?.message} label="Phone">
        <Input {...register("phone")} />
      </Field>
      <Field error={formState.errors.occasion_or_requirement?.message} label="Occasion or requirement">
        <Input {...register("occasion_or_requirement")} />
      </Field>
      <Field error={formState.errors.timeline?.message} label="Timeline">
        <Input placeholder="Flexible, next month, Q3..." {...register("timeline")} />
      </Field>
      <Field error={formState.errors.preferred_contact_method?.message} label="Preferred contact">
        <Select {...register("preferred_contact_method")}>
          <option value="email">Email</option>
          <option value="phone">Phone</option>
          <option value="whatsapp">WhatsApp</option>
        </Select>
      </Field>
      <Field className="md:col-span-2" error={formState.errors.discussion_topic?.message} label="What should we discuss?">
        <Textarea {...register("discussion_topic")} />
      </Field>
      <label className="flex gap-3 md:col-span-2">
        <Checkbox {...register("communication_consent")} />
        <span className="text-sm leading-6 text-ink/70">
          I consent to GYVFT contacting me about this discovery request.
        </span>
      </label>
      {message ? <p className="rounded-2xl bg-copper/10 p-4 text-sm text-copper-deep md:col-span-2">{message}</p> : null}
      <Button className="md:col-span-2 md:w-fit" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Sending..." : "Request discovery"}
      </Button>
    </form>
  );
}

function Field({
  children,
  className,
  error,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  error?: string;
  label: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <div className="mt-2">{children}</div>
      {error ? <p className="mt-2 text-sm text-copper-deep">{error}</p> : null}
    </div>
  );
}
