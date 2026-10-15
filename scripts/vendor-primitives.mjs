// One-time vendoring of DS v0.3.0 primitives into src/primitives (re-runnable; it overwrites, so run it only
// before the hand edits recorded in VENDORED.md). Rewrites `@/` imports to relative paths and renames custom
// classes to `sf-…` inside string literals only (the same map as styles/rename-map.json).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RENAME = JSON.parse(fs.readFileSync(path.join(root, "styles/rename-map.json"), "utf8"));
const names = Object.keys(RENAME).sort((a, b) => b.length - a.length).map((n) => n.replace(/[-]/g, "\\-"));
const classRe = new RegExp(`(?<=^|[\\s:!])(${names.join("|")})(?=$|[\\s])`, "g");
const renameInStrings = (src) => src.replace(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g, (m, q, body) => q + body.replace(classRe, (c) => RENAME[c]) + q);
const files = process.argv.slice(2);
for (const name of files) {
  let s = fs.readFileSync(path.join(root, "upstream/ds-v0.3.0/ui", `${name}.tsx`), "utf8");
  s = s.replace(/from "@\/lib\/utils"/g, 'from "../lib/cn"').replace(/from "@\/components\/ui\/([a-z-]+)"/g, 'from "./$1"');
  s = renameInStrings(s);
  const header = `// Vendored from @solvfast/design-system v0.3.0 (92fc1cd) frontend/src/components/ui/${name}.tsx — see VENDORED.md.\n`;
  fs.writeFileSync(path.join(root, "src/primitives", `${name}.tsx`), header + s);
}
console.log(`vendored ${files.length} files`);
