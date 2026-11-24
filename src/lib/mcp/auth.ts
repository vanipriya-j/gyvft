import "server-only";
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Sql } from "postgres";
import { z } from "zod";
import { getSql } from "@/lib/database/client";
import { validSetupSecret } from "@/lib/security/setup-secret";
import {
  allowedRedirect,
  mcpClientId,
  mcpOrigin,
  mcpResource,
  mcpScopes,
} from "./config";

export class McpAuthError extends Error {
  constructor(
    public code: string,
    message = "The GYVFT connection could not be authorised.",
  ) {
    super(message);
  }
}
export const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const opaque = () => randomBytes(32).toString("base64url");
const same = (a: string, b: string) =>
  timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
function key(purpose: string) {
  const secret = process.env.SETUP_SECRET?.trim();
  if (!secret || secret.length < 11)
    throw new McpAuthError("temporarily_unavailable");
  return createHmac("sha256", secret)
    .update("gyvft-mcp:" + purpose + ":v1")
    .digest();
}
export async function agentProposalsAvailable(sql: Sql = getSql()) {
  const [table] =
    await sql`SELECT to_regclass('gyvft_mcp_settings')::text AS name`;
  return !!table?.name;
}
export async function requireMcpEnabled(sql: Sql = getSql()) {
  if (!(await agentProposalsAvailable(sql)))
    throw new McpAuthError(
      "temporarily_unavailable",
      "The GYVFT agent workspace needs activation in Operations.",
    );
  const [settings] =
    await sql`SELECT enabled FROM gyvft_mcp_settings WHERE singleton=true`;
  if (!settings?.enabled)
    throw new McpAuthError(
      "access_denied",
      "The GPT connection is disabled in GYVFT Operations.",
    );
}
export const authorisationInput = z.object({
  client_id: z.literal(mcpClientId),
  redirect_uri: z.string().max(2048).refine(allowedRedirect),
  response_type: z.literal("code"),
  code_challenge_method: z.literal("S256"),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  state: z.string().min(1).max(2048),
  resource: z.string().refine((value) => value === mcpResource()),
  scope: z.string().max(200).default(mcpScopes.join(" ")),
});
type Authorisation = z.infer<typeof authorisationInput>;
function scopesFor(value: string) {
  const scopes = [...new Set(value.split(/\s+/).filter(Boolean))];
  if (
    !scopes.length ||
    scopes.some(
      (scope) => !mcpScopes.includes(scope as (typeof mcpScopes)[number]),
    )
  )
    throw new McpAuthError("invalid_scope");
  return scopes.sort();
}
export async function signAuthorisationRequest(raw: unknown) {
  const input = authorisationInput.parse(raw);
  scopesFor(input.scope);
  await requireMcpEnabled();
  return new SignJWT({ request: input })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(mcpOrigin())
    .setAudience("gyvft-mcp-consent")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key("consent"));
}
export async function readAuthorisationRequest(
  token: string,
): Promise<Authorisation> {
  const { payload } = await jwtVerify(token, key("consent"), {
    algorithms: ["HS256"],
    issuer: mcpOrigin(),
    audience: "gyvft-mcp-consent",
  });
  return authorisationInput.parse(payload.request);
}
export async function approveMcpConnection(token: string, secret: unknown) {
  if (!validSetupSecret(secret))
    throw new McpAuthError(
      "access_denied",
      "Operator access could not be verified.",
    );
  const input = await readAuthorisationRequest(token),
    sql = getSql();
  await requireMcpEnabled(sql);
  const code = opaque(),
    scopes = scopesFor(input.scope);
  await sql`INSERT INTO gyvft_mcp_grants(code_hash,client_id,redirect_uri,resource,scopes,code_challenge,expires_at) VALUES(${hashToken(code)},${input.client_id},${input.redirect_uri},${input.resource},${scopes},${input.code_challenge},now()+interval '5 minutes')`;
  const redirect = new URL(input.redirect_uri);
  redirect.searchParams.set("code", code);
  redirect.searchParams.set("state", input.state);
  redirect.searchParams.set("iss", mcpOrigin());
  return redirect.href;
}
type Grant = {
  id: string;
  client_id: string;
  redirect_uri: string;
  resource: string;
  scopes: string[];
  code_challenge: string;
  expires_at: string;
  redeemed_at: string | null;
  refresh_expires_at: string | null;
  revoked_at: string | null;
};
async function accessToken(grant: Grant, scopes: string[]) {
  return new SignJWT({ scope: scopes.join(" ") })
    .setProtectedHeader({ alg: "HS256", typ: "at+jwt" })
    .setIssuer(mcpOrigin())
    .setAudience(mcpResource())
    .setSubject(grant.id)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(key("access"));
}
export async function exchangeMcpToken(params: URLSearchParams) {
  if (
    params.get("client_id") !== mcpClientId ||
    (params.has("resource") && params.get("resource") !== mcpResource())
  )
    throw new McpAuthError("invalid_grant");
  const sql = getSql();
  await requireMcpEnabled(sql);
  const type = params.get("grant_type");
  if (type !== "authorization_code" && type !== "refresh_token")
    throw new McpAuthError("unsupported_grant_type");
  const credential =
    params.get(type === "authorization_code" ? "code" : "refresh_token") || "";
  if (!/^[a-zA-Z0-9_-]{43}$/.test(credential))
    throw new McpAuthError("invalid_grant");
  return sql.begin(async (txRaw) => {
    const tx = txRaw as unknown as Sql;
    const rows =
      type === "authorization_code"
        ? await tx<
            Grant[]
          >`SELECT * FROM gyvft_mcp_grants WHERE code_hash=${hashToken(credential)} FOR UPDATE`
        : await tx<
            Grant[]
          >`SELECT * FROM gyvft_mcp_grants WHERE refresh_hash=${hashToken(credential)} FOR UPDATE`;
    const grant = rows[0];
    if (
      !grant ||
      grant.revoked_at ||
      grant.client_id !== mcpClientId ||
      grant.resource !== mcpResource()
    )
      throw new McpAuthError("invalid_grant");
    if (type === "authorization_code") {
      const verifier = params.get("code_verifier") || "";
      if (
        grant.redeemed_at ||
        new Date(grant.expires_at).getTime() <= Date.now() ||
        params.get("redirect_uri") !== grant.redirect_uri ||
        !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) ||
        !same(
          createHash("sha256").update(verifier).digest("base64url"),
          grant.code_challenge,
        )
      )
        throw new McpAuthError("invalid_grant");
    } else if (
      !grant.redeemed_at ||
      !grant.refresh_expires_at ||
      new Date(grant.refresh_expires_at).getTime() <= Date.now()
    )
      throw new McpAuthError("invalid_grant");
    const scopes = params.has("scope")
      ? scopesFor(params.get("scope")!)
      : grant.scopes;
    if (scopes.some((scope) => !grant.scopes.includes(scope)))
      throw new McpAuthError("invalid_scope");
    const refresh = opaque();
    await tx`UPDATE gyvft_mcp_grants SET redeemed_at=COALESCE(redeemed_at,now()),refresh_hash=${hashToken(refresh)},refresh_expires_at=COALESCE(refresh_expires_at,now()+interval '30 days'),last_used_at=now() WHERE id=${grant.id}::uuid`;
    return {
      access_token: await accessToken(grant, scopes),
      token_type: "Bearer",
      expires_in: 900,
      refresh_token: refresh,
      scope: scopes.join(" "),
    };
  });
}
export async function authenticateMcp(header: string | null) {
  if (!header?.startsWith("Bearer ") || header.length > 8192)
    throw new McpAuthError("invalid_token");
  let payload;
  try {
    ({ payload } = await jwtVerify(header.slice(7), key("access"), {
      algorithms: ["HS256"],
      issuer: mcpOrigin(),
      audience: mcpResource(),
      typ: "at+jwt",
    }));
  } catch {
    throw new McpAuthError("invalid_token");
  }
  const id = z.string().uuid().safeParse(payload.sub);
  if (!id.success || typeof payload.scope !== "string")
    throw new McpAuthError("invalid_token");
  const sql = getSql();
  await requireMcpEnabled(sql);
  const [grant] = await sql<
    Grant[]
  >`SELECT * FROM gyvft_mcp_grants WHERE id=${id.data}::uuid`;
  const scopes = scopesFor(payload.scope);
  if (
    !grant ||
    !grant.redeemed_at ||
    grant.revoked_at ||
    !grant.refresh_expires_at ||
    new Date(grant.refresh_expires_at).getTime() <= Date.now() ||
    scopes.some((scope) => !grant.scopes.includes(scope))
  )
    throw new McpAuthError("invalid_token");
  return { id: id.data, scopes };
}
export async function revokeMcpToken(token: string) {
  if (token.length > 8192) return;
  const sql = getSql();
  if (!(await agentProposalsAvailable(sql))) return;
  let id: string | undefined;
  try {
    const { payload } = await jwtVerify(token, key("access"), {
      algorithms: ["HS256"],
      issuer: mcpOrigin(),
      audience: mcpResource(),
    });
    id = z.string().uuid().parse(payload.sub);
  } catch {
    /* It can instead be a refresh token. */
  }
  if (id)
    await sql`UPDATE gyvft_mcp_grants SET revoked_at=COALESCE(revoked_at,now()) WHERE id=${id}::uuid`;
  else
    await sql`UPDATE gyvft_mcp_grants SET revoked_at=COALESCE(revoked_at,now()) WHERE refresh_hash=${hashToken(token)}`;
}
