import manifest from "@/config/public-assets.generated.json";
const assets: Record<string, { width?: number; height?: number }> = manifest;

/** Build-generated metadata avoids tracing /public into every server function. */
export function publicAssetExists(publicPath: string): boolean {
  return (
    publicPath.startsWith("/") &&
    Object.prototype.hasOwnProperty.call(assets, publicPath)
  );
}

export function publicAssetDimensions(publicPath: string) {
  const value = publicAssetExists(publicPath) ? assets[publicPath] : null;
  return value?.width && value.height
    ? { width: value.width, height: value.height }
    : null;
}

export function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.IS_PRODUCTION === "true" ||
    process.env.IS_PRODUCTION === "1"
  );
}
