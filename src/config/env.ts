import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  INTEGRATION_ENCRYPTION_KEY: z.string().min(32).optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  RESEND_FROM_NAME: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  META_ACCESS_TOKEN: z.string().optional(),
  META_DATASET_ID: z.string().optional(),
  NEXT_PUBLIC_META_PIXEL_ID: z.string().optional(),
  NEXT_PUBLIC_GTM_ID: z.string().optional(),
  NEXT_PUBLIC_GA4_MEASUREMENT_ID: z.string().optional(),
  NEXT_PUBLIC_CLARITY_PROJECT_ID: z.string().optional(),
  CRON_SECRET: z.string().min(16).optional(),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10_485_760),
  DEFAULT_CURRENCY: z.string().length(3).default("INR"),
  IS_PRODUCTION: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => v === "true" || v === "1"),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${message}`);
  }
  cached = parsed.data;
  return cached;
}

export function requireDatabaseUrl(): string {
  const env = getEnv();
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database operations");
  }
  return env.DATABASE_URL;
}

export function hasSupabaseConfig(): boolean {
  const env = getEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Integration secret precedence:
 * 1. Studio-managed encrypted secret in integration_secrets (when present)
 * 2. Environment variable fallback for the provider
 */
export const INTEGRATION_ENV_FALLBACKS = {
  resend: ["RESEND_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  meta_capi: ["META_ACCESS_TOKEN"],
} as const;
