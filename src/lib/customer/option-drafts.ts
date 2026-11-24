import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Sql } from "postgres";
import { getSql } from "@/lib/database/client";
import { agentProposalsAvailable } from "@/lib/mcp/auth";
import { curatedOptionSchema } from "./gift-workspace-model";
import { GiftWorkspaceError, editable } from "./gift-workspace";
import { validImage } from "./images";
import { queueNotification } from "./notifications";
import {
  MAX_OPTION_IMAGES,
  MAX_OPTION_PREVIEW_BYTES,
} from "./option-image-model";
export const draftWriteSchema = z
  .object({
    project_id: z.string().uuid(),
    client_reference: z.string().uuid(),
    option_id: z.string().uuid().optional(),
    expected_version: z.number().int().positive().optional(),
    option: curatedOptionSchema,
    images: z
      .array(z.object({ mime: z.string(), data: z.string().max(440000) }))
      .max(MAX_OPTION_IMAGES)
      .default([]),
  })
  .superRefine((v, c) => {
    if (v.option_id && !v.expected_version)
      c.addIssue({
        code: "custom",
        path: ["expected_version"],
        message: "Include the current draft version when updating it.",
      });
  });
export async function saveOptionDraft(
  raw: unknown,
  source: "operations" | "mcp",
  actorId?: string,
  sourceHash?: string,
) {
  const input = draftWriteSchema.parse(raw),
    sql = getSql();
  if (!(await agentProposalsAvailable(sql)))
    throw new GiftWorkspaceError(
      "Private option drafts need activation in Operations.",
    );
  const images = input.images.map((image) => {
    const data = Buffer.from(image.data, "base64");
    if (!validImage(data, image.mime) || data.length > MAX_OPTION_PREVIEW_BYTES)
      throw new GiftWorkspaceError(
        "Use optimised PNG, JPEG or WebP previews under 320 KB.",
      );
    return { data, mime: image.mime };
  });
  const digest =
    source === "mcp" && sourceHash
      ? z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .parse(sourceHash)
      : createHash("sha256")
          .update(
            JSON.stringify({ option: input.option, images: input.images }),
          )
          .digest("hex");
  return sql.begin(async (txRaw) => {
    const tx = txRaw as unknown as Sql;
    const [submitted] =
      await tx`SELECT id FROM customer_projects WHERE id=${input.project_id}::uuid AND NOT is_draft`;
    if (!submitted)
      throw new GiftWorkspaceError("Submitted request unavailable.");
    await editable(tx, input.project_id);
    const [replay] =
      await tx`SELECT v.option_id,v.input_hash,o.project_id,o.published,o.draft_version FROM gyvft_gift_option_draft_versions v JOIN gyvft_gift_options o ON o.id=v.option_id WHERE v.revision_key=${input.client_reference}::uuid`;
    if (replay) {
      if (
        replay.project_id !== input.project_id ||
        (input.option_id && replay.option_id !== input.option_id) ||
        replay.input_hash !== digest
      )
        throw new GiftWorkspaceError(
          "This action key was used for different draft data. Use a new key.",
        );
      return {
        id: String(replay.option_id),
        version: Number(replay.draft_version),
        published: !!replay.published,
        duplicate: true,
      };
    }
    const [prior] = input.option_id
      ? await tx`SELECT * FROM gyvft_gift_options WHERE id=${input.option_id}::uuid AND project_id=${input.project_id}::uuid FOR UPDATE`
      : await tx`SELECT * FROM gyvft_gift_options WHERE request_id=${input.client_reference}::uuid FOR UPDATE`;
    if (prior && prior.project_id !== input.project_id)
      throw new GiftWorkspaceError(
        "This action key belongs to another request.",
      );
    if (prior?.draft_revision_key === input.client_reference) {
      if (prior.draft_revision_hash !== digest)
        throw new GiftWorkspaceError(
          "This action key was used for different draft data. Use a new key.",
        );
      return {
        id: String(prior.id),
        version: Number(prior.draft_version),
        published: !!prior.published,
        duplicate: true,
      };
    }
    if (input.option_id && !prior)
      throw new GiftWorkspaceError("Draft unavailable.");
    if (prior?.published)
      throw new GiftWorkspaceError(
        "Published options cannot be edited. Create a new private draft.",
      );
    if (prior && prior.draft_version !== input.expected_version)
      throw new GiftWorkspaceError(
        "This draft changed. Read its latest version before saving.",
      );
    let option = prior;
    if (!option) {
      const [count] =
        await tx`SELECT count(*)::int AS n FROM gyvft_gift_options WHERE project_id=${input.project_id}::uuid`;
      if (count.n >= 24)
        throw new GiftWorkspaceError("This request already has 24 options.");
      [option] =
        await tx`INSERT INTO gyvft_gift_options(project_id,title,description,contents,pricing,image_data,image_type,published,request_id,draft_revision_key,draft_revision_hash) VALUES(${input.project_id}::uuid,${input.option.title},${input.option.description},${tx.json(input.option.contents)},${tx.json(input.option.pricing)},${images[0]?.data ?? null},${images[0]?.mime ?? "image/png"},false,${input.client_reference}::uuid,${input.client_reference}::uuid,${digest}) RETURNING id,draft_version,image_data`;
    } else {
      [option] =
        await tx`UPDATE gyvft_gift_options SET title=${input.option.title},description=${input.option.description},contents=${tx.json(input.option.contents)},pricing=${tx.json(input.option.pricing)},draft_version=draft_version+1,draft_revision_key=${input.client_reference}::uuid,draft_revision_hash=${digest} WHERE id=${prior.id}::uuid RETURNING id,draft_version,image_data`;
    }
    const [count] =
      await tx`SELECT count(*)::int AS n FROM gyvft_gift_option_images WHERE option_id=${option.id}::uuid`;
    const existing = option.image_data ? 1 + Number(count.n) : 0;
    // A new option already received its first image in the INSERT above.
    const append = prior ? images : images.slice(1);
    if (existing + append.length > MAX_OPTION_IMAGES)
      throw new GiftWorkspaceError(
        `This draft already has ${existing} images. At most ${MAX_OPTION_IMAGES} are allowed; existing images are preserved.`,
      );
    let position = existing;
    for (const image of append) {
      position++;
      if (position === 1)
        await tx`UPDATE gyvft_gift_options SET image_data=${image.data},image_type=${image.mime} WHERE id=${option.id}::uuid`;
      else
        await tx`INSERT INTO gyvft_gift_option_images(option_id,position,image_data,image_type) VALUES(${option.id}::uuid,${position},${image.data},${image.mime})`;
    }
    await tx`INSERT INTO gyvft_gift_option_draft_versions(option_id,version,document,revision_key,input_hash,source,actor_id) VALUES(${option.id}::uuid,${option.draft_version},${tx.json({ ...input.option, image_count: position })},${input.client_reference}::uuid,${digest},${source},${actorId ?? null}::uuid)`;
    return {
      id: String(option.id),
      version: Number(option.draft_version),
      published: false,
      imageCount: position,
      duplicate: false,
    };
  });
}
export async function optionDraftReplay(
  projectId: string,
  reference: string,
  digest: string,
  optionId?: string,
) {
  const [row] =
    await getSql()`SELECT v.option_id,v.input_hash,o.project_id,o.published,o.draft_version FROM gyvft_gift_option_draft_versions v JOIN gyvft_gift_options o ON o.id=v.option_id WHERE v.revision_key=${reference}::uuid`;
  if (!row) return null;
  if (
    row.project_id !== projectId ||
    (optionId && row.option_id !== optionId) ||
    row.input_hash !== digest
  )
    throw new GiftWorkspaceError(
      "This action key was used for different draft data. Use a new key.",
    );
  return {
    id: String(row.option_id),
    version: Number(row.draft_version),
    published: !!row.published,
    duplicate: true,
  };
}
export async function publishOptionDraft(
  projectId: string,
  optionId: string,
  version: number,
) {
  z.string().uuid().parse(projectId);
  z.string().uuid().parse(optionId);
  z.number().int().positive().parse(version);
  return getSql().begin(async (txRaw) => {
    const tx = txRaw as unknown as Sql,
      project = await editable(tx, projectId);
    const [option] =
      await tx`SELECT id,title,published,draft_version,image_data,request_id FROM gyvft_gift_options WHERE id=${optionId}::uuid AND project_id=${projectId}::uuid FOR UPDATE`;
    if (!option || option.draft_version !== version)
      throw new GiftWorkspaceError(
        "This draft changed. Refresh and review its latest version before publishing.",
      );
    if (option.published) return;
    if (!option.image_data)
      throw new GiftWorkspaceError(
        "Add at least one image before publishing this draft.",
      );
    await tx`UPDATE gyvft_gift_options SET published=true,created_at=now() WHERE id=${option.id}::uuid`;
    await tx`INSERT INTO customer_project_events(project_id,title,body) VALUES(${projectId}::uuid,'New gift option from GYVFT',${option.title})`;
    await tx`UPDATE customer_projects SET next_action='Your gift options are ready. Explore the options or build one of your own.' WHERE id=${projectId}::uuid`;
    await queueNotification(
      tx,
      projectId,
      `gift-option:${option.request_id}`,
      "customer",
      project.customer_email,
      "Your GYVFT gift options are ready",
    );
  });
}
