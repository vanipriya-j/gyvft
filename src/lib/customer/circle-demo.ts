import "server-only";
import { createHash } from "node:crypto";
import type { Sql } from "postgres";
import { demoAccounts } from "./demo-accounts";
import { circlesReady } from "./circles";
import { CircleError } from "./circle-model";
const key = (s: string) => {
  const h = createHash("sha256").update(`gyvft-demo-v1:${s}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4000-8000-${h.slice(20, 32)}`;
};
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
