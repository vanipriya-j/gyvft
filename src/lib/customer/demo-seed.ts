import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Sql } from "postgres";
import { getSql } from "@/lib/database/client";
import { hashCustomerPassword } from "./password";
import { demoAccounts, demoAccountIds } from "./demo-accounts";
import { indiaToday } from "./dashboard-model";
import { draftSchema } from "./gift-workspace-model";
import { giftBriefSchema } from "./journey-model";
import { storyRequestSchema } from "./story-request";
import { seedDemoCircles, repairDemoOccasionContexts } from "./circle-demo";
import {
  demoKey as key,
  demoScenarios as scenarios,
  demoOccasionContexts,
} from "./demo-fixtures";
import { logger } from "@/lib/logging/logger";

const marker = "GYVFT-DEMO-v1";
export const demoImagePaths = [
  "public/images/gyvft/case-studies/bits-2001-reunion/hero.png",
  "public/images/gyvft/case-studies/various-dance-schools/hero.png",
] as const;
export class DemoSeedConflict extends Error {}
type Value = string | number | boolean | Buffer | null;
type Row = Record<string, Value>;
type Table = { rows: Row[]; owner?: string; key?: string };

/** Explicit data-only command. No schema commands, deletion, notifications or integrations.
 * Circle context is attached only to exact known fictional gifts, when empty. */
export async function seedCustomerDemos(password: string, now = new Date()) {
  const today = indiaToday(now);
  const day = (offset: number) =>
    new Date(Date.parse(today + "T12:00:00Z") + offset * 86400000)
      .toISOString()
      .slice(0, 10);
  const time = (offset: number) => day(offset) + "T09:00:00+05:30";
  const hashes = await Promise.all(
    demoAccounts.map(() => hashCustomerPassword(password)),
  );
  const images = await Promise.all([
    readFile(
      path.join(
        process.cwd(),
        "public/images/gyvft/case-studies/bits-2001-reunion/hero.png",
      ),
    ),
    readFile(
      path.join(
        process.cwd(),
        "public/images/gyvft/case-studies/various-dance-schools/hero.png",
      ),
    ),
  ]);
  const tables = new Map<string, Table>();
  function add(table: string, row: Row, owner?: string, primaryKey = "id") {
    if (!tables.has(table))
      tables.set(table, { rows: [], owner, key: primaryKey });
    tables.get(table)!.rows.push(row);
  }
  for (const [aIndex, a] of demoAccounts.entries()) {
    const scenario = scenarios[a.kind],
      organisation =
        a.kind === "business" ? "Meridian Studio (fictional)" : null;
    add("gyvft_customer_accounts", {
      id: a.id,
      email: a.email,
      password_hash: hashes[aIndex],
      is_active: true,
      created_at: time(-180),
    });
    add(
      "gyvft_customer_profiles",
      {
        account_id: a.id,
        name: a.shortName,
        about: `${marker}. ${a.scenario}. Fictional demonstration profile. Circle membership is managed separately; fictional organisation claims remain unverified.`,
        interests:
          "Thoughtful everyday gifts, coffee, illustrated keepsakes and personal notes",
        avoid: "Disposable plastic and generic branding",
        share_profile: false,
      },
      undefined,
      "account_id",
    );
    const personIds = scenario.people.map((p, i) => {
      const id = key(`${a.kind}:person:${i}`);
      add(
        "gyvft_customer_people",
        {
          id,
          account_id: a.id,
          name: p[0],
          relationship: p[1],
          about: `Fictional recipient. ${p[2]}.`,
          likes: p[2],
          avoid: "Disposable packaging and generic messages",
          email: "",
          created_at: time(-170 + i),
        },
        "account_id",
      );
      return id;
    });
    const occasionIds = scenario.occasions.map((title, i) => {
      const id = key(`${a.kind}:occasion:${i}`),
        context = demoOccasionContexts[a.kind][i];
      add(
        "gyvft_customer_occasions",
        {
          id,
          account_id: a.id,
          title,
          occasion_date: day(7 + i * 9),
          repeats_annually: i % 2 === 0,
          person_id: context.person === null ? null : personIds[context.person],
          relationship: context.relationship,
          notes:
            "A fictional upcoming occasion. Allow two days between requested delivery and the occasion.",
          photo_data: i === 0 ? images[aIndex % 2] : null,
          photo_type: i === 0 ? "image/png" : null,
          created_at: time(-90 + i),
        },
        "account_id",
      );
      return id;
    });
    const gifts = [
      ...scenario.active.map((g, i) => ({
        title: g[0],
        stage: g[1],
        quantity: g[2],
        offset: g[3],
        created: -18 + i * 3,
        past: false,
      })),
      ...scenario.past.map((title, i) => ({
        title,
        stage: 10,
        quantity: a.kind === "single" ? 1 : 10 + i * 4,
        offset: -20 - i * 27,
        created: -40 - i * 27,
        past: true,
      })),
    ];
    for (const [i, g] of gifts.entries()) {
      const id = key(`${a.kind}:gift:${i}`),
        personIndex = Math.max(
          0,
          scenario.people.findIndex((p) =>
            g.title.toLowerCase().includes(p[0].toLowerCase()),
          ),
        ),
        person = personIds[personIndex],
        occasion = occasionIds[i % occasionIds.length];
      const total = g.quantity * 129900 + 15000,
        paid = g.stage >= 8 ? total : g.stage >= 5 ? Math.ceil(total / 2) : 0,
        converted = g.stage >= 4;
      const product = "Personalised bottle and keepsake card",
        brief = `${marker}. ${g.title}. We would like useful, warm gifts for ${g.quantity} recipient${g.quantity === 1 ? "" : "s"}, with one shared illustration and a thoughtful personal note. ${scenario.people[personIndex][2]}. This entire request is fictional sample activity.`;
      const document = giftBriefSchema.parse({
        title: g.title,
        story: brief,
        occasion: g.title,
        audience: g.quantity === 1 ? "One person" : "One group",
        recipients: g.quantity,
        individuals: [],
        recipient_notes: scenario.people[personIndex][0],
        likes: scenario.people[personIndex][2],
        avoid: "Disposable plastic",
        message: "A little thought, and a lasting connection.",
        formats: product,
        budget: "1500",
        budget_basis: "per_recipient",
        delivery_date: day(g.offset - 2),
        city: "Chennai",
        phone: "9000000000",
        person_id: person,
        occasion_id: occasion,
      });
      const story = storyRequestSchema.parse({
        source: "tell_your_story",
        version: 1,
        story_description: brief,
        occasion_type: "Other",
        occasion_other: g.title,
        audiences: [
          a.kind === "business"
            ? "Employees"
            : a.kind === "communities"
              ? "Community"
              : "Family",
        ],
        preferred_formats: ["Merchandise"],
        target_date: day(g.offset - 2),
        target_date_precision: "exact",
        quantity_range: String(g.quantity),
        budget_range: "₹1,500 per recipient",
        primary_city: "Chennai",
        multiple_locations: false,
        full_name: a.shortName,
        organisation_name: organisation,
        email: a.email,
        phone: "9000000000",
        preferred_contact_method: "email",
        communication_consent: true,
        marketing_consent: false,
      });
      add(
        "customer_projects",
        {
          id,
          submission_key: `gyvft-demo-v1-${a.kind}-${i}`,
          customer_account_id: a.id,
          customer_email: a.email,
          title: g.title,
          brief,
          kind: converted ? "project" : "enquiry",
          customer_type: a.kind === "business" ? "b2b" : "b2c",
          organisation_name: organisation,
          stage: g.stage,
          next_action: g.past
            ? "Your fictional gifts have been delivered. Explore feedback and shared moments."
            : g.stage === 3
              ? "Two sample directions are ready to explore."
              : g.stage === 4
                ? "Sample quote approved. A 50% advance would be due next."
                : g.stage === 6
                  ? "Sample artwork is ready to review."
                  : g.stage === 8
                    ? "Fictional gifts checked and packed, ready for dispatch."
                    : "Aarla is shaping this fictional gifting brief.",
          target_date: day(g.offset - 2),
          delivery_date: day(g.offset - 2),
          occasion_date: day(g.offset),
          total_paise: converted ? total : null,
          paid_paise: paid,
          gift_brief: JSON.stringify(story),
          draft_document: JSON.stringify(document),
          person_id: person,
          occasion_id: occasion,
          production_started_at: g.stage >= 7 ? time(g.created + 8) : null,
          task_owner: g.stage === 3 ? "Waiting with customer" : "Aarla",
          task_due_at: time(g.offset - 4),
          tracking_reference: g.past ? `DEMO-DELIVERED-${a.kind}-${i}` : null,
          tracking_url: null,
          created_at: time(g.created),
        },
        "customer_account_id",
      );
      add(
        "gyvft_gift_brief_revisions",
        {
          project_id: id,
          version: 1,
          document: JSON.stringify(document),
          created_at: time(g.created),
        },
        undefined,
        "project_id",
      );
      if (g.stage >= 3) {
        const options = [0, 1].map((n) => {
          const option = key(`${id}:option:${n}`),
            contents = [
              {
                key: "bottle",
                name: product,
                quantity: 1,
                unit_paise: n === 0 ? 129900 : 139900,
              },
            ];
          add(
            "gyvft_gift_options",
            {
              id: option,
              project_id: id,
              title: n === 0 ? "A warmth shared" : "A little colour, every day",
              description:
                "Fictional curated option. Existing Aarla photography illustrates this sample; the contents and prices are demonstration values.",
              contents: JSON.stringify(contents),
              image_data: images[n],
              image_type: "image/png",
              pricing: JSON.stringify({
                mode: "range",
                basis: "per_set",
                quantity: g.quantity,
                low_paise: n === 0 ? 129900 : 139900,
                high_paise: n === 0 ? 149900 : 159900,
                packaging_included: true,
              }),
              published: true,
              created_at: time(g.created + 2),
              request_id: key(`${option}:publish`),
            },
            "project_id",
          );
          return option;
        });
        if (converted) {
          const draft = key(`${id}:draft`),
            selection = key(`${id}:selection`);
          const snapshot = draftSchema.parse({
            label: "My chosen gift",
            recipients: g.quantity,
            lines: [
              {
                key: key(`${id}:line`),
                source: {
                  kind: "curated",
                  optionId: options[0],
                  key: "bottle",
                },
                quantity: 1,
                variants: {},
                name: product,
                unit_paise: 129900,
              },
            ],
            design: "suggested",
            design_notes:
              "A shared warm illustration with a small personal note.",
            personalisation: "One shared message across the gifts.",
            packaging: "Individual Aarla shopping bags",
            notes:
              "Fictional sample. Standard printing and applicable taxes included; delivery is quoted separately.",
            extra_budget_paise: null,
            extra_idea: "",
            based_on: options[0],
          });
          add(
            "gyvft_gift_drafts",
            {
              id: draft,
              project_id: id,
              version: 1,
              document: JSON.stringify(snapshot),
              updated_at: time(g.created + 3),
            },
            "project_id",
          );
          add(
            "gyvft_gift_selections",
            {
              id: selection,
              project_id: id,
              draft_id: draft,
              draft_version: 1,
              snapshot: JSON.stringify(snapshot),
              created_at: time(g.created + 3),
            },
            "project_id",
          );
          const quote = key(`${id}:quote`),
            items = [
              {
                name: product,
                quantity: g.quantity,
                unit_paise: 129900,
                item_type: "gift",
                personalisation: "Standard print and applicable taxes included",
              },
              {
                name: "Delivery at actuals · fictional estimate",
                quantity: 1,
                unit_paise: 15000,
                item_type: "fee",
                personalisation: "Sample charge",
              },
            ];
          add(
            "customer_project_approvals",
            {
              id: quote,
              project_id: id,
              kind: "proposal",
              version: 1,
              title: "Your gift quote · sample",
              description:
                "Fictional quote: 50% advance and remaining 50% before dispatch. Gift price includes standard printing and applicable taxes; delivery is a separate line.",
              status: "approved",
              customer_response:
                "Sample approval: this composition and amount work for us.",
              decided_at: time(g.created + 4),
              amount_paise: total,
              items: JSON.stringify(items),
              image_data: images[0],
              image_type: "image/png",
              gift_selection_id: selection,
              created_at: time(g.created + 3),
            },
            "project_id",
          );
          for (const [j, item] of items.entries())
            add(
              "customer_order_items",
              {
                id: key(`${id}:item:${j}`),
                project_id: id,
                approval_id: quote,
                ...item,
              },
              "project_id",
            );
          if (g.stage >= 6)
            add(
              "customer_project_approvals",
              {
                id: key(`${id}:artwork`),
                project_id: id,
                kind: "design",
                version: 1,
                title: "The shared illustration · sample",
                description:
                  "Fictional artwork preview using existing Aarla photography. No production artwork or real print file is represented.",
                status: g.stage === 6 ? "pending" : "approved",
                customer_response:
                  g.stage === 6 ? null : "Sample artwork approved.",
                decided_at: g.stage === 6 ? null : time(g.created + 7),
                amount_paise: null,
                items: null,
                image_data: images[1],
                image_type: "image/png",
                gift_selection_id: selection,
                created_at: time(g.created + 6),
              },
              "project_id",
            );
          const payments =
            paid === total
              ? [Math.ceil(total / 2), total - Math.ceil(total / 2)]
              : paid
                ? [paid]
                : [];
          payments.forEach((amount, j) =>
            add(
              "customer_payment_submissions",
              {
                id: key(`${id}:receipt:${j}`),
                project_id: id,
                amount_paise: amount,
                reference: `DEMO-${a.kind}-${i}-${j}`,
                status: "verified",
                verified_at: time(g.created + 5 + j * 4),
                created_at: time(g.created + 5 + j * 4),
              },
              "project_id",
            ),
          );
          add(
            "customer_delivery_addresses",
            {
              project_id: id,
              recipient_name: scenario.people[personIndex][0],
              phone: "9000000000",
              address: "12 Example Lane · fictional demonstration address",
              city: "Chennai",
              state: "Tamil Nadu",
              postal_code: "600001",
              updated_at: time(g.created + 4),
            },
            undefined,
            "project_id",
          );
        }
      }
      const events = [
        ["Your story reached Aarla", brief, g.created],
        [
          "A little more about your recipients",
          `Fictional preferences: ${scenario.people[personIndex][2]}.`,
          g.created + 1,
        ],
        ...(g.stage >= 3
          ? [
              [
                "Two gift directions shared",
                "Visuals, indicative prices and compositions are ready in Options.",
                g.created + 2,
              ],
            ]
          : []),
        ...(converted
          ? [
              [
                "Sample quote approved",
                "The selected composition and sample quote were approved together.",
                g.created + 4,
              ],
            ]
          : []),
        ...(g.past
          ? [
              [
                "Delivered · sample history",
                "A fictional completed gifting occasion; no live shipment was created.",
                g.offset - 2,
              ],
            ]
          : []),
      ];
      events.forEach((e, n) =>
        add(
          "customer_project_events",
          {
            id: key(`${id}:event:${n}`),
            project_id: id,
            title: String(e[0]),
            body: String(e[1]),
            created_at: time(Number(e[2])),
          },
          "project_id",
        ),
      );
      [
        "Would a warmer colour palette suit their everyday style?",
        "Yes, please keep the shared illustration warm and the note personal.",
        "We’ve included that in this sample direction, with delivery listed separately.",
      ].forEach((body, n) =>
        add(
          "customer_project_messages",
          {
            id: key(`${id}:message:${n}`),
            project_id: id,
            sender: n === 1 ? "customer" : "team",
            body: `[Fictional conversation] ${body}`,
            created_at: time(g.created + 1 + n),
          },
          "project_id",
        ),
      );
      add(
        "gyvft_gift_internal_notes",
        {
          id: key(`${id}:internal`),
          project_id: id,
          body: "Fictional demo request. Do not create payment requests, external orders or send operational notifications.",
          created_at: time(g.created + 1),
        },
        "project_id",
      );
      if (g.past) {
        add(
          "gyvft_gift_testimonials",
          {
            project_id: id,
            rating: i % 2 === 0 ? 5 : 4,
            body: "Fictional feedback: the little personal details made everyone smile.",
            public_permission: false,
            featured: false,
            updated_at: time(g.offset + 1),
          },
          undefined,
          "project_id",
        );
        if (i % 2 === 0)
          add(
            "gyvft_gift_photos",
            {
              id: key(`${id}:moment`),
              project_id: id,
              caption:
                "Sample memory · existing Aarla image, not a photograph of this fictional event",
              kind: "The celebration",
              image_data: images[0],
              image_type: "image/png",
              public_permission: false,
              featured: false,
              created_at: time(g.offset + 1),
            },
            "project_id",
          );
      }
    }
    for (const slug of [
      "private-diwali-hampers",
      "kumon-delegate-gifting",
      "root360",
    ])
      add(
        "gyvft_customer_saved_ideas",
        { account_id: a.id, story_slug: slug, created_at: time(-15) },
        undefined,
        "account_id",
      );
  }
  // Dependencies are explicit: parents precede children, regardless of scenario order.
  const order = [
    "gyvft_customer_accounts",
    "gyvft_customer_profiles",
    "gyvft_customer_people",
    "gyvft_customer_occasions",
    "customer_projects",
    "gyvft_gift_brief_revisions",
    "gyvft_gift_options",
    "gyvft_gift_drafts",
    "gyvft_gift_selections",
    "customer_project_approvals",
    "customer_order_items",
    "customer_payment_submissions",
    "customer_delivery_addresses",
    "customer_project_events",
    "customer_project_messages",
    "gyvft_gift_internal_notes",
    "gyvft_gift_testimonials",
    "gyvft_gift_photos",
    "gyvft_customer_saved_ideas",
  ];
  let inserted = 0;
  await getSql().begin(async (raw) => {
    const tx = raw as unknown as Sql;
    await tx`SET LOCAL statement_timeout='45s'`;
    const [lock] = await tx<
      { acquired: boolean }[]
    >`SELECT pg_try_advisory_xact_lock(714093822) AS acquired`;
    if (!lock.acquired)
      throw new DemoSeedConflict(
        "A demo-data addition is already running. Wait for it to finish.",
      );
    const existing =
      await tx`SELECT a.id,a.email,p.about FROM public.gyvft_customer_accounts a LEFT JOIN public.gyvft_customer_profiles p ON p.account_id=a.id WHERE a.id IN ${tx(demoAccountIds)} OR a.email IN ${tx(demoAccounts.map((a) => a.email))}`;
    for (const row of existing) {
      if (
        !demoAccounts.some((a) => a.id === row.id && a.email === row.email) ||
        !String(row.about || "").startsWith(marker)
      )
        throw new DemoSeedConflict(
          "An account already occupies a demo email or identifier. Nothing was changed; existing accounts will not be replaced.",
        );
    }
    for (const table of order) {
      const { rows, owner, key: primaryKey } = tables.get(table)!;
      if (owner) {
        const prior =
          await tx`SELECT ${tx(primaryKey!)},${tx(owner)} FROM public.${tx(table)} WHERE ${tx(primaryKey!)} IN ${tx(rows.map((r) => r[primaryKey!]))}`;
        const wanted = new Map(rows.map((r) => [r[primaryKey!], r[owner]]));
        if (prior.some((r) => r[owner] !== wanted.get(r[primaryKey!])))
          throw new DemoSeedConflict(
            "A demo identifier conflicts with another record. Nothing was changed.",
          );
      }
      const jsonFields = new Set([
        "document",
        "gift_brief",
        "draft_document",
        "contents",
        "pricing",
        "snapshot",
        "items",
      ]);
      const values = rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([name, value]) => [
            name,
            jsonFields.has(name) && typeof value === "string"
              ? tx.json(JSON.parse(value))
              : value,
          ]),
        ),
      );
      try {
        const result =
          await tx`INSERT INTO public.${tx(table)} ${tx(values, Object.keys(rows[0]))} ON CONFLICT DO NOTHING`;
        inserted += result.count;
      } catch (error) {
        const code =
          error &&
          typeof error === "object" &&
          "code" in error &&
          typeof error.code === "string" &&
          /^[0-9]{2}[A-Z0-9]{3}$/.test(error.code)
            ? error.code
            : "DEMO_INSERT_FAILED";
        logger.error("Demo batch rejected before commit", { table, code });
        throw error;
      }
    }
    inserted += await seedDemoCircles(tx);
    await repairDemoOccasionContexts(tx);
  });
  return {
    inserted,
    accounts: demoAccounts.map((a) => ({ ...a, loginUrl: "/account/login" })),
    counts: {
      circles: 5,
      circleMemberships: 11,
      gifts: tables.get("customer_projects")!.rows.length,
      people: tables.get("gyvft_customer_people")!.rows.length,
      occasions: tables.get("gyvft_customer_occasions")!.rows.length,
      options: tables.get("gyvft_gift_options")!.rows.length,
      receipts: tables.get("customer_payment_submissions")!.rows.length,
    },
    message: inserted
      ? "Four demo workspaces are ready. Existing accounts and passwords were preserved."
      : "The demo records already exist. Existing records and passwords were preserved.",
  };
}
