import type { Sql } from "postgres";
import { getSql } from "@/lib/database/client";
import { normaliseEmail, normalisePhone } from "@/lib/utils/normalise";
import type { Contact } from "@/types/domain";

export async function findContactByEmailOrPhone(
  email: string,
  phone: string,
  db: Sql = getSql(),
): Promise<Contact | null> {
  const normalisedEmail = normaliseEmail(email);
  const normalisedPhone = normalisePhone(phone);
  const rows = await db<Contact[]>`
    SELECT *
    FROM contacts
    WHERE deleted_at IS NULL
      AND (
        normalised_email = ${normalisedEmail}
        OR (${normalisedPhone} <> '' AND normalised_phone = ${normalisedPhone})
      )
    ORDER BY created_at ASC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function createOrMatchContact(
  input: {
    fullName: string;
    email: string;
    phone: string;
    organisationId?: string | null;
    designation?: string | null;
    preferredContactMethod?: string | null;
    source: string;
    communicationConsent: boolean;
    marketingConsent: boolean;
    consentVersion?: string | null;
  },
  db: Sql = getSql(),
): Promise<{ contact: Contact; created: boolean }> {
  const existing = await findContactByEmailOrPhone(input.email, input.phone, db);
  if (existing) {
    const rows = await db<Contact[]>`
      UPDATE contacts
      SET
        organisation_id = COALESCE(${input.organisationId ?? null}::uuid, organisation_id),
        designation = COALESCE(${input.designation ?? null}, designation),
        preferred_contact_method = COALESCE(${input.preferredContactMethod ?? null}, preferred_contact_method),
        communication_consent = contacts.communication_consent OR ${input.communicationConsent},
        marketing_consent = contacts.marketing_consent OR ${input.marketingConsent},
        consent_version = COALESCE(${input.consentVersion ?? null}, consent_version),
        last_activity_at = NOW(),
        updated_at = NOW()
      WHERE id = ${existing.id}::uuid
      RETURNING *
    `;
    return { contact: rows[0]!, created: false };
  }

  const rows = await db<Contact[]>`
    INSERT INTO contacts (
      organisation_id, full_name, email, normalised_email, phone, normalised_phone,
      designation, preferred_contact_method, source, communication_consent, marketing_consent,
      consent_version, last_activity_at
    ) VALUES (
      ${input.organisationId ?? null}::uuid,
      ${input.fullName},
      ${input.email},
      ${normaliseEmail(input.email)},
      ${input.phone},
      ${normalisePhone(input.phone)},
      ${input.designation ?? null},
      ${input.preferredContactMethod ?? null},
      ${input.source},
      ${input.communicationConsent},
      ${input.marketingConsent},
      ${input.consentVersion ?? null},
      NOW()
    )
    RETURNING *
  `;
  return { contact: rows[0]!, created: true };
}

export async function getContactById(id: string, db: Sql = getSql()): Promise<Contact | null> {
  const rows = await db<Contact[]>`
    SELECT * FROM contacts WHERE id = ${id}::uuid AND deleted_at IS NULL LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listContacts(options: {
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: Contact[]; total: number }> {
  const sql = getSql();
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const q = options.query?.trim();
  const rows = q
    ? await sql<Contact[]>`
        SELECT * FROM contacts
        WHERE deleted_at IS NULL
          AND (
            full_name ILIKE ${"%" + q + "%"}
            OR email ILIKE ${"%" + q + "%"}
            OR phone ILIKE ${"%" + q + "%"}
          )
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    : await sql<Contact[]>`
        SELECT * FROM contacts
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
  const totalRows = q
    ? await sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count FROM contacts
        WHERE deleted_at IS NULL
          AND (
            full_name ILIKE ${"%" + q + "%"}
            OR email ILIKE ${"%" + q + "%"}
            OR phone ILIKE ${"%" + q + "%"}
          )
      `
    : await sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count FROM contacts WHERE deleted_at IS NULL
      `;
  return { rows, total: Number(totalRows[0]?.count ?? 0) };
}
