import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Sql } from "postgres";
import { getSql } from "@/lib/database/client";
import { dateKey } from "./dashboard-model";
import { storyRequestSchema } from "./story-request";
import { uuidPattern } from "./model";
import {
  giftBriefSchema,
  draftGiftBriefSchema,
  profileSchema,
  personSchema,
  occasionSchema,
  giftLocked,
  JourneyError,
  type Person,
  type Occasion,
  type Profile,
  type GiftBrief,
} from "./journey-model";
import { validateCircleGiftContext, circlesReady } from "./circles";
import { queueNotification } from "./notifications";
export async function journeyProject(
  tx: Sql,
  id: string,
  accountId?: string,
  edit = false,
) {
  if (!uuidPattern.test(id)) throw new JourneyError("Gift unavailable.");
  const [p] = accountId
    ? await tx`SELECT * FROM customer_projects WHERE id=${id}::uuid AND customer_account_id=${accountId}::uuid FOR UPDATE`
    : await tx`SELECT * FROM customer_projects WHERE id=${id}::uuid FOR UPDATE`;
  if (!p) throw new JourneyError("Gift unavailable.");
  if (edit && giftLocked(p as { stage: number }))
    throw new JourneyError(
      "Production has started. Changes to the gift and artwork are no longer possible.",
    );
  if (edit && String(p.submission_key || "").startsWith("gyvft-demo-"))
    throw new JourneyError(
      "Sample requests are read-only. Start a new gift to create your own.",
    );
  return p;
}
export async function peopleFor(accountId: string) {
  return getSql()<
    Person[]
  >`SELECT p.id,p.name,p.relationship,p.about,p.likes,p.avoid,p.email,p.linked_account_id,p.invitation_accepted_at,CASE WHEN f.share_profile THEN f.about END AS shared_about,CASE WHEN f.share_profile THEN f.interests END AS shared_interests,CASE WHEN f.share_profile THEN f.avoid END AS shared_avoid FROM gyvft_customer_people p LEFT JOIN gyvft_customer_profiles f ON f.account_id=p.linked_account_id WHERE p.account_id=${accountId}::uuid ORDER BY p.name,p.id`;
}
export async function profileFor(accountId: string) {
  const [p] = await getSql()<
    Profile[]
  >`SELECT name,about,interests,avoid,share_profile FROM gyvft_customer_profiles WHERE account_id=${accountId}::uuid`;
  return (
    p || { name: "", about: "", interests: "", avoid: "", share_profile: false }
  );
}
export async function occasionsFor(accountId: string) {
  return getSql()<
    Occasion[]
  >`SELECT id,title,occasion_date::text,repeats_annually,notes,relationship,person_id,photo_data IS NOT NULL AS has_photo FROM gyvft_customer_occasions WHERE account_id=${accountId}::uuid ORDER BY occasion_date,title`;
}
export async function saveProfile(
  accountId: string,
  raw: unknown,
  sql: Sql = getSql(),
) {
  const p = profileSchema.parse(raw);
  await sql`INSERT INTO gyvft_customer_profiles(account_id,name,about,interests,avoid,share_profile) VALUES(${accountId}::uuid,${p.name},${p.about},${p.interests},${p.avoid},${p.share_profile}) ON CONFLICT(account_id) DO UPDATE SET name=EXCLUDED.name,about=EXCLUDED.about,interests=EXCLUDED.interests,avoid=EXCLUDED.avoid,share_profile=EXCLUDED.share_profile,updated_at=now()`;
}
export async function savePerson(
  accountId: string,
  id: string,
  raw: unknown,
  sql: Sql = getSql(),
) {
  if (!uuidPattern.test(id)) throw new JourneyError("Person unavailable.");
  const p = personSchema.parse(raw);
  const rows =
    await sql`INSERT INTO gyvft_customer_people(id,account_id,name,relationship,about,likes,avoid,email) VALUES(${id}::uuid,${accountId}::uuid,${p.name},${p.relationship},${p.about},${p.likes},${p.avoid},${p.email.toLowerCase()}) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,relationship=EXCLUDED.relationship,about=EXCLUDED.about,likes=EXCLUDED.likes,avoid=EXCLUDED.avoid,email=EXCLUDED.email,linked_account_id=CASE WHEN gyvft_customer_people.email=EXCLUDED.email THEN gyvft_customer_people.linked_account_id ELSE NULL END,invitation_hash=CASE WHEN gyvft_customer_people.email=EXCLUDED.email THEN gyvft_customer_people.invitation_hash ELSE NULL END,updated_at=now() WHERE gyvft_customer_people.account_id=${accountId}::uuid RETURNING id`;
  if (!rows[0]) throw new JourneyError("Person unavailable.");
  return id;
}
async function ownedLinks(
  tx: Sql,
  accountId: string,
  occasion: string | null,
  person: string | null,
) {
  if (occasion) {
    const rows =
      await tx`SELECT id FROM gyvft_customer_occasions WHERE id=${occasion}::uuid AND account_id=${accountId}::uuid`;
    if (!rows[0]) throw new JourneyError("Occasion unavailable.");
  }
  if (person) {
    const rows =
      await tx`SELECT id FROM gyvft_customer_people WHERE id=${person}::uuid AND account_id=${accountId}::uuid`;
    if (!rows[0]) throw new JourneyError("Person unavailable.");
  }
}
export async function saveOccasion(
  accountId: string,
  id: string,
  raw: unknown,
  sql?: Sql,
) {
  if (!uuidPattern.test(id)) throw new JourneyError("Occasion unavailable.");
  const o = occasionSchema.parse(raw);
  const write = async (tx: Sql) => {
    await ownedLinks(tx, accountId, null, o.person_id);
    const rows =
      await tx`INSERT INTO gyvft_customer_occasions(id,account_id,title,occasion_date,repeats_annually,notes,relationship,person_id) VALUES(${id}::uuid,${accountId}::uuid,${o.title},${o.occasion_date}::date,${o.repeats_annually},${o.notes},${o.relationship},${o.person_id}::uuid) ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,occasion_date=EXCLUDED.occasion_date,repeats_annually=EXCLUDED.repeats_annually,notes=EXCLUDED.notes,relationship=EXCLUDED.relationship,person_id=EXCLUDED.person_id WHERE gyvft_customer_occasions.account_id=${accountId}::uuid RETURNING id`;
    if (!rows[0]) throw new JourneyError("Occasion unavailable.");
  };
  if (sql) await write(sql);
  else await getSql().begin((tx) => write(tx as unknown as Sql));
  return id;
}
export async function saveGift(
  account: { id: string; email: string },
  id: string,
  raw: unknown,
  draft = false,
) {
  if (!uuidPattern.test(id)) throw new JourneyError("Gift unavailable.");
  const b = (draft ? draftGiftBriefSchema : giftBriefSchema).parse(raw);
  return getSql().begin(async (rawTx) => {
    const tx = rawTx as unknown as Sql;
    await ownedLinks(tx, account.id, b.occasion_id, b.person_id);
    const [existing] =
      await tx`SELECT * FROM customer_projects WHERE id=${id}::uuid FOR UPDATE`;
    if (existing) {
      await journeyProject(tx, id, account.id, true);
      if (draft && !existing.is_draft)
        throw new JourneyError(
          "This brief is already submitted. Send an updated brief to keep the team informed.",
        );
      const [quote] =
        await tx`SELECT id FROM customer_project_approvals WHERE project_id=${id}::uuid LIMIT 1`;
      if (quote)
        throw new JourneyError(
          "Your gift has a quote. Request a version-specific change from Quote & pay.",
        );
    }
    const circleSchema = await circlesReady(tx);
    if ((b.circle_id || b.circle_occasion_id) && !circleSchema)
      throw new JourneyError(
        "Circles needs the approved database update before a gift can be attached.",
      );
    if (b.circle_occasion_id && !b.circle_id)
      throw new JourneyError("Choose a circle for this shared occasion.");
    if (
      b.circle_id &&
      (!existing ||
        b.circle_id !== existing.circle_id ||
        (b.circle_occasion_id || null) !== existing.circle_occasion_id)
    )
      await validateCircleGiftContext(
        tx,
        account.id,
        b.circle_id,
        b.circle_occasion_id,
      );
    const rows = circleSchema
      ? await tx`INSERT INTO customer_projects(id,customer_account_id,customer_email,title,brief,is_draft,draft_document,occasion_id,person_id,circle_id,circle_occasion_id,delivery_date,next_action) VALUES(${id}::uuid,${account.id}::uuid,${account.email},${b.title},${b.story},${draft},${tx.json(b)},${b.occasion_id}::uuid,${b.person_id}::uuid,${b.circle_id || null}::uuid,${b.circle_occasion_id || null}::uuid,${b.delivery_date || null}::date,${draft ? "Private draft" : "Your story is with Aarla. We will curate options for you."}) ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,brief=EXCLUDED.brief,is_draft=EXCLUDED.is_draft,draft_document=EXCLUDED.draft_document,occasion_id=EXCLUDED.occasion_id,person_id=EXCLUDED.person_id,circle_id=EXCLUDED.circle_id,circle_occasion_id=EXCLUDED.circle_occasion_id,delivery_date=EXCLUDED.delivery_date,next_action=EXCLUDED.next_action WHERE customer_projects.customer_account_id=${account.id}::uuid RETURNING id`
      : await tx`INSERT INTO customer_projects(id,customer_account_id,customer_email,title,brief,is_draft,draft_document,occasion_id,person_id,delivery_date,next_action) VALUES(${id}::uuid,${account.id}::uuid,${account.email},${b.title},${b.story},${draft},${tx.json(b)},${b.occasion_id}::uuid,${b.person_id}::uuid,${b.delivery_date || null}::date,${draft ? "Private draft" : "Your story is with Aarla. We will curate options for you."}) ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,brief=EXCLUDED.brief,is_draft=EXCLUDED.is_draft,draft_document=EXCLUDED.draft_document,occasion_id=EXCLUDED.occasion_id,person_id=EXCLUDED.person_id,delivery_date=EXCLUDED.delivery_date,next_action=EXCLUDED.next_action WHERE customer_projects.customer_account_id=${account.id}::uuid RETURNING id`;
    if (!rows[0]) throw new JourneyError("Gift unavailable.");
    if (!draft) {
      const [last] =
        await tx`SELECT COALESCE(max(version),0)::int AS version FROM gyvft_gift_brief_revisions WHERE project_id=${id}::uuid`;
      let revision = last.version;
      if (existing && revision === 0) {
        await tx`INSERT INTO gyvft_gift_brief_revisions(project_id,version,document) VALUES(${id}::uuid,1,${tx.json(existing.draft_document || existing.gift_brief || { title: existing.title, story: existing.brief })})`;
        revision = 1;
      }
      await tx`INSERT INTO gyvft_gift_brief_revisions(project_id,version,document) VALUES(${id}::uuid,${revision + 1},${tx.json(b)})`;
      await tx`INSERT INTO customer_project_events(project_id,title,body) VALUES(${id}::uuid,${existing ? "Brief updated" : "Your story received"},'Your gift brief has been saved.')`;
      await queueNotification(
        tx,
        id,
        `brief:${id}:${Date.now()}`,
        "team",
        account.email,
        "GYVFT: gift brief received",
      );
    }
    return id;
  });
}
export async function invitePerson(accountId: string, id: string) {
  if (!uuidPattern.test(id)) throw new JourneyError("Person unavailable.");
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  const rows =
    await getSql()`UPDATE gyvft_customer_people SET invitation_accepted_at=NULL,invitation_hash=${hash},invitation_expires_at=now()+interval '7 days' WHERE id=${id}::uuid AND account_id=${accountId}::uuid AND linked_account_id IS NULL AND email<>'' RETURNING email,name`;
  if (!rows[0])
    throw new JourneyError("Add their email before preparing an invitation.");
  return { token, email: String(rows[0].email), name: String(rows[0].name) };
}
export async function invitationFor(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const [p] =
    await getSql()`SELECT p.id,p.name,p.email,p.linked_account_id,p.invitation_accepted_at,COALESCE(NULLIF(f.name,''),'Your friend') AS inviter FROM gyvft_customer_people p LEFT JOIN gyvft_customer_profiles f ON f.account_id=p.account_id WHERE p.invitation_hash=${hash} AND p.invitation_expires_at>now()`;
  return p || null;
}
export async function acceptInvitation(
  account: { id: string; email: string },
  token: string,
) {
  const p = await invitationFor(token);
  if (!p || String(p.email).toLowerCase() !== account.email.toLowerCase())
    throw new JourneyError(
      "Sign in with the email the invitation was sent to.",
    );
  if (p.invitation_accepted_at) {
    if (p.linked_account_id === account.id) return;
    throw new JourneyError("This invitation has already been accepted.");
  }
  const accepted =
    await getSql()`UPDATE gyvft_customer_people SET linked_account_id=${account.id}::uuid,invitation_accepted_at=now() WHERE id=${p.id}::uuid AND invitation_hash=${createHash("sha256").update(token).digest("hex")} AND invitation_expires_at>now() RETURNING id`;
  if (!accepted[0])
    throw new JourneyError(
      "This invitation changed or expired. Ask for a new link.",
    );
}
export async function requestVersionChange(
  accountId: string,
  projectId: string,
  approvalId: string,
  body: string,
) {
  if (!uuidPattern.test(approvalId) || !body.trim() || body.length > 4000)
    throw new JourneyError("Describe the changes you need.");
  await getSql().begin(async (rawTx) => {
    const tx = rawTx as unknown as Sql;
    const p = await journeyProject(tx, projectId, accountId, true);
    const [a] =
      await tx`SELECT * FROM customer_project_approvals WHERE id=${approvalId}::uuid AND project_id=${projectId}::uuid AND version=(SELECT max(version) FROM customer_project_approvals newer WHERE newer.project_id=${projectId}::uuid AND newer.kind=customer_project_approvals.kind)`;
    if (!a) throw new JourneyError("Refresh to see the latest version.");
    if (
      (p.shopify_order_id ||
        p.shopify_order_reference ||
        p.shopify_order_state !== "pending") &&
      a.kind === "proposal"
    )
      throw new JourneyError(
        "Your official Shopify order is confirmed. Message the team for support.",
      );
    await tx`INSERT INTO gyvft_gift_changes(project_id,approval_id,body) VALUES(${projectId}::uuid,${approvalId}::uuid,${body.trim()})`;
    await tx`UPDATE customer_project_approvals SET status='changes_requested',customer_response=${body.trim()},decided_at=now() WHERE id=${approvalId}::uuid`;
    await tx`INSERT INTO customer_project_messages(project_id,sender,body) VALUES(${projectId}::uuid,'customer',${`Changes to ${a.kind === "design" ? "artwork" : "quote"} v${a.version}: ${body.trim()}`})`;
    await queueNotification(
      tx,
      projectId,
      `change:${approvalId}:${Date.now()}`,
      "team",
      p.customer_email,
      "GYVFT: changes requested",
    );
  });
}
export function briefFromProject(p: {
  gift_brief?: unknown;
  draft_document?: unknown;
  title: string;
  brief: string;
  delivery_date?: string | null;
}): Partial<GiftBrief> {
  if (p.draft_document && typeof p.draft_document === "object")
    return p.draft_document as GiftBrief;
  const original = storyRequestSchema.safeParse(p.gift_brief);
  return {
    title: p.title,
    story: p.brief,
    delivery_date: dateKey(p.delivery_date) || "",
    ...(original.success
      ? {
          occasion: original.data.occasion_type,
          recipient_notes: original.data.audiences.join(", "),
          formats: original.data.preferred_formats.join(", "),
          budget: original.data.budget_range,
          city: original.data.primary_city,
          phone: original.data.phone,
          ...(/^\d+$/.test(original.data.quantity_range)
            ? { recipients: Number(original.data.quantity_range) }
            : {}),
        }
      : {}),
  };
}
export async function tasteSuggestions(accountId: string) {
  const sql = getSql();
  const rows =
    await sql`SELECT trim(line->>'name') AS name,count(DISTINCT s.project_id)::int AS gifts FROM gyvft_gift_selections s JOIN customer_projects p ON p.id=s.project_id CROSS JOIN LATERAL jsonb_array_elements(s.snapshot->'lines') line WHERE p.customer_account_id=${accountId}::uuid AND line->>'name' IS NOT NULL GROUP BY trim(line->>'name') HAVING count(DISTINCT s.project_id)>=2 ORDER BY gifts DESC LIMIT 8`;
  const [profile] =
    await sql`SELECT taste_dismissals FROM gyvft_customer_profiles WHERE account_id=${accountId}::uuid`;
  return rows.filter(
    (r) => !((profile?.taste_dismissals || []) as string[]).includes(r.name),
  );
}
export async function decideTaste(
  accountId: string,
  name: string,
  accept: boolean,
) {
  const suggestions = await tasteSuggestions(accountId);
  if (!suggestions.some((s) => s.name === name))
    throw new JourneyError("That suggestion is no longer available.");
  await getSql()`INSERT INTO gyvft_customer_profiles(account_id,interests,taste_dismissals) VALUES(${accountId}::uuid,${accept ? name : ""},${getSql().json([name])}) ON CONFLICT(account_id) DO UPDATE SET interests=CASE WHEN ${accept} THEN concat_ws(', ',NULLIF(gyvft_customer_profiles.interests,''),${name}) ELSE gyvft_customer_profiles.interests END,taste_dismissals=gyvft_customer_profiles.taste_dismissals || ${getSql().json([name])},updated_at=now()`;
}
