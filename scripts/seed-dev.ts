import { randomUUID } from "crypto";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config();

async function main() {
  if (process.env.IS_PRODUCTION === "true" || process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed: production environment flag is enabled.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const sql = postgres(databaseUrl, { max: 1 });

  const settings = await sql<{ production_mode: boolean }[]>`
    SELECT production_mode FROM workspace_settings LIMIT 1
  `;
  if (settings[0]?.production_mode) {
    throw new Error("Refusing to seed: workspace production_mode is true.");
  }

  const owner = await sql<{ id: string }[]>`
    SELECT id FROM profiles WHERE role = 'owner' AND deleted_at IS NULL LIMIT 1
  `;
  if (!owner[0]) {
    throw new Error("Create an owner first with npm run create-owner");
  }

  const orgId = randomUUID();
  const contactId = randomUUID();
  const opportunityId = randomUUID();
  const visitorId = randomUUID();
  const sessionId = randomUUID();

  await sql`
    INSERT INTO organisations (id, name, normalised_name, primary_city, relationship_status)
    VALUES (${orgId}::uuid, 'Northwind Heritage Trust', 'northwind heritage trust', 'Bengaluru', 'prospect')
    ON CONFLICT DO NOTHING
  `;

  await sql`
    INSERT INTO contacts (
      id, organisation_id, full_name, email, normalised_email, phone, normalised_phone,
      source, communication_consent, marketing_consent
    ) VALUES (
      ${contactId}::uuid, ${orgId}::uuid, 'Asha Menon', 'asha.menon@example.com', 'asha.menon@example.com',
      '+919876543210', '+919876543210', 'seed', TRUE, FALSE
    )
    ON CONFLICT DO NOTHING
  `;

  await sql`
    INSERT INTO opportunities (
      id, story_title, intent_type, relationship_type, stage, priority, source,
      contact_id, organisation_id, assigned_user_id, occasion_type, budget_range,
      primary_city, form_key, idempotency_key
    ) VALUES (
      ${opportunityId}::uuid,
      'Centenary memory book for Northwind Heritage Trust',
      'story_opportunity',
      'one_off',
      'new',
      'high',
      'story_form',
      ${contactId}::uuid,
      ${orgId}::uuid,
      ${owner[0].id}::uuid,
      'Institutional milestone',
      '₹2,00,000–₹10,00,000',
      'Bengaluru',
      'tell_your_story',
      ${randomUUID()}
    )
    ON CONFLICT DO NOTHING
  `;

  await sql`
    INSERT INTO visitor_identities (anonymous_visitor_id, first_touch_source, first_touch_medium, first_touch_campaign, first_touch_landing_page)
    VALUES (${visitorId}::uuid, 'google', 'cpc', 'heritage_centenary', '/tell-your-story')
    ON CONFLICT DO NOTHING
  `;

  await sql`
    INSERT INTO analytics_events (event_name, event_id, correlation_id, anonymous_visitor_id, session_id, opportunity_id, source_route)
    VALUES
      ('story_form_started', ${randomUUID()}::uuid, ${randomUUID()}::uuid, ${visitorId}::uuid, ${sessionId}::uuid, NULL, '/tell-your-story'),
      ('story_form_submitted', ${randomUUID()}::uuid, ${randomUUID()}::uuid, ${visitorId}::uuid, ${sessionId}::uuid, ${opportunityId}::uuid, '/tell-your-story')
  `;

  await sql`
    INSERT INTO tasks (title, opportunity_id, contact_id, organisation_id, assigned_user_id, created_by_user_id, due_at, priority, status)
    VALUES (
      'Review seeded opportunity',
      ${opportunityId}::uuid,
      ${contactId}::uuid,
      ${orgId}::uuid,
      ${owner[0].id}::uuid,
      ${owner[0].id}::uuid,
      NOW() + INTERVAL '2 days',
      'medium',
      'open'
    )
  `;

  await sql.end();
  console.log("Development seed complete. Fictional records created.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
