import "server-only";
import { demoProjectContext } from "./demo-feature-context";
import { sampleRequirementPdf } from "./demo-feature-data";
import { demoKey } from "./demo-fixtures";
import {
  createHash,
  createHmac,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import type { Sql } from "postgres";
import { getSql } from "@/lib/database/client";
import {
  hashCustomerPassword,
  hashOpaqueToken,
  newOpaqueToken,
} from "./password";
import { validImage } from "./images";
import { demoAccountIds } from "./demo-accounts";
import { sendNotificationEmail } from "@/services/notifications/transports";
import { logger } from "@/lib/logging/logger";
import {
  operationsIntakeSchema,
  MAX_REQUIREMENT_TOTAL_BYTES,
  MAX_REQUIREMENT_FILE_BYTES,
  type RequirementAttachment,
  type IntakeCustomerSummary,
  type IntakeResult,
} from "./operations-intake-model";

export class OperationsIntakeError extends Error {}
export async function operationsIntakeReady(sql: Sql = getSql()) {
  const [row] =
    await sql`SELECT to_regclass('gyvft_operations_intakes')::text AS name`;
  return !!row?.name;
}
async function requireReady(sql: Sql) {
  if (!(await operationsIntakeReady(sql)))
    throw new OperationsIntakeError(
      "Customer intake needs its reviewed database update. Open /setup/operations-intake.",
    );
}
export async function requirementAttachmentsFor(
  projectId: string,
  sql: Sql = getSql(),
): Promise<RequirementAttachment[]> {
  const sample = await demoProjectContext(sql, projectId);
  if (sample) {
    const bytes = sampleRequirementPdf(
      String(sample.project.title),
      String(sample.project.brief),
    );
    return [
      {
        id: demoKey(`${projectId}:demo-requirement`),
        filename: "Sample requirement.pdf",
        mime_type: "application/pdf",
        size: bytes.length,
      },
    ];
  }
  if (!(await operationsIntakeReady(sql))) return [];
  return sql<
    RequirementAttachment[]
  >`SELECT id,filename,mime_type,octet_length(file_data)::int AS size FROM gyvft_requirement_attachments WHERE project_id=${projectId}::uuid ORDER BY position`;
}
export async function intakeAccessFor(
  accountIds: string[],
  sql: Sql = getSql(),
) {
  if (!accountIds.length || !(await operationsIntakeReady(sql))) return [];
  return sql<
    {
      account_id: string;
      setup_pending: boolean;
      setup_email_state: string | null;
    }[]
  >`SELECT i.account_id,
    NOT EXISTS(SELECT 1 FROM gyvft_customer_password_resets r WHERE r.account_id=i.account_id AND r.used_at IS NOT NULL) AS setup_pending,
    (SELECT state FROM gyvft_customer_setup_emails e WHERE e.account_id=i.account_id ORDER BY created_at DESC LIMIT 1) AS setup_email_state
    FROM gyvft_operations_intakes i WHERE i.created_account AND i.account_id=ANY(${accountIds}::uuid[])`;
}
export async function intakeCustomers(
  query: string,
  sql: Sql = getSql(),
): Promise<IntakeCustomerSummary[]> {
  await requireReady(sql);
  const search = "%" + query.trim().slice(0, 120) + "%";
  return sql<
    IntakeCustomerSummary[]
  >`SELECT a.id,a.email,COALESCE(f.name,'') AS name,a.is_active,
    EXISTS(SELECT 1 FROM gyvft_operations_intakes i WHERE i.account_id=a.id AND i.created_account) AND NOT EXISTS(SELECT 1 FROM gyvft_customer_password_resets r WHERE r.account_id=a.id AND r.used_at IS NOT NULL) AS setup_pending,
    (SELECT state FROM gyvft_customer_setup_emails e WHERE e.account_id=a.id ORDER BY created_at DESC LIMIT 1) AS setup_email_state
    FROM gyvft_customer_accounts a LEFT JOIN gyvft_customer_profiles f ON f.account_id=a.id
    WHERE (a.email ILIKE ${search} OR f.name ILIKE ${search}) AND NOT(a.id=ANY(${demoAccountIds}::uuid[]))
    ORDER BY a.created_at DESC LIMIT 30`;
}
function decodeFile(file: { data: string; mime: string; filename: string }) {
  const bytes = Buffer.from(file.data, "base64");
  if (
    bytes.toString("base64") !== file.data ||
    bytes.length > MAX_REQUIREMENT_FILE_BYTES
  )
    throw new OperationsIntakeError("Use files under 2 MB each.");
  const valid =
    file.mime === "application/pdf"
      ? bytes.length >= 12 && bytes.subarray(0, 5).toString() === "%PDF-"
      : validImage(bytes, file.mime);
  if (!valid)
    throw new OperationsIntakeError("Use valid PDF, PNG, JPEG or WebP files.");
  return { ...file, bytes };
}
export async function createOperationsIntake(
  raw: unknown,
): Promise<IntakeResult> {
  const input = operationsIntakeSchema.parse(raw),
    sql = getSql();
  await requireReady(sql);
  const files = input.files.map(decodeFile);
  if (
    files.reduce((total, file) => total + file.bytes.length, 0) >
    MAX_REQUIREMENT_TOTAL_BYTES
  )
    throw new OperationsIntakeError(
      "Keep all attached files together under 2.5 MB. Images are optimised before uploading.",
    );
  const digest = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  // The randomly generated initial password is never returned, logged or sent.
  const passwordHash =
    input.customer.kind === "new"
      ? await hashCustomerPassword(newOpaqueToken())
      : null;
  return sql.begin(async (rawTx) => {
    const tx = rawTx as unknown as Sql;
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${"ops-intake:" + input.request_id},0))`;
    const [prior] =
      await tx`SELECT i.*,a.email,COALESCE(f.name,'') AS name FROM gyvft_operations_intakes i JOIN gyvft_customer_accounts a ON a.id=i.account_id LEFT JOIN gyvft_customer_profiles f ON f.account_id=a.id WHERE i.id=${input.request_id}::uuid`;
    if (prior) {
      if (prior.input_hash !== digest)
        throw new OperationsIntakeError(
          "This save key belongs to different data. Start a new save.",
        );
      const [reset] =
        await tx`SELECT 1 FROM gyvft_customer_password_resets WHERE account_id=${prior.account_id}::uuid AND used_at IS NOT NULL LIMIT 1`;
      return {
        account_id: prior.account_id,
        email: prior.email,
        name: prior.name,
        created_account: prior.created_account,
        project_id: prior.project_id,
        setup_pending: prior.created_account && !reset,
        duplicate: true,
      };
    }
    let account: { id: string; email: string; is_active: boolean } | undefined;
    if (input.customer.kind === "new") {
      [account] = await tx<
        { id: string; email: string; is_active: boolean }[]
      >`INSERT INTO gyvft_customer_accounts(email,password_hash) VALUES(${input.customer.email},${passwordHash!}) ON CONFLICT(email) DO NOTHING RETURNING id,email,is_active`;
      if (!account)
        throw new OperationsIntakeError(
          "A customer already exists with this email. Choose Existing customer to use their account.",
        );
      await tx`INSERT INTO gyvft_customer_profiles(account_id,name,about,interests,avoid,share_profile) VALUES(${account.id}::uuid,${input.customer.name},'','','',false)`;
    } else {
      [account] = await tx<
        { id: string; email: string; is_active: boolean }[]
      >`SELECT id,email,is_active FROM gyvft_customer_accounts WHERE id=${input.customer.id}::uuid AND email=${input.customer.email} FOR UPDATE`;
      if (!account?.is_active || demoAccountIds.includes(account.id))
        throw new OperationsIntakeError(
          "Choose an active customer account. Sample accounts cannot receive real requirements.",
        );
    }
    const [profile] =
      await tx`SELECT name FROM gyvft_customer_profiles WHERE account_id=${account.id}::uuid`;
    let projectId: string | null = null;
    if (input.requirement) {
      projectId = randomUUID();
      const r = input.requirement;
      const story =
        r.story || "The requirement was supplied in the attached files.";
      const document = {
        title: r.title,
        story,
        occasion: r.occasion,
        recipients: r.recipients,
        budget: r.budget,
        budget_basis: r.budget_basis,
        city: r.city,
        phone: r.phone,
        delivery_date: r.delivery_date || "",
        source: "operations",
        version: 1,
      };
      await tx`INSERT INTO customer_projects(id,submission_key,customer_account_id,customer_email,title,brief,customer_type,organisation_name,is_draft,draft_document,occasion_date,delivery_date,next_action) VALUES(${projectId}::uuid,${"gyvft-ops-intake:" + input.request_id},${account.id}::uuid,${account.email},${r.title},${story},${r.customer_type},${r.organisation_name || null},false,${tx.json(document)},${r.occasion_date}::date,${r.delivery_date}::date,'Your requirement is with Aarla. We will curate options for you.')`;
      await tx`INSERT INTO gyvft_gift_brief_revisions(project_id,version,document) VALUES(${projectId}::uuid,1,${tx.json(document)})`;
      for (const [index, file] of files.entries())
        await tx`INSERT INTO gyvft_requirement_attachments(project_id,filename,mime_type,file_data,position) VALUES(${projectId}::uuid,${file.filename},${file.mime},${file.bytes},${index + 1})`;
      await tx`INSERT INTO customer_project_events(project_id,title,body) VALUES(${projectId}::uuid,'Requirement recorded by GYVFT','The GYVFT team added this requirement on your behalf.')`;
    }
    await tx`INSERT INTO gyvft_operations_intakes(id,account_id,project_id,created_account,input_hash) VALUES(${input.request_id}::uuid,${account.id}::uuid,${projectId}::uuid,${input.customer.kind === "new"},${digest})`;
    const [setup] =
      await tx`SELECT EXISTS(SELECT 1 FROM gyvft_operations_intakes WHERE account_id=${account.id}::uuid AND created_account) AND NOT EXISTS(SELECT 1 FROM gyvft_customer_password_resets WHERE account_id=${account.id}::uuid AND used_at IS NOT NULL) AS pending`;
    return {
      account_id: account.id,
      email: account.email,
      name: profile?.name || "",
      created_account: input.customer.kind === "new",
      project_id: projectId,
      setup_pending: !!setup?.pending,
      duplicate: false,
    };
  });
}
function emailKey() {
  const secret = process.env.SETUP_SECRET?.trim();
  if (!secret || secret.length < 11)
    throw new OperationsIntakeError("Operations access is not configured.");
  return createHmac("sha256", secret)
    .update("gyvft:customer-setup-email:v1")
    .digest();
}
function sealToken(token: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", emailKey(), iv);
  return Buffer.concat([
    iv,
    cipher.update(token, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}
function openToken(value: string) {
  const bytes = Buffer.from(value, "base64"),
    decipher = createDecipheriv(
      "aes-256-gcm",
      emailKey(),
      bytes.subarray(0, 12),
    );
  decipher.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([
    decipher.update(bytes.subarray(12, -16)),
    decipher.final(),
  ]).toString("utf8");
}
type SetupMail = {
  id: string;
  account_id: string;
  recipient: string;
  token_ciphertext: string;
  expires_at: Date | string;
  state: string;
};
export async function sendOperationsSetupEmail(
  accountId: string,
  requestId: string,
) {
  const sql = getSql();
  await requireReady(sql);
  const mail = await sql.begin(async (rawTx) => {
    const tx = rawTx as unknown as Sql;
    const [account] =
      await tx`SELECT id,email,is_active FROM gyvft_customer_accounts WHERE id=${accountId}::uuid FOR UPDATE`;
    if (!account?.is_active || demoAccountIds.includes(accountId))
      throw new OperationsIntakeError("Choose an active customer account.");
    const [prior] = await tx<
      SetupMail[]
    >`SELECT * FROM gyvft_customer_setup_emails WHERE id=${requestId}::uuid`;
    if (prior) {
      if (prior.account_id !== accountId)
        throw new OperationsIntakeError(
          "This email action belongs to another customer.",
        );
      if (prior.state !== "sent") {
        const [reset] =
          await tx`SELECT used_at FROM gyvft_customer_password_resets WHERE token_hash=(SELECT token_hash FROM gyvft_customer_setup_emails WHERE id=${prior.id}::uuid)`;
        if (!reset || reset.used_at)
          throw new OperationsIntakeError(
            "This customer already has account access. They can sign in or use Forgot password.",
          );
      }
      return prior;
    }
    const [pending] =
      await tx`SELECT EXISTS(SELECT 1 FROM gyvft_operations_intakes WHERE account_id=${accountId}::uuid AND created_account) AND NOT EXISTS(SELECT 1 FROM gyvft_customer_password_resets WHERE account_id=${accountId}::uuid AND used_at IS NOT NULL) AS pending`;
    if (!pending?.pending)
      throw new OperationsIntakeError(
        "This customer already has account access. They can sign in or use Forgot password.",
      );
    const token = newOpaqueToken(),
      hash = hashOpaqueToken(token),
      expires = new Date(Date.now() + 60 * 60 * 1000),
      encrypted = sealToken(token);
    await tx`INSERT INTO gyvft_customer_password_resets(token_hash,account_id,expires_at) VALUES(${hash},${accountId}::uuid,${expires})`;
    const [row] = await tx<
      SetupMail[]
    >`INSERT INTO gyvft_customer_setup_emails(id,account_id,token_hash,token_ciphertext,recipient,expires_at) VALUES(${requestId}::uuid,${accountId}::uuid,${hash},${encrypted},${account.email},${expires}) RETURNING *`;
    return row;
  });
  if (mail.state === "sent")
    return {
      state: "sent",
      message:
        "The setup email was already accepted by the email provider. It was not sent twice.",
    };
  if (new Date(mail.expires_at).getTime() <= Date.now())
    throw new OperationsIntakeError(
      "This setup link expired. Start a new setup email.",
    );
  const [claimed] =
    await sql`UPDATE gyvft_customer_setup_emails SET state='sending',attempted_at=now() WHERE id=${mail.id}::uuid AND (state IN ('pending','failed') OR (state='sending' AND attempted_at<now()-interval '5 minutes')) RETURNING id`;
  if (!claimed)
    return {
      state: "sending",
      message: "The setup email is being sent. Refresh before retrying.",
    };
  try {
    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.NODE_ENV === "production"
        ? "https://www.gyvft.com"
        : "http://localhost:3000");
    const url = new URL("/account/login", origin);
    url.searchParams.set("reset", openToken(mail.token_ciphertext));
    url.searchParams.set("setup", "1");
    await sendNotificationEmail({
      id: mail.id,
      to: mail.recipient,
      subject: "Your GYVFT account is ready to set up",
      text: `The GYVFT team has prepared your account so you can follow your gifting requests. Choose your own password using this secure link. It expires in one hour.\n\n${url.href}\n\nYour password is private to you. If you were not expecting this invitation, you can ignore it.`,
    });
    await sql`UPDATE gyvft_customer_setup_emails SET state='sent',sent_at=now() WHERE id=${mail.id}::uuid`;
    return {
      state: "sent",
      message:
        "Setup email accepted by the email provider. Ask the customer to check their inbox; delivery is not yet confirmed.",
    };
  } catch {
    await sql`UPDATE gyvft_customer_setup_emails SET state='failed' WHERE id=${mail.id}::uuid`;
    logger.warn("Operations customer setup email needs attention", {
      code: "CUSTOMER_SETUP_EMAIL_PENDING",
      requestId: mail.id,
    });
    return {
      state: "failed",
      message:
        "The customer and requirement are saved. The setup email could not be confirmed. Retry this email; do not create the customer again.",
    };
  }
}
