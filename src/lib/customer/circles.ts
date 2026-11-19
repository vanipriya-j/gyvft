import "server-only";
import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { z } from "zod";
import { getSql } from "@/lib/database/client";
import { hashOpaqueToken, isOpaqueToken, newOpaqueToken } from "./password";
import { isDemoAccount } from "./demo-accounts";
import {
  CircleError,
  circleInput,
  circleInviteInput,
  circleRecipientInput,
  circleOccasionInput,
  institutionalCategories,
  organisationSchema,
  type Circle,
  type CircleDetail,
  type CircleMember,
  type CircleRecipient,
  type CircleOccasion,
  type CircleOrganisation,
  type PendingCircleInvitation,
} from "./circle-model";
type Actor = { id: string; email: string };
const uuid = z.string().uuid();
export async function circlesReady(sql = getSql()) {
  const [r] = await sql<
    { ready: boolean }[]
  >`SELECT to_regclass('public.gyvft_circles') IS NOT NULL AND to_regclass('public.gyvft_circle_members') IS NOT NULL AND to_regclass('public.gyvft_circle_organisations') IS NOT NULL AND to_regclass('public.gyvft_circle_recipients') IS NOT NULL AND to_regclass('public.gyvft_circle_invitations') IS NOT NULL AND to_regclass('public.gyvft_circle_occasions') IS NOT NULL AND to_regclass('public.gyvft_circle_events') IS NOT NULL AND (SELECT count(*)=2 FROM information_schema.columns WHERE table_schema='public' AND table_name='customer_projects' AND column_name IN ('circle_id','circle_occasion_id')) AS ready`;
  return r.ready;
}
async function requireSchema() {
  if (!(await circlesReady()))
    throw new CircleError(
      "SETUP_REQUIRED",
      "Circles needs the approved database update. No migration has been run by this request.",
    );
}
async function audit(
  tx: Sql,
  circle: string,
  actor: string | null,
  operation: string,
  subject: string | null = null,
) {
  await tx`INSERT INTO public.gyvft_circle_events(circle_id,actor_account_id,operation,subject_id) VALUES(${circle},${actor},${operation},${subject})`;
}
async function access(
  tx: Sql,
  id: string,
  actor: string,
  write = false,
  allowArchived = false,
) {
  uuid.parse(id);
  const [c] = write
    ? await tx<
        Circle[]
      >`SELECT c.*,m.role,m.display_name,m.share_profile FROM public.gyvft_circles c JOIN public.gyvft_circle_members m ON m.circle_id=c.id AND m.account_id=${actor} AND m.state='active' WHERE c.id=${id} FOR UPDATE OF c`
    : await tx<
        Circle[]
      >`SELECT c.*,m.role,m.display_name,m.share_profile FROM public.gyvft_circles c JOIN public.gyvft_circle_members m ON m.circle_id=c.id AND m.account_id=${actor} AND m.state='active' WHERE c.id=${id} FOR SHARE OF c`;
  if (!c) throw new CircleError("NOT_FOUND", "Circle unavailable.");
  if (write && c.archived_at && !allowArchived)
    throw new CircleError("CONFLICT", "This circle is archived.");
  return c;
}
function admin(c: Circle) {
  if (c.role !== "admin")
    throw new CircleError(
      "FORBIDDEN",
      "Only this circle’s admins can do that.",
    );
}
function owner(c: Circle, actor: string) {
  if (c.owner_account_id !== actor)
    throw new CircleError("FORBIDDEN", "Only the circle owner can do that.");
}
export async function circlesForAccount(accountId: string, archived = false) {
  await requireSchema();
  return getSql()<
    Circle[]
  >`SELECT c.id,c.name,c.category,c.description,c.owner_account_id,c.is_demo,c.archived_at::text,m.role,m.display_name,m.share_profile,
 (SELECT count(*)::int FROM public.gyvft_circle_members n WHERE n.circle_id=c.id AND n.state='active') AS member_count,
 (SELECT count(*)::int FROM public.gyvft_circle_recipients p WHERE p.circle_id=c.id AND p.archived_at IS NULL) AS recipient_count
 FROM public.gyvft_circles c JOIN public.gyvft_circle_members m ON m.circle_id=c.id WHERE m.account_id=${accountId} AND m.state='active' AND (${archived} OR c.archived_at IS NULL) ORDER BY c.archived_at NULLS FIRST,c.name,c.id`;
}
export async function circleForAccount(
  id: string,
  accountId: string,
  offset = 0,
  limit = 25,
): Promise<CircleDetail> {
  await requireSchema();
  offset = z.number().int().min(0).max(10000).parse(offset);
  limit = z.number().int().min(1).max(100).parse(limit);
  return getSql().begin(async (raw) => {
    const tx = raw as unknown as Sql,
      c = await access(tx, id, accountId);
    const [counts] = await tx<
      { members: number; recipients: number }[]
    >`SELECT (SELECT count(*)::int FROM public.gyvft_circle_members WHERE circle_id=${id} AND state='active') AS members,(SELECT count(*)::int FROM public.gyvft_circle_recipients WHERE circle_id=${id} AND archived_at IS NULL) AS recipients`;
    const [orgs, members, recipients, invitations, occasions, gifts] =
      await Promise.all([
        tx<
          CircleOrganisation[]
        >`SELECT id,name,website,domain,verification_state,'' AS verification_note,verified_at::text FROM public.gyvft_circle_organisations WHERE circle_id=${id}`,
        tx<
          CircleMember[]
        >`SELECT m.account_id,m.display_name,m.role,m.account_id=${c.owner_account_id} AS is_owner,
    CASE WHEN ${c.role === "admin"} OR m.account_id=${accountId} THEN a.email END AS email,m.share_profile,
    CASE WHEN m.share_profile OR m.account_id=${accountId} THEN p.about END AS about,
    CASE WHEN m.share_profile OR m.account_id=${accountId} THEN p.interests END AS interests,
    CASE WHEN m.share_profile OR m.account_id=${accountId} THEN p.avoid END AS avoid
    FROM public.gyvft_circle_members m JOIN public.gyvft_customer_accounts a ON a.id=m.account_id LEFT JOIN public.gyvft_customer_profiles p ON p.account_id=m.account_id
    WHERE m.circle_id=${id} AND m.state='active' ORDER BY (m.account_id=${c.owner_account_id}) DESC,m.role,m.display_name,m.account_id LIMIT ${limit} OFFSET ${offset}`,
        c.role === "admin"
          ? tx<
              CircleRecipient[]
            >`SELECT id,name,email,about,likes,avoid,linked_account_id FROM public.gyvft_circle_recipients WHERE circle_id=${id} AND archived_at IS NULL ORDER BY name,id LIMIT 500`
          : Promise.resolve([]),
        c.role === "admin"
          ? tx<
              PendingCircleInvitation[]
            >`SELECT id,email,display_name,role,expires_at::text,expires_at<=now() AS expired FROM public.gyvft_circle_invitations WHERE circle_id=${id} AND accepted_at IS NULL AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 100`
          : Promise.resolve([]),
        tx<
          CircleOccasion[]
        >`SELECT id,title,occasion_date::text,repeats_annually,description FROM public.gyvft_circle_occasions WHERE circle_id=${id} AND archived_at IS NULL ORDER BY occasion_date,id`,
        tx<
          { id: string; title: string; stage: number }[]
        >`SELECT id,title,stage FROM public.customer_projects WHERE circle_id=${id} AND customer_account_id=${accountId} ORDER BY created_at DESC LIMIT 20`,
      ]);
    return {
      circle: {
        ...c,
        archived_at: c.archived_at ? String(c.archived_at) : null,
        member_count: counts.members,
        recipient_count: counts.recipients,
      },
      organisation: orgs[0] || null,
      members,
      memberPage: { offset, limit, total: counts.members },
      recipients,
      invitations,
      occasions,
      gifts,
    };
  });
}
export async function createCircle(actor: Actor, raw: unknown) {
  const input = circleInput.parse(raw);
  await requireSchema();
  return getSql().begin(async (rawTx) => {
    const tx = rawTx as unknown as Sql;
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${input.id}, 0))`;
    const [existing] =
      await tx`SELECT owner_account_id FROM public.gyvft_circles WHERE id=${input.id} FOR UPDATE`;
    if (existing) {
      if (existing.owner_account_id !== actor.id)
        throw new CircleError(
          "CONFLICT",
          "This creation key is already in use.",
        );
      return input.id;
    }
    await tx`INSERT INTO public.gyvft_circles(id,name,category,description,owner_account_id,is_demo) VALUES(${input.id},${input.name},${input.category},${input.description},${actor.id},${isDemoAccount(actor.id)})`;
    await tx`INSERT INTO public.gyvft_circle_members(circle_id,account_id,role,display_name) VALUES(${input.id},${actor.id},'admin',${input.display_name})`;
    if (input.organisation) {
      const o = input.organisation;
      await tx`INSERT INTO public.gyvft_circle_organisations(circle_id,name,website,domain) VALUES(${input.id},${o.name},${o.website},${o.domain})`;
    }
    await audit(tx, input.id, actor.id, "circle.created");
    return input.id;
  });
}
const commands = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("update"),
      name: z.string().trim().min(2).max(120),
      description: z.string().trim().max(2000),
      organisation: organisationSchema.optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("profile"),
      display_name: z.string().trim().min(2).max(120),
      share_profile: z.boolean(),
    })
    .strict(),
  z
    .object({
      op: z.literal("role"),
      account_id: uuid,
      role: z.enum(["admin", "member"]),
    })
    .strict(),
  z.object({ op: z.literal("remove"), account_id: uuid }).strict(),
  z.object({ op: z.literal("leave") }).strict(),
  z.object({ op: z.literal("transfer"), account_id: uuid }).strict(),
  z.object({ op: z.literal("archive"), confirm: z.literal(true) }).strict(),
  z.object({ op: z.literal("restore") }).strict(),
  z
    .object({ op: z.literal("revoke_invitation"), invitation_id: uuid })
    .strict(),
  z
    .object({ op: z.literal("recipient"), recipient: circleRecipientInput })
    .strict(),
  z.object({ op: z.literal("archive_recipient"), recipient_id: uuid }).strict(),
  z
    .object({ op: z.literal("occasion"), occasion: circleOccasionInput })
    .strict(),
  z.object({ op: z.literal("archive_occasion"), occasion_id: uuid }).strict(),
]);
export async function changeCircle(actor: Actor, id: string, raw: unknown) {
  const command = commands.parse(raw);
  await requireSchema();
  await getSql().begin(async (rawTx) => {
    const tx = rawTx as unknown as Sql,
      c = await access(
        tx,
        id,
        actor.id,
        true,
        command.op === "leave" ||
          command.op === "profile" ||
          command.op === "restore",
      );
    if (command.op === "profile") {
      await tx`UPDATE public.gyvft_circle_members SET display_name=${command.display_name},share_profile=${command.share_profile},updated_at=now() WHERE circle_id=${id} AND account_id=${actor.id}`;
    } else if (command.op === "leave") {
      if (c.owner_account_id === actor.id)
        throw new CircleError(
          "CONFLICT",
          "Transfer ownership to an active member before leaving.",
        );
      await tx`UPDATE public.gyvft_circle_members SET state='left',share_profile=false,updated_at=now() WHERE circle_id=${id} AND account_id=${actor.id}`;
      await tx`UPDATE public.gyvft_circle_invitations SET revoked_at=now() WHERE circle_id=${id} AND invited_by=${actor.id} AND accepted_at IS NULL AND revoked_at IS NULL`;
    } else {
      admin(c);
      if (command.op === "update") {
        if (command.organisation) {
          owner(c, actor.id);
          if (!institutionalCategories.has(c.category))
            throw new CircleError(
              "VALIDATION_ERROR",
              "Organisation details belong to an institutional circle.",
            );
          const o = command.organisation;
          await tx`UPDATE public.gyvft_circle_organisations SET name=${o.name},website=${o.website},domain=${o.domain},verification_state=CASE WHEN name<>${o.name} OR website<>${o.website} OR domain<>${o.domain} THEN 'unverified' ELSE verification_state END,verified_at=CASE WHEN name<>${o.name} OR website<>${o.website} OR domain<>${o.domain} THEN NULL ELSE verified_at END,updated_at=now() WHERE circle_id=${id}`;
        }
        await tx`UPDATE public.gyvft_circles SET name=${command.name},description=${command.description},updated_at=now() WHERE id=${id}`;
      } else if (
        command.op === "role" ||
        command.op === "remove" ||
        command.op === "transfer"
      ) {
        const [target] = await tx<
          { role: string }[]
        >`SELECT role FROM public.gyvft_circle_members WHERE circle_id=${id} AND account_id=${command.account_id} AND state='active' FOR UPDATE`;
        if (!target) throw new CircleError("NOT_FOUND", "Member unavailable.");
        if (command.op === "transfer") {
          owner(c, actor.id);
          if (command.account_id === actor.id)
            throw new CircleError(
              "CONFLICT",
              "This person already owns the circle.",
            );
          await tx`UPDATE public.gyvft_circle_members SET role='admin',updated_at=now() WHERE circle_id=${id} AND account_id=${command.account_id}`;
          await tx`UPDATE public.gyvft_circles SET owner_account_id=${command.account_id},updated_at=now() WHERE id=${id}`;
        } else {
          if (command.account_id === c.owner_account_id)
            throw new CircleError(
              "CONFLICT",
              "The owner must transfer ownership first.",
            );
          if (command.op === "role") {
            owner(c, actor.id);
            await tx`UPDATE public.gyvft_circle_members SET role=${command.role},updated_at=now() WHERE circle_id=${id} AND account_id=${command.account_id}`;
          } else {
            if (target.role === "admin") owner(c, actor.id);
            await tx`UPDATE public.gyvft_circle_members SET state='removed',share_profile=false,updated_at=now() WHERE circle_id=${id} AND account_id=${command.account_id}`;
          }
          await tx`UPDATE public.gyvft_circle_invitations SET revoked_at=now() WHERE circle_id=${id} AND invited_by=${command.account_id} AND accepted_at IS NULL AND revoked_at IS NULL`;
        }
      } else if (command.op === "archive") {
        owner(c, actor.id);
        await tx`UPDATE public.gyvft_circles SET archived_at=now(),updated_at=now() WHERE id=${id}`;
        await tx`UPDATE public.gyvft_circle_invitations SET revoked_at=now() WHERE circle_id=${id} AND accepted_at IS NULL AND revoked_at IS NULL`;
      } else if (command.op === "restore") {
        owner(c, actor.id);
        await tx`UPDATE public.gyvft_circles SET archived_at=NULL,updated_at=now() WHERE id=${id}`;
      } else if (command.op === "revoke_invitation") {
        const [invite] =
          await tx`SELECT role FROM public.gyvft_circle_invitations WHERE id=${command.invitation_id} AND circle_id=${id}`;
        if (!invite)
          throw new CircleError("NOT_FOUND", "Invitation unavailable.");
        if (invite.role === "admin") owner(c, actor.id);
        await tx`UPDATE public.gyvft_circle_invitations SET revoked_at=now() WHERE id=${command.invitation_id} AND circle_id=${id} AND accepted_at IS NULL`;
      } else if (command.op === "recipient") {
        const r = command.recipient;
        if (r.email) {
          const [duplicate] =
            await tx`SELECT id FROM public.gyvft_circle_recipients WHERE circle_id=${id} AND email=${r.email} AND archived_at IS NULL AND id<>${r.id}`;
          if (duplicate)
            throw new CircleError(
              "CONFLICT",
              "A recipient with this email is already in the circle.",
            );
        }
        const rows =
          await tx`INSERT INTO public.gyvft_circle_recipients(id,circle_id,name,email,about,likes,avoid,created_by) VALUES(${r.id},${id},${r.name},${r.email},${r.about},${r.likes},${r.avoid},${actor.id}) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,about=EXCLUDED.about,likes=EXCLUDED.likes,avoid=EXCLUDED.avoid,linked_account_id=CASE WHEN gyvft_circle_recipients.email=EXCLUDED.email THEN gyvft_circle_recipients.linked_account_id ELSE NULL END,updated_at=now() WHERE gyvft_circle_recipients.circle_id=${id} AND gyvft_circle_recipients.archived_at IS NULL RETURNING id`;
        if (!rows[0])
          throw new CircleError("CONFLICT", "Recipient unavailable.");
        await tx`UPDATE public.gyvft_circle_invitations SET revoked_at=now() WHERE circle_id=${id} AND recipient_id=${r.id} AND email<>${r.email} AND accepted_at IS NULL AND revoked_at IS NULL`;
      } else if (command.op === "archive_recipient") {
        await tx`UPDATE public.gyvft_circle_recipients SET archived_at=now(),updated_at=now() WHERE id=${command.recipient_id} AND circle_id=${id}`;
        await tx`UPDATE public.gyvft_circle_invitations SET revoked_at=now() WHERE circle_id=${id} AND recipient_id=${command.recipient_id} AND accepted_at IS NULL AND revoked_at IS NULL`;
      } else if (command.op === "occasion") {
        const o = command.occasion;
        const rows =
          await tx`INSERT INTO public.gyvft_circle_occasions(id,circle_id,title,occasion_date,repeats_annually,description,created_by) VALUES(${o.id},${id},${o.title},${o.occasion_date},${o.repeats_annually},${o.description},${actor.id}) ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,occasion_date=EXCLUDED.occasion_date,repeats_annually=EXCLUDED.repeats_annually,description=EXCLUDED.description,updated_at=now() WHERE gyvft_circle_occasions.circle_id=${id} AND gyvft_circle_occasions.archived_at IS NULL RETURNING id`;
        if (!rows[0])
          throw new CircleError("CONFLICT", "Occasion unavailable.");
      } else if (command.op === "archive_occasion")
        await tx`UPDATE public.gyvft_circle_occasions SET archived_at=now(),updated_at=now() WHERE id=${command.occasion_id} AND circle_id=${id}`;
    }
    await audit(
      tx,
      id,
      actor.id,
      command.op,
      "account_id" in command ? command.account_id : null,
    );
  });
}
export async function inviteToCircle(actor: Actor, id: string, raw: unknown) {
  const input = circleInviteInput.parse(raw),
    token = newOpaqueToken(),
    invitationId = randomUUID();
  await requireSchema();
  await getSql().begin(async (rawTx) => {
    const tx = rawTx as unknown as Sql,
      c = await access(tx, id, actor.id, true);
    admin(c);
    if (input.role === "admin") owner(c, actor.id);
    if (input.recipient_id) {
      const [r] =
        await tx`SELECT email FROM public.gyvft_circle_recipients WHERE id=${input.recipient_id} AND circle_id=${id} AND archived_at IS NULL`;
      if (!r || r.email !== input.email)
        throw new CircleError(
          "VALIDATION_ERROR",
          "Use this recipient’s recorded email for their invitation.",
        );
    }
    const [member] =
      await tx`SELECT m.state FROM public.gyvft_circle_members m JOIN public.gyvft_customer_accounts a ON a.id=m.account_id WHERE m.circle_id=${id} AND a.email=${input.email}`;
    if (member?.state === "active")
      throw new CircleError(
        "CONFLICT",
        "This person is already an active member.",
      );
    if (member?.state === "removed") owner(c, actor.id);
    const [pending] =
      await tx`SELECT id,role,expires_at>now() AS live FROM public.gyvft_circle_invitations WHERE circle_id=${id} AND email=${input.email} AND accepted_at IS NULL AND revoked_at IS NULL`;
    if (pending?.live && !input.replace)
      throw new CircleError(
        "CONFLICT",
        "An invitation is already pending. Choose Replace existing invitation to invalidate its old link.",
      );
    if (pending?.role === "admin") owner(c, actor.id);
    await tx`UPDATE public.gyvft_circle_invitations SET revoked_at=now() WHERE circle_id=${id} AND email=${input.email} AND accepted_at IS NULL AND revoked_at IS NULL`;
    await tx`INSERT INTO public.gyvft_circle_invitations(id,circle_id,email,display_name,role,token_hash,invited_by,recipient_id,expires_at) VALUES(${invitationId},${id},${input.email},${input.display_name},${input.role},${hashOpaqueToken(token)},${actor.id},${input.recipient_id},now()+interval '7 days')`;
    await audit(tx, id, actor.id, "invitation.created", invitationId);
  });
  return { token, id: invitationId, email: input.email };
}
export async function circleInvitation(token: string) {
  if (!isOpaqueToken(token)) return null;
  await requireSchema();
  const [i] = await getSql()<
    {
      id: string;
      circle_id: string;
      circle_name: string;
      category: string;
      email: string;
      display_name: string;
      role: string;
      accepted_by: string | null;
      expires_at: string;
    }[]
  >`SELECT i.id,i.circle_id,c.name AS circle_name,c.category,i.email,i.display_name,i.role,i.accepted_by,i.expires_at::text FROM public.gyvft_circle_invitations i JOIN public.gyvft_circles c ON c.id=i.circle_id WHERE i.token_hash=${hashOpaqueToken(token)} AND i.revoked_at IS NULL AND i.expires_at>now() AND c.archived_at IS NULL`;
  return i || null;
}
export async function acceptCircleInvitation(
  actor: Actor,
  token: string,
  raw: unknown,
) {
  if (!isOpaqueToken(token))
    throw new CircleError("NOT_FOUND", "Invitation unavailable.");
  const input = z
    .object({
      display_name: z.string().trim().min(2).max(120),
      share_profile: z.boolean(),
    })
    .strict()
    .parse(raw);
  await requireSchema();
  return getSql().begin(async (rawTx) => {
    const tx = rawTx as unknown as Sql;
    const [initial] = await tx<
      { circle_id: string }[]
    >`SELECT circle_id FROM public.gyvft_circle_invitations WHERE token_hash=${hashOpaqueToken(token)}`;
    if (!initial) throw new CircleError("NOT_FOUND", "Invitation unavailable.");
    const [circle] = await tx<
      { owner_account_id: string; archived_at: unknown }[]
    >`SELECT owner_account_id,archived_at FROM public.gyvft_circles WHERE id=${initial.circle_id} FOR UPDATE`;
    const [i] = await tx<
      {
        id: string;
        email: string;
        role: string;
        invited_by: string;
        recipient_id: string | null;
        accepted_by: string | null;
      }[]
    >`SELECT id,email,role,invited_by,recipient_id,accepted_by FROM public.gyvft_circle_invitations WHERE token_hash=${hashOpaqueToken(token)} AND revoked_at IS NULL AND expires_at>now() FOR UPDATE`;
    if (!circle || circle.archived_at || !i)
      throw new CircleError(
        "NOT_FOUND",
        "This invitation is no longer available.",
      );
    if (i.email !== actor.email)
      throw new CircleError(
        "FORBIDDEN",
        "Sign in with the email this invitation was sent to.",
      );
    if (i.accepted_by) {
      if (i.accepted_by !== actor.id)
        throw new CircleError(
          "CONFLICT",
          "This invitation was already accepted.",
        );
      const [m] =
        await tx`SELECT state FROM public.gyvft_circle_members WHERE circle_id=${initial.circle_id} AND account_id=${actor.id}`;
      if (m?.state !== "active")
        throw new CircleError(
          "CONFLICT",
          "Your access has changed. Ask an admin for a new invitation.",
        );
      return initial.circle_id;
    }
    const [inviter] = await tx<
      { role: string }[]
    >`SELECT role FROM public.gyvft_circle_members WHERE circle_id=${initial.circle_id} AND account_id=${i.invited_by} AND state='active'`;
    if (
      inviter?.role !== "admin" ||
      (i.role === "admin" && circle.owner_account_id !== i.invited_by)
    )
      throw new CircleError(
        "FORBIDDEN",
        "This invitation’s admin access has changed. Ask for a new one.",
      );
    const [prior] =
      await tx`SELECT state FROM public.gyvft_circle_members WHERE circle_id=${initial.circle_id} AND account_id=${actor.id}`;
    if (prior?.state === "removed" && circle.owner_account_id !== i.invited_by)
      throw new CircleError(
        "FORBIDDEN",
        "Only the circle owner can restore removed access.",
      );
    await tx`INSERT INTO public.gyvft_circle_members(circle_id,account_id,role,display_name,share_profile) VALUES(${initial.circle_id},${actor.id},${i.role},${input.display_name},${input.share_profile}) ON CONFLICT(circle_id,account_id) DO UPDATE SET role=CASE WHEN gyvft_circle_members.state='active' THEN gyvft_circle_members.role ELSE EXCLUDED.role END,state='active',display_name=EXCLUDED.display_name,share_profile=EXCLUDED.share_profile,joined_at=now(),updated_at=now()`;
    await tx`UPDATE public.gyvft_circle_invitations SET accepted_at=now(),accepted_by=${actor.id} WHERE id=${i.id}`;
    if (i.recipient_id)
      await tx`UPDATE public.gyvft_circle_recipients SET linked_account_id=${actor.id},updated_at=now() WHERE id=${i.recipient_id} AND circle_id=${initial.circle_id} AND email=${actor.email} AND archived_at IS NULL`;
    await audit(tx, initial.circle_id, actor.id, "invitation.accepted", i.id);
    return initial.circle_id;
  });
}
export async function validateCircleGiftContext(
  tx: Sql,
  accountId: string,
  id: string,
  eventId?: string | null,
) {
  const c = await access(tx, id, accountId);
  if (c.archived_at)
    throw new CircleError("CONFLICT", "This circle is archived.");
  const [o] = eventId
    ? await tx<
        CircleOccasion[]
      >`SELECT id,title,occasion_date::text,repeats_annually,description FROM public.gyvft_circle_occasions WHERE id=${uuid.parse(eventId)} AND circle_id=${id} AND archived_at IS NULL`
    : [];
  if (eventId && !o)
    throw new CircleError("NOT_FOUND", "Circle occasion unavailable.");
  return { circle: c, occasion: o || null };
}
export async function circleGiftContext(
  accountId: string,
  id: string,
  eventId?: string | null,
) {
  await requireSchema();
  return getSql().begin((raw) =>
    validateCircleGiftContext(raw as unknown as Sql, accountId, id, eventId),
  );
}
export async function circleOrganisationDirectory() {
  await requireSchema();
  return getSql()`SELECT c.id,c.name,c.category,c.is_demo,c.archived_at,a.email AS owner_email,o.name AS organisation_name,o.website,o.domain,o.verification_state,o.verification_note FROM public.gyvft_circles c JOIN public.gyvft_customer_accounts a ON a.id=c.owner_account_id JOIN public.gyvft_circle_organisations o ON o.circle_id=c.id ORDER BY o.verification_state,c.created_at DESC LIMIT 200`;
}
export async function verifyCircleOrganisation(id: string, raw: unknown) {
  const input = z
    .object({
      state: z.enum(["verified", "needs_review"]),
      note: z.string().trim().min(10).max(1000),
      confirmed: z.literal(true),
    })
    .strict()
    .parse(raw);
  uuid.parse(id);
  await requireSchema();
  await getSql().begin(async (raw) => {
    const tx = raw as unknown as Sql;
    const [c] =
      await tx`SELECT is_demo,archived_at FROM public.gyvft_circles WHERE id=${id} FOR UPDATE`;
    if (!c || c.archived_at)
      throw new CircleError("NOT_FOUND", "Organisation unavailable.");
    if (c.is_demo && input.state === "verified")
      throw new CircleError(
        "CONFLICT",
        "Fictional organisations cannot receive real verification.",
      );
    const rows =
      await tx`UPDATE public.gyvft_circle_organisations SET verification_state=${input.state},verification_note=${input.note},verified_at=CASE WHEN ${input.state}='verified' THEN now() ELSE NULL END,updated_at=now() WHERE circle_id=${id} RETURNING id`;
    if (!rows[0])
      throw new CircleError("NOT_FOUND", "Organisation unavailable.");
    await audit(tx, id, null, "organisation." + input.state);
  });
}

export async function circleOccasionsFor(accountId: string) {
  if (!(await circlesReady())) return [];
  return getSql()<
    (CircleOccasion & { circle_id: string; circle_name: string })[]
  >`SELECT o.id,o.title,o.occasion_date::text,o.repeats_annually,o.description,c.id AS circle_id,c.name AS circle_name FROM public.gyvft_circle_occasions o JOIN public.gyvft_circles c ON c.id=o.circle_id JOIN public.gyvft_circle_members m ON m.circle_id=c.id AND m.account_id=${accountId} AND m.state='active' WHERE c.archived_at IS NULL AND o.archived_at IS NULL ORDER BY o.occasion_date,o.title`;
}
