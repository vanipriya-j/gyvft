"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { submitPartnerAction } from "@/actions/public-forms";
import { trackPublicEvent } from "@/components/analytics/AnalyticsProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MERCH_REQUIREMENT_TYPES } from "@/config/constants";
import { useAttribution } from "@/hooks/use-attribution";
import { useConsent } from "@/hooks/use-consent";
import { toConsentSnapshot } from "@/lib/consent/client";
import { partnerFormSchema, type PartnerFormInput } from "@/lib/validation/partner-form";

const DRAFT_KEY = "gyvft.partner-form.v1";
const stepFields: Array<Array<FieldPath<PartnerFormInput>>> = [
  ["full_name", "organisation_name", "work_email", "phone", "preferred_contact_method"],
  ["organisation_size", "primary_locations", "requirement_types"],
  ["annual_occasion_range", "quantity_range", "budget_range", "upcoming_requirement"],
  ["communication_consent"],
];

function defaults(): PartnerFormInput {
  return {
    full_name: "",
    organisation_name: "",
    designation: "",
    work_email: "",
    phone: "",
    preferred_contact_method: "email",
    organisation_size: "Not sure",
    primary_locations: "",
    requirement_types: [],
    annual_occasion_range: "",
    quantity_range: "",
    budget_range: "",
    upcoming_requirement: "",
    additional_context: "",
    communication_consent: true,
    marketing_consent: false,
    honeypot: "",
    idempotency_key: crypto.randomUUID(),
  };
}

export function PartnerForm() {
  const router = useRouter();
  const { consent } = useConsent();
  const attribution = useAttribution(consent);
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<PartnerFormInput>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: useMemo(() => defaults(), []),
    mode: "onTouched",
  });
  const { control, formState, getValues, handleSubmit, register, reset, setValue, trigger } = form;
  const draftValues = useWatch({ control });
  const selected = useWatch({ control, name: "requirement_types" });

  useEffect(() => {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = partnerFormSchema.partial().parse(JSON.parse(raw));
      reset({ ...defaults(), ...draft, idempotency_key: draft.idempotency_key ?? crypto.randomUUID() });
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, [reset]);

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draftValues));
  }, [draftValues]);

  useEffect(() => {
    void trackPublicEvent("partner_form_started", { step: 1 });
  }, []);

  const toggleRequirement = (value: string) => {
    const current = getValues("requirement_types");
    setValue(
      "requirement_types",
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const next = async () => {
    const ok = await trigger(stepFields[step]);
    if (!ok) return;
    void trackPublicEvent("partner_step_completed", { step: step + 1 });
    setStep((current) => Math.min(current + 1, stepFields.length - 1));
  };

  const onSubmit = handleSubmit(async (values) => {
    setIsSubmitting(true);
    setMessage(null);
    const result = await submitPartnerAction({
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
    void trackPublicEvent("partner_form_submitted", { submitted: true });
    router.push("/thank-you");
  });

  return (
    <form className="paper-panel space-y-8 rounded-[2rem] p-5 md:p-8" onSubmit={onSubmit}>
      <Progress label={`Step ${step + 1} of 4`} max={4} value={step + 1} />
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

      {step === 0 ? (
        <div className="grid gap-5 md:grid-cols-2">
          <Field error={formState.errors.full_name?.message} label="Full name">
            <Input {...register("full_name")} />
          </Field>
          <Field error={formState.errors.organisation_name?.message} label="Organisation">
            <Input {...register("organisation_name")} />
          </Field>
          <Field error={formState.errors.designation?.message} label="Designation">
            <Input {...register("designation")} />
          </Field>
          <Field error={formState.errors.work_email?.message} label="Work email">
            <Input type="email" {...register("work_email")} />
          </Field>
          <Field error={formState.errors.phone?.message} label="Phone">
            <Input {...register("phone")} />
          </Field>
          <Field error={formState.errors.preferred_contact_method?.message} label="Preferred contact">
            <Select {...register("preferred_contact_method")}>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="whatsapp">WhatsApp</option>
            </Select>
          </Field>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <Field error={formState.errors.organisation_size?.message} label="Organisation size">
              <Select {...register("organisation_size")}>
                {["1-50", "51-200", "201-1000", "1000+", "Not sure"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <Field error={formState.errors.primary_locations?.message} label="Primary locations">
              <Input placeholder="Mumbai, Delhi, remote teams..." {...register("primary_locations")} />
            </Field>
          </div>
          <div>
            <Label>What do you need?</Label>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {MERCH_REQUIREMENT_TYPES.map((option) => (
                <button
                  className={`focus-ring rounded-2xl border p-4 text-left ${
                    selected.includes(option) ? "border-copper bg-copper/10" : "border-ink/12 bg-paper/70"
                  }`}
                  key={option}
                  onClick={() => toggleRequirement(option)}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
            {formState.errors.requirement_types?.message ? (
              <p className="mt-3 text-sm text-copper-deep">{formState.errors.requirement_types.message}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-5 md:grid-cols-2">
          <Field error={formState.errors.annual_occasion_range?.message} label="Annual occasions">
            <Input placeholder="e.g. 5-8 events or milestones" {...register("annual_occasion_range")} />
          </Field>
          <Field error={formState.errors.quantity_range?.message} label="Quantity range">
            <Input placeholder="e.g. 250-500 kits" {...register("quantity_range")} />
          </Field>
          <Field error={formState.errors.budget_range?.message} label="Budget range">
            <Input placeholder="e.g. 5L-15L" {...register("budget_range")} />
          </Field>
          <Field error={formState.errors.upcoming_requirement?.message} label="Upcoming requirement">
            <Textarea {...register("upcoming_requirement")} />
          </Field>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-5">
          <Field error={formState.errors.additional_context?.message} label="Additional context">
            <Textarea {...register("additional_context")} />
          </Field>
          <label className="flex gap-3">
            <Checkbox {...register("communication_consent")} />
            <span className="text-sm leading-6 text-ink/70">
              I consent to GYVFT contacting me about this partnership enquiry.
            </span>
          </label>
          <label className="flex gap-3">
            <Checkbox {...register("marketing_consent")} />
            <span className="text-sm leading-6 text-ink/70">Send occasional studio notes.</span>
          </label>
        </div>
      ) : null}

      {message ? <p className="rounded-2xl bg-copper/10 p-4 text-sm text-copper-deep">{message}</p> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button disabled={step === 0 || isSubmitting} onClick={() => setStep((current) => current - 1)} type="button" variant="secondary">
          Back
        </Button>
        {step < 3 ? (
          <Button onClick={next} type="button">
            Continue
          </Button>
        ) : (
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Sending..." : "Send partnership enquiry"}
          </Button>
        )}
      </div>
    </form>
  );
}

function Field({ children, error, label }: { children: React.ReactNode; error?: string; label: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-sm text-copper-deep">{error}</p> : null}
    </div>
  );
}
