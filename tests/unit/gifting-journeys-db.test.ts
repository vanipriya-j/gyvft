import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import postgres, { type Sql } from "postgres";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
let sql: Sql;
let actor: { id: string; email: string } | null = null;
vi.mock("@/lib/database/client", () => ({ getSql: () => sql }));
vi.mock("@/lib/customer/session", () => ({
  requireCustomerAccount: async () => actor,
  getCustomerAccount: async () => actor,
}));
vi.mock("@/lib/customer/notifications", () => ({
  queueNotification: vi.fn(),
  scheduleNotifications: vi.fn(),
}));
vi.mock("@/lib/customer/observability", () => ({
  recordCustomerEvent: vi.fn(),
}));
import {
  saveGift,
  savePerson,
  saveProfile,
  peopleFor,
  saveOccasion,
  invitePerson,
  acceptInvitation,
  requestVersionChange,
} from "@/lib/customer/journeys";
import {
  addMomentPhoto,
  photoPermission,
  featureMomentPhoto,
  momentsFor,
  saveTestimonial,
} from "@/lib/customer/moments";
import {
  pilotList,
  pilotDetail,
  mutatePilot,
} from "@/lib/customer/pilot-admin";
import {
  operatorJourneyCommand,
  operationsDirectory,
} from "@/lib/customer/operations-workflow";
import { requestForAccount } from "@/lib/customer/request";
import {
  publishGiftOption,
  saveGiftDraft,
  requestGiftQuote,
  giftWorkspace,
  setGiftVisibility,
} from "@/lib/customer/gift-workspace";
import { emptyGiftDraft } from "@/lib/customer/gift-workspace-model";
import {
  decideApproval,
  submitPayment,
  correctPaymentProof,
} from "@/app/account/actions";
import { GET as asset } from "@/app/api/customer-assets/[kind]/[id]/route";
const url = process.env.GYVFT_JOURNEY_TEST_DB;
describe.skipIf(!url)("approved gifting model on disposable PostgreSQL", () => {
  const account = randomUUID(),
    other = randomUUID(),
    gift = randomUUID(),
    privateDraft = randomUUID(),
    person = randomUUID(),
    occasion = randomUUID();
  let quoteId = "",
    designId = "",
    photoA = "",
    photoB = "";
  const a = { id: account, email: `${account}@example.test` },
    b = { id: other, email: `${other}@example.test` };
  const brief = {
    title: "The thoughtful family gift",
    story:
      "A warm thank-you for ten family members, with useful keepsakes and a shared personalised design.",
    occasion: "Family celebration",
    audience: "One group",
    recipients: 10,
    individuals: [],
    recipient_notes: "Ten friends and family members",
    likes: "Music and coffee",
    avoid: "Strong perfume",
    message: "Thank you for being part of our story",
    formats: "Bottle, card, keepsake",
    budget: "1300",
    budget_basis: "per_recipient",
    delivery_date: "2026-12-12",
    city: "Chennai",
    phone: "9000000000",
    occasion_id: occasion,
    person_id: person,
  };
  const image = readFileSync(
    "public/images/gyvft/case-studies/various-dance-schools/hero.png",
  );
  const op = (raw: Record<string, unknown>) =>
    mutatePilot({ id: gift, request_id: randomUUID(), ...raw });
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (
      parsed.hostname !== "127.0.0.1" ||
      parsed.port !== "55434" ||
      parsed.pathname !== "/gyvftapproved"
    )
      throw Error("Dedicated local fixture required.");
    sql = postgres(url!, { max: 5, prepare: false });
    await sql`INSERT INTO gyvft_customer_accounts(id,email,password_hash) VALUES(${account},${a.email},'TEST'),(${other},${b.email},'TEST')`;
    actor = a;
  });
  afterAll(async () => {
    if (sql) {
      await sql`DELETE FROM customer_projects WHERE customer_account_id IN (${account},${other})`;
      await sql`DELETE FROM gyvft_customer_accounts WHERE id IN (${account},${other})`;
      await sql.end();
    }
  });
  it("keeps notes private and reads the invited person’s profile only with revocable permission", async () => {
    await savePerson(account, person, {
      name: "Amma",
      relationship: "Mother",
      email: b.email,
      about: "My private note",
      likes: "Morning coffee",
      avoid: "",
    });
    await saveProfile(other, {
      name: "Amma",
      about: "My own shared words",
      interests: "Music",
      avoid: "",
      share_profile: true,
    });
    const invite = await invitePerson(account, person);
    await expect(acceptInvitation(a, invite.token)).rejects.toThrow("email");
    await acceptInvitation(b, invite.token);
    expect((await peopleFor(account))[0].shared_about).toBe(
      "My own shared words",
    );
    expect(await peopleFor(other)).toHaveLength(0);
    await saveProfile(other, {
      name: "Amma",
      about: "My own shared words",
      interests: "Music",
      avoid: "",
      share_profile: false,
    });
    expect((await peopleFor(account))[0].shared_about).toBeNull();
    await expect(
      savePerson(other, person, {
        name: "Intruder",
        relationship: "",
        email: "",
        about: "",
        likes: "",
        avoid: "",
      }),
    ).rejects.toThrow("unavailable");
  });
  it("owns linked people/occasions and excludes unsent drafts from Operations", async () => {
    await saveOccasion(account, occasion, {
      title: "Family celebration",
      occasion_date: "2026-12-14",
      repeats_annually: true,
      notes: "Remember their favourites",
      relationship: "Family",
      person_id: person,
    });
    await expect(saveGift(b, randomUUID(), brief)).rejects.toThrow("Occasion");
    await saveGift(a, privateDraft, { ...brief, title: "Private draft" }, true);
    expect((await pilotList()).some((p) => p.id === privateDraft)).toBe(false);
    await expect(pilotDetail(privateDraft)).rejects.toThrow("unavailable");
    await saveGift(a, gift, brief);
    await expect(saveGift(a, gift, brief, true)).rejects.toThrow("submitted");
    expect(
      (await operationsDirectory()).occasions.some((o) => o.id === occasion),
    ).toBe(true);
    expect(await requestForAccount(gift, other)).toBeNull();
    expect((await requestForAccount(gift, account))?.project.title).toBe(
      brief.title,
    );
  });
  it("keeps published curation immutable and separates operator visibility from the customer’s personal hiding", async () => {
    await publishGiftOption(gift, randomUUID(), {
      title: "A warmth shared",
      description: "Curated bottle and keepsakes",
      contents: [
        { key: "bottle", name: "Bottle", quantity: 1, unit_paise: 120000 },
      ],
      pricing: {
        mode: "range",
        basis: "per_set",
        quantity: 10,
        low_paise: 120000,
        high_paise: 135000,
        packaging_included: false,
      },
      image: { mime: "image/png", data: image.toString("base64") },
    });
    const original = (await giftWorkspace(gift, account)).options[0];
    await setGiftVisibility(gift, original.id, "curated", true, account);
    expect((await giftWorkspace(gift, account)).options[0].hidden).toBe(true);
    await setGiftVisibility(gift, original.id, "curated", true);
    expect((await giftWorkspace(gift, account)).options).toHaveLength(0);
    await setGiftVisibility(gift, original.id, "curated", false);
    const doc = {
      ...emptyGiftDraft("Option C"),
      recipients: 10,
      lines: [
        {
          key: randomUUID(),
          source: {
            kind: "curated" as const,
            optionId: original.id,
            key: "bottle",
          },
          quantity: 1,
          variants: {},
        },
      ],
    };
    const saved = await saveGiftDraft(gift, account, randomUUID(), 0, doc);
    await requestGiftQuote(
      gift,
      account,
      saved.id,
      saved.version,
      randomUUID(),
    );
    expect((await giftWorkspace(gift)).options[0].contents).toEqual(
      original.contents,
    );
  });
  it("saves a private priced quote, publishes a version, and unlocks only the approved advance", async () => {
    const selection = (await giftWorkspace(gift)).selections[0];
    await operatorJourneyCommand({
      id: gift,
      request_id: randomUUID(),
      op: "save_approval_draft",
      kind: "proposal",
      title: "Family gift quote",
      description: "Ten gifts, taxes included; packaging and delivery listed.",
      items: [
        {
          name: "Gift set",
          quantity: 10,
          unit_paise: 125000,
          item_type: "gift",
          personalisation: "One shared design",
        },
        {
          name: "Packaging",
          quantity: 10,
          unit_paise: 5000,
          item_type: "fee",
          personalisation: "",
        },
        {
          name: "Delivery",
          quantity: 1,
          unit_paise: 30000,
          item_type: "fee",
          personalisation: "",
        },
      ],
      gift_selection_id: selection.id,
    });
    expect((await requestForAccount(gift, account))!.approvals).toHaveLength(0);
    await op({ op: "publish", kind: "proposal", saved_draft_version: 1 });
    const q = (await requestForAccount(gift, account))!.approvals[0];
    quoteId = q.id;
    const fd = new FormData();
    fd.set("decision", "approved");
    expect((await decideApproval(gift, quoteId, fd)).ok).toBe(true);
    const p = (await requestForAccount(gift, account))!.project;
    expect(p.kind).toBe("project");
    expect(Number(p.total_paise)).toBe(1330000);
    expect(Number(p.paid_paise)).toBe(0);
  });
  it("keeps proof pending until bank verification and records only verified money", async () => {
    const f = new FormData();
    f.set("amount", "6650");
    f.set("reference", "LOCAL-ADVANCE-RECEIPT");
    f.set("evidence", new File([image], "payment.png", { type: "image/png" }));
    expect((await submitPayment(gift, f)).ok).toBe(true);
    const [submission] =
      await sql`SELECT id FROM customer_payment_submissions WHERE project_id=${gift}`;
    f.set("reference", "LOCAL-ADVANCE-CORRECTED");
    actor = b;
    expect((await correctPaymentProof(gift, submission.id, f)).ok).toBe(false);
    actor = a;
    expect((await correctPaymentProof(gift, submission.id, f)).ok).toBe(true);
    expect(
      Number((await requestForAccount(gift, account))!.project.paid_paise),
    ).toBe(0);
    await op({
      op: "payment",
      reference: "LOCAL-ADVANCE-CORRECTED",
      confirmed_receipt: true,
    });
    expect(
      Number((await requestForAccount(gift, account))!.project.paid_paise),
    ).toBe(665000);
    expect((await correctPaymentProof(gift, submission.id, f)).ok).toBe(false);
  });
  it("preserves internal notes separately, deduplicates a retried command, and requires official-order production readiness", async () => {
    const command = {
      id: gift,
      op: "internal_note",
      body: "Private supplier discussion",
      request_id: randomUUID(),
    };
    await operatorJourneyCommand(command);
    await operatorJourneyCommand(command);
    expect((await pilotDetail(gift)).journey.notes).toHaveLength(1);
    expect(
      JSON.stringify(await requestForAccount(gift, account)),
    ).not.toContain("Private supplier discussion");
    await op({
      op: "publish",
      kind: "design",
      title: "Shared artwork",
      description: "Review spelling and placement",
      image: { mime: "image/png", data: image.toString("base64") },
    });
    designId = (await requestForAccount(gift, account))!.approvals.find(
      (x) => x.kind === "design",
    )!.id;
    const f = new FormData();
    f.set("decision", "approved");
    await decideApproval(gift, designId, f);
    await expect(
      op({ op: "progress", stage: 7, next_action: "In production" }),
    ).rejects.toThrow("Shopify");
    await requestVersionChange(
      account,
      gift,
      designId,
      "Please adjust the printed name.",
    );
    await op({
      op: "instructions",
      upi_id: "",
      razorpay_url: "",
      shopify_order_reference: "#MANUAL-TEST",
    });
    await expect(
      op({ op: "progress", stage: 7, next_action: "In production" }),
    ).rejects.toThrow("change");
    await op({
      op: "publish",
      kind: "design",
      title: "Shared artwork revised",
      description: "Name corrected",
    });
    const latest = (await requestForAccount(gift, account))!.approvals.find(
      (x) => x.kind === "design",
    )!;
    expect(latest.status).toBe("pending");
    expect(latest.version).toBe(2);
    await decideApproval(gift, latest.id, f);
    await op({
      op: "progress",
      stage: 7,
      next_action: "Your gifts are being made.",
    });
  });
  it("locks gift and artwork changes at the server boundary after production starts", async () => {
    await expect(
      requestVersionChange(account, gift, designId, "Another change"),
    ).rejects.toThrow("Production");
    await expect(saveGift(a, gift, brief)).rejects.toThrow("Production");
    await expect(
      saveGiftDraft(gift, account, randomUUID(), 0, emptyGiftDraft()),
    ).rejects.toThrow("locked");
    await expect(
      op({
        op: "publish",
        kind: "design",
        title: "New artwork",
        description: "Not allowed",
      }),
    ).rejects.toThrow("fulfilment");
    await expect(
      op({ op: "progress", stage: 2, next_action: "Move backwards" }),
    ).rejects.toThrow("locked");
  });
  it("withdraws exactly one featured photo, retaining its private copy and the second photo’s permission", async () => {
    await sql`UPDATE customer_projects SET stage=10 WHERE id=${gift}`;
    photoA = randomUUID();
    photoB = randomUUID();
    for (const id of [photoA, photoB])
      await addMomentPhoto(account, gift, id, {
        caption: id === photoA ? "First moment" : "Second moment",
        kind: "Gift distribution",
        rights: true,
        public_permission: true,
        bytes: image,
        mime: "image/png",
      });
    await featureMomentPhoto(photoA, true);
    await featureMomentPhoto(photoB, true);
    actor = null;
    const read = (id: string) =>
      asset(new Request(`http://localhost/api/customer-assets/moment/${id}`), {
        params: Promise.resolve({ kind: "moment", id }),
      });
    expect((await read(photoA)).status).toBe(200);
    await expect(photoPermission(other, photoA, false)).rejects.toThrow(
      "unavailable",
    );
    await photoPermission(account, photoA, false);
    expect((await read(photoA)).status).toBe(404);
    expect((await read(photoB)).status).toBe(200);
    actor = a;
    expect((await read(photoA)).status).toBe(200);
    const photos = (await momentsFor(gift, account)).photos;
    expect(photos).toHaveLength(2);
    expect(photos.find((p) => p.id === photoB)?.featured).toBe(true);
    await photoPermission(account, photoA, true);
    expect(
      (await momentsFor(gift, account)).photos.find((p) => p.id === photoA)
        ?.featured,
    ).toBe(false);
    actor = a;
  });
  it("does not publish private feedback by default", async () => {
    await saveTestimonial(account, gift, {
      rating: 5,
      body: "A lovely shared memory.",
      public_permission: false,
    });
    const m = await momentsFor(gift, account);
    expect(m.testimonial?.featured).toBe(false);
    await expect(
      operatorJourneyCommand({
        id: gift,
        request_id: randomUUID(),
        op: "feature_testimonial",
        featured: true,
      }),
    ).rejects.toThrow("permitted");
  });
});
