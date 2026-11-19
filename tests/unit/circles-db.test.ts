import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import postgres, { type Sql } from "postgres";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
let sql: Sql;
vi.mock("@/lib/database/client", () => ({ getSql: () => sql }));
vi.mock("@/lib/customer/notifications", () => ({
  queueNotification: vi.fn(),
  scheduleNotifications: vi.fn(),
}));
import {
  createCircle,
  changeCircle,
  circleForAccount,
  circlesForAccount,
  inviteToCircle,
  acceptCircleInvitation,
  circleInvitation,
  verifyCircleOrganisation,
  circleGiftContext,
} from "@/lib/customer/circles";
import { saveGift, saveProfile } from "@/lib/customer/journeys";
import { homeOccasions } from "@/lib/customer/home-data";
import { seedCustomerDemos } from "@/lib/customer/demo-seed";
import { demoAccounts } from "@/lib/customer/demo-accounts";
const db = process.env.GYVFT_CIRCLES_TEST_DB;
describe.skipIf(!db)("Circles against isolated local PostgreSQL", () => {
  const a = { id: randomUUID(), email: `owner-${randomUUID()}@example.test` },
    b = { id: randomUUID(), email: `member-${randomUUID()}@example.test` },
    c = { id: randomUUID(), email: `other-${randomUUID()}@example.test` };
  const id = randomUUID(),
    other = randomUUID(),
    institution = randomUUID(),
    recipient = randomUUID(),
    occasion = randomUUID(),
    gift = randomUUID();
  let token = "";
  const make = (cid: string, name = "Our family") => ({
    id: cid,
    name,
    category: "family",
    description: "Our private circle",
    display_name: "Owner",
  });
  beforeAll(async () => {
    const u = new URL(db!);
    if (
      u.hostname !== "127.0.0.1" ||
      u.port !== "55434" ||
      !["/gyvft_circles_test", "/gyvft_circles_release"].includes(u.pathname)
    )
      throw Error("Use the dedicated local Circles database.");
    sql = postgres(db!, { max: 5, prepare: false });
    for (const x of [a, b, c])
      await sql`INSERT INTO gyvft_customer_accounts(id,email,password_hash) VALUES(${x.id},${x.email},'local-unused-password')`;
  });
  afterAll(async () => {
    await sql?.end();
  });
  it("creates real ownership and permits multiple memberships without duplicate creation", async () => {
    const result = await Promise.all([
      createCircle(a, make(id)),
      createCircle(a, make(id)),
    ]);
    expect(result).toEqual([id, id]);
    await createCircle(a, make(other, "Friends"));
    expect((await circlesForAccount(a.id)).map((c) => c.id)).toEqual(
      expect.arrayContaining([id, other]),
    );
    await expect(createCircle(b, make(id))).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
  it("hides circles from outsiders and requires explicit accepted membership", async () => {
    await expect(circleForAccount(id, b.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const i = await inviteToCircle(a, id, {
      email: b.email,
      display_name: "Member",
    });
    token = i.token;
    expect((await circleInvitation(token))?.email).toBe(b.email);
    await expect(
      acceptCircleInvitation(c, token, {
        display_name: "Wrong user",
        share_profile: false,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await acceptCircleInvitation(b, token, {
      display_name: "Member",
      share_profile: false,
    });
    expect((await circleForAccount(id, b.id)).circle.role).toBe("member");
    await expect(
      changeCircle(b, id, { op: "update", name: "Hacked", description: "" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("keeps per-circle profile consent revocable and peer email/recipient notes private", async () => {
    await saveProfile(a.id, {
      name: "Owner",
      about: "My own words",
      interests: "Coffee",
      avoid: "Perfume",
      share_profile: true,
    });
    let d = await circleForAccount(id, b.id);
    expect(d.members.find((m) => m.account_id === a.id)).toMatchObject({
      about: null,
      email: null,
    });
    await changeCircle(a, id, {
      op: "profile",
      display_name: "Owner",
      share_profile: true,
    });
    d = await circleForAccount(id, b.id);
    expect(d.members.find((m) => m.account_id === a.id)?.interests).toBe(
      "Coffee",
    );
    await changeCircle(a, id, {
      op: "profile",
      display_name: "Owner",
      share_profile: false,
    });
    await changeCircle(a, id, {
      op: "recipient",
      recipient: {
        id: recipient,
        name: "A recipient",
        email: c.email,
        about: "Admin-only notes",
        likes: "Art",
      },
    });
    d = await circleForAccount(id, b.id);
    expect(d.recipients).toEqual([]);
    expect(d.invitations).toEqual([]);
    expect(d.members.find((m) => m.account_id === a.id)?.about).toBeNull();
    expect((await circleForAccount(id, a.id)).recipients[0].about).toBe(
      "Admin-only notes",
    );
  });
  it("links recipients through acceptance and revokes stale links after an email edit", async () => {
    const i = await inviteToCircle(a, id, {
      email: c.email,
      display_name: "Recipient",
      recipient_id: recipient,
    });
    await changeCircle(a, id, {
      op: "recipient",
      recipient: {
        id: recipient,
        name: "A recipient",
        email: "changed@example.test",
      },
    });
    expect(await circleInvitation(i.token)).toBeNull();
    await expect(
      acceptCircleInvitation(c, i.token, {
        display_name: "Recipient",
        share_profile: false,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await changeCircle(a, id, {
      op: "recipient",
      recipient: { id: recipient, name: "A recipient", email: c.email },
    });
    const fresh = await inviteToCircle(a, id, {
      email: c.email,
      display_name: "Recipient",
      recipient_id: recipient,
    });
    await acceptCircleInvitation(c, fresh.token, {
      display_name: "Recipient",
      share_profile: false,
    });
    expect(
      (await circleForAccount(id, a.id)).recipients[0].linked_account_id,
    ).toBe(c.id);
  });
  it("requires explicit occasion publication and isolates shared occasions from outsiders", async () => {
    const o = {
      id: occasion,
      title: "Family anniversary",
      occasion_date: "2026-12-12",
      repeats_annually: true,
    };
    await expect(
      changeCircle(a, id, { op: "occasion", occasion: o }),
    ).rejects.toThrow();
    await changeCircle(a, id, {
      op: "occasion",
      occasion: { ...o, publish: true },
    });
    expect((await circleGiftContext(b.id, id, occasion)).occasion?.title).toBe(
      o.title,
    );
    const upcoming = await homeOccasions(b.id, "2026-11-19", 0, 10);
    expect(
      upcoming.items.find((o) => o.id === occasion)?.action.href,
    ).toContain(`circle=${id}`);
    await expect(
      circleGiftContext(b.id, other, occasion),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("ties gifts to circle context without sharing gifts with peers or admins", async () => {
    const brief = {
      title: "A personal anniversary gift",
      story:
        "A thoughtful keepsake for our family anniversary, with a useful personalised bottle and a warm note.",
      occasion: "Anniversary",
      audience: "One person",
      recipients: 1,
      individuals: [],
      recipient_notes: "A family member",
      likes: "Coffee",
      avoid: "",
      message: "Thank you",
      formats: "Bottle",
      budget: "1500",
      budget_basis: "per_recipient",
      delivery_date: "2026-12-10",
      city: "Chennai",
      phone: "9000000000",
      occasion_id: null,
      person_id: null,
      circle_id: id,
      circle_occasion_id: occasion,
    };
    await saveGift(b, gift, brief, true);
    expect((await circleForAccount(id, b.id)).gifts.map((g) => g.id)).toContain(
      gift,
    );
    expect((await circleForAccount(id, a.id)).gifts).toEqual([]);
    await expect(
      saveGift(b, randomUUID(), { ...brief, circle_id: other }, true),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("prevents owner removal and readmission by replaying an accepted invitation", async () => {
    await expect(changeCircle(a, id, { op: "leave" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await changeCircle(a, id, { op: "remove", account_id: b.id });
    await expect(
      acceptCircleInvitation(b, token, {
        display_name: "Member",
        share_profile: false,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(circleForAccount(id, b.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const [p] =
      await sql`SELECT customer_account_id FROM customer_projects WHERE id=${gift}`;
    expect(p.customer_account_id).toBe(b.id);
  });
  it("requires the owner for admin grants and removed-member readmission; revokes demoted invites", async () => {
    await changeCircle(a, id, { op: "role", account_id: c.id, role: "admin" });
    await expect(
      inviteToCircle(c, id, { email: b.email, display_name: "Removed member" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const invited = await inviteToCircle(c, id, {
      email: "future@example.test",
      display_name: "Future member",
    });
    await expect(
      inviteToCircle(c, id, {
        email: "admin@example.test",
        display_name: "Admin",
        role: "admin",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await changeCircle(a, id, { op: "role", account_id: c.id, role: "member" });
    expect(await circleInvitation(invited.token)).toBeNull();
    const fresh = await inviteToCircle(a, id, {
      email: b.email,
      display_name: "Member",
    });
    await acceptCircleInvitation(b, fresh.token, {
      display_name: "Member",
      share_profile: false,
    });
  });
  it("supports archive/restore and transfer without deleting history", async () => {
    await changeCircle(a, id, { op: "archive", confirm: true });
    await expect(
      inviteToCircle(a, id, {
        email: "test@example.test",
        display_name: "Guest",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await circleForAccount(id, b.id)).gifts).toHaveLength(1);
    await expect(changeCircle(b, id, { op: "restore" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await changeCircle(a, id, { op: "restore" });
    await changeCircle(a, id, { op: "transfer", account_id: b.id });
    await expect(
      changeCircle(a, id, { op: "role", account_id: c.id, role: "admin" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await changeCircle(a, id, { op: "leave" });
    expect((await circleForAccount(id, b.id)).circle.owner_account_id).toBe(
      b.id,
    );
  });
  it("requires organisation details for institutions; edits reset real verification", async () => {
    await expect(
      createCircle(a, { ...make(institution), category: "corporate" }),
    ).rejects.toThrow();
    const organisation = {
      name: "Test Company",
      website: "https://company.example",
      domain: "company.example",
    };
    await createCircle(a, {
      ...make(institution, "Test Company"),
      category: "corporate",
      organisation,
    });
    expect(
      (await circleForAccount(institution, a.id)).organisation
        ?.verification_state,
    ).toBe("unverified");
    await verifyCircleOrganisation(institution, {
      state: "verified",
      note: "Website and owner authority checked by operator.",
      confirmed: true,
    });
    await changeCircle(a, institution, {
      op: "update",
      name: "New company",
      description: "",
      organisation: { ...organisation, name: "New company" },
    });
    expect(
      (await circleForAccount(institution, a.id)).organisation
        ?.verification_state,
    ).toBe("unverified");
  });
  it("checks invitation expiry, explicit replacement and archived-recipient access", async () => {
    const i = await inviteToCircle(b, id, {
      email: "expired@example.test",
      display_name: "Expired guest",
    });
    await expect(
      inviteToCircle(b, id, {
        email: "expired@example.test",
        display_name: "Expired guest",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const fresh = await inviteToCircle(b, id, {
      email: "expired@example.test",
      display_name: "Expired guest",
      replace: true,
    });
    expect(await circleInvitation(i.token)).toBeNull();
    await sql`UPDATE gyvft_circle_invitations SET expires_at=now()-interval '1 hour' WHERE id=${fresh.id}`;
    expect(await circleInvitation(fresh.token)).toBeNull();
    const rid = randomUUID();
    await changeCircle(b, id, {
      op: "recipient",
      recipient: {
        id: rid,
        name: "Archived recipient",
        email: "archive@example.test",
      },
    });
    const pending = await inviteToCircle(b, id, {
      email: "archive@example.test",
      display_name: "Archived recipient",
      recipient_id: rid,
    });
    await changeCircle(b, id, { op: "archive_recipient", recipient_id: rid });
    expect(await circleInvitation(pending.token)).toBeNull();
    expect(
      (
        await sql`SELECT archived_at FROM gyvft_circle_recipients WHERE id=${rid}`
      )[0].archived_at,
    ).toBeTruthy();
  });
  it("adds real demo circles explicitly and preserves records/passwords/consent on repeat", async () => {
    const password = readFileSync(
      "work/customer-demo-test-password.txt",
      "utf8",
    );
    await seedCustomerDemos(password);
    const d = await circlesForAccount(demoAccounts[2].id);
    expect(d).toHaveLength(5);
    expect(d.every((c) => c.share_profile === false)).toBe(true);
    const family = d.find((c) => c.category === "family")!;
    const member = demoAccounts[0];
    await changeCircle(member, family.id, {
      op: "profile",
      display_name: "Kavya",
      share_profile: true,
    });
    const [before] =
      await sql`SELECT password_hash FROM gyvft_customer_accounts WHERE id=${member.id}`;
    const book = d.find((c) => c.name === "The Sunday Book Club")!;
    if (book.owner_account_id === demoAccounts[2].id)
      await changeCircle(demoAccounts[2], book.id, {
        op: "transfer",
        account_id: member.id,
      });
    await seedCustomerDemos("different local-only password");
    const [after] =
      await sql`SELECT password_hash FROM gyvft_customer_accounts WHERE id=${member.id}`;
    expect(after.password_hash).toBe(before.password_hash);
    expect(
      (await circleForAccount(book.id, member.id)).circle.owner_account_id,
    ).toBe(member.id);
    expect(
      (await circleForAccount(family.id, member.id)).circle.share_profile,
    ).toBe(true);
    const meridian = d.find((c) => c.category === "corporate")!;
    expect(
      (await circleForAccount(meridian.id, demoAccounts[1].id)).recipients,
    ).toHaveLength(6);
    await expect(
      verifyCircleOrganisation(meridian.id, {
        state: "verified",
        note: "This is fictional, cannot verify.",
        confirmed: true,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
