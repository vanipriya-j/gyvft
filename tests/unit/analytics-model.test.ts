import { describe, expect, it } from "vitest";
import { analyticsPage, googleParameters } from "@/lib/analytics/model";

describe("analytics data boundaries", () => {
  it("removes customer IDs and tokens while preserving the journey screen", () => {
    const page = analyticsPage(
      "/account/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "view=quote&token=secret&email=person@example.com",
    );
    expect(page).toEqual({
      path: "/account/projects/[id]?view=quote",
      title: "My GYVFT",
    });
    expect(
      analyticsPage(
        "/account/login",
        "mode=signup&next=/account/projects/private&email=person@example.com",
      )?.path,
    ).toBe("/account/login?mode=signup");
  });
  it("does not track operator, setup, invitation or unknown private routes", () => {
    for (const route of [
      "/operations",
      "/operations/requests",
      "/operations-review",
      "/studio",
      "/setup/shipping",
      "/api/events",
      "/mcp",
      "/mcp/oauth/authorize",
      "/connect/gyvft-agent",
      "/.well-known/oauth-protected-resource",
      "/account/invitations/private-token",
      "/account/circle-invitations/private-token",
      "/account/password/secret",
    ])
      expect(analyticsPage(route)).toBeNull();
  });
  it("keeps safe campaign tags and excludes arbitrary query data", () => {
    expect(
      analyticsPage(
        "/stories/bits-2001-reunion",
        "utm_source=instagram&utm_medium=social&utm_campaign=reunion_2026&email=p@example.com&token=private",
      )?.path,
    ).toBe(
      "/stories/bits-2001-reunion?utm_source=instagram&utm_medium=social&utm_campaign=reunion_2026",
    );
    expect(analyticsPage("/", "utm_campaign=person@example.com")?.path).toBe(
      "/",
    );
    expect(analyticsPage("/someone@example.com")).toEqual({
      path: "/other",
      title: "/other · GYVFT",
    });
  });
  it("sends only bounded product events rather than free-form fields", () => {
    expect(
      googleParameters({
        email: "private@example.com",
        story: "private brief",
        budget: 10000,
        method: "email",
        form_name: "gift_brief",
        cta_name: "create_account",
        step: 3,
      }),
    ).toEqual({
      method: "email",
      form_name: "gift_brief",
      cta_name: "create_account",
      step: 3,
    });
    expect(
      googleParameters({ method: "private@example.com", step: 999 }),
    ).toEqual({});
  });
});
