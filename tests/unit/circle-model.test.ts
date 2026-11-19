import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  organisationSchema,
  circleInput,
  circleOccasionInput,
} from "@/lib/customer/circle-model";
describe("Circle claim and publication validation", () => {
  it("accepts a matching HTTPS institution claim and rejects malformed, unrelated or credential-bearing websites safely", () => {
    const claim = {
      name: "Team",
      website: "https://www.company.example/about",
      domain: "Company.Example",
    };
    expect(organisationSchema.parse(claim).domain).toBe("company.example");
    for (const website of [
      "not a url",
      "http://company.example",
      "https://elsewhere.example",
      "https://company.example.evil.test",
      "https://user:password@company.example",
    ])
      expect(organisationSchema.safeParse({ ...claim, website }).success).toBe(
        false,
      );
  });
  it("requires organisation data only for institutional categories", () => {
    const input = {
      id: randomUUID(),
      name: "Our circle",
      display_name: "Owner",
    };
    expect(
      circleInput.safeParse({ ...input, category: "family" }).success,
    ).toBe(true);
    for (const category of ["corporate", "school", "college"])
      expect(circleInput.safeParse({ ...input, category }).success).toBe(false);
    expect(
      circleInput.safeParse({
        ...input,
        category: "family",
        organisation: {
          name: "Team",
          website: "https://company.example",
          domain: "company.example",
        },
      }).success,
    ).toBe(false);
  });
  it("requires a valid occasion day and affirmative sharing decision", () => {
    const input = {
      id: randomUUID(),
      title: "A special day",
      occasion_date: "2026-12-20",
    };
    expect(circleOccasionInput.safeParse(input).success).toBe(false);
    expect(
      circleOccasionInput.safeParse({ ...input, publish: true }).success,
    ).toBe(true);
    expect(
      circleOccasionInput.safeParse({
        ...input,
        publish: true,
        occasion_date: "2026-02-30",
      }).success,
    ).toBe(false);
  });
});
