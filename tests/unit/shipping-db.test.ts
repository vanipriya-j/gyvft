/** Opt-in: a dedicated disposable local database, never a hosted database. */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import postgres, { type Sql } from "postgres";
import { randomUUID } from "node:crypto";
let sql: Sql;
vi.mock("@/lib/database/client", () => ({ getSql: () => sql }));
vi.mock("next/server", () => ({ after: vi.fn() }));
import { runPendingMigrations } from "@/lib/database/migrations";
import {
  saveShippingSettings,
  shippingSettingsStatus,
  shippingConfig,
} from "@/lib/customer/shipping-settings";
import {
  saveShippingPlan,
  saveShipment,
  archiveShipment,
  shipmentsForProject,
  manualShipmentStatus,
  bookDelhivery,
  refreshDelhivery,
  assertShippingProgress,
  scheduleDelhiveryPickup,
  refreshDueShipments,
} from "@/lib/customer/shipping";
import type { Shipment } from "@/lib/customer/shipping-model";
const url = process.env.SHIPPING_TEST_DATABASE_URL,
  owner = randomUUID(),
  other = randomUUID();
let projectId: string;
let awbBase = Date.now(),
  postCount = 0,
  pickupCount = 0,
  pickupPackages = 0,
  failPost = false;
const carrierRows = new Map<
  string,
  { awb: string; status: string; type: string; time: string }
>();
const settings = {
  environment: "production",
  expected_version: 0,
  api_key: "local-only-delhivery-token",
  client_name: "Shipping fixture",
  warehouse_name: "Fixture warehouse",
  origin_pin: "600034",
  seller_name: "Fixture seller",
  seller_gstin: "33ABCDE1234F1Z5",
  enabled: true,
};
const parcel = {
  weight_g: 1000,
  length_cm: 20,
  width_cm: 15,
  height_cm: 10,
  declared_value_paise: 40000,
  description: "Custom gifts",
  hsn_code: "4911",
  invoice_reference: "INV-TEST",
};
const action = (s: Shipment) => ({
  id: s.id,
  project_id: projectId,
  expected_version: s.version,
  request_id: randomUUID(),
  confirmed: true,
});
async function view() {
  return shipmentsForProject(projectId, owner);
}
async function add(method: Shipment["method"], n: number) {
  const id = randomUUID();
  await saveShipment({
    id,
    project_id: projectId,
    expected_version: 0,
    request_id: randomUUID(),
    method,
    label: method + " parcel",
    gift_sets: n,
    recipient_name: "Test recipient",
    phone: "9876543210",
    address: "10 Example Road",
    city: "Chennai",
    state: "Tamil Nadu",
    postal_code: "600034",
    courier_name: method === "other" ? "Local courier" : "",
  });
  return (await view()).shipments.find((s) => s.id === id)!;
}
async function stage() {
  return (
    await sql`SELECT stage FROM customer_projects WHERE id=${projectId}`
  )[0].stage;
}
describe.skipIf(!url)("Shipping commands against real PostgreSQL", () => {
  beforeAll(async () => {
    const u = new URL(url!);
    if (
      !["localhost", "127.0.0.1"].includes(u.hostname) ||
      !/^\/gyvft_shipping_/.test(u.pathname)
    )
      throw Error("Dedicated local shipping database required");
    sql = postgres(url!, { prepare: false, max: 5, onnotice: () => {} });
    for (const role of ["anon", "authenticated"])
      await sql.unsafe(
        `DO $$ BEGIN CREATE ROLE ${role}; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      );
    await runPendingMigrations(sql, undefined, "customer");
    expect(await runPendingMigrations(sql, undefined, "customer")).toEqual([]);
    for (const id of [owner, other])
      await sql`INSERT INTO gyvft_customer_accounts(id,email,password_hash) VALUES(${id},${id + "@example.test"},'test-only')`;
    const saved = (await shippingSettingsStatus()).settings.find(
      (s) => s.environment === "production",
    );
    await saveShippingSettings({
      ...settings,
      expected_version: saved?.version || 0,
      request_id: randomUUID(),
    });
  }, 30000);
  afterAll(async () => {
    vi.unstubAllGlobals();
    if (sql) await sql.end();
  });
  beforeEach(async () => {
    awbBase += 100;
    postCount = 0;
    pickupCount = 0;
    pickupPackages = 0;
    failPost = false;
    carrierRows.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown, init: RequestInit) => {
        const u = new URL(String(input));
        if (u.hostname !== "track.delhivery.com")
          throw Error("External network blocked");
        if (u.pathname.includes("pin-codes"))
          return Response.json({
            delivery_codes: [
              { postal_code: { pin: 600034, pre_paid: "Y", remarks: "" } },
            ],
          });
        if (u.pathname.includes("create.json")) {
          postCount++;
          const body = JSON.parse(
            new URLSearchParams(String(init.body)).get("data")!,
          );
          const ref = body.shipments[0].order;
          const row = {
            awb: String(awbBase + postCount),
            status: "Manifested",
            type: "UD",
            time: "2026-11-20T10:30:00",
          };
          carrierRows.set(ref, row);
          if (failPost) throw Error("Simulated reply lost after provider save");
          return Response.json({
            success: true,
            packages: [{ status: "Success", waybill: row.awb, refnum: ref }],
          });
        }
        if (u.pathname.includes("/fm/request")) {
          pickupCount++;
          pickupPackages = JSON.parse(String(init.body)).expected_package_count;
          return Response.json({ pickup_id: "PICKUP-LOCAL" });
        }
        if (u.pathname.includes("packages/json")) {
          const refs = u.searchParams.get("ref_ids"),
            awbs = u.searchParams.get("waybill")?.split(",");
          const rows = [...carrierRows.entries()].filter(([ref, r]) =>
            refs ? ref === refs : awbs?.includes(r.awb),
          );
          return Response.json({
            ShipmentData: rows.map(([ref, r]) => ({
              Shipment: {
                AWB: r.awb,
                ReferenceNo: ref,
                Status: {
                  Status: r.status,
                  StatusType: r.type,
                  StatusDateTime: r.time,
                },
              },
            })),
          });
        }
        throw Error("Unexpected carrier endpoint");
      }),
    );
    projectId = randomUUID();
    await sql`INSERT INTO customer_projects(id,customer_account_id,customer_email,title,kind,stage,total_paise,paid_paise,shopify_order_reference) VALUES(${projectId},${owner},${owner + "@example.test"},'Shipping test','project',8,100000,100000,'#LOCAL-ORDER')`;
    await sql`INSERT INTO customer_project_approvals(project_id,kind,version,title,description,status) VALUES(${projectId},'design',1,'Approved artwork','Test approved proof','approved')`;
    await saveShippingPlan({
      project_id: projectId,
      expected_sets: 100,
      expected_version: 0,
      request_id: randomUUID(),
      confirmed_manifest: true,
    });
  });
  it("encrypts credentials and returns no token/ciphertext; blank input preserves the stored key", async () => {
    const status = await shippingSettingsStatus();
    expect(JSON.stringify(status)).not.toMatch(
      /local-only|ciphertext|auth_tag|token/,
    );
    const [r] =
      await sql`SELECT ciphertext FROM gyvft_shipping_settings WHERE environment='production'`;
    expect(r.ciphertext.toString()).not.toContain(settings.api_key);
    const c = await shippingConfig("production");
    expect(c.token).toBe(settings.api_key);
    await saveShippingSettings({
      ...settings,
      api_key: "",
      expected_version: c.version,
      request_id: randomUUID(),
    });
    expect((await shippingConfig("production")).token).toBe(settings.api_key);
    await expect(
      saveShippingSettings({
        ...settings,
        api_key: "",
        request_id: randomUUID(),
      }),
    ).rejects.toThrow("another tab");
    expect(postCount).toBe(0);
  });
  it("keeps unallocated/address-pending enquiries editable, isolates ownership and archives only unbooked parcels", async () => {
    const s = await add("porter", 60);
    await expect(shipmentsForProject(projectId, other)).rejects.toThrow(
      "unavailable",
    );
    await expect(
      manualShipmentStatus({
        ...action(s),
        status: "in_transit",
        tracking_reference: "PORTER",
      }),
    ).rejects.toThrow("Allocate 40");
    await archiveShipment({
      id: s.id,
      project_id: projectId,
      expected_version: s.version,
      request_id: randomUUID(),
    });
    expect((await view()).shipments).toHaveLength(0);
    expect(
      (await sql`SELECT archived_at FROM gyvft_shipments WHERE id=${s.id}`)[0]
        .archived_at,
    ).toBeTruthy();
  });
  it("does not overwrite a shipment that already belongs to another request", async () => {
    const s = await add("porter", 60),
      another = randomUUID();
    await sql`INSERT INTO customer_projects(id,customer_account_id,customer_email,title,kind,stage) VALUES(${another},${owner},${owner + "@example.test"},'Other request','enquiry',0)`;
    await saveShippingPlan({
      project_id: another,
      expected_sets: 100,
      expected_version: 0,
      request_id: randomUUID(),
      confirmed_manifest: true,
    });
    await expect(
      saveShipment({
        id: s.id,
        project_id: another,
        expected_version: 0,
        request_id: randomUUID(),
        method: "pickup",
        label: "Wrong destination",
        gift_sets: 100,
        recipient_name: "Test contact",
      }),
    ).rejects.toThrow("unavailable");
    expect((await view()).shipments[0].gift_sets).toBe(60);
  });
  it("tracks a 60/40 Porter and pickup split without completing the whole order early", async () => {
    let a = await add("porter", 60),
      b = await add("pickup", 40);
    await manualShipmentStatus({
      ...action(a),
      status: "in_transit",
      tracking_reference: "PORTER-1",
    });
    a = (await view()).shipments.find((s) => s.id === a.id)!;
    await manualShipmentStatus({ ...action(a), status: "delivered" });
    expect(await stage()).toBe(8);
    expect((await view()).delivered).toBe(60);
    await expect(assertShippingProgress(sql, projectId, 10)).rejects.toThrow(
      "partly fulfilled",
    );
    await manualShipmentStatus({ ...action(b), status: "ready_for_pickup" });
    b = (await view()).shipments.find((s) => s.id === b.id)!;
    await manualShipmentStatus({ ...action(b), status: "collected" });
    expect(await stage()).toBe(10);
    expect((await view()).delivered).toBe(100);
    expect(await assertShippingProgress(sql, projectId, 10)).toBe(true);
    expect(postCount).toBe(0);
    expect(
      (
        await sql`SELECT count(*)::int AS n FROM gyvft_customer_notifications WHERE project_id=${projectId}`
      )[0].n,
    ).toBe(4);
  });
  it("retains the dispatch milestone when a courier later reports a delivery exception", async () => {
    let s = await add("porter", 100);
    await manualShipmentStatus({
      ...action(s),
      status: "in_transit",
      tracking_reference: "PORTER-EXCEPTION",
    });
    s = (await view()).shipments[0];
    await manualShipmentStatus({
      ...action(s),
      status: "exception",
      tracking_reference: "PORTER-EXCEPTION",
    });
    expect((await view()).dispatched).toBe(100);
    expect((await view()).delivered).toBe(0);
    expect(await stage()).toBe(9);
  });
  it("blocks unpaid dispatch and manual writes to Delhivery state", async () => {
    const s = await add("delhivery", 100);
    await sql`UPDATE customer_projects SET paid_paise=50000 WHERE id=${projectId}`;
    await expect(bookDelhivery({ ...action(s), parcel })).rejects.toThrow(
      "full verified payment",
    );
    await expect(
      manualShipmentStatus({
        ...action(s),
        status: "in_transit",
        tracking_reference: "FAKE",
      }),
    ).rejects.toThrow("statuses come from");
    expect(postCount).toBe(0);
  });
  it("allows only one manifest under concurrent requests; pickup counts parcels rather than gifts", async () => {
    let a = await add("delhivery", 60),
      b = await add("delhivery", 40);
    const input = { ...action(a), parcel };
    const results = await Promise.allSettled([
      bookDelhivery(input),
      bookDelhivery({ ...input, request_id: randomUUID() }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(postCount).toBe(1);
    await bookDelhivery({ ...action(b), parcel });
    a = (await view()).shipments.find((s) => s.id === a.id)!;
    b = (await view()).shipments.find((s) => s.id === b.id)!;
    expect(await stage()).toBe(8);
    const tomorrow = new Date(Date.now() + 2 * 86400000)
        .toISOString()
        .slice(0, 10),
      pickup = {
        project_id: projectId,
        ids: [a.id, b.id],
        request_id: randomUUID(),
        confirmed: true,
        date: tomorrow,
        time: "12:00:00",
      };
    await scheduleDelhiveryPickup(pickup);
    await scheduleDelhiveryPickup(pickup);
    expect(pickupCount).toBe(1);
    expect(pickupPackages).toBe(2);
    expect(await stage()).toBe(8);
    await expect(
      archiveShipment({
        id: a.id,
        project_id: projectId,
        expected_version: a.version + 2,
        request_id: randomUUID(),
      }),
    ).rejects.toThrow("Only an unbooked");
  });
  it("reconciles an uncertain booking by its stable reference without another POST", async () => {
    let s = await add("delhivery", 100);
    failPost = true;
    const input = { ...action(s), parcel };
    await expect(bookDelhivery(input)).rejects.toThrow("may have been created");
    await bookDelhivery(input);
    expect(postCount).toBe(1);
    s = (await view()).shipments[0];
    expect(s.booking_state).toBe("uncertain");
    await expect(bookDelhivery({ ...action(s), parcel })).rejects.toThrow(
      "Reconcile",
    );
    await refreshDelhivery(projectId, s.id);
    expect((await view()).shipments[0]).toMatchObject({
      booking_state: "booked",
      tracking_reference: String(awbBase + 1),
      status: "booked",
    });
    expect(postCount).toBe(1);
  });
  it("ignores stale scans and never counts a return as delivery", async () => {
    const a = await add("delhivery", 60),
      b = await add("delhivery", 40);
    await bookDelhivery({ ...action(a), parcel });
    await bookDelhivery({ ...action(b), parcel });
    const ar = carrierRows.get(a.provider_reference)!,
      br = carrierRows.get(b.provider_reference)!;
    ar.status = "Delivered";
    ar.type = "DL";
    ar.time = "2026-11-22T10:30:00";
    await refreshDelhivery(projectId, a.id);
    expect((await view()).delivered).toBe(60);
    ar.status = "In Transit";
    ar.type = "UD";
    ar.time = "2026-11-21T10:30:00";
    await refreshDelhivery(projectId, a.id);
    expect((await view()).delivered).toBe(60);
    br.status = "Delivered";
    br.type = "RT";
    br.time = "2026-11-22T10:30:00";
    await refreshDelhivery(projectId, b.id);
    expect((await view()).delivered).toBe(60);
    expect(
      (
        await sql`SELECT subject FROM gyvft_customer_notifications WHERE project_id=${projectId} ORDER BY created_at LIMIT 1`
      )[0].subject,
    ).toBe("GYVFT: your delivery plan has an update");
    expect(await stage()).toBeLessThan(10);
    expect((await view()).shipments.find((s) => s.id === b.id)?.status).toBe(
      "returned",
    );
  });
  it("batch refreshes active parcels with one GET and exposes only safe sync state", async () => {
    const a = await add("delhivery", 100);
    await bookDelhivery({ ...action(a), parcel });
    const r = carrierRows.get(a.provider_reference)!;
    r.status = "Delivered";
    r.type = "DL";
    r.time = "2026-11-23T10:30:00";
    expect(await refreshDueShipments(projectId)).toEqual({ checked: 1 });
    expect(await stage()).toBe(10);
    expect(await refreshDueShipments(projectId)).toEqual({ checked: 0 });
    expect(JSON.stringify(await view())).not.toMatch(
      /booking_document|provider_account|ciphertext|api_key/,
    );
  });
});
