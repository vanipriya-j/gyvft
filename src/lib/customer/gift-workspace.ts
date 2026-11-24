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
import {
  MAX_OPTION_IMAGES,
  MAX_OPTION_PREVIEW_BYTES,
  type OptionImage,
} from "./option-image-model";
export class GiftWorkspaceError extends Error {}
export async function optionImagesAvailable(sql: Sql) {
  const [table] =
    await sql`SELECT to_regclass('gyvft_gift_option_images')::text AS name`;
  return !!table?.name;
}
export async function giftWorkspace(projectId: string, accountId?: string) {
  const sql = getSql();
  if (accountId) {
    const [owned] =
      await sql`SELECT id FROM customer_projects WHERE id=${projectId}::uuid AND customer_account_id=${accountId}::uuid`;
    if (!owned) throw new GiftWorkspaceError("Request unavailable.");
  }
  const [options, drafts, selections] = await Promise.all([
    sql<
      GiftOption[]
    >`SELECT o.id,title,description,contents,pricing,published,image_data IS NOT NULL AS has_image,created_at,COALESCE(v.hidden,false) AS hidden,o.operator_hidden FROM gyvft_gift_options o LEFT JOIN gyvft_gift_visibility v ON v.option_id=o.id AND v.project_id=o.project_id AND v.kind='curated' WHERE o.project_id=${projectId}::uuid ORDER BY created_at,o.id`,
    sql<
      SavedGiftDraft[]
    >`SELECT d.id,version,document,updated_at,COALESCE(v.hidden,false) AS hidden FROM gyvft_gift_drafts d LEFT JOIN gyvft_gift_visibility v ON v.option_id=d.id AND v.project_id=d.project_id AND v.kind='draft' WHERE d.project_id=${projectId}::uuid ORDER BY updated_at DESC LIMIT 12`,
    sql<
      GiftSelection[]
    >`SELECT s.id,s.draft_id,s.draft_version,s.snapshot,s.created_at,EXISTS(SELECT 1 FROM customer_project_approvals a WHERE a.gift_selection_id=s.id) AS quoted FROM gyvft_gift_selections s WHERE s.project_id=${projectId}::uuid ORDER BY s.created_at DESC LIMIT 30`,
  ]);
  const optionImagesReady = await optionImagesAvailable(sql);
  const images = optionImagesReady
    ? await sql<(OptionImage & { option_id: string })[]>`
        SELECT i.id,i.option_id,i.position,'gift-option-image'::text AS kind
        FROM gyvft_gift_option_images i JOIN gyvft_gift_options o ON o.id=i.option_id
        WHERE o.project_id=${projectId}::uuid ORDER BY i.position,i.id`
    : [];
  const galleryOptions = options.map((o) => ({
    ...o,
    images: images
      .filter((image) => image.option_id === o.id)
      .map(({ id, kind, position }) => ({ id, kind, position })),
  }));
  const [agentTable] =
    await sql`SELECT to_regclass('gyvft_mcp_settings')::text AS name`;
  const optionDraftsReady = !!agentTable?.name;
  const versions = optionDraftsReady
    ? await sql`SELECT id,draft_version FROM gyvft_gift_options WHERE project_id=${projectId}::uuid`
    : [];
  return {
    optionImagesReady,
    optionDraftsReady,
    options: accountId
      ? galleryOptions.filter((o) => !o.operator_hidden && o.published)
      : galleryOptions.map((o) => ({
          ...o,
          draft_version: Number(
            versions.find((v) => v.id === o.id)?.draft_version || 1,
          ),
          hidden: !!o.operator_hidden,
        })),
    drafts,
    selections,
  };
}
export async function editable(tx: Sql, projectId: string, accountId?: string) {
  if (
    !uuidPattern.test(projectId) ||
    (accountId && !uuidPattern.test(accountId))
  )
    throw new GiftWorkspaceError("Request unavailable.");
  const [project] = accountId
    ? await tx`SELECT id,kind,stage,production_started_at,shopify_order_id,shopify_order_reference,shopify_order_state,customer_email,submission_key FROM customer_projects WHERE id=${projectId}::uuid AND customer_account_id=${accountId}::uuid FOR UPDATE`
    : await tx`SELECT id,kind,stage,production_started_at,shopify_order_id,shopify_order_reference,shopify_order_state,customer_email,submission_key FROM customer_projects WHERE id=${projectId}::uuid FOR UPDATE`;
  if (!project) throw new GiftWorkspaceError("Request unavailable.");
  if (
    project.stage >= 7 ||
    project.production_started_at ||
    project.shopify_order_id ||
    project.shopify_order_reference ||
    (project.shopify_order_state && project.shopify_order_state !== "pending")
  )
    throw new GiftWorkspaceError(
      "This gift is locked for the official order or production. Message the team for support.",
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
    >`SELECT id,contents FROM gyvft_gift_options WHERE project_id=${projectId}::uuid AND published`;
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
  const pictures = raw.images === undefined ? [raw.image] : raw.images;
  if (
    !Array.isArray(pictures) ||
    pictures.length < 1 ||
    pictures.length > MAX_OPTION_IMAGES
  )
    throw new GiftWorkspaceError(
      `Add between 1 and ${MAX_OPTION_IMAGES} option images.`,
    );
  const images = pictures.map((picture: unknown) => {
    const image = picture as { data?: unknown; mime?: unknown } | undefined;
    if (
      !image ||
      typeof image.data !== "string" ||
      image.data.length > 2800000 ||
      typeof image.mime !== "string"
    )
      throw new GiftWorkspaceError(
        "Add valid PNG, JPEG or WebP option images.",
      );
    const data = Buffer.from(image.data, "base64");
    if (!validImage(data, image.mime))
      throw new GiftWorkspaceError(
        "Use a valid PNG, JPEG or WebP image under 2 MB.",
      );
    if (pictures.length > 1 && data.length > MAX_OPTION_PREVIEW_BYTES)
      throw new GiftWorkspaceError(
        "Gallery previews are too large. Select the images again to optimise them.",
      );
    return { data, mime: image.mime };
  });
  const { data: bytes, mime } = images[0];
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
    if (images.length > 1 && !(await optionImagesAvailable(tx)))
      throw new GiftWorkspaceError(
        "Multiple-image setup is not active yet. No option was published. Ask the owner to activate option images.",
      );
    const [count] =
      await tx`SELECT count(*)::int AS n FROM gyvft_gift_options WHERE project_id=${projectId}::uuid`;
    if (count.n >= 24)
      throw new GiftWorkspaceError("This request already has 24 options.");
    const [option] =
      await tx`INSERT INTO gyvft_gift_options(project_id,title,description,contents,image_data,image_type,request_id,pricing) VALUES(${projectId}::uuid,${parsed.title},${parsed.description},${tx.json(parsed.contents)},${bytes},${mime},${requestId}::uuid,${tx.json(parsed.pricing)}) RETURNING id`;
    for (let index = 1; index < images.length; index++)
      await tx`INSERT INTO gyvft_gift_option_images(option_id,position,image_data,image_type) VALUES(${option.id}::uuid,${index + 1},${images[index].data},${images[index].mime})`;
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
    if (!accountId && kind === "curated") {
      await tx`UPDATE gyvft_gift_options SET operator_hidden=${hidden} WHERE id=${id}::uuid AND project_id=${projectId}::uuid`;
      return;
    }
    await tx`INSERT INTO gyvft_gift_visibility(project_id,option_id,kind,hidden) VALUES(${projectId}::uuid,${id}::uuid,${kind},${hidden}) ON CONFLICT(project_id,option_id,kind) DO UPDATE SET hidden=EXCLUDED.hidden`;
  });
}
