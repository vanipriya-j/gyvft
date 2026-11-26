import postgres, { type Sql } from "postgres";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
let sql: Sql;
const context = vi.hoisted(() => ({
  account: null as { id: string; email: string } | null,
}));
vi.mock("@/lib/database/client", () => ({ getSql: () => sql }));
vi.mock("@/lib/customer/session", () => ({
  getCustomerAccount: async () => context.account,
  sessionCookie: "gyvft_customer_session",
}));
import { demoAccounts } from "@/lib/customer/demo-accounts";
import { demoKey } from "@/lib/customer/demo-fixtures";
import { demoProjectSpecs } from "@/lib/customer/demo-feature-data";
import { demoProjectContext } from "@/lib/customer/demo-feature-context";
import { giftWorkspace } from "@/lib/customer/gift-workspace";
import { shipmentsForProject } from "@/lib/customer/shipping";
import { requirementAttachmentsFor } from "@/lib/customer/operations-intake";
import { catalogueForAccount } from "@/lib/customer/account-catalogue";
import { GET as asset } from "@/app/api/customer-assets/[kind]/[id]/route";
import {
  savePrivateDetails,
  privateDetailsVersion,
} from "@/lib/customer/private-details";
import { POST as saveRoute } from "@/app/api/customer/private-details/route";
const uri = process.env.TEST_DEMO_COVERAGE_DB_URL;
const download = (kind: string, id: string) =>
  asset(
    new Request(`https://www.gyvft.com/api/customer-assets/${kind}/${id}`),
    { params: Promise.resolve({ kind, id }) },
  );
describe.skipIf(!uri)(
  "owned demo coverage and retry-safe private details",
  () => {
    const customer = randomUUID(),
      person = randomUUID(),
      occasion = randomUUID();
    beforeAll(async () => {
      const target = new URL(uri!);
      if (
        target.hostname !== "127.0.0.1" ||
        target.port !== "55438" ||
        target.pathname !== "/gyvft_gallery_test"
      )
        throw Error("Dedicated disposable demo fixture required");
      sql = postgres(uri!, { max: 1, prepare: false });
      await sql`INSERT INTO gyvft_customer_accounts(id,email,password_hash) VALUES(${customer}::uuid,${`fixture-${customer}@example.test`},'local-fixture-only')`;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw Error("Provider calls forbidden during demo QA");
        }),
      );
    });
    afterAll(async () => {
      if (sql) {
        await sql`DELETE FROM gyvft_customer_accounts WHERE id=${customer}::uuid`;
        await sql.end();
      }
      vi.unstubAllGlobals();
    });
    it("provides all 28 existing demo briefs, protected attachments, galleries and shipping without provider calls", async () => {
      expect(demoProjectSpecs).toHaveLength(28);
      for (const spec of demoProjectSpecs) {
        const account = demoAccounts.find((a) => a.id === spec.accountId)!;
        context.account = account;
        expect(
          await demoProjectContext(sql, spec.projectId, customer),
        ).toBeNull();
        const files = await requirementAttachmentsFor(spec.projectId);
        expect(files).toHaveLength(1);
        const pdf = await download("requirement", files[0].id);
        expect(pdf.status).toBe(200);
        expect(pdf.headers.get("cache-control")).toBe("private, no-store");
        expect((await pdf.text()).startsWith("%PDF-1.4")).toBe(true);
        const workspace = await giftWorkspace(spec.projectId, account.id);
        for (const option of workspace.options.filter((o) => o.has_image)) {
          expect(option.images.length).toBeGreaterThan(0);
          const image = await download(
            "gift-option-image",
            option.images[0].id,
          );
          expect(image.status).toBe(200);
          expect((await image.arrayBuffer()).byteLength).toBeGreaterThan(100);
        }
        const delivery = await shipmentsForProject(spec.projectId, account.id);
        expect(delivery.available).toBe(true);
        if (spec.stage === 10) {
          expect(delivery.delivered).toBe(spec.quantity);
          expect(delivery.shipments.length).toBeGreaterThan(0);
        }
        context.account = { id: customer, email: "fixture@example.test" };
        expect((await download("requirement", files[0].id)).status).toBe(404);
        expect(
          (
            await download(
              "gift-option-image",
              demoKey(`${demoKey(`${spec.projectId}:option:0`)}:demo-extra`),
            )
          ).status,
        ).toBe(404);
        await expect(giftWorkspace(spec.projectId, customer)).rejects.toThrow(
          "unavailable",
        );
        await expect(
          shipmentsForProject(spec.projectId, customer),
        ).rejects.toThrow("unavailable");
      }
      for (const account of demoAccounts)
        expect(
          (await catalogueForAccount(account.id)).allProducts,
        ).toHaveLength(6);
      expect(fetch).not.toHaveBeenCalled();
    }, 30000);
    it("idempotently replays a save, serialises concurrent edits and refuses another account", async () => {
      const document = {
        name: "Local fixture",
        relationship: "Friend",
        email: "",
        about: "Private notes",
        likes: "Coffee",
        avoid: "",
      };
      const input = {
        accountId: customer,
        kind: "person",
        id: person,
        version: null,
        document,
      };
      const first = await savePrivateDetails(customer, input);
      expect(await savePrivateDetails(customer, input)).toEqual(first);
      const edits = await Promise.allSettled([
        savePrivateDetails(customer, {
          ...input,
          version: first.version,
          document: { ...document, likes: "Music" },
        }),
        savePrivateDetails(customer, {
          ...input,
          version: first.version,
          document: { ...document, likes: "Books" },
        }),
      ]);
      expect(edits.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(edits.filter((r) => r.status === "rejected")).toHaveLength(1);
      await expect(
        savePrivateDetails(demoAccounts[0].id, input),
      ).rejects.toThrow("account");
      const [row] =
        await sql`SELECT * FROM gyvft_customer_people WHERE id=${person}::uuid`;
      expect(privateDetailsVersion("person", row)).not.toBe(first.version);
      expect(
        (
          await sql`SELECT count(*)::int AS n FROM gyvft_customer_people WHERE id=${person}::uuid`
        )[0].n,
      ).toBe(1);
    });
    it("saves profile and occasion atomically using the same domain validation", async () => {
      const profile = {
        name: "Fictional tester",
        about: "",
        interests: "Books",
        avoid: "",
        share_profile: false,
      };
      const p = await savePrivateDetails(customer, {
        accountId: customer,
        kind: "profile",
        id: customer,
        version: null,
        document: profile,
      });
      expect(
        await savePrivateDetails(customer, {
          accountId: customer,
          kind: "profile",
          id: customer,
          version: null,
          document: profile,
        }),
      ).toEqual(p);
      const input = {
        accountId: customer,
        kind: "occasion",
        id: occasion,
        version: null,
        document: {
          title: "Fixture birthday",
          occasion_date: "2026-12-15",
          repeats_annually: true,
          notes: "",
          relationship: "Friend",
          person_id: person,
        },
      };
      const o = await savePrivateDetails(customer, input);
      expect(await savePrivateDetails(customer, input)).toEqual(o);
      await expect(
        savePrivateDetails(customer, {
          ...input,
          id: randomUUID(),
          document: { ...input.document, person_id: randomUUID() },
        }),
      ).rejects.toThrow("unavailable");
    });
    it("keeps the API authenticated, same-origin and account-bound", async () => {
      const input = {
        accountId: customer,
        kind: "profile",
        id: customer,
        version: null,
        document: {
          name: "Other account",
          about: "",
          interests: "",
          avoid: "",
          share_profile: false,
        },
      };
      const request = (origin?: string) =>
        new Request("https://www.gyvft.com/api/customer/private-details", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(origin ? { origin } : {}),
          },
          body: JSON.stringify(input),
        });
      context.account = null;
      expect((await saveRoute(request("https://www.gyvft.com"))).status).toBe(
        401,
      );
      context.account = demoAccounts[0];
      expect(
        (await saveRoute(request("https://attacker.example"))).status,
      ).toBe(403);
      expect((await saveRoute(request("https://www.gyvft.com"))).status).toBe(
        403,
      );
      const [row] =
        await sql`SELECT name FROM gyvft_customer_profiles WHERE account_id=${customer}::uuid`;
      expect(row.name).toBe("Fictional tester");
    });
  },
);
