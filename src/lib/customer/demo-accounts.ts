/** Explicit fictional fixtures. Never infer demo status from a person's email. */
export const demoAccounts = [
  {
    id: "d4e00000-0000-4000-8000-000000000001",
    email: "aarla+demo-single@aarla.in",
    name: "Kavya · personal gifting",
    scenario: "One thoughtful gift for a friend",
    shortName: "Kavya",
    kind: "single",
  },
  {
    id: "d4e00000-0000-4000-8000-000000000002",
    email: "aarla+demo-business@aarla.in",
    name: "Arun · Meridian Studio",
    scenario: "Business and employee gifting",
    shortName: "Arun",
    kind: "business",
  },
  {
    id: "d4e00000-0000-4000-8000-000000000003",
    email: "aarla+demo-communities@aarla.in",
    name: "Meera · connected communities",
    scenario: "Alumni, book club and neighbourhood gifting",
    shortName: "Meera",
    kind: "communities",
  },
  {
    id: "d4e00000-0000-4000-8000-000000000004",
    email: "aarla+demo-family@aarla.in",
    name: "Raghav · family and friends",
    scenario: "Recurring occasions and gifts for several recipients",
    shortName: "Raghav",
    kind: "family",
  },
] as const;
export const demoAccountIds: string[] = demoAccounts.map((a) => a.id);
export function isDemoAccount(id: string) {
  return demoAccountIds.includes(id);
}
