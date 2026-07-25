import { createHash, randomBytes } from "crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

async function main() {
  const email = arg("email");
  const name = arg("name") ?? "GYVFT Owner";
  if (!email) {
    throw new Error('Usage: npm run create-owner -- --email="owner@example.com"');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const sql = postgres(databaseUrl, { max: 1 });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  let userId: string;
  let invited = false;

  if (supabaseUrl && secretKey) {
    const admin = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const tempPassword = randomBytes(24).toString("base64url");
    const created = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: name, role: "owner" },
    });
    if (created.error || !created.data.user) {
      // Try invite if user exists or create failed
      const invite = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: name, role: "owner" },
      });
      if (invite.error || !invite.data.user) {
        throw new Error(created.error?.message ?? invite.error?.message ?? "Unable to create owner");
      }
      userId = invite.data.user.id;
      invited = true;
    } else {
      userId = created.data.user.id;
      // Temporary password is intentionally never printed.
      void createHash("sha256").update(tempPassword).digest("hex");
    }
  } else {
    userId = randomBytes(16).toString("hex").replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
    console.warn("Supabase Auth is not configured. Created a local profile ID only.");
  }

  await sql`
    INSERT INTO profiles (id, email, full_name, role, is_active)
    VALUES (${userId}::uuid, ${email.toLowerCase()}, ${name}, 'owner', TRUE)
    ON CONFLICT (email) DO UPDATE
    SET role = 'owner', is_active = TRUE, full_name = EXCLUDED.full_name, deleted_at = NULL, updated_at = NOW()
  `;

  await sql`
    UPDATE workspace_settings
    SET default_opportunity_owner_id = (
      SELECT id FROM profiles WHERE email = ${email.toLowerCase()} LIMIT 1
    ),
    updated_at = NOW()
  `;

  await sql`
    INSERT INTO audit_logs (action, entity_type, entity_id, metadata)
    VALUES (
      'owner.created',
      'profile',
      (SELECT id FROM profiles WHERE email = ${email.toLowerCase()} LIMIT 1),
      ${sql.json({ email, invited })}
    )
  `;

  await sql.end();
  console.log(`Owner ready for ${email}${invited ? " (invitation sent)" : ""}`);
  console.log("Password was never printed. Use forgot-password or the invitation email to set credentials.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
