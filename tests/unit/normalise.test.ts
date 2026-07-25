import { describe, expect, it } from "vitest";
import {
  normaliseEmail,
  normaliseOrganisationName,
  normalisePhone,
} from "@/lib/utils/normalise";

describe("normalise helpers", () => {
  it("normalises email case and surrounding whitespace", () => {
    expect(normaliseEmail("  Founder@GYVFT.COM ")).toBe("founder@gyvft.com");
  });

  it("normalises phone numbers while preserving a leading plus", () => {
    expect(normalisePhone(" +91 (987) 654-3210 ")).toBe("+919876543210");
    expect(normalisePhone("0987 654 3210")).toBe("09876543210");
  });

  it("normalises organisation names for matching", () => {
    expect(normaliseOrganisationName("  The GYVFT, Studio!  ")).toBe("the gyvft studio");
  });
});
