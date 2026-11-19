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
import { runPendingMigrations } from "@/lib/database/migrations";
let sql: Sql;
const { send, scheduled } = vi.hoisted(() => ({
  send: vi.fn(),
  scheduled: vi.fn(),
}));
vi.mock("@/lib/database/client", () => ({ getSql: () => sql }));
vi.mock("next/server", () => ({ after: scheduled }));
vi.mock("@/services/notifications/transports", async (original) => ({
  ...(await original<typeof import("@/services/notifications/transports")>()),
  sendNotificationEmail: send,
}));
import {
  queueNotification,
  deliverNotifications,
  scheduleNotifications,
} from "@/lib/customer/notifications";
import { notificationRows } from "@/lib/customer/notification-status";
import { NotificationTransportError } from "@/services/notifications/transports";
import { demoAccounts } from "@/lib/customer/demo-accounts";
const controlUrl = process.env.GYVFT_NOTIFICATION_TEST_DB;
describe.skipIf(!controlUrl)(
  "customer email outbox on isolated PostgreSQL",
  () => {
    const accountId = randomUUID();
    async function project(sample = false, owner = accountId) {
      const id = randomUUID();
      await sql`INSERT INTO customer_projects(id,customer_email,title,customer_account_id,submission_key) VALUES(${id},'customer@example.test','Local notification fixture',${owner},${sample ? "gyvft-demo-" + id : "notification-" + id})`;
      return id;
    }
    async function queue(
      id: string,
      key = randomUUID(),
      destination: "customer" | "team" = "customer",
    ) {
      await sql.begin(async (tx) =>
        queueNotification(
          tx as unknown as Sql,
          id,
          key,
          destination,
          "customer@example.test",
          "Your gift options are ready",
        ),
      );
    }
    beforeAll(async () => {
      const u = new URL(controlUrl!);
      if (
        u.hostname !== "127.0.0.1" ||
        u.port !== "55434" ||
        u.pathname !== "/gyvft_test"
      )
        throw Error("Dedicated local fixture only.");
      const control = postgres(controlUrl!, { prepare: false, max: 1 });
      const db = "gyvft_notifications_" + randomUUID().replaceAll("-", "");
      await control.unsafe("CREATE DATABASE " + db);
      await control.end();
      u.pathname = "/" + db;
      sql = postgres(u.toString(), { prepare: false, max: 5 });
      await runPendingMigrations(sql, undefined, "customer");
      await sql`INSERT INTO gyvft_customer_accounts(id,email,password_hash) VALUES(${accountId},'customer@example.test','local-unused-password'),(${demoAccounts[0].id},${demoAccounts[0].email},'local-unused-password')`;
      vi.stubEnv("RESEND_API_KEY", "re_local_mock");
      vi.stubEnv("GYVFT_LEADS_EMAIL", "team@example.test");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.gyvft.com");
    });
    beforeEach(() => {
      send.mockReset().mockResolvedValue("provider-local-id");
      scheduled.mockReset();
    });
    afterAll(async () => {
      await sql?.end();
      vi.unstubAllEnvs();
    });
    it("commits one event per key, never an email from a rolled-back update", async () => {
      const id = await project(),
        key = randomUUID();
      await Promise.all([queue(id, key), queue(id, key)]);
      expect(
        (
          await sql`SELECT id FROM gyvft_customer_notifications WHERE project_id=${id}`
        ).length,
      ).toBe(1);
      await expect(
        sql.begin(async (tx) => {
          await queueNotification(
            tx as unknown as Sql,
            id,
            "rollback",
            "team",
            "unused@example.test",
            "Not committed",
          );
          throw Error("rollback");
        }),
      ).rejects.toThrow("rollback");
      expect(
        (
          await sql`SELECT id FROM gyvft_customer_notifications WHERE event_key='rollback'`
        ).length,
      ).toBe(0);
    });
    it("excludes both sample-marked gifts and exact fictional account identities", async () => {
      const a = await project(true),
        b = await project(false, demoAccounts[0].id);
      await queue(a);
      await queue(b);
      expect(
        (
          await sql`SELECT id FROM gyvft_customer_notifications WHERE project_id IN (${a},${b})`
        ).length,
      ).toBe(0);
    });
    it("sends to the customer and configured team inbox with correct private links", async () => {
      const id = await project();
      await queue(id);
      await queue(id, randomUUID(), "team");
      expect(await deliverNotifications(id)).toEqual({
        candidates: 2,
        accepted: 2,
      });
      expect(send.mock.calls.map((c) => c[0].to).sort()).toEqual([
        "customer@example.test",
        "team@example.test",
      ]);
      expect(
        send.mock.calls.find((c) => c[0].to === "customer@example.test")![0]
          .text,
      ).toContain(`/account/projects/${id}`);
      expect(
        send.mock.calls.find((c) => c[0].to === "team@example.test")![0].text,
      ).toContain(`/operations/requests?request=${id}`);
      expect(
        (await notificationRows(id)).every((n) => n.state === "sent"),
      ).toBe(true);
    });
    it("claims atomically so concurrent dispatchers send each event once", async () => {
      const id = await project();
      await queue(id);
      await Promise.all([deliverNotifications(id), deliverNotifications(id)]);
      expect(send).toHaveBeenCalledTimes(1);
    });
    it("retries a transient failure promptly with identical provider idempotency input", async () => {
      const id = await project();
      await queue(id);
      send.mockRejectedValueOnce(
        new NotificationTransportError("EMAIL_HTTP_503", true),
      );
      expect((await deliverNotifications(id)).accepted).toBe(1);
      expect(send).toHaveBeenCalledTimes(2);
      expect(send.mock.calls[0][0]).toEqual(send.mock.calls[1][0]);
    });
    it("keeps deterministic sender rejection failed, honors retry delay and recovers later", async () => {
      const id = await project();
      await queue(id);
      send.mockRejectedValueOnce(
        new NotificationTransportError("EMAIL_HTTP_403"),
      );
      expect((await deliverNotifications(id)).accepted).toBe(0);
      expect(send).toHaveBeenCalledTimes(1);
      expect((await deliverNotifications(id)).candidates).toBe(0);
      await sql`UPDATE gyvft_customer_notifications SET attempted_at=now()-interval '3 minutes' WHERE project_id=${id}`;
      expect((await deliverNotifications(id)).accepted).toBe(1);
      expect(send.mock.calls[0][0]).toEqual(send.mock.calls[1][0]);
    });
    it("recovers pending and interrupted email across projects independently of Studio tables", async () => {
      const id = await project();
      await queue(id);
      await sql`UPDATE gyvft_customer_notifications SET state='sending',attempted_at=now()-interval '6 minutes' WHERE project_id=${id}`;
      expect((await deliverNotifications()).accepted).toBeGreaterThanOrEqual(1);
      expect((await notificationRows(id))[0].state).toBe("sent");
    });
    it("never blindly resends after the provider deduplication window or max attempts", async () => {
      const id = await project();
      await queue(id);
      await sql`UPDATE gyvft_customer_notifications SET state='failed',attempts=1,attempted_at=now()-interval '24 hours',created_at=now()-interval '25 hours' WHERE project_id=${id}`;
      expect((await deliverNotifications(id)).candidates).toBe(0);
      expect((await notificationRows(id))[0].can_retry).toBe(false);
      expect(send).not.toHaveBeenCalled();
      await sql`UPDATE gyvft_customer_notifications SET created_at=now(),attempts=8 WHERE project_id=${id}`;
      expect((await deliverNotifications(id)).candidates).toBe(0);
    });
    it("does not send existing queued fixture or disabled-account messages", async () => {
      const id = await project();
      await queue(id);
      await sql`UPDATE customer_projects SET submission_key=${"gyvft-demo-" + id} WHERE id=${id}`;
      expect((await deliverNotifications(id)).candidates).toBe(0);
      const inactive = await project();
      await queue(inactive);
      await sql`UPDATE gyvft_customer_accounts SET is_active=false WHERE id=${accountId}`;
      expect((await deliverNotifications(inactive)).candidates).toBe(0);
      await sql`UPDATE gyvft_customer_accounts SET is_active=true WHERE id=${accountId}`;
      expect(send).not.toHaveBeenCalled();
    });
    it("does not consume attempts without configuration; schedules only after the response", async () => {
      const id = await project();
      await queue(id);
      delete process.env.RESEND_API_KEY;
      expect(await deliverNotifications(id)).toEqual({
        candidates: 0,
        accepted: 0,
      });
      expect((await notificationRows(id))[0].attempts).toBe(0);
      scheduleNotifications(id);
      expect(scheduled).not.toHaveBeenCalled();
      process.env.RESEND_API_KEY = "re_local_mock";
      scheduleNotifications(id);
      expect(scheduled).toHaveBeenCalledOnce();
      expect(send).not.toHaveBeenCalled();
    });
  },
);
