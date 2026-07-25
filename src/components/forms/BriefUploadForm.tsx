"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { submitBriefUploadAction } from "@/actions/public-forms";
import { trackPublicEvent } from "@/components/analytics/AnalyticsProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAttribution } from "@/hooks/use-attribution";
import { useConsent } from "@/hooks/use-consent";
import { toConsentSnapshot } from "@/lib/consent/client";

const DRAFT_KEY = "gyvft.brief-upload.v1";

const briefSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  organisation_name: z.string().trim().max(200).optional().nullable(),
  designation: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(40),
  brief_title: z.string().trim().min(4).max(180),
  brief_context: z.string().trim().min(10).max(5000),
  timeline: z.string().trim().min(2).max(200),
  budget_range: z.string().trim().min(1).max(120),
  preferred_contact_method: z.enum(["email", "phone", "whatsapp"]),
  communication_consent: z.literal(true),
  honeypot: z.string().max(0).optional().nullable(),
  idempotency_key: z.string().uuid(),
});

type BriefInput = z.infer<typeof briefSchema>;

function defaults(): BriefInput {
  return {
    full_name: "",
    organisation_name: "",
    designation: "",
    email: "",
    phone: "",
    brief_title: "",
    brief_context: "",
    timeline: "",
    budget_range: "",
    preferred_contact_method: "email",
    communication_consent: true,
    honeypot: "",
    idempotency_key: crypto.randomUUID(),
  };
}

export function BriefUploadForm() {
  const router = useRouter();
  const { consent } = useConsent();
  const attribution = useAttribution(consent);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<BriefInput>({
    resolver: zodResolver(briefSchema),
    defaultValues: useMemo(() => defaults(), []),
    mode: "onTouched",
  });
  const { control, formState, handleSubmit, register, reset, setValue } = form;
  const draftValues = useWatch({ control });

  useEffect(() => {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = briefSchema.partial().parse(JSON.parse(raw));
      reset({ ...defaults(), ...draft, idempotency_key: draft.idempotency_key ?? crypto.randomUUID() });
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, [reset]);

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draftValues));
  }, [draftValues]);

  const onSubmit = handleSubmit(async (values) => {
    if (!file) {
      setMessage("Please attach a PDF, DOCX, PNG, JPG, or WEBP brief.");
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    setProgress(18);
    void trackPublicEvent("brief_upload_started", { hasFile: true });
    const progressTimer = window.setInterval(() => {
      setProgress((current) => Math.min(current + 12, 90));
    }, 300);

    const body = new FormData();
    body.set("file", file);
    body.set(
      "metadata",
      JSON.stringify({
        ...values,
        attribution,
        consent: toConsentSnapshot(consent),
        honeypot: values.honeypot ?? "",
      }),
    );

    const result = await submitBriefUploadAction(body);
    window.clearInterval(progressTimer);
    setIsSubmitting(false);

    if (!result.ok) {
      setProgress(0);
      setMessage(result.message);
      void trackPublicEvent("brief_upload_failed", { reason: "submit_failed" });
      return;
    }

    setProgress(100);
    window.localStorage.removeItem(DRAFT_KEY);
    void trackPublicEvent("brief_upload_completed", { submitted: true });
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
      <Field error={formState.errors.designation?.message} label="Designation">
        <Input {...register("designation")} />
      </Field>
      <Field error={formState.errors.email?.message} label="Email">
        <Input type="email" {...register("email")} />
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
      <Field error={formState.errors.brief_title?.message} label="Brief title">
        <Input {...register("brief_title")} />
      </Field>
      <Field error={formState.errors.timeline?.message} label="Timeline">
        <Input {...register("timeline")} />
      </Field>
      <Field error={formState.errors.budget_range?.message} label="Budget range">
        <Input {...register("budget_range")} />
      </Field>
      <Field className="md:col-span-2" error={formState.errors.brief_context?.message} label="Context">
        <Textarea {...register("brief_context")} />
      </Field>
      <div className="md:col-span-2">
        <Label>Brief file</Label>
        <Input
          accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp"
          className="mt-2"
          type="file"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setProgress(event.target.files?.[0] ? 8 : 0);
          }}
        />
        <p className="mt-2 text-sm text-ink/55">PDF, DOCX, PNG, JPG, or WEBP up to the configured upload limit.</p>
      </div>
      {progress > 0 ? (
        <Progress className="md:col-span-2" label="Upload progress" value={progress} />
      ) : null}
      <label className="flex gap-3 md:col-span-2">
        <Checkbox {...register("communication_consent")} />
        <span className="text-sm leading-6 text-ink/70">
          I consent to GYVFT contacting me about this brief.
        </span>
      </label>
      {message ? <p className="rounded-2xl bg-copper/10 p-4 text-sm text-copper-deep md:col-span-2">{message}</p> : null}
      <Button className="md:col-span-2 md:w-fit" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Uploading..." : "Upload brief"}
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
