import type { Instrumentation } from "next";
/** Native Next.js error hook; infrastructure monitoring remains on Vercel. */
export const onRequestError: Instrumentation.onRequestError = async (
  ...args
) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { recordRequestError } = await import("@/lib/logging/request-errors");
    await recordRequestError(...args);
  }
};
