"use client";
import { useEffect, useState } from "react";
import { Bot, Copy, LoaderCircle } from "lucide-react";
import type { McpSettings } from "@/lib/mcp/settings";
type Post = (
  body: Record<string, unknown>,
  candidate?: string,
  signal?: AbortSignal,
) => Promise<Record<string, unknown>>;
export function AgentConnections({ post }: { post: Post }) {
  const [settings, setSettings] = useState<McpSettings | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    post({ op: "mcp_status" }, undefined, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted)
          setSettings(result.settings as McpSettings);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage(
            "GPT connection settings could not load. Refresh the desk to retry.",
          );
      });
    return () => controller.abort();
  }, [post]);
  async function command(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await post(body);
      setSettings(result.settings as McpSettings);
      setMessage(String(result.message || "Saved."));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not confirm the change. Refresh before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ops-panel mt-5" aria-busy={busy}>
      <h2 className="flex items-center gap-2">
        <Bot size={20} />
        GPT & agent connections
      </h2>
      <p className="app-muted mt-2">
        Let GPT prepare options and, with the permissions you authorise, carry
        out explicit Operations instructions for publication, customer messages,
        evidenced approvals, payments and Shopify handoff.
      </p>
      {!settings && !message && (
        <p className="mt-4 inline-flex items-center gap-2" role="status">
          <LoaderCircle className="animate-spin" size={16} />
          Checking connection settings…
        </p>
      )}
      {settings &&
        (!settings.installed ? (
          <div className="mt-4">
            <p className="text-sm">
              The private agent workspace needs its database update before a
              connection can be enabled.
            </p>
            <a
              className="app-button secondary mt-3 min-h-11"
              href="/setup/agent-proposals"
            >
              Review agent workspace setup
            </a>
          </div>
        ) : (
          <>
            <p className="mt-4">
              <span className="app-badge">
                {settings.enabled ? "GPT access enabled" : "GPT access off"}
              </span>
            </p>
            <label className="app-label mt-4 block">
              MCP server URL
              <input
                className="app-input"
                readOnly
                value={settings.url}
                onFocus={(event) => event.target.select()}
              />
            </label>
            <div className="app-actions mt-3">
              <button
                type="button"
                className="app-button secondary min-h-11"
                disabled={busy}
                onClick={() =>
                  void navigator.clipboard
                    ?.writeText(settings.url)
                    .then(() => setMessage("Server URL copied."))
                    .catch(() => setMessage("Select and copy the URL above."))
                }
              >
                <Copy size={16} />
                Copy URL
              </button>
              <button
                type="button"
                className={`app-button ${settings.enabled ? "secondary" : "primary"} min-h-11`}
                disabled={busy}
                onClick={() =>
                  void command({
                    op: "mcp_enabled",
                    enabled: !settings.enabled,
                  })
                }
              >
                {busy ? (
                  <>
                    <LoaderCircle size={16} className="animate-spin" />
                    Saving…
                  </>
                ) : settings.enabled ? (
                  "Turn off GPT access"
                ) : (
                  "Enable GPT connections"
                )}
              </button>
            </div>
            <p className="app-note mt-3">
              Add this URL in ChatGPT developer mode using OAuth. Authorise it
              on GYVFT using your Operations secret. A separate access token is
              issued to ChatGPT. Turning access off revokes existing
              connections.
            </p>
            <p className="app-note mt-3">
              Existing connections keep their original permissions. Refresh the
              app’s tools and reconnect in ChatGPT to review and grant the
              additional actions.
            </p>
            <a
              className="app-button secondary mt-3 min-h-11"
              href="/setup/agent-operations"
            >
              Review Operations actions setup
            </a>
            <h3 className="mt-5 font-medium">Authorised connections</h3>
            {!settings.grants.length ? (
              <p className="app-muted mt-2">
                No GPT connection has been authorised yet.
              </p>
            ) : (
              <div className="mt-2 divide-y divide-border">
                {settings.grants.map((grant) => (
                  <article
                    key={grant.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="text-sm">
                        ChatGPT ·{" "}
                        {grant.revoked
                          ? "Revoked"
                          : grant.expired
                            ? "Expired"
                            : "Active"}
                      </p>
                      <p className="app-muted mt-1 text-xs">
                        Connected{" "}
                        {new Date(grant.createdAt).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                        })}{" "}
                        IST
                      </p>
                      <p className="app-note mt-2 break-all">
                        Permissions:{" "}
                        {grant.scopes
                          .map((scope) => scope.replace("gyvft:", ""))
                          .join(", ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="app-button secondary min-h-11"
                      disabled={busy || grant.revoked}
                      onClick={() =>
                        void command({ op: "mcp_revoke", grant_id: grant.id })
                      }
                    >
                      {grant.revoked ? "Revoked" : "Revoke"}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </>
        ))}
      <p role="status" className="app-muted mt-3 min-h-5 text-sm">
        {message}
      </p>
    </section>
  );
}
