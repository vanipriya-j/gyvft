import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Sql } from "postgres";
import { getSql } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import { saveProfile, savePerson, saveOccasion } from "./journeys";
import { profileSchema, personSchema, occasionSchema } from "./journey-model";

export const privateDetailsInput = z
  .object({
    accountId: z.string().uuid(),
    kind: z.enum(["profile", "person", "occasion"]),
    id: z.string().uuid(),
    version: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    document: z.record(z.string(), z.unknown()),
  })
  .strict();
export type PrivateDetailsKind = z.infer<typeof privateDetailsInput>["kind"];
const fields = {
  profile: ["name", "about", "interests", "avoid", "share_profile"],
  person: ["name", "relationship", "about", "likes", "avoid", "email"],
  occasion: [
    "title",
    "occasion_date",
    "repeats_annually",
    "notes",
    "relationship",
    "person_id",
  ],
};
function documentFor(kind: PrivateDetailsKind, value: Record<string, unknown>) {
  return Object.fromEntries(
    fields[kind].map((key) => [
      key,
      key === "share_profile" || key === "repeats_annually"
        ? value[key] === true
        : key === "person_id"
          ? value[key] || null
          : String(value[key] || "").trim(),
    ]),
  );
}
/** Hash only editable fields: photos, shared tastes and invitation state are independent. */
export function privateDetailsVersion(
  kind: PrivateDetailsKind,
  value?: object | null,
) {
  if (!value) return null;
  const document = documentFor(kind, value as Record<string, unknown>);
  if (kind === "profile" && Object.values(document).every((v) => !v))
    return null;
  return createHash("sha256").update(JSON.stringify(document)).digest("hex");
}
export async function savePrivateDetails(
  accountId: string,
  raw: unknown,
  sql: Sql = getSql(),
) {
  const input = privateDetailsInput.parse(raw);
  if (
    input.accountId !== accountId ||
    (input.kind === "profile" && input.id !== accountId)
  )
    throw new AppError(
      "FORBIDDEN",
      "Sign in to the account that saved this draft.",
    );
  const document =
    input.kind === "profile"
      ? profileSchema.parse(input.document)
      : input.kind === "person"
        ? personSchema.parse(input.document)
        : occasionSchema.parse(input.document);
  if (input.kind === "person")
    (document as z.infer<typeof personSchema>).email = String(
      input.document.email || "",
    )
      .trim()
      .toLowerCase();
  return sql.begin(async (rawTx) => {
    const tx = rawTx as unknown as Sql;
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`private-details:${input.kind}:${input.id}`},0))`;
    const rows =
      input.kind === "profile"
        ? await tx`SELECT * FROM gyvft_customer_profiles WHERE account_id=${accountId}::uuid FOR UPDATE`
        : input.kind === "person"
          ? await tx`SELECT * FROM gyvft_customer_people WHERE id=${input.id}::uuid AND account_id=${accountId}::uuid FOR UPDATE`
          : await tx`SELECT *,occasion_date::text AS occasion_date FROM gyvft_customer_occasions WHERE id=${input.id}::uuid AND account_id=${accountId}::uuid FOR UPDATE`;
    const current = privateDetailsVersion(input.kind, rows[0]),
      next = privateDetailsVersion(input.kind, document);
    // A lost response can safely be replayed without creating another record.
    if (current === next) return { version: next, id: input.id };
    if (current !== input.version)
      throw new AppError(
        "CONFLICT",
        "This record changed elsewhere. Your draft is kept in this tab. Review the latest version before saving again.",
      );
    if (input.kind === "profile") await saveProfile(accountId, document, tx);
    else if (input.kind === "person")
      await savePerson(accountId, input.id, document, tx);
    else await saveOccasion(accountId, input.id, document, tx);
    return { version: next, id: input.id };
  });
}
