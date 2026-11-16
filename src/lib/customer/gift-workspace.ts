import "server-only";
import type { Sql } from "postgres";
import { getSql } from "@/lib/database/client";
import { uuidPattern } from "./model";
import {
  normaliseGiftDraft,
  curatedOptionSchema,
  type GiftOption,
  type SavedGiftDraft,
  type GiftSelection,
} from "./gift-workspace-model";
import { validImage } from "./images";
import { queueNotification } from "./notifications";
export class GiftWorkspaceError extends Error {}
export async function giftWorkspace(projectId: string) {
  const sql = getSql();
  const [options, drafts, selections] = await Promise.all([
    sql<
      GiftOption[]
    >`SELECT o.id,title,description,contents,pricing,published,image_data IS NOT NULL AS has_image,created_at,COALESCE(v.hidden,false) AS hidden FROM gyvft_gift_options o LEFT JOIN gyvft_gift_visibility v ON v.option_id=o.id AND v.project_id=o.project_id AND v.kind='curated' WHERE o.project_id=${projectId}::uuid ORDER BY created_at,o.id`,
    sql<
      SavedGiftDraft[]
    >`SELECT d.id,version,document,updated_at,COALESCE(v.hidden,false) AS hidden FROM gyvft_gift_drafts d LEFT JOIN gyvft_gift_visibility v ON v.option_id=d.id AND v.project_id=d.project_id AND v.kind='draft' WHERE d.project_id=${projectId}::uuid ORDER BY updated_at DESC LIMIT 12`,
    sql<
      GiftSelection[]
    >`SELECT s.id,s.draft_id,s.draft_version,s.snapshot,s.created_at,EXISTS(SELECT 1 FROM customer_project_approvals a WHERE a.gift_selection_id=s.id) AS quoted FROM gyvft_gift_selections s WHERE s.project_id=${projectId}::uuid ORDER BY s.created_at DESC LIMIT 30`,
  ]);
  return { options, drafts, selections };
}
async function editable(tx: Sql, projectId: string, accountId?: string) {
  if (
    !uuidPattern.test(projectId) ||
    (accountId && !uuidPattern.test(accountId))
  )
    throw new GiftWorkspaceError("Request unavailable.");
  const [project] = accountId
    ? await tx`SELECT id,kind,customer_email,submission_key FROM customer_projects WHERE id=${projectId}::uuid AND customer_account_id=${accountId}::uuid FOR UPDATE`
    : await tx`SELECT id,kind,customer_email,submission_key FROM customer_projects WHERE id=${projectId}::uuid FOR UPDATE`;
  if (!project) throw new GiftWorkspaceError("Request unavailable.");
  if (project.kind === "project")
    throw new GiftWorkspaceError(
      "This gift is already an order. Message the team to discuss a change.",
    );
  if (String(project.submission_key || "").startsWith("gyvft-demo-"))
    throw new GiftWorkspaceError(
      "Sample requests are read-only. Open a real enquiry to build your gift.",
    );
  return project;
}
export async function saveGiftDraft(
  projectId: string,
  accountId: string,
  id: string,
  version: number,
  raw: unknown,
) {
  if (!uuidPattern.test(id) || !Number.isInteger(version) || version < 0)
    throw new GiftWorkspaceError("Invalid draft.");
  return getSql().begin(async (txRaw) => {
    const tx = txRaw as unknown as Sql;
    await editable(tx, projectId, accountId);
    const [quoted] =
      await tx`SELECT a.id FROM customer_project_approvals a JOIN gyvft_gift_selections s ON s.id=a.gift_selection_id WHERE s.draft_id=${id}::uuid AND s.project_id=${projectId}::uuid LIMIT 1`;
    if (quoted)
      throw new GiftWorkspaceError(
        "This option has been quoted. Reload, then create an alternative to make changes.",
      );
    const options = await tx<
      GiftOption[]
    >`SELECT id,contents FROM gyvft_gift_options WHERE project_id=${projectId}::uuid`;
    const doc = normaliseGiftDraft(raw, options);
    let result;
    if (version === 0) {
      const [count] =
        await tx`SELECT count(*)::int AS n FROM gyvft_gift_drafts WHERE project_id=${projectId}::uuid`;
      if (count.n >= 12)
        throw new GiftWorkspaceError(
          "You can keep up to 12 alternatives for this request.",
        );
      result = await tx<
        SavedGiftDraft[]
      >`INSERT INTO gyvft_gift_drafts(id,project_id,document) VALUES(${id}::uuid,${projectId}::uuid,${tx.json(doc)}) ON CONFLICT(id) DO NOTHING RETURNING id,version,document,updated_at`;
    } else
      result = await tx<
        SavedGiftDraft[]
      >`UPDATE gyvft_gift_drafts SET document=${tx.json(doc)},version=version+1,updated_at=now() WHERE id=${id}::uuid AND project_id=${projectId}::uuid AND version=${version} RETURNING id,version,document,updated_at`;
    if (!result[0])
      throw new GiftWorkspaceError(
        "This draft has changed in another tab, or a previous save succeeded. Reload to recover the latest saved version.",
      );
    return result[0];
  });
}
export async function requestGiftQuote(
  projectId: string,
  accountId: string,
  draftId: string,
  version: number,
  selectionId: string,
) {
  if (!uuidPattern.test(draftId) || !uuidPattern.test(selectionId))
    throw new GiftWorkspaceError("Invalid selection.");
  return getSql().begin(async (txRaw) => {
    const tx = txRaw as unknown as Sql;
    const project = await editable(tx, projectId, accountId);
    const [draft] = await tx<
      SavedGiftDraft[]
    >`SELECT id,version,document FROM gyvft_gift_drafts WHERE id=${draftId}::uuid AND project_id=${projectId}::uuid`;
    if (!draft || draft.version !== version)
      throw new GiftWorkspaceError(
        "Save the latest draft before requesting a quote.",
      );
    if (!draft.document.lines.length)
      throw new GiftWorkspaceError(
        "Add at least one product before requesting a quote.",
      );
    const [prior] = await tx<
      GiftSelection[]
    >`SELECT id,draft_id,draft_version,snapshot,created_at FROM gyvft_gift_selections WHERE project_id=${projectId}::uuid AND draft_id=${draftId}::uuid AND draft_version=${version}`;
    if (prior) return prior;
    const [selection] = await tx<
      GiftSelection[]
    >`INSERT INTO gyvft_gift_selections(id,project_id,draft_id,draft_version,snapshot) VALUES(${selectionId}::uuid,${projectId}::uuid,${draftId}::uuid,${version},${tx.json(draft.document)}) RETURNING id,draft_id,draft_version,snapshot,created_at`;
    await tx`INSERT INTO customer_project_events(project_id,title,body) VALUES(${projectId}::uuid,'Gift selected for quote',${draft.document.label + " · saved version " + version})`;
    await tx`UPDATE customer_projects SET next_action='Your selected gift is with GYVFT. We will confirm availability, packaging and an itemised quote.' WHERE id=${projectId}::uuid`;
    await queueNotification(
      tx,
      projectId,
      `gift-selection:${selection.id}`,
      "team",
      project.customer_email,
      "GYVFT: gift selected for quote",
    );
    return selection;
  });
}
export async function publishGiftOption(
  projectId: string,
  requestId: string,
  raw: Record<string, unknown>,
) {
  if (!uuidPattern.test(requestId))
    throw new GiftWorkspaceError("Invalid action key.");
  const parsed = curatedOptionSchema.parse(raw);
  const picture = raw.image as { data?: unknown; mime?: unknown } | undefined;
  if (
    !picture ||
    typeof picture.data !== "string" ||
    picture.data.length > 2800000 ||
    typeof picture.mime !== "string"
  )
    throw new GiftWorkspaceError("Add one hamper image under 2 MB.");
  const mime = picture.mime;
  const bytes = Buffer.from(picture.data, "base64");
  if (!validImage(bytes, picture.mime))
    throw new GiftWorkspaceError(
      "Use a valid PNG, JPEG or WebP hamper image under 2 MB.",
    );
  return getSql().begin(async (txRaw) => {
    const tx = txRaw as unknown as Sql;
    const project = await editable(tx, projectId);
    const [prior] =
      await tx`SELECT id,project_id FROM gyvft_gift_options WHERE request_id=${requestId}::uuid`;
    if (prior) {
      if (prior.project_id !== projectId)
        throw new GiftWorkspaceError("Action key already used.");
      return;
    }
    const [count] =
      await tx`SELECT count(*)::int AS n FROM gyvft_gift_options WHERE project_id=${projectId}::uuid`;
    if (count.n >= 24)
      throw new GiftWorkspaceError("This request already has 24 options.");
    await tx`INSERT INTO gyvft_gift_options(project_id,title,description,contents,image_data,image_type,request_id,pricing) VALUES(${projectId}::uuid,${parsed.title},${parsed.description},${tx.json(parsed.contents)},${bytes},${mime},${requestId}::uuid,${tx.json(parsed.pricing)})`;
    await tx`INSERT INTO customer_project_events(project_id,title,body) VALUES(${projectId}::uuid,'New gift option from GYVFT',${parsed.title})`;
    await tx`UPDATE customer_projects SET next_action='Your gift options are ready. Explore the options or build one of your own.' WHERE id=${projectId}::uuid`;
    await queueNotification(
      tx,
      projectId,
      `gift-option:${requestId}`,
      "customer",
      project.customer_email,
      "Your GYVFT gift options are ready",
    );
  });
}

export async function setGiftVisibility(
  projectId: string,
  id: string,
  kind: "curated" | "draft",
  hidden: boolean,
  accountId?: string,
) {
  if (!uuidPattern.test(id))
    throw new GiftWorkspaceError("Option unavailable.");
  return getSql().begin(async (txRaw) => {
    const tx = txRaw as unknown as Sql;
    await editable(tx, projectId, accountId);
    const rows =
      kind === "curated"
        ? await tx`SELECT id FROM gyvft_gift_options WHERE id=${id}::uuid AND project_id=${projectId}::uuid`
        : await tx`SELECT id FROM gyvft_gift_drafts WHERE id=${id}::uuid AND project_id=${projectId}::uuid`;
    if (!rows[0]) throw new GiftWorkspaceError("Option unavailable.");
    await tx`INSERT INTO gyvft_gift_visibility(project_id,option_id,kind,hidden) VALUES(${projectId}::uuid,${id}::uuid,${kind},${hidden}) ON CONFLICT(project_id,option_id,kind) DO UPDATE SET hidden=EXCLUDED.hidden`;
  });
}
