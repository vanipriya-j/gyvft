/** The managed Supabase pooler uses the same credentials/project on either port.
 * Serverless functions must share transaction connections rather than pin sessions. */
export function databasePoolConfig(raw: string, serverless: boolean) {
  const url = new URL(raw);
  const supabasePooler = url.hostname.endsWith(".pooler.supabase.com");
  if (serverless && supabasePooler && (!url.port || url.port === "5432"))
    url.port = "6543";
  return {
    url: url.toString(),
    options: {
      max: serverless ? 1 : 3,
      idle_timeout: 5,
      connect_timeout: 10,
      max_lifetime: serverless ? 60 : 300,
      prepare: false as const,
    },
  };
}
