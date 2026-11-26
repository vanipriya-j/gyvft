/** Per-process backpressure, not a durable queue or a global customer limit.
 * Postgres/Supavisor still controls database connection sharing across instances. */
export class DatabaseBusyError extends Error {
  constructor() {
    super("Database work is busy. Please retry shortly.");
  }
}
type Waiting = { start: () => void; fail: () => void };
export class DatabaseWorkQueue {
  private active = 0;
  private waiting: Waiting[] = [];
  constructor(
    private concurrency = 2,
    private capacity = 24,
    private waitMs = 4000,
  ) {}
  run<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted || this.waiting.length >= this.capacity) {
        reject(new DatabaseBusyError());
        return;
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      const clean = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", fail);
      };
      const fail = () => {
        const index = this.waiting.indexOf(job);
        if (index < 0) return;
        this.waiting.splice(index, 1);
        clean();
        reject(new DatabaseBusyError());
      };
      const job: Waiting = {
        fail,
        start: () => {
          clean();
          this.active++;
          // Never retry unknown writes here. The caller owns idempotency.
          Promise.resolve()
            .then(work)
            .then(resolve, reject)
            .finally(() => {
              this.active--;
              this.waiting.shift()?.start();
            });
        },
      };
      if (this.active < this.concurrency) job.start();
      else {
        this.waiting.push(job);
        timer = setTimeout(fail, this.waitMs);
        signal?.addEventListener("abort", fail, { once: true });
      }
    });
  }
}
export const customerDatabaseQueue = new DatabaseWorkQueue();
