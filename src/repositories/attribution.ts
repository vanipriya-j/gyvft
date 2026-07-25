import type { Sql } from "postgres";
import { getSql } from "@/lib/database/client";
import type { AttributionSnapshot } from "@/types/domain";

export async function upsertVisitorAndAttribution(
  snapshot: AttributionSnapshot,
  options: {
    opportunityId?: string;
    contactId?: string;
    campaignId?: string | null;
  } = {},
  db: Sql = getSql(),
): Promise<{ visitorIdentityId: string; attributionTouchId: string }> {
  const existing = await db<{ id: string }[]>`
    SELECT id FROM visitor_identities
    WHERE anonymous_visitor_id = ${snapshot.anonymousVisitorId}::uuid
    LIMIT 1
  `;

  let visitorIdentityId: string;
  if (existing[0]) {
    visitorIdentityId = existing[0].id;
    await db`
      UPDATE visitor_identities
      SET
        last_touch_source = COALESCE(${snapshot.lastTouchSource ?? null}, last_touch_source),
        last_touch_medium = COALESCE(${snapshot.lastTouchMedium ?? null}, last_touch_medium),
        last_touch_campaign = COALESCE(${snapshot.lastTouchCampaign ?? null}, last_touch_campaign),
        last_touch_content = COALESCE(${snapshot.lastTouchContent ?? null}, last_touch_content),
        last_touch_term = COALESCE(${snapshot.lastTouchTerm ?? null}, last_touch_term),
        last_touch_landing_page = COALESCE(${snapshot.lastTouchLandingPage ?? null}, last_touch_landing_page),
        last_seen_at = NOW(),
        contact_id = COALESCE(${options.contactId ?? null}::uuid, contact_id),
        device_category = COALESCE(${snapshot.deviceCategory ?? null}, device_category),
        updated_at = NOW()
      WHERE id = ${visitorIdentityId}::uuid
    `;
  } else {
    const rows = await db<{ id: string }[]>`
      INSERT INTO visitor_identities (
        anonymous_visitor_id,
        first_touch_source, first_touch_medium, first_touch_campaign, first_touch_content,
        first_touch_term, first_touch_landing_page, first_touch_referrer,
        last_touch_source, last_touch_medium, last_touch_campaign, last_touch_content,
        last_touch_term, last_touch_landing_page, device_category, contact_id
      ) VALUES (
        ${snapshot.anonymousVisitorId}::uuid,
        ${snapshot.firstTouchSource ?? null},
        ${snapshot.firstTouchMedium ?? null},
        ${snapshot.firstTouchCampaign ?? null},
        ${snapshot.firstTouchContent ?? null},
        ${snapshot.firstTouchTerm ?? null},
        ${snapshot.firstTouchLandingPage ?? null},
        ${snapshot.firstTouchReferrer ?? null},
        ${snapshot.lastTouchSource ?? null},
        ${snapshot.lastTouchMedium ?? null},
        ${snapshot.lastTouchCampaign ?? null},
        ${snapshot.lastTouchContent ?? null},
        ${snapshot.lastTouchTerm ?? null},
        ${snapshot.lastTouchLandingPage ?? null},
        ${snapshot.deviceCategory ?? null},
        ${options.contactId ?? null}::uuid
      )
      RETURNING id
    `;
    visitorIdentityId = rows[0]!.id;
  }

  await db`
    INSERT INTO visitor_sessions (
      visitor_identity_id, session_id, landing_page, referrer, device_category,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term, last_seen_at
    ) VALUES (
      ${visitorIdentityId}::uuid,
      ${snapshot.sessionId}::uuid,
      ${snapshot.lastTouchLandingPage ?? snapshot.firstTouchLandingPage ?? null},
      ${snapshot.firstTouchReferrer ?? null},
      ${snapshot.deviceCategory ?? null},
      ${snapshot.lastTouchSource ?? snapshot.firstTouchSource ?? null},
      ${snapshot.lastTouchMedium ?? snapshot.firstTouchMedium ?? null},
      ${snapshot.lastTouchCampaign ?? snapshot.firstTouchCampaign ?? null},
      ${snapshot.lastTouchContent ?? snapshot.firstTouchContent ?? null},
      ${snapshot.lastTouchTerm ?? snapshot.firstTouchTerm ?? null},
      NOW()
    )
    ON CONFLICT (session_id) DO UPDATE
    SET last_seen_at = NOW()
  `;

  const touch = await db<{ id: string }[]>`
    INSERT INTO attribution_touches (
      visitor_identity_id, session_id, touch_type, source, medium, campaign, content, term,
      landing_page, referrer, opportunity_id, contact_id, campaign_id
    ) VALUES (
      ${visitorIdentityId}::uuid,
      (SELECT id FROM visitor_sessions WHERE session_id = ${snapshot.sessionId}::uuid LIMIT 1),
      'conversion',
      ${snapshot.lastTouchSource ?? snapshot.firstTouchSource ?? null},
      ${snapshot.lastTouchMedium ?? snapshot.firstTouchMedium ?? null},
      ${snapshot.lastTouchCampaign ?? snapshot.firstTouchCampaign ?? null},
      ${snapshot.lastTouchContent ?? snapshot.firstTouchContent ?? null},
      ${snapshot.lastTouchTerm ?? snapshot.firstTouchTerm ?? null},
      ${snapshot.lastTouchLandingPage ?? snapshot.firstTouchLandingPage ?? null},
      ${snapshot.firstTouchReferrer ?? null},
      ${options.opportunityId ?? null}::uuid,
      ${options.contactId ?? null}::uuid,
      ${options.campaignId ?? null}::uuid
    )
    RETURNING id
  `;

  return { visitorIdentityId, attributionTouchId: touch[0]!.id };
}

export async function findCampaignIdByUtm(
  campaign?: string | null,
  db: Sql = getSql(),
): Promise<string | null> {
  if (!campaign) return null;
  const rows = await db<{ id: string }[]>`
    SELECT id FROM campaigns
    WHERE deleted_at IS NULL
      AND status = 'active'
      AND campaign = ${campaign}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}
