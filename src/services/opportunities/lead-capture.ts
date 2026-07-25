import "server-only";
import { randomUUID } from "crypto";
import type { JSONValue } from "postgres";
import { getSql, withTransaction } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging/logger";
import type { DiscoveryFormInput } from "@/lib/validation/discovery-form";
import type { PartnerFormInput } from "@/lib/validation/partner-form";
import type { StoryFormInput } from "@/lib/validation/story-form";
import { createActivity } from "@/repositories/activities";
import {
  findCampaignIdByUtm,
  upsertVisitorAndAttribution,
} from "@/repositories/attribution";
import { createOrMatchContact } from "@/repositories/contacts";
import { recordAnalyticsEvent } from "@/repositories/events";
import { createOrMatchOrganisation } from "@/repositories/organisations";
import {
  createOpportunity,
  findByIdempotencyKey,
} from "@/repositories/opportunities";
import { createTask } from "@/repositories/tasks";
import { generateOpportunitySummary } from "@/services/ai/summary";
import { sendConversionEvent } from "@/services/meta/conversions";
import { sendTransactionalEmail } from "@/services/email/send";
import { dispatchWebhooks } from "@/services/webhooks/dispatch";
import type { AttributionSnapshot, Opportunity } from "@/types/domain";

async function getDefaultAssigneeId(): Promise<string | null> {
  const sql = getSql();
  const settings = await sql<{ default_opportunity_owner_id: string | null }[]>`
    SELECT default_opportunity_owner_id FROM workspace_settings LIMIT 1
  `;
  if (settings[0]?.default_opportunity_owner_id) {
    return settings[0].default_opportunity_owner_id;
  }
  const owner = await sql<{ id: string }[]>`
    SELECT id FROM profiles
    WHERE role = 'owner' AND is_active = TRUE AND deleted_at IS NULL
    ORDER BY created_at ASC
    LIMIT 1
  `;
  return owner[0]?.id ?? null;
}

async function saveSubmission(
  opportunityId: string,
  formKey: string,
  payload: unknown,
  idempotencyKey: string,
) {
  const sql = getSql();
  await sql`
    INSERT INTO opportunity_submissions (opportunity_id, form_key, payload, idempotency_key)
    VALUES (
      ${opportunityId}::uuid,
      ${formKey},
      ${sql.json(payload as JSONValue)},
      ${idempotencyKey}
    )
    ON CONFLICT (idempotency_key) DO NOTHING
  `;
}

async function runSecondaryEffects(options: {
  opportunity: Opportunity;
  eventName: string;
  eventId: string;
  correlationId: string;
  emailTemplate: string;
  toEmail: string;
  toName: string;
  attribution?: AttributionSnapshot;
  consentAdvertising?: boolean;
  consentAnalytics?: boolean;
  allowAi?: boolean;
  submissionForAi?: Record<string, unknown>;
}) {
  const secondaryErrors: Array<{ step: string; message: string }> = [];

  try {
    await recordAnalyticsEvent({
      eventName: options.eventName,
      eventId: options.eventId,
      correlationId: options.correlationId,
      anonymousVisitorId: options.attribution?.anonymousVisitorId,
      sessionId: options.attribution?.sessionId,
      opportunityId: options.opportunity.id,
      contactId: options.opportunity.contact_id,
      sourceRoute: options.opportunity.source,
      deviceCategory: options.attribution?.deviceCategory,
      consentAnalytics: options.consentAnalytics,
      consentAdvertising: options.consentAdvertising,
      properties: {
        intent_type: options.opportunity.intent_type,
        source: options.opportunity.source,
      },
    });
  } catch (error) {
    secondaryErrors.push({
      step: "analytics_event",
      message: error instanceof Error ? error.message : "analytics failed",
    });
  }

  if (options.allowAi !== false && options.submissionForAi) {
    try {
      await generateOpportunitySummary(options.opportunity.id, options.submissionForAi);
    } catch (error) {
      secondaryErrors.push({
        step: "ai_summary",
        message: error instanceof Error ? error.message : "ai failed",
      });
      logger.warn("AI summary failed safely", {
        opportunityId: options.opportunity.id,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  try {
    await sendTransactionalEmail({
      templateKey: options.emailTemplate,
      to: [options.toEmail],
      subject:
        options.emailTemplate === "story_ack"
          ? "We received your story — GYVFT"
          : options.emailTemplate === "partner_ack"
            ? "We received your partnership enquiry — GYVFT"
            : options.emailTemplate === "discovery_ack"
              ? "We received your discovery request — GYVFT"
              : "We received your submission — GYVFT",
      opportunityId: options.opportunity.id,
      variables: { name: options.toName },
    });
  } catch (error) {
    secondaryErrors.push({
      step: "ack_email",
      message: error instanceof Error ? error.message : "email failed",
    });
  }

  try {
    await sendTransactionalEmail({
      templateKey: "internal_opportunity",
      to: await getInternalRecipients(),
      subject: `New opportunity: ${options.opportunity.intent_type}`,
      opportunityId: options.opportunity.id,
      variables: {
        opportunityId: options.opportunity.id,
        intentType: options.opportunity.intent_type,
        source: options.opportunity.source,
      },
    });
  } catch (error) {
    secondaryErrors.push({
      step: "internal_email",
      message: error instanceof Error ? error.message : "internal email failed",
    });
  }

  try {
    await sendConversionEvent({
      eventName: mapMetaEvent(options.eventName),
      eventId: options.eventId,
      opportunityId: options.opportunity.id,
      consentAdvertising: Boolean(options.consentAdvertising),
      email: options.toEmail,
      correlationId: options.correlationId,
    });
  } catch (error) {
    secondaryErrors.push({
      step: "meta_capi",
      message: error instanceof Error ? error.message : "meta failed",
    });
  }

  try {
    await dispatchWebhooks("opportunity.created", {
      opportunityId: options.opportunity.id,
      intentType: options.opportunity.intent_type,
      source: options.opportunity.source,
      stage: options.opportunity.stage,
    });
    await dispatchWebhooks("form.submitted", {
      opportunityId: options.opportunity.id,
      formKey: options.opportunity.form_key,
      source: options.opportunity.source,
    });
  } catch (error) {
    secondaryErrors.push({
      step: "webhooks",
      message: error instanceof Error ? error.message : "webhooks failed",
    });
  }

  return secondaryErrors;
}

async function getInternalRecipients(): Promise<string[]> {
  const sql = getSql();
  const config = await sql<{ config: { internal_notification_recipients?: string[] } }[]>`
    SELECT config FROM integration_definitions WHERE provider = 'resend' LIMIT 1
  `;
  const fromConfig = config[0]?.config?.internal_notification_recipients ?? [];
  if (fromConfig.length) return fromConfig;
  const owners = await sql<{ email: string }[]>`
    SELECT email FROM profiles
    WHERE role IN ('owner','admin') AND is_active = TRUE AND deleted_at IS NULL
  `;
  return owners.map((o) => o.email);
}

function mapMetaEvent(eventName: string): string {
  switch (eventName) {
    case "story_form_submitted":
    case "partner_form_submitted":
      return "Lead";
    case "discovery_requested":
      return "Schedule";
    case "brief_upload_completed":
      return "SubmitApplication";
    default:
      return "Lead";
  }
}

function assertNotBot(honeypot?: string | null) {
  if (honeypot && honeypot.length > 0) {
    throw new AppError("VALIDATION_ERROR", "Submission rejected");
  }
}

export async function submitStoryOpportunity(input: StoryFormInput) {
  assertNotBot(input.honeypot);
  const existing = await findByIdempotencyKey(input.idempotency_key);
  if (existing) {
    return { opportunityId: existing.id, duplicate: true as const };
  }

  const assigneeId = await getDefaultAssigneeId();
  const eventId = randomUUID();
  const correlationId = randomUUID();

  const opportunity = await withTransaction(async (tx) => {
    let organisationId: string | null = null;
    if (input.organisation_name?.trim()) {
      const org = await createOrMatchOrganisation(
        {
          name: input.organisation_name,
          primaryCity: input.primary_city,
        },
        tx,
      );
      organisationId = org.organisation.id;
      if (org.created) {
        await createActivity(
          {
            organisationId,
            activityType: "organisation.created",
            summary: `Organisation created from story form: ${org.organisation.name}`,
          },
          tx,
        );
      }
    }

    const contactResult = await createOrMatchContact(
      {
        fullName: input.full_name,
        email: input.email,
        phone: input.phone,
        organisationId,
        designation: input.designation,
        preferredContactMethod: input.preferred_contact_method,
        source: "story_form",
        communicationConsent: input.communication_consent,
        marketingConsent: input.marketing_consent,
        consentVersion: input.consent?.version,
      },
      tx,
    );

    if (contactResult.created) {
      await createActivity(
        {
          contactId: contactResult.contact.id,
          organisationId,
          activityType: "contact.created",
          summary: `Contact created from story form: ${contactResult.contact.full_name}`,
        },
        tx,
      );
    }

    let attributionId: string | null = null;
    let campaignId: string | null = null;
    if (input.attribution) {
      campaignId = await findCampaignIdByUtm(input.attribution.lastTouchCampaign ?? input.attribution.firstTouchCampaign, tx);
      const attr = await upsertVisitorAndAttribution(
        input.attribution,
        { contactId: contactResult.contact.id, campaignId },
        tx,
      );
      attributionId = attr.attributionTouchId;
    }

    const created = await createOpportunity(
      {
        storyTitle: input.story_description.slice(0, 120),
        intentType: "story_opportunity",
        relationshipType: "one_off",
        source: "story_form",
        formKey: "tell_your_story",
        campaignId,
        contactId: contactResult.contact.id,
        organisationId,
        assignedUserId: assigneeId,
        occasionType: input.occasion_type,
        occasionOther: input.occasion_other,
        targetDate: input.target_date,
        targetDatePrecision: input.target_date_precision,
        quantityRange: input.quantity_range,
        budgetRange: input.budget_range,
        primaryCity: input.primary_city,
        multipleLocations: input.multiple_locations,
        locationNotes: input.location_notes,
        idempotencyKey: input.idempotency_key,
        attributionId,
        audiences: input.audiences,
        formats: input.preferred_formats,
      },
      tx,
    );

    if (attributionId) {
      await tx`
        UPDATE attribution_touches
        SET opportunity_id = ${created.id}::uuid
        WHERE id = ${attributionId}::uuid
      `;
    }

    await saveSubmission(created.id, "tell_your_story", input, input.idempotency_key);
    await createActivity(
      {
        opportunityId: created.id,
        contactId: contactResult.contact.id,
        organisationId,
        activityType: "form.submitted",
        summary: "Story opportunity submitted",
        metadata: { form_key: "tell_your_story" },
      },
      tx,
    );

    return created;
  });

  const secondaryErrors = await runSecondaryEffects({
    opportunity,
    eventName: "story_form_submitted",
    eventId,
    correlationId,
    emailTemplate: "story_ack",
    toEmail: input.email,
    toName: input.full_name,
    attribution: input.attribution,
    consentAdvertising: input.consent?.advertising,
    consentAnalytics: input.consent?.analytics,
    submissionForAi: {
      story_description: input.story_description,
      occasion_type: input.occasion_type,
      audiences: input.audiences,
      preferred_formats: input.preferred_formats,
      primary_city: input.primary_city,
      organisation_name: input.organisation_name,
    },
  });

  return {
    opportunityId: opportunity.id,
    duplicate: false as const,
    eventId,
    correlationId,
    secondaryErrors,
  };
}

export async function submitPartnerOpportunity(input: PartnerFormInput) {
  assertNotBot(input.honeypot);
  const existing = await findByIdempotencyKey(input.idempotency_key);
  if (existing) return { opportunityId: existing.id, duplicate: true as const };

  const assigneeId = await getDefaultAssigneeId();
  const eventId = randomUUID();
  const correlationId = randomUUID();

  const opportunity = await withTransaction(async (tx) => {
    const org = await createOrMatchOrganisation(
      {
        name: input.organisation_name,
        primaryCity: input.primary_locations.split(",")[0]?.trim() ?? null,
        type: "organisation",
      },
      tx,
    );

    const contactResult = await createOrMatchContact(
      {
        fullName: input.full_name,
        email: input.work_email,
        phone: input.phone,
        organisationId: org.organisation.id,
        designation: input.designation,
        preferredContactMethod: input.preferred_contact_method,
        source: "merch_partner_form",
        communicationConsent: input.communication_consent,
        marketingConsent: input.marketing_consent,
        consentVersion: input.consent?.version,
      },
      tx,
    );

    let attributionId: string | null = null;
    let campaignId: string | null = null;
    if (input.attribution) {
      campaignId = await findCampaignIdByUtm(
        input.attribution.lastTouchCampaign ?? input.attribution.firstTouchCampaign,
        tx,
      );
      const attr = await upsertVisitorAndAttribution(
        input.attribution,
        { contactId: contactResult.contact.id, campaignId },
        tx,
      );
      attributionId = attr.attributionTouchId;
    }

    const created = await createOpportunity(
      {
        storyTitle: `${input.organisation_name} merch partnership`,
        intentType: "merch_partnership_opportunity",
        relationshipType: "recurring",
        source: "merch_partner_form",
        formKey: "merch_partner",
        campaignId,
        contactId: contactResult.contact.id,
        organisationId: org.organisation.id,
        assignedUserId: assigneeId,
        quantityRange: input.quantity_range,
        budgetRange: input.budget_range,
        primaryCity: input.primary_locations,
        locationNotes: input.additional_context,
        idempotencyKey: input.idempotency_key,
        attributionId,
        formats: input.requirement_types,
      },
      tx,
    );

    if (attributionId) {
      await tx`
        UPDATE attribution_touches
        SET opportunity_id = ${created.id}::uuid
        WHERE id = ${attributionId}::uuid
      `;
    }

    await saveSubmission(created.id, "merch_partner", input, input.idempotency_key);
    await createActivity(
      {
        opportunityId: created.id,
        contactId: contactResult.contact.id,
        organisationId: org.organisation.id,
        activityType: "form.submitted",
        summary: "Merch partnership opportunity submitted",
      },
      tx,
    );
    return created;
  });

  const secondaryErrors = await runSecondaryEffects({
    opportunity,
    eventName: "partner_form_submitted",
    eventId,
    correlationId,
    emailTemplate: "partner_ack",
    toEmail: input.work_email,
    toName: input.full_name,
    attribution: input.attribution,
    consentAdvertising: input.consent?.advertising,
    consentAnalytics: input.consent?.analytics,
    submissionForAi: {
      organisation_name: input.organisation_name,
      requirement_types: input.requirement_types,
      upcoming_requirement: input.upcoming_requirement,
      additional_context: input.additional_context,
    },
  });

  return { opportunityId: opportunity.id, duplicate: false as const, eventId, correlationId, secondaryErrors };
}

export async function submitDiscoveryRequest(input: DiscoveryFormInput) {
  assertNotBot(input.honeypot);
  const existing = await findByIdempotencyKey(input.idempotency_key);
  if (existing) return { opportunityId: existing.id, duplicate: true as const };

  const assigneeId = await getDefaultAssigneeId();
  const eventId = randomUUID();
  const correlationId = randomUUID();

  const opportunity = await withTransaction(async (tx) => {
    let organisationId: string | null = null;
    if (input.organisation_name?.trim()) {
      const org = await createOrMatchOrganisation({ name: input.organisation_name }, tx);
      organisationId = org.organisation.id;
    }

    const contactResult = await createOrMatchContact(
      {
        fullName: input.full_name,
        email: input.email,
        phone: input.phone,
        organisationId,
        preferredContactMethod: input.preferred_contact_method,
        source: "discovery_form",
        communicationConsent: input.communication_consent,
        marketingConsent: false,
        consentVersion: input.consent?.version,
      },
      tx,
    );

    let attributionId: string | null = null;
    if (input.attribution) {
      const attr = await upsertVisitorAndAttribution(
        input.attribution,
        { contactId: contactResult.contact.id },
        tx,
      );
      attributionId = attr.attributionTouchId;
    }

    const created = await createOpportunity(
      {
        storyTitle: input.discussion_topic.slice(0, 120),
        intentType: "discovery_request",
        relationshipType: "unknown",
        source: "discovery_form",
        formKey: "book_discovery",
        contactId: contactResult.contact.id,
        organisationId,
        assignedUserId: assigneeId,
        occasionType: input.occasion_or_requirement,
        targetDatePrecision: input.timeline,
        idempotencyKey: input.idempotency_key,
        attributionId,
      },
      tx,
    );

    await saveSubmission(created.id, "book_discovery", input, input.idempotency_key);
    await createActivity(
      {
        opportunityId: created.id,
        contactId: contactResult.contact.id,
        organisationId,
        activityType: "form.submitted",
        summary: "Discovery conversation requested",
      },
      tx,
    );

    const task = await createTask(
      {
        title: "Schedule discovery conversation",
        description: input.discussion_topic,
        opportunityId: created.id,
        contactId: contactResult.contact.id,
        organisationId,
        assignedUserId: assigneeId,
        priority: "high",
      },
      tx,
    );

    await createActivity(
      {
        opportunityId: created.id,
        taskId: task.id,
        contactId: contactResult.contact.id,
        activityType: "task.created",
        summary: "Task created: Schedule discovery conversation",
      },
      tx,
    );

    return created;
  });

  const secondaryErrors = await runSecondaryEffects({
    opportunity,
    eventName: "discovery_requested",
    eventId,
    correlationId,
    emailTemplate: "discovery_ack",
    toEmail: input.email,
    toName: input.full_name,
    attribution: input.attribution,
    consentAdvertising: input.consent?.advertising,
    consentAnalytics: input.consent?.analytics,
    allowAi: false,
  });

  return { opportunityId: opportunity.id, duplicate: false as const, eventId, correlationId, secondaryErrors };
}
