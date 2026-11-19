import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import postgres, { type Sql } from "postgres";
import { randomUUID } from "node:crypto";
let sql: Sql;
vi.mock("@/lib/database/client", () => ({ getSql: () => sql }));
vi.mock("@/lib/customer/notifications", () => ({ queueNotification: vi.fn() }));
import { saveGift } from "@/lib/customer/journeys";
import { circlesReady } from "@/lib/customer/circles";
const url = process.env.GYVFT_CIRCLES_LEGACY_TEST_DB;
describe.skipIf(!url)(
  "Circles release before approved schema activation",
  () => {
    const actor = {
      id: randomUUID(),
      email: `rollout-${randomUUID()}@example.test`,
    };
    const brief = {
      title: "A gift before Circles activation",
      story:
        "A thoughtful birthday gift with a useful personalised bottle and a warm handwritten note.",
      occasion: "Birthday",
      audience: "One person",
      recipients: 1,
      individuals: [],
      recipient_notes: "A friend",
      likes: "Coffee",
      avoid: "",
      message: "Thank you",
      formats: "Bottle",
      budget: "1500",
      budget_basis: "per_recipient",
      delivery_date: "",
      city: "Chennai",
      phone: "9000000000",
      occasion_id: null,
      person_id: null,
    };
    beforeAll(async () => {
      const u = new URL(url!);
      if (
        u.hostname !== "127.0.0.1" ||
        u.port !== "55434" ||
        u.pathname !== "/gyvft_circles_legacy_test"
      )
        throw Error("Dedicated local pre-Circles schema required.");
      sql = postgres(url!, { prepare: false });
      await sql`INSERT INTO gyvft_customer_accounts(id,email,password_hash) VALUES(${actor.id},${actor.email},'local-only')`;
    });
    afterAll(async () => {
      await sql?.end();
    });
    it("keeps ordinary gift creation working without running migrations and rejects circle context clearly", async () => {
      expect(await circlesReady()).toBe(false);
      const id = await saveGift(actor, randomUUID(), brief, true);
      expect(
        (await sql`SELECT title FROM customer_projects WHERE id=${id}`)[0]
          .title,
      ).toBe(brief.title);
      await expect(
        saveGift(
          actor,
          randomUUID(),
          { ...brief, circle_id: randomUUID() },
          true,
        ),
      ).rejects.toThrow("approved database update");
      expect(await circlesReady()).toBe(false);
    });
  },
);
