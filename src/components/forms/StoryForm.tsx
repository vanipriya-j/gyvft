"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { submitStoryAction } from "@/actions/public-forms";
import { trackPublicEvent } from "@/components/analytics/AnalyticsProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AUDIENCE_OPTIONS, FORMAT_OPTIONS, OCCASION_TYPES } from "@/config/constants";
import { useAttribution } from "@/hooks/use-attribution";
import { useConsent } from "@/hooks/use-consent";
import { toConsentSnapshot } from "@/lib/consent/client";
import { storyFormSchema, type StoryFormInput } from "@/lib/validation/story-form";

const DRAFT_KEY = "gyvft.story-form.v1";

const quantityRanges = ["1-25", "26-100", "101-500", "500+", "Not sure"];
const budgetRanges = ["Under 1L", "1L-5L", "5L-15L", "15L+", "Not sure"];
const stepFields: Array<Array<FieldPath<StoryFormInput>>> = [
  ["story_description"],
  ["occasion_type", "occasion_other"],
  ["audiences"],
  ["preferred_formats"],
  ["target_date", "target_date_precision", "quantity_range", "budget_range"],
  ["primary_city", "multiple_locations", "location_notes"],
  ["full_name", "email", "phone", "preferred_contact_method", "communication_consent"],
];

function defaultValues(): StoryFormInput {
  return {
    story_description: "",
    occasion_type: "Birthday",
    occasion_other: "",
    audiences: [],
    preferred_formats: [],
    target_date: "",
    target_date_precision: "flexible",
    quantity_range: "",
    budget_range: "",
    primary_city: "",
    multiple_locations: false,
    location_notes: "",
    full_name: "",
    organisation_name: "",
    designation: "",
    email: "",
    phone: "",
    preferred_contact_method: "email",
    communication_consent: true,
    marketing_consent: false,
    honeypot: "",
    idempotency_key: crypto.randomUUID(),
  };
}

export function StoryForm() {
  const router = useRouter();
  const { consent } = useConsent();
  const attribution = useAttribution(consent);
  const [step, setStep] = useState(0);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<StoryFormInput>({
    resolver: zodResolver(storyFormSchema),
    defaultValues: useMemo(() => defaultValues(), []),
    mode: "onTouched",
  });

  const {
    formState: { errors },
    control,
    getValues,
    handleSubmit,
    register,
    reset,
    setValue,
    trigger,
  } = form;
  const draftValues = useWatch({ control });
  const watchedAudiences = useWatch({ control, name: "audiences" });
  const watchedFormats = useWatch({ control, name: "preferred_formats" });

  useEffect(() => {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = storyFormSchema.partial().parse(JSON.parse(raw));
      reset({ ...defaultValues(), ...draft, idempotency_key: draft.idempotency_key ?? crypto.randomUUID() });
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, [reset]);

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draftValues));
  }, [draftValues]);

  useEffect(() => {
    void trackPublicEvent("story_form_started", { step: 1 });
  }, []);

  useEffect(() => {
    void trackPublicEvent("story_step_viewed", { step: step + 1 });
  }, [step]);

  const toggleArray = (name: "audiences" | "preferred_formats", value: string) => {
    const current = getValues(name);
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    setValue(name, next, { shouldDirty: true, shouldValidate: true });
  };

  const continueStep = async () => {
    const ok = await trigger(stepFields[step]);
    if (!ok) return;
    void trackPublicEvent("story_step_completed", { step: step + 1 });
    setStep((current) => Math.min(current + 1, stepFields.length - 1));
  };

  const backStep = () => {
    void trackPublicEvent("story_step_back", { step: step + 1 });
    setStep((current) => Math.max(current - 1, 0));
  };

  const onSubmit = handleSubmit(async (values) => {
    setIsSubmitting(true);
    setFormMessage(null);
    void trackPublicEvent("story_form_reviewed", { steps: stepFields.length });
    const result = await submitStoryAction({
      ...values,
      attribution,
      consent: toConsentSnapshot(consent),
      honeypot: values.honeypot ?? "",
    });
    setIsSubmitting(false);
    if (!result.ok) {
      setFormMessage(result.message);
      void trackPublicEvent("story_form_error", { reason: "validation_or_submit" });
      return;
    }
    window.localStorage.removeItem(DRAFT_KEY);
    void trackPublicEvent("story_form_submitted", { submitted: true });
    router.push("/thank-you");
  });

  return (
    <form className="paper-panel space-y-8 rounded-[2rem] p-5 md:p-8" onSubmit={onSubmit}>
      <Progress label={`Step ${step + 1} of 7`} max={7} value={step + 1} />
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
        <Field label="What story should we help tell?" error={errors.story_description?.message}>
          <Textarea
            placeholder="Share the people, place, milestone, or memory. A few generous paragraphs are welcome."
            {...register("story_description")}
          />
        </Field>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Occasion" error={errors.occasion_type?.message}>
            <Select {...register("occasion_type")}>
              {OCCASION_TYPES.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </Select>
          </Field>
          <Field label="If other, tell us more" error={errors.occasion_other?.message}>
            <Input {...register("occasion_other")} />
          </Field>
        </div>
      ) : null}

      {step === 2 ? (
        <ChoiceGrid
          error={errors.audiences?.message}
          label="Who is this for?"
          onToggle={(value) => toggleArray("audiences", value)}
          options={AUDIENCE_OPTIONS}
          selected={watchedAudiences}
        />
      ) : null}

      {step === 3 ? (
        <ChoiceGrid
          error={errors.preferred_formats?.message}
          label="What could it become?"
          onToggle={(value) => toggleArray("preferred_formats", value)}
          options={FORMAT_OPTIONS}
          selected={watchedFormats}
        />
      ) : null}

      {step === 4 ? (
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Target date" error={errors.target_date?.message}>
            <Input type="date" {...register("target_date")} />
          </Field>
          <Field label="Date precision" error={errors.target_date_precision?.message}>
            <Select {...register("target_date_precision")}>
              {["exact", "month", "quarter", "flexible"].map((option) => (
                <option key={option}>{option}</option>
              ))}
            </Select>
          </Field>
          <Field label="Quantity range" error={errors.quantity_range?.message}>
            <Select {...register("quantity_range")}>
              <option value="">Select range</option>
              {quantityRanges.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </Select>
          </Field>
          <Field label="Budget range" error={errors.budget_range?.message}>
            <Select {...register("budget_range")}>
              <option value="">Select range</option>
              {budgetRanges.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </Select>
          </Field>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="space-y-5">
          <Field label="Primary city" error={errors.primary_city?.message}>
            <Input {...register("primary_city")} />
          </Field>
          <label className="flex gap-3 text-ink/75">
            <Checkbox {...register("multiple_locations")} />
            Multiple locations
          </label>
          <Field label="Location notes" error={errors.location_notes?.message}>
            <Textarea {...register("location_notes")} />
          </Field>
        </div>
      ) : null}

      {step === 6 ? (
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Full name" error={errors.full_name?.message}>
            <Input {...register("full_name")} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" {...register("email")} />
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            <Input {...register("phone")} />
          </Field>
          <Field label="Preferred contact" error={errors.preferred_contact_method?.message}>
            <Select {...register("preferred_contact_method")}>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="whatsapp">WhatsApp</option>
            </Select>
          </Field>
          <Field label="Organisation" error={errors.organisation_name?.message}>
            <Input {...register("organisation_name")} />
          </Field>
          <Field label="Designation" error={errors.designation?.message}>
            <Input {...register("designation")} />
          </Field>
          <label className="flex gap-3 md:col-span-2">
            <Checkbox {...register("communication_consent")} />
            <span className="text-sm leading-6 text-ink/70">
              I consent to GYVFT contacting me about this enquiry.
            </span>
          </label>
          <label className="flex gap-3 md:col-span-2">
            <Checkbox {...register("marketing_consent")} />
            <span className="text-sm leading-6 text-ink/70">
              I would like occasional notes from GYVFT.
            </span>
          </label>
        </div>
      ) : null}

      {formMessage ? <p className="rounded-2xl bg-copper/10 p-4 text-sm text-copper-deep">{formMessage}</p> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button disabled={step === 0 || isSubmitting} onClick={backStep} type="button" variant="secondary">
          Back
        </Button>
        {step < 6 ? (
          <Button onClick={continueStep} type="button">
            Continue
          </Button>
        ) : (
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Sending..." : "Send story"}
          </Button>
        )}
      </div>
    </form>
  );
}

function Field({
  children,
  error,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-sm text-copper-deep">{error}</p> : null}
    </div>
  );
}

function ChoiceGrid({
  error,
  label,
  onToggle,
  options,
  selected,
}: {
  error?: string;
  label: string;
  onToggle: (value: string) => void;
  options: readonly string[];
  selected: string[];
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {options.map((option) => (
          <button
            className={`focus-ring rounded-2xl border p-4 text-left transition ${
              selected.includes(option)
                ? "border-copper bg-copper/10 text-copper-deep"
                : "border-ink/12 bg-paper/70 text-ink/72"
            }`}
            key={option}
            onClick={() => onToggle(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-copper-deep">{error}</p> : null}
    </div>
  );
}
