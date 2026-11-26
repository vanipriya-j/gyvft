import { describe, it, expect, vi } from "vitest";
import {
  DatabaseWorkQueue,
  DatabaseBusyError,
} from "@/lib/database/work-queue";
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
describe("bounded database admission", () => {
  it("limits in-flight work, drains fairly and releases slots after failure", async () => {
    const queue = new DatabaseWorkQueue(1, 2, 1000),
      first = deferred(),
      order: number[] = [];
    const a = queue.run(async () => {
      order.push(1);
      await first.promise;
      throw Error("failed");
    });
    const failure = expect(a).rejects.toThrow("failed");
    const b = queue.run(async () => {
      order.push(2);
      return "second";
    });
    const c = queue.run(async () => {
      order.push(3);
    });
    await expect(queue.run(async () => {})).rejects.toBeInstanceOf(
      DatabaseBusyError,
    );
    await Promise.resolve();
    expect(order).toEqual([1]);
    first.resolve();
    await failure;
    expect(await b).toBe("second");
    await c;
    expect(order).toEqual([1, 2, 3]);
  });
  it("expires queued work before execution and cancels disconnected waiters", async () => {
    vi.useFakeTimers();
    try {
      const queue = new DatabaseWorkQueue(1, 3, 100),
        first = deferred(),
        work = vi.fn(async () => {}),
        abort = new AbortController();
      const a = queue.run(() => first.promise),
        b = queue.run(work),
        c = queue.run(work, abort.signal);
      const expired = expect(b).rejects.toBeInstanceOf(DatabaseBusyError),
        cancelled = expect(c).rejects.toBeInstanceOf(DatabaseBusyError);
      abort.abort();
      await cancelled;
      await vi.advanceTimersByTimeAsync(100);
      await expired;
      first.resolve();
      await a;
      expect(work).not.toHaveBeenCalled();
      await queue.run(async () => {});
    } finally {
      vi.useRealTimers();
    }
  });
});
