import { afterEach, describe, expect, it } from "vitest";
import {
  assertPublicFormRateLimit,
  findIdempotentSubmission,
  rememberIdempotentSubmission,
  resetMemoryGuardsForTests,
} from "@/lib/security/memory-guards";

afterEach(() => {
  resetMemoryGuardsForTests();
});

describe("public form memory guards", () => {
  it("rate limits repeated submissions from the same IP/form", () => {
    for (let i = 0; i < 5; i += 1) {
      assertPublicFormRateLimit({ ip: "1.1.1.1", formKey: "tell_your_story" });
    }
    expect(() =>
      assertPublicFormRateLimit({ ip: "1.1.1.1", formKey: "tell_your_story" }),
    ).toThrow(/Too many requests/i);
  });

  it("remembers idempotent submissions", () => {
    expect(findIdempotentSubmission("key-1")).toBeNull();
    rememberIdempotentSubmission("key-1", "sub-1");
    expect(findIdempotentSubmission("key-1")).toBe("sub-1");
  });
});
