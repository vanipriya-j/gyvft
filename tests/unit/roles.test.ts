import { describe, expect, it } from "vitest";
import {
  canConfigureSecretIntegrations,
  canDeleteOpportunity,
  canExportAllData,
  canManageIntegrations,
  canManageUsers,
  canViewAnalytics,
  roleAtLeast,
} from "@/lib/auth/roles";

describe("role permission helpers", () => {
  it("orders roles by privilege", () => {
    expect(roleAtLeast("owner", "admin")).toBe(true);
    expect(roleAtLeast("admin", "contributor")).toBe(true);
    expect(roleAtLeast("contributor", "admin")).toBe(false);
  });

  it("limits owner-only actions to owners", () => {
    expect(canManageUsers("owner")).toBe(true);
    expect(canDeleteOpportunity("owner")).toBe(true);
    expect(canConfigureSecretIntegrations("owner")).toBe(true);
    expect(canManageUsers("admin")).toBe(false);
    expect(canDeleteOpportunity("contributor")).toBe(false);
    expect(canConfigureSecretIntegrations("admin")).toBe(false);
  });

  it("allows admins to manage non-secret integrations and analytics", () => {
    expect(canManageIntegrations("admin")).toBe(true);
    expect(canViewAnalytics("admin")).toBe(true);
    expect(canExportAllData("admin")).toBe(true);
    expect(canManageIntegrations("contributor")).toBe(false);
    expect(canViewAnalytics("contributor")).toBe(false);
  });
});
