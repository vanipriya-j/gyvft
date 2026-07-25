import "server-only";
import { createHash, randomUUID } from "crypto";
import {
  ALLOWED_BRIEF_EXTENSIONS,
  ALLOWED_BRIEF_MIME_TYPES,
  SIGNED_URL_EXPIRES_SECONDS,
  STORAGE_BUCKET_BRIEFS,
} from "@/config/constants";
import { getEnv } from "@/config/env";
import { getSql } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createIntegrationLog } from "@/services/integrations/logs";

function extensionOf(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts[parts.length - 1] ?? "";
}

export function validateBriefFile(file: { name: string; type: string; size: number }) {
  const env = getEnv();
  const ext = extensionOf(file.name);
  if (!(ALLOWED_BRIEF_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new AppError("VALIDATION_ERROR", "File extension is not allowed");
  }
  if (!(ALLOWED_BRIEF_MIME_TYPES as readonly string[]).includes(file.type)) {
    throw new AppError("VALIDATION_ERROR", "File type is not allowed");
  }
  if (file.size <= 0 || file.size > env.MAX_UPLOAD_BYTES) {
    throw new AppError("VALIDATION_ERROR", "File exceeds the maximum allowed size");
  }
}

export async function storeBriefFile(input: {
  file: File;
  opportunityId: string;
  uploadedByUserId?: string | null;
}): Promise<{ fileId: string; storagePath: string }> {
  validateBriefFile(input.file);
  const ext = extensionOf(input.file.name);
  const storagePath = `${input.opportunityId}/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const sql = getSql();

  // Malware-scanning integration boundary (provider plug-in point)
  const scanStatus = await runMalwareScanBoundary({
    filename: input.file.name,
    mimeType: input.file.type,
    byteSize: input.file.size,
    checksum,
  });

  try {
    const admin = createSupabaseAdminClient();
    const upload = await admin.storage.from(STORAGE_BUCKET_BRIEFS).upload(storagePath, buffer, {
      contentType: input.file.type,
      upsert: false,
    });
    if (upload.error) {
      throw new Error(upload.error.message);
    }

    const rows = await sql<{ id: string }[]>`
      INSERT INTO files (
        opportunity_id, uploaded_by_user_id, original_filename, storage_path,
        mime_type, byte_size, checksum_sha256, scan_status, scan_provider
      ) VALUES (
        ${input.opportunityId}::uuid,
        ${input.uploadedByUserId ?? null}::uuid,
        ${input.file.name},
        ${storagePath},
        ${input.file.type},
        ${input.file.size},
        ${checksum},
        ${scanStatus},
        'boundary'
      )
      RETURNING id
    `;

    await createIntegrationLog({
      provider: "supabase_storage",
      operation: "upload_brief",
      success: true,
      metadata: { opportunityId: input.opportunityId, fileId: rows[0]!.id },
    });

    return { fileId: rows[0]!.id, storagePath };
  } catch (error) {
    // Cleanup orphaned object if DB insert failed after upload
    try {
      const admin = createSupabaseAdminClient();
      await admin.storage.from(STORAGE_BUCKET_BRIEFS).remove([storagePath]);
    } catch {
      // ignore cleanup failure
    }
    await createIntegrationLog({
      provider: "supabase_storage",
      operation: "upload_brief",
      success: false,
      sanitisedError: error instanceof Error ? error.message : "upload failed",
    });
    throw error;
  }
}

async function runMalwareScanBoundary(meta: {
  filename: string;
  mimeType: string;
  byteSize: number;
  checksum: string;
}): Promise<"pending" | "clean" | "skipped"> {
  // Integration boundary: replace with a real scanner provider when configured.
  void meta;
  return "pending";
}

export async function createSignedBriefUrl(fileId: string): Promise<{
  url: string;
  expiresIn: number;
}> {
  const sql = getSql();
  const rows = await sql<{ storage_path: string; deleted_at: string | null }[]>`
    SELECT storage_path, deleted_at FROM files WHERE id = ${fileId}::uuid LIMIT 1
  `;
  const file = rows[0];
  if (!file || file.deleted_at) {
    throw new AppError("NOT_FOUND", "File not found");
  }
  const admin = createSupabaseAdminClient();
  const signed = await admin.storage
    .from(STORAGE_BUCKET_BRIEFS)
    .createSignedUrl(file.storage_path, SIGNED_URL_EXPIRES_SECONDS);
  if (signed.error || !signed.data?.signedUrl) {
    throw new AppError("INTEGRATION_ERROR", "Unable to create signed URL");
  }
  return { url: signed.data.signedUrl, expiresIn: SIGNED_URL_EXPIRES_SECONDS };
}
