import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { AI_PROMPT_VERSION, OPENAI_MODEL_ALLOWLIST } from "@/config/constants";
import { getEnv } from "@/config/env";
import { getSql } from "@/lib/database/client";
import { decryptSecret } from "@/lib/encryption/secrets";
import { logger } from "@/lib/logging/logger";
import { createIntegrationLog } from "@/services/integrations/logs";
import type { AiSummary } from "@/types/domain";

const summarySchema = z.object({
  storyTitle: z.string(),
  storySummary: z.string(),
  whyItMatters: z.string(),
  peopleOrOrganisations: z.array(z.string()),
  occasion: z.string(),
  audiences: z.array(z.string()),
  emotionalIntent: z.array(z.string()),
  keyThemes: z.array(z.string()),
  constraints: z.array(z.string()),
  suggestedDirections: z.array(
    z.object({
      title: z.string(),
      format: z.string(),
      reason: z.string(),
    }),
  ),
  recommendedNextAction: z.string(),
});

async function resolveOpenAI(): Promise<{ apiKey: string | null; model: string; enabled: boolean }> {
  const env = getEnv();
  const sql = getSql();
  const def = await sql<{ enabled: boolean; config: Record<string, unknown> }[]>`
    SELECT enabled, config FROM integration_definitions WHERE provider = 'openai' LIMIT 1
  `;
  const secret = await sql<{ ciphertext: Buffer; iv: Buffer; auth_tag: Buffer }[]>`
    SELECT ciphertext, iv, auth_tag FROM integration_secrets
    WHERE provider = 'openai' AND secret_name = 'api_key'
    LIMIT 1
  `;
  let apiKey: string | null = null;
  if (secret[0]) {
    apiKey = decryptSecret({
      ciphertext: secret[0].ciphertext,
      iv: secret[0].iv,
      authTag: secret[0].auth_tag,
    });
  } else if (env.OPENAI_API_KEY) {
    apiKey = env.OPENAI_API_KEY;
  }
  const configuredModel = String(def[0]?.config?.model ?? "gpt-4o-mini");
  const model = (OPENAI_MODEL_ALLOWLIST as readonly string[]).includes(configuredModel)
    ? configuredModel
    : "gpt-4o-mini";
  const summaryEnabled = def[0]?.config?.summary_generation_enabled !== false;
  return {
    apiKey,
    model,
    enabled: Boolean(def[0]?.enabled ?? apiKey) && summaryEnabled,
  };
}

export async function generateOpportunitySummary(
  opportunityId: string,
  submission: Record<string, unknown>,
): Promise<AiSummary | null> {
  const sql = getSql();
  const config = await resolveOpenAI();
  if (!config.enabled || !config.apiKey) {
    await sql`
      UPDATE opportunities SET ai_summary_status = 'disabled', updated_at = NOW()
      WHERE id = ${opportunityId}::uuid
    `;
    return null;
  }

  const started = new Date();
  try {
    const client = new OpenAI({ apiKey: config.apiKey });
    // Strip direct personal identifiers before sending when possible
    const safeSubmission = { ...submission };
    delete safeSubmission.email;
    delete safeSubmission.phone;
    delete safeSubmission.work_email;
    delete safeSubmission.full_name;

    const completion = await client.chat.completions.create({
      model: config.model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You summarise GYVFT opportunity submissions. Never invent factual details. Mark uncertainty clearly. Return JSON matching the schema fields exactly.",
        },
        {
          role: "user",
          content: JSON.stringify({
            promptVersion: AI_PROMPT_VERSION,
            schema: summarySchema.shape,
            submission: safeSubmission,
          }),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    const parsed = summarySchema.parse(JSON.parse(content));

    await sql`
      INSERT INTO opportunity_summaries (
        opportunity_id, story_title, story_summary, why_it_matters, people_or_organisations,
        occasion, audiences, emotional_intent, key_themes, constraints, suggested_directions,
        recommended_next_action, prompt_version, provider, model, generated_at
      ) VALUES (
        ${opportunityId}::uuid,
        ${parsed.storyTitle},
        ${parsed.storySummary},
        ${parsed.whyItMatters},
        ${sql.json(parsed.peopleOrOrganisations)},
        ${parsed.occasion},
        ${sql.json(parsed.audiences)},
        ${sql.json(parsed.emotionalIntent)},
        ${sql.json(parsed.keyThemes)},
        ${sql.json(parsed.constraints)},
        ${sql.json(parsed.suggestedDirections)},
        ${parsed.recommendedNextAction},
        ${AI_PROMPT_VERSION},
        'openai',
        ${config.model},
        NOW()
      )
    `;
    await sql`
      UPDATE opportunities
      SET ai_summary_status = 'ready', story_title = COALESCE(NULLIF(story_title, ''), ${parsed.storyTitle}), updated_at = NOW()
      WHERE id = ${opportunityId}::uuid
    `;
    await createIntegrationLog({
      provider: "openai",
      operation: "generate_summary",
      success: true,
      requestStartedAt: started,
      requestCompletedAt: new Date(),
      metadata: { opportunityId },
    });
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI summary failed";
    await sql`
      UPDATE opportunities SET ai_summary_status = 'failed', updated_at = NOW()
      WHERE id = ${opportunityId}::uuid
    `;
    await createIntegrationLog({
      provider: "openai",
      operation: "generate_summary",
      success: false,
      sanitisedError: message,
      requestStartedAt: started,
      requestCompletedAt: new Date(),
      metadata: { opportunityId },
    });
    logger.warn("AI summary generation failed", { opportunityId, message });
    throw error;
  }
}
