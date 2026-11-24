export const mcpScopes = [
  "gyvft:requests:read",
  "gyvft:options:write",
] as const;
export const mcpClientId = "gyvft-chatgpt";
export function mcpOrigin() {
  const configured = process.env.GYVFT_MCP_ORIGIN;
  if (configured) {
    const url = new URL(configured);
    if (
      url.origin !== configured ||
      url.username ||
      url.password ||
      (url.protocol !== "https:" &&
        !(url.protocol === "http:" && url.hostname === "127.0.0.1"))
    )
      throw Error("Invalid MCP origin configuration.");
    return url.origin;
  }
  return "https://www.gyvft.com";
}
export const mcpResource = () => mcpOrigin() + "/mcp";
export function allowedRedirect(value: string) {
  try {
    const url = new URL(value);
    return (
      url.origin === "https://chatgpt.com" &&
      !url.search &&
      !url.hash &&
      (url.pathname === "/connector_platform_oauth_redirect" ||
        /^\/connector\/oauth\/[a-zA-Z0-9_-]{1,200}$/.test(url.pathname))
    );
  } catch {
    return false;
  }
}
export function authorisationMetadata() {
  const issuer = mcpOrigin();
  return {
    issuer,
    authorization_endpoint: issuer + "/mcp/oauth/authorize",
    token_endpoint: issuer + "/mcp/oauth/token",
    registration_endpoint: issuer + "/mcp/oauth/register",
    revocation_endpoint: issuer + "/mcp/oauth/revoke",
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: mcpScopes,
    authorization_response_iss_parameter_supported: true,
  };
}
export function protectedResourceMetadata() {
  return {
    resource: mcpResource(),
    authorization_servers: [mcpOrigin()],
    scopes_supported: mcpScopes,
    bearer_methods_supported: ["header"],
  };
}
