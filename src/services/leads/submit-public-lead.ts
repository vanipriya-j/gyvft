import "server-only";
import { headers } from "next/headers";
import { AppError } from "@/lib/errors/app-error";
import {
  assertPublicFormRateLimit,
  findIdempotentSubmission,
  rememberIdempotentSubmission,
} from "@/lib/security/memory-guards";
import { escapeHtml, formatFieldValue, isPresent } from "@/lib/security/sanitize";
import {
  getPublicLeadsInbox,
  logAckFailure,
  sendPublicResendEmail,
  type PublicEmailAttachment,
} from "@/services/email/public-resend";

export type PublicFormKey =
  | "tell_your_story"
  | "become_a_merch_partner"
  | "book_a_discovery"
  | "upload_a_brief";

type AttributionLike = {
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
  lastTouchReferrer?: string | null;
  deviceCategory?: string | null;
};

const FORM_NAMES: Record<PublicFormKey, string> = {
  tell_your_story: "Tell Your Story",
  become_a_merch_partner: "Story & Merch Partner",
  book_a_discovery: "Book a Discovery",
  upload_a_brief: "Upload a Brief",
};

const ACK_SUBJECT = "We received your story | GYVFT";
const ACK_TEXT = [
  "Thank you for reaching out to GYVFT.",
  "",
  "We have received your submission and will get in touch to understand it better.",
  "",
  "Your story. Our telling.",
  "",
  "GYVFT",
  "Created by the team behind Aarla.",
].join("\n");

const ACK_HTML = `
<p>Thank you for reaching out to GYVFT.</p>
<p>We have received your submission and will get in touch to understand it better.</p>
<p><em>Your story. Our telling.</em></p>
<p>GYVFT<br/>Created by the team behind Aarla.</p>
`.trim();

function assertNotBot(honeypot: string | null | undefined) {
  if (honeypot && honeypot.trim().length > 0) {
    throw new AppError("FORBIDDEN", "Submission rejected.", { expose: true, status: 403 });
  }
}

async function requestContext() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const referrer = h.get("referer") || h.get("referrer") || null;
  return { ip, referrer };
}

function buildInternalSubject(formKey: PublicFormKey, fields: Record<string, unknown>): string {
  const name = String(fields.full_name ?? fields.name ?? "Unknown").trim() || "Unknown";
  const organisation =
    String(fields.organisation_name ?? fields.organisation ?? "Unknown").trim() || "Unknown";

  switch (formKey) {
    case "tell_your_story":
      return `New GYVFT Story Lead — ${name}`;
    case "become_a_merch_partner":
      return `New GYVFT Story & Merch Partner Lead — ${organisation}`;
    case "book_a_discovery":
      return `New GYVFT Discovery Lead — ${name}`;
    case "upload_a_brief":
      return `New GYVFT Brief Upload — ${name}`;
    default:
      return `New GYVFT Lead — ${name}`;
  }
}

function fieldRows(fields: Record<string, unknown>): Array<[string, string]> {
  const labels: Array<[string, string]> = [
    ["full_name", "Name"],
    ["email", "Email"],
    ["work_email", "Work email"],
    ["phone", "Phone / WhatsApp"],
    ["organisation_name", "Organisation"],
    ["designation", "Designation"],
    ["preferred_contact_method", "Preferred contact method"],
    ["story_description", "Story"],
    ["occasion_type", "Occasion"],
    ["occasion_other", "Occasion (other)"],
    ["audiences", "Audiences"],
    ["preferred_formats", "Preferred formats"],
    ["target_date", "Target date"],
    ["target_date_precision", "Date precision"],
    ["quantity_range", "Quantity range"],
    ["budget_range", "Budget range"],
    ["primary_city", "Primary city"],
    ["multiple_locations", "Multiple locations"],
    ["location_notes", "Location notes"],
    ["organisation_size", "Organisation size"],
    ["primary_locations", "Primary locations"],
    ["requirement_types", "Requirement types"],
    ["annual_occasion_range", "Annual occasion range"],
    ["upcoming_requirement", "Upcoming requirement"],
    ["additional_context", "Additional context"],
    ["discussion_topic", "Discussion topic"],
    ["occasion_or_requirement", "Occasion or requirement"],
    ["timeline", "Timeline"],
    ["brief_title", "Brief title"],
    ["brief_context", "Brief context"],
    ["communication_consent", "Communication consent"],
    ["marketing_consent", "Marketing consent"],
  ];

  const rows: Array<[string, string]> = [];
  for (const [key, label] of labels) {
    if (!(key in fields)) continue;
    const value = fields[key];
    if (!isPresent(value)) continue;
    rows.push([label, formatFieldValue(value)]);
  }
  return rows;
}

function utmRows(attribution?: AttributionLike | null): Array<[string, string]> {
  if (!attribution) return [];
  const mapping: Array<[keyof AttributionLike, string]> = [
    ["firstTouchSource", "UTM source (first)"],
    ["firstTouchMedium", "UTM medium (first)"],
    ["firstTouchCampaign", "UTM campaign (first)"],
    ["firstTouchContent", "UTM content (first)"],
    ["firstTouchTerm", "UTM term (first)"],
    ["firstTouchLandingPage", "Landing page (first)"],
    ["lastTouchSource", "UTM source (last)"],
    ["lastTouchMedium", "UTM medium (last)"],
    ["lastTouchCampaign", "UTM campaign (last)"],
    ["lastTouchContent", "UTM content (last)"],
    ["lastTouchTerm", "UTM term (last)"],
    ["lastTouchLandingPage", "Landing page (last)"],
    ["deviceCategory", "Device"],
  ];
  const rows: Array<[string, string]> = [];
  for (const [key, label] of mapping) {
    const value = attribution[key];
    if (!isPresent(value)) continue;
    rows.push([label, formatFieldValue(value)]);
  }
  return rows;
}

function buildInternalBodies(input: {
  formKey: PublicFormKey;
  submittedAt: string;
  fields: Record<string, unknown>;
  attribution?: AttributionLike | null;
  referrer?: string | null;
  attachmentName?: string | null;
}) {
  const rows: Array<[string, string]> = [
    ["Form name", FORM_NAMES[input.formKey]],
    ["Submitted time", input.submittedAt],
    ...fieldRows(input.fields),
    ...utmRows(input.attribution),
  ];

  const attributionReferrer = input.attribution?.firstTouchReferrer || input.attribution?.lastTouchReferrer;
  const referrer = input.referrer || attributionReferrer;
  if (isPresent(referrer)) rows.push(["Referrer", formatFieldValue(referrer)]);
  if (isPresent(input.attachmentName)) rows.push(["Attached file", formatFieldValue(input.attachmentName)]);

  const text = rows.map(([label, value]) => `${label}: ${value}`).join("\n");
  const html = `
    <h2>${escapeHtml(FORM_NAMES[input.formKey])}</h2>
    <table cellpadding="6" cellspacing="0" border="0">
      ${rows
        .map(
          ([label, value]) =>
            `<tr><td style="vertical-align:top;font-weight:600">${escapeHtml(label)}</td><td>${escapeHtml(value).replaceAll("\n", "<br/>")}</td></tr>`,
        )
        .join("")}
    </table>
  `.trim();

  return { text, html };
}

function visitorEmail(fields: Record<string, unknown>): string {
  const email = fields.email ?? fields.work_email;
  return String(email ?? "").trim();
}

export async function submitPublicLead(input: {
  formKey: PublicFormKey;
  idempotencyKey: string;
  honeypot?: string | null;
  fields: Record<string, unknown>;
  attribution?: AttributionLike | null;
  attachment?: PublicEmailAttachment | null;
}): Promise<{ submissionId: string }> {
  assertNotBot(input.honeypot);

  const { ip, referrer } = await requestContext();
  assertPublicFormRateLimit({ ip, formKey: input.formKey });

  const existing = findIdempotentSubmission(input.idempotencyKey);
  if (existing) {
    return { submissionId: existing };
  }

  const submissionId = crypto.randomUUID();
  const submittedAt = new Date().toISOString();
  const replyTo = visitorEmail(input.fields);
  if (!replyTo) {
    throw new AppError("VALIDATION_ERROR", "A valid email address is required.", { expose: true });
  }

  const subject = buildInternalSubject(input.formKey, input.fields);
  const bodies = buildInternalBodies({
    formKey: input.formKey,
    submittedAt,
    fields: input.fields,
    attribution: input.attribution,
    referrer,
    attachmentName: input.attachment?.filename,
  });

  try {
    await sendPublicResendEmail({
      to: getPublicLeadsInbox(),
      subject,
      text: bodies.text,
      html: bodies.html,
      replyTo,
      attachments: input.attachment ? [input.attachment] : undefined,
    });
  } catch {
    throw new AppError(
      "INTEGRATION_ERROR",
      "We could not send your submission just now. Please try again.",
      { expose: true },
    );
  }

  try {
    await sendPublicResendEmail({
      to: replyTo,
      subject: ACK_SUBJECT,
      text: ACK_TEXT,
      html: ACK_HTML,
    });
  } catch (error) {
    logAckFailure(input.formKey, error);
  }

  rememberIdempotentSubmission(input.idempotencyKey, submissionId);
  return { submissionId };
}

/** Exported for unit tests */
export const __testables = {
  buildInternalSubject,
  buildInternalBodies,
  ACK_SUBJECT,
  ACK_TEXT,
};
