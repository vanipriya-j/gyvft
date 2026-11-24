import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
export async function proposalFixture(uri: string) {
  const parsed = new URL(uri);
  if (
    parsed.hostname !== "127.0.0.1" ||
    parsed.port !== "55438" ||
    parsed.pathname !== "/gyvft_gallery_test"
  )
    throw Error(
      "Proposal integration tests require their dedicated localhost:55438 fixture.",
    );
  const schema = "proposal_" + randomUUID().replaceAll("-", "");
  const sql = postgres(uri, { max: 2, connection: { search_path: schema } });
  await sql.unsafe(`CREATE SCHEMA ${schema};
    DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; END $$;
    CREATE TABLE customer_projects(id uuid PRIMARY KEY,customer_account_id uuid,customer_email text,title text,brief text DEFAULT '',gift_brief jsonb,customer_type text,organisation_name text,target_date date,delivery_date date,kind text DEFAULT 'enquiry',stage int DEFAULT 0,production_started_at timestamptz,shopify_order_id text,shopify_order_reference text,shopify_order_state text,submission_key text,next_action text,is_draft boolean DEFAULT false,created_at timestamptz DEFAULT now());
    CREATE TABLE gyvft_gift_options(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid REFERENCES customer_projects(id),title text,description text,contents jsonb,pricing jsonb,image_data bytea NOT NULL,image_type text,published boolean DEFAULT true,operator_hidden boolean DEFAULT false,created_at timestamptz DEFAULT now(),request_id uuid UNIQUE);
    CREATE TABLE gyvft_gift_visibility(option_id uuid,project_id uuid,kind text,hidden boolean);
    CREATE TABLE gyvft_gift_drafts(id uuid,project_id uuid,version int,document jsonb,updated_at timestamptz);
    CREATE TABLE gyvft_gift_selections(id uuid,project_id uuid,draft_id uuid,draft_version int,snapshot jsonb,created_at timestamptz);
    CREATE TABLE customer_project_approvals(id uuid,gift_selection_id uuid);
    CREATE TABLE customer_project_events(project_id uuid,title text,body text);`);
  for (const file of [
    "20261124000001_gift_option_images.sql",
    "20261124000002_agent_proposals.sql",
  ])
    await sql.unsafe(readFileSync("supabase/migrations/" + file, "utf8"));
  return { sql, schema };
}
