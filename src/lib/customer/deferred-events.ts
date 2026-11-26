import "server-only";
import { after } from "next/server";
import { recordCustomerEvent } from "./observability";
import { DatabaseWorkQueue } from "@/lib/database/work-queue";
// Secondary telemetry must not turn an unavailable database into more foreground work.
const telemetry = new DatabaseWorkQueue(1, 8, 1000);
export function deferCustomerEvent(
  ...args: Parameters<typeof recordCustomerEvent>
) {
  const record = async () => {
    try {
      await telemetry.run(() => recordCustomerEvent(...args));
    } catch {
      /* Best-effort telemetry may be shed; business outbox jobs are durable separately. */
    }
  };
  try {
    after(record);
  } catch {
    void record();
  } // Non-Next scripts/tests have no response lifecycle.
}
