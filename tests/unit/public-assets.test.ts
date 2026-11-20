import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import manifest from "@/config/public-assets.generated.json";
import { publicAssetExists, publicAssetDimensions } from "@/lib/public-asset";
describe("static public asset metadata", () => {
  it("matches the actual public inventory without bundling image bytes", () => {
    function walk(dir: string, prefix = ""): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? walk(path.join(dir, e.name), prefix + "/" + e.name)
          : e.isFile()
            ? [prefix + "/" + e.name]
            : [],
      );
    }
    expect(Object.keys(manifest).sort()).toEqual(walk("public").sort());
    expect(publicAssetExists("/images/brand/GYVFT_3x.png")).toBe(true);
    expect(publicAssetExists("/images/missing-fixture.png")).toBe(false);
    expect(publicAssetExists("/../package.json")).toBe(false);
    expect(JSON.stringify(manifest).length).toBeLessThan(50000);
  });
  it("retains accurate review-image dimensions and missing-image fallback inputs", () => {
    const file = "/operations-review/dashboard-desktop.png",
      header = readFileSync("public" + file);
    expect(publicAssetDimensions(file)).toEqual({
      width: header.readUInt32BE(16),
      height: header.readUInt32BE(20),
    });
    expect(publicAssetDimensions("/missing.png")).toBeNull();
  });
});
