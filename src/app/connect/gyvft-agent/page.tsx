import { readAuthorisationRequest } from "@/lib/mcp/auth";
import { AgentConsent } from "@/components/operations/agent-consent";
export const metadata = {
  title: "Connect GPT to GYVFT",
  robots: { index: false, follow: false },
};
export default async function ConnectAgent({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>;
}) {
  const { request } = await searchParams;
  let scopes: string[] | null = null;
  try {
    if (!request || request.length > 10000) throw Error("Missing request");
    const input = await readAuthorisationRequest(request);
    scopes = input.scope.split(/\s+/);
  } catch {
    // An expired or invalid request cannot grant access.
  }
  if (!scopes || !request) {
    return (
      <main className="mx-auto max-w-xl px-5 py-12">
        <h1 className="font-serif text-3xl">Connection request expired</h1>
        <p className="mt-4">
          Return to ChatGPT and start connecting GYVFT again.
        </p>
      </main>
    );
  }
  return <AgentConsent request={request} scopes={scopes} />;
}
