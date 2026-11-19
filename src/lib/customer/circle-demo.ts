import "server-only";
import { getSql } from "@/lib/database/client";
import {
  demoKey as key,
  demoScenarios as scenarios,
  demoOccasionContexts,
} from "./demo-fixtures";
import type { Sql } from "postgres";
import { demoAccounts } from "./demo-accounts";
import { circlesReady } from "./circles";
import { CircleError } from "./circle-model";
export const demoCircles = [
  {
    key: "family",
    name: "Our family",
    category: "family",
    owner: 3,
    members: [0, 2],
    description:
      "Birthdays, milestones and small thank-yous for the people closest to us.",
  },
  {
    key: "meridian",
    name: "Meridian Studio",
    category: "corporate",
    owner: 1,
    members: [2],
    description:
      "A fictional team, celebrating welcomes, good work and shared milestones.",
  },
  {
    key: "alumni",
    name: "Class of 2001",
    category: "alumni",
    owner: 2,
    members: [1],
    description:
      "Old friends, new stories. Reunions and occasions for our alumni circle.",
  },
  {
    key: "books",
    name: "The Sunday Book Club",
    category: "community",
    owner: 2,
    members: [0],
    description: "People who always have another book to recommend.",
  },
  {
    key: "neighbours",
    name: "Our neighbourhood",
    category: "community",
    owner: 2,
    members: [3],
    description: "Good neighbours and little reasons to celebrate together.",
  },
] as const;
/** Explicit operator fixture only. Never called by a migration, page load or startup. */
export async function seedDemoCircles(tx: Sql) {
  if (!(await circlesReady(tx)))
    throw new CircleError(
      "SETUP_REQUIRED",
      "Approve and apply the Circles migration before adding these demo workspaces.",
    );
  let inserted = 0;
  for (const c of demoCircles) {
    const id = key(`circle:${c.key}`),
      owner = demoAccounts[c.owner];
    const [prior] =
      await tx`SELECT c.owner_account_id,c.is_demo,EXISTS(SELECT 1 FROM public.gyvft_circle_events e WHERE e.circle_id=c.id AND e.operation='demo.created' AND e.actor_account_id=${owner.id}) AS fixture_origin FROM public.gyvft_circles c WHERE c.id=${id}`;
    if (prior && (!prior.is_demo || !prior.fixture_origin))
      throw new CircleError(
        "CONFLICT",
        "A demo circle identifier is already in use. No data was changed.",
      );
    // Existing fixtures may have been edited, left or archived. Never reset those choices.
    if (prior) continue;
    inserted += (
      await tx`INSERT INTO public.gyvft_circles(id,name,category,description,owner_account_id,is_demo) VALUES(${id},${c.name},${c.category},${c.description},${owner.id},true)`
    ).count;
    for (const n of [c.owner, ...c.members]) {
      const a = demoAccounts[n];
      await tx`INSERT INTO public.gyvft_circle_members(circle_id,account_id,role,display_name,share_profile) VALUES(${id},${a.id},${n === c.owner ? "admin" : "member"},${a.shortName},false)`;
    }
    if (c.category === "corporate") {
      await tx`INSERT INTO public.gyvft_circle_organisations(circle_id,name,website,domain) VALUES(${id},'Meridian Studio','https://meridian.example','meridian.example')`;
    }
    const people =
      c.key === "family"
        ? ["Appa", "Amma", "Tara", "Arjun"]
        : c.key === "meridian"
          ? ["Nila", "Vikram", "Sana", "Rohit", "Priya", "Dev"]
          : c.key === "alumni"
            ? ["Leela", "Aditya"]
            : c.key === "books"
              ? ["Farah", "Karthik"]
              : ["Revathi", "Ashwin"];
    for (const [i, name] of people.entries())
      await tx`INSERT INTO public.gyvft_circle_recipients(id,circle_id,name,email,about,likes,avoid,created_by) VALUES(${key(`circle:${c.key}:recipient:${i}`)},${id},${name},${c.key === "meridian" ? `team${i + 1}@meridian.example` : ""},'Fictional recipient. No invitation has been sent.',${c.key === "books" ? "Books, coffee and illustrated art" : c.key === "neighbours" ? "Gardening and local crafts" : "Useful keepsakes and thoughtful personal notes"},'Disposable plastic',${owner.id})`;
    const titles =
      c.key === "family"
        ? ["Amma’s birthday", "Our family gathering"]
        : c.key === "meridian"
          ? ["Team anniversary", "New colleague welcome"]
          : c.key === "alumni"
            ? ["Our annual reunion"]
            : c.key === "books"
              ? ["Book club year-end evening"]
              : ["Neighbourhood festive gathering"];
    for (const [i, title] of titles.entries())
      await tx`INSERT INTO public.gyvft_circle_occasions(id,circle_id,title,occasion_date,repeats_annually,description,created_by) VALUES(${key(`circle:${c.key}:occasion:${i}`)},${id},${title},current_date+${14 + i * 17}::int,true,'Fictional shared occasion for this demo circle.',${owner.id})`;
    const kind =
        c.key === "meridian"
          ? "business"
          : c.key === "family"
            ? "family"
            : "communities",
      a = demoAccounts.find((a) => a.kind === kind)!;
    const indices =
      c.key === "family"
        ? [0, 1, 2, 3, 4, 5, 6]
        : c.key === "meridian"
          ? [0, 1, 2, 3, 4, 5, 6, 7]
          : c.key === "alumni"
            ? [0, 5]
            : c.key === "books"
              ? [1, 4, 6]
              : [2, 3, 7];
    // Only exact known fixture keys/owners receive context. Private real gifts are untouched.
    for (const i of indices)
      await tx`UPDATE public.customer_projects SET circle_id=${id} WHERE id=${key(`${kind}:gift:${i}`)} AND customer_account_id=${a.id} AND submission_key=${`gyvft-demo-v1-${kind}-${i}`} AND circle_id IS NULL`;
    await tx`INSERT INTO public.gyvft_circle_events(circle_id,actor_account_id,operation) VALUES(${id},${owner.id},'demo.created')`;
  }
  return inserted;
}

/** Correct only untouched v1 fictional occasion context; retain all dates/content. */
export async function repairDemoOccasionContexts(tx: Sql) {
  let corrected = 0;
  for (const account of demoAccounts) {
    const scenario = scenarios[account.kind];
    for (const [i, title] of scenario.occasions.entries()) {
      const context = demoOccasionContexts[account.kind][i],
        oldPerson = i % scenario.people.length;
      const desiredPerson =
        context.person === null
          ? null
          : key(`${account.kind}:person:${context.person}`);
      const oldRelationship = scenario.people[oldPerson][1];
      if (
        oldRelationship === context.relationship &&
        desiredPerson === key(`${account.kind}:person:${oldPerson}`)
      )
        continue;
      const result =
        await tx`UPDATE public.gyvft_customer_occasions SET relationship=${context.relationship},person_id=${desiredPerson} WHERE id=${key(`${account.kind}:occasion:${i}`)} AND account_id=${account.id} AND title=${title} AND notes='A fictional upcoming occasion. Allow two days between requested delivery and the occasion.' AND relationship=${oldRelationship} AND person_id=${key(`${account.kind}:person:${oldPerson}`)}`;
      corrected += result.count;
    }
  }
  return corrected;
}

/** An explicit operator command for already-created, positively identified fixtures. */
export async function completeDemoCircles() {
  return getSql().begin(async (raw) => {
    const tx = raw as unknown as Sql;
    await tx`SET LOCAL statement_timeout='45s'`;
    const [lock] = await tx<
      { acquired: boolean }[]
    >`SELECT pg_try_advisory_xact_lock(714093822) AS acquired`;
    if (!lock.acquired)
      throw new CircleError(
        "CONFLICT",
        "Another demo update is running. Wait for it to finish.",
      );
    const accounts =
      await tx`SELECT a.id,a.email,p.about FROM public.gyvft_customer_accounts a LEFT JOIN public.gyvft_customer_profiles p ON p.account_id=a.id WHERE a.id IN ${tx(demoAccounts.map((a) => a.id))} OR a.email IN ${tx(demoAccounts.map((a) => a.email))}`;
    if (
      accounts.length !== 4 ||
      accounts.some(
        (row) =>
          !demoAccounts.some((a) => a.id === row.id && a.email === row.email) ||
          !String(row.about || "").startsWith("GYVFT-DEMO-v1"),
      )
    )
      throw new CircleError(
        "CONFLICT",
        "The four original demo accounts could not be confirmed. No records were changed. Use the full demo tool to create missing demo accounts first.",
      );
    const inserted = await seedDemoCircles(tx),
      corrected = await repairDemoOccasionContexts(tx);
    const status = await tx<
      { id: string; email: string; circles: number }[]
    >`SELECT a.id,a.email,count(c.id)::int AS circles FROM public.gyvft_customer_accounts a LEFT JOIN public.gyvft_circle_members m ON m.account_id=a.id AND m.state='active' LEFT JOIN public.gyvft_circles c ON c.id=m.circle_id AND c.archived_at IS NULL WHERE a.id IN ${tx(demoAccounts.map((a) => a.id))} GROUP BY a.id,a.email ORDER BY a.id`;
    return {
      inserted,
      corrected,
      accounts: status,
      message: inserted
        ? `Added ${inserted} demo circles. Existing passwords and membership choices were preserved.`
        : "Demo circles already exist. Existing membership, ownership and password choices were preserved.",
    };
  });
}
