export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalisePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    return `+${digits.slice(1).replace(/\D/g, "")}`;
  }
  return digits.replace(/\D/g, "");
}

export function normaliseOrganisationName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function maskId(value: string | null | undefined, visible = 4): string {
  if (!value) return "—";
  if (value.length <= visible * 2) return "*".repeat(value.length);
  return `${value.slice(0, visible)}…${value.slice(-visible)}`;
}

export function lastFour(value: string): string {
  if (value.length <= 4) return value;
  return value.slice(-4);
}
