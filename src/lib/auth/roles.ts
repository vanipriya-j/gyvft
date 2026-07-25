import type { UserRole } from "@/types/domain";

const rank: Record<UserRole, number> = {
  contributor: 1,
  admin: 2,
  owner: 3,
};

export function roleAtLeast(role: UserRole, minimum: UserRole): boolean {
  return rank[role] >= rank[minimum];
}

export function canManageUsers(role: UserRole): boolean {
  return role === "owner";
}

export function canManageSecrets(role: UserRole): boolean {
  return role === "owner";
}

export function canManageIntegrations(role: UserRole): boolean {
  return role === "owner" || role === "admin";
}

export function canConfigureSecretIntegrations(role: UserRole): boolean {
  return role === "owner";
}

export function canDeleteOpportunity(role: UserRole): boolean {
  return role === "owner";
}

export function canExportAllData(role: UserRole): boolean {
  return role === "owner" || role === "admin";
}

export function canManageWorkspaceSecurity(role: UserRole): boolean {
  return role === "owner";
}

export function canViewAnalytics(role: UserRole): boolean {
  return role === "owner" || role === "admin";
}

export function canManageLandingPages(role: UserRole): boolean {
  return role === "owner" || role === "admin";
}
