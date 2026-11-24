import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres, { type Sql } from "postgres";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
let sql: Sql;
const access = vi.hoisted(() => ({
  account: null as { id: string } | null,
  notify: vi.fn(),
}));
vi.mock("@/lib/database/client", () => ({ getSql: () => sql }));
vi.mock("@/lib/customer/notifications", () => ({
  queueNotification: access.notify,
}));
vi.mock("@/lib/customer/session", () => ({
  getCustomerAccount: async () => access.account,
}));
vi.mock("@/lib/security/setup-secret", () => ({
  validSetupSecret: (value: unknown) => value === "fixture-operator",
}));
import {
  giftWorkspace,
  publishGiftOption,
} from "@/lib/customer/gift-workspace";
import { GET } from "@/app/api/customer-assets/[kind]/[id]/route";
const uri = process.env.TEST_OPTION_IMAGES_DB_URL;
const cover = {
  mime: "image/png",
  data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XxioAAAAASUVORK5CYII=",
};
describe.skipIf(!uri)(
  "private option galleries in an isolated PostgreSQL fixture",
  () => {
    const schema = "gallery_" + randomUUID().replaceAll("-", ""),
      project = randomUUID(),
      owner = randomUUID();
    let galleryId: string, extraId: string, legacyId: string;
    const raw = {
      title: "Fictional team set",
      description: "Test option",
      contents: [
        { key: "one", name: "Test journal", quantity: 1, unit_paise: null },
      ],
    };
    const asset = (kind: string, id: string, operator = false) =>
      GET(
        new Request(`https://www.gyvft.com/api/customer-assets/${kind}/${id}`, {
          headers: operator ? { "x-setup-secret": "fixture-operator" } : {},
        }),
        { params: Promise.resolve({ kind, id }) },
      );
    beforeAll(async () => {
      const parsed = new URL(uri!);
      if (
        parsed.hostname !== "127.0.0.1" ||
        parsed.port !== "55438" ||
        parsed.pathname !== "/gyvft_gallery_test"
      )
        throw Error("Only the dedicated localhost gallery fixture is allowed.");
      sql = postgres(uri!, { max: 1, connection: { search_path: schema } });
      await sql.unsafe(`CREATE SCHEMA ${schema};
      DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; END $$;
      CREATE TABLE customer_projects(id uuid PRIMARY KEY,customer_account_id uuid,customer_email text,kind text DEFAULT 'enquiry',stage int DEFAULT 0,production_started_at timestamptz,shopify_order_id text,shopify_order_reference text,shopify_order_state text,submission_key text,next_action text);
      CREATE TABLE gyvft_gift_options(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid REFERENCES customer_projects(id),title text,description text,contents jsonb,pricing jsonb,image_data bytea NOT NULL,image_type text,published boolean DEFAULT true,operator_hidden boolean DEFAULT false,created_at timestamptz DEFAULT now(),request_id uuid UNIQUE);
      CREATE TABLE gyvft_gift_visibility(option_id uuid,project_id uuid,kind text,hidden boolean);
      CREATE TABLE gyvft_gift_drafts(id uuid,project_id uuid,version int,document jsonb,updated_at timestamptz);
      CREATE TABLE gyvft_gift_selections(id uuid,project_id uuid,draft_id uuid,draft_version int,snapshot jsonb,created_at timestamptz);
      CREATE TABLE customer_project_approvals(id uuid,gift_selection_id uuid);
      CREATE TABLE customer_project_events(project_id uuid,title text,body text);`);
      await sql`INSERT INTO customer_projects(id,customer_account_id,customer_email) VALUES(${project}::uuid,${owner}::uuid,'fictional@example.test')`;
    });
    afterAll(async () => {
      if (sql) await sql.end();
    });
    it("keeps single-image publishing working before activation and rejects multi-image writes atomically", async () => {
      await publishGiftOption(project, randomUUID(), { ...raw, image: cover });
      const before = await giftWorkspace(project);
      legacyId = before.options[0].id;
      expect(before.optionImagesReady).toBe(false);
      expect(before.options).toHaveLength(1);
      await expect(
        publishGiftOption(project, randomUUID(), {
          ...raw,
          images: [cover, cover],
        }),
      ).rejects.toThrow("No option was published");
      expect((await giftWorkspace(project)).options).toHaveLength(1);
      expect(
        (await asset("gift-option-image", randomUUID(), true)).status,
      ).toBe(404);
    });
    it("applies the additive SQL without changing the legacy cover and restricts direct table access", async () => {
      const before =
        await sql`SELECT image_data FROM gyvft_gift_options WHERE id=${legacyId}::uuid`;
      const migration = readFileSync(
        "supabase/migrations/20261124000001_gift_option_images.sql",
        "utf8",
      );
      await sql.unsafe(migration);
      await sql.unsafe(migration);
      expect((await giftWorkspace(project)).optionImagesReady).toBe(true);
      const after =
        await sql`SELECT image_data FROM gyvft_gift_options WHERE id=${legacyId}::uuid`;
      expect(after[0].image_data).toEqual(before[0].image_data);
      const [permissions] =
        await sql`SELECT relrowsecurity AS rls,has_table_privilege('anon',${schema + ".gyvft_gift_option_images"},'SELECT') AS anon,has_table_privilege('authenticated',${schema + ".gyvft_gift_option_images"},'SELECT') AS authenticated FROM pg_class WHERE oid=to_regclass('gyvft_gift_option_images')`;
      expect(permissions).toMatchObject({
        rls: true,
        anon: false,
        authenticated: false,
      });
    });
    it("activates private drafts without changing a previously published cover", async () => {
      const [before] =
        await sql`SELECT image_data,title,created_at FROM gyvft_gift_options WHERE id=${legacyId}::uuid`;
      const contents = readFileSync(
        "supabase/migrations/20261124000002_agent_proposals.sql",
        "utf8",
      );
      await sql.unsafe(contents);
      await sql.unsafe(contents);
      const [after] =
        await sql`SELECT image_data,title,created_at,draft_version,published FROM gyvft_gift_options WHERE id=${legacyId}::uuid`;
      expect(after.image_data).toEqual(before.image_data);
      expect(after.title).toBe(before.title);
      expect(after.created_at).toEqual(before.created_at);
      expect(after.published).toBe(true);
      expect(after.draft_version).toBe(1);
      expect(
        (
          await sql`SELECT enabled FROM gyvft_mcp_settings WHERE singleton=true`
        )[0].enabled,
      ).toBe(false);
    });
    it("saves six ordered images once, with one event and notification for the option", async () => {
      access.notify.mockClear();
      const key = randomUUID();
      await publishGiftOption(project, key, {
        ...raw,
        images: Array.from({ length: 6 }, () => cover),
      });
      await publishGiftOption(project, key, {
        ...raw,
        images: Array.from({ length: 6 }, () => cover),
      });
      const option = (await giftWorkspace(project)).options.find(
        (o) => o.images?.length === 5,
      )!;
      galleryId = option.id;
      extraId = option.images![0].id;
      expect(option.images!.map((i) => i.position)).toEqual([2, 3, 4, 5, 6]);
      expect(access.notify).toHaveBeenCalledTimes(1);
      expect(
        (
          await sql`SELECT count(*)::int AS n FROM gyvft_gift_options WHERE request_id=${key}::uuid`
        )[0].n,
      ).toBe(1);
      expect(
        (
          await sql`SELECT count(*)::int AS n FROM customer_project_events WHERE project_id=${project}::uuid`
        )[0].n,
      ).toBe(2);
    });
    it("enforces customer ownership, publication and hidden-option boundaries for every image", async () => {
      access.account = { id: owner };
      expect((await asset("gift-option", galleryId)).status).toBe(200);
      expect((await asset("gift-option-image", extraId)).status).toBe(200);
      access.account = { id: randomUUID() };
      expect((await asset("gift-option-image", extraId)).status).toBe(404);
      await expect(giftWorkspace(project, access.account.id)).rejects.toThrow(
        "unavailable",
      );
      access.account = null;
      expect((await asset("gift-option-image", extraId)).status).toBe(404);
      access.account = { id: owner };
      await sql`UPDATE gyvft_gift_options SET operator_hidden=true WHERE id=${galleryId}::uuid`;
      expect((await asset("gift-option-image", extraId)).status).toBe(404);
      expect((await asset("gift-option-image", extraId, true)).status).toBe(
        200,
      );
      await sql`UPDATE gyvft_gift_options SET operator_hidden=false,published=false WHERE id=${galleryId}::uuid`;
      expect(
        (await giftWorkspace(project, owner)).options.some(
          (o) => o.id === galleryId,
        ),
      ).toBe(false);
      expect((await asset("gift-option-image", extraId)).status).toBe(404);
      await sql`UPDATE gyvft_gift_options SET published=true WHERE id=${galleryId}::uuid`;
    });
    it("rejects bad images, excessive counts and production changes without partial records", async () => {
      const before = (await giftWorkspace(project)).options.length;
      await expect(
        publishGiftOption(project, randomUUID(), {
          ...raw,
          images: Array.from({ length: 7 }, () => cover),
        }),
      ).rejects.toThrow("between 1 and 6");
      await expect(
        publishGiftOption(project, randomUUID(), {
          ...raw,
          images: [
            cover,
            {
              mime: "image/png",
              data: Buffer.from("not an image at all").toString("base64"),
            },
          ],
        }),
      ).rejects.toThrow("valid PNG");
      await sql`UPDATE customer_projects SET stage=7 WHERE id=${project}::uuid`;
      await expect(
        publishGiftOption(project, randomUUID(), {
          ...raw,
          images: [cover, cover],
        }),
      ).rejects.toThrow("locked");
      expect((await giftWorkspace(project)).options).toHaveLength(before);
    });
  },
);
