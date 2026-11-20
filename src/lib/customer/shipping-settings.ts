import "server-only";
import type { Sql } from "postgres";
import { getSql } from "@/lib/database/client";
import { encryptSecret, decryptSecret } from "@/lib/encryption/secrets";
import { AppError } from "@/lib/errors/app-error";
import { settingsSchema } from "./shipping-model";
import { checkPin, type DelhiveryConfig } from "@/services/shipping/delhivery";
export const shippingError = (message: string) =>
  new AppError("CONFLICT", message);
export async function shippingReady(sql = getSql()) {
  const [r] =
    await sql`SELECT to_regclass('public.gyvft_shipping_settings') IS NOT NULL AND to_regclass('public.gyvft_shipments') IS NOT NULL AS ready`;
  return r?.ready === true;
}
export async function requireShipping(sql = getSql()) {
  if (!(await shippingReady(sql)))
    throw new AppError(
      "SETUP_REQUIRED",
      "Shipping needs the separately approved database update. No migration has been run.",
    );
}
export type PublicShippingSetting = {
  environment: "staging" | "production";
  client_name: string;
  warehouse_name: string;
  origin_pin: string;
  seller_name: string;
  seller_gstin: string;
  enabled: boolean;
  version: number;
  tested_at: string | null;
  updated_at: string;
  has_key?: boolean;
};
export async function shippingSettingsStatus() {
  const sql = getSql(),
    available = await shippingReady(sql);
  const rows = available
    ? await sql<
        PublicShippingSetting[]
      >`SELECT environment,client_name,warehouse_name,origin_pin,seller_name,seller_gstin,enabled,version,tested_at,updated_at FROM gyvft_shipping_settings ORDER BY environment`
    : [];
  return {
    available,
    encryptionReady:
      (process.env.INTEGRATION_ENCRYPTION_KEY || "").length >= 32,
    settings: rows.map((r) => ({ ...r, has_key: true })),
  };
}
export type ShippingSettingsStatus = Awaited<
  ReturnType<typeof shippingSettingsStatus>
>;
export async function shippingConfig(
  environment: "staging" | "production",
  sql = getSql(),
): Promise<DelhiveryConfig> {
  await requireShipping(sql);
  const [r] =
    await sql`SELECT * FROM gyvft_shipping_settings WHERE environment=${environment}`;
  if (!r)
    throw shippingError(
      "Enter Delhivery credentials in Operations Settings first.",
    );
  let token: string;
  try {
    token = decryptSecret({
      ciphertext: r.ciphertext,
      iv: r.iv,
      authTag: r.auth_tag,
    });
  } catch {
    throw shippingError(
      "The saved Delhivery key cannot be read. Check the server encryption key or replace the API token.",
    );
  }
  return {
    environment,
    token,
    client_name: r.client_name,
    warehouse_name: r.warehouse_name,
    origin_pin: r.origin_pin,
    seller_name: r.seller_name,
    seller_gstin: r.seller_gstin,
    enabled: r.enabled,
    version: r.version,
  };
}
export async function saveShippingSettings(input: unknown) {
  const data = settingsSchema.parse(input),
    sql = getSql();
  await requireShipping(sql);
  if ((process.env.INTEGRATION_ENCRYPTION_KEY || "").length < 32)
    throw shippingError(
      "Set INTEGRATION_ENCRYPTION_KEY on the server before saving API tokens.",
    );
  await sql.begin(async (raw) => {
    const tx = raw as unknown as Sql;
    await tx`SELECT pg_advisory_xact_lock(734201912)`;
    const [prior] =
      await tx`SELECT operation FROM gyvft_shipping_events WHERE request_id=${data.request_id}::uuid`;
    if (prior) {
      if (prior.operation !== `settings:${data.environment}`)
        throw shippingError("This action key belongs to another environment.");
      return;
    }
    const [r] =
      await tx`SELECT * FROM gyvft_shipping_settings WHERE environment=${data.environment} FOR UPDATE`;
    if ((r?.version || 0) !== data.expected_version)
      throw shippingError(
        "Settings changed in another tab. Reload before saving.",
      );
    if (!data.api_key && !r)
      throw shippingError("Enter the API token for this environment.");
    const encrypted = data.api_key ? encryptSecret(data.api_key) : null;
    await tx`INSERT INTO gyvft_shipping_settings(environment,client_name,warehouse_name,origin_pin,seller_name,seller_gstin,ciphertext,iv,auth_tag,enabled)
      VALUES(${data.environment},${data.client_name},${data.warehouse_name},${data.origin_pin},${data.seller_name},${data.seller_gstin},${encrypted?.ciphertext || r.ciphertext},${encrypted?.iv || r.iv},${encrypted?.authTag || r.auth_tag},${data.enabled})
      ON CONFLICT(environment) DO UPDATE SET client_name=EXCLUDED.client_name,warehouse_name=EXCLUDED.warehouse_name,origin_pin=EXCLUDED.origin_pin,seller_name=EXCLUDED.seller_name,seller_gstin=EXCLUDED.seller_gstin,ciphertext=EXCLUDED.ciphertext,iv=EXCLUDED.iv,auth_tag=EXCLUDED.auth_tag,enabled=EXCLUDED.enabled,version=gyvft_shipping_settings.version+1,tested_at=NULL,updated_at=now()`;
    await tx`INSERT INTO gyvft_shipping_events(request_id,operation) VALUES(${data.request_id}::uuid,${"settings:" + data.environment})`;
  });
}
export async function testShippingConnection(
  environment: "staging" | "production",
) {
  const c = await shippingConfig(environment);
  const result = await checkPin(c, c.origin_pin);
  await getSql()`UPDATE gyvft_shipping_settings SET tested_at=now() WHERE environment=${environment} AND version=${c.version}`;
  return {
    message: result.serviceable
      ? "API token accepted. This PIN supports prepaid delivery; confirm pickup service and the registered warehouse in Delhivery One."
      : "API token accepted, but this PIN is not serviceable for prepaid delivery. Check the origin PIN and warehouse in Delhivery One.",
  };
}
