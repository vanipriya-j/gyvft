import fs from "node:fs";
import path from "node:path";

/** True when a file exists under /public for a site-absolute path like `/images/...`. */
export function publicAssetExists(publicPath: string): boolean {
  if (!publicPath.startsWith("/")) return false;
  const absolute = path.join(process.cwd(), "public", publicPath.slice(1));
  try {
    return fs.existsSync(absolute) && fs.statSync(absolute).isFile();
  } catch {
    return false;
  }
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || process.env.IS_PRODUCTION === "true" || process.env.IS_PRODUCTION === "1";
}
