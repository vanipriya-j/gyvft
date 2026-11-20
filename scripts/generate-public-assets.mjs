// Build-time metadata only. Never reads the database or copies image content.
import {
  readdirSync,
  openSync,
  readSync,
  closeSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  entries = {};
function walk(directory, prefix = "") {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
    (a, b) => a.name.localeCompare(b.name, "en"),
  )) {
    const name = prefix + "/" + entry.name,
      filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(filename, name);
      continue;
    }
    if (!entry.isFile()) continue;
    entries[name] = {};
    if (entry.name.toLowerCase().endsWith(".png")) {
      const fd = openSync(filename, "r"),
        header = Buffer.alloc(24);
      try {
        if (
          readSync(fd, header, 0, 24, 0) === 24 &&
          header
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        )
          entries[name] = {
            width: header.readUInt32BE(16),
            height: header.readUInt32BE(20),
          };
      } finally {
        closeSync(fd);
      }
    }
  }
}
walk(path.join(root, "public"));
writeFileSync(
  path.join(root, "src/config/public-assets.generated.json"),
  JSON.stringify(entries, null, 2) + "\n",
);
console.log(
  `Indexed ${Object.keys(entries).length} public asset paths; images remain static files.`,
);
