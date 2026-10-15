// Enforces the dependency boundaries of architecture §4. Fails (exit 1) on any violation.
//  A. src/: what each module folder may import.
//  B. dist/: nothing reachable from the core entry (dist/index.js) imports @tanstack/*, the Frappe layer, or
//     talks to Frappe (`/api/method`, `/api/resource`, `csrf`).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []);
const importsOf = (src) => [...src.matchAll(/(?:import|export)\s[^"']*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g)].map((m) => m[1] || m[2] || m[3]);
const problems = [];

// ---- A. source rules -------------------------------------------------------------------------------------------
const area = (file) => {
  const rel = path.relative(path.join(root, "src"), file).split(path.sep);
  if (rel[0] === "list" && rel[1] === "model") return "list/model";
  return rel.length === 1 ? rel[0] : rel[0];
};
const RULES = {
  lib: { deny: [/^react/, /^@radix-ui/, /^@tanstack/, /frappe/, /^\.\.\/(theme|primitives|shell|list|frappe)/] },
  "list/model": { deny: [/^react/, /^@radix-ui/, /^@tanstack/, /frappe/, /^\.\.\/\.\.\/(theme|primitives|shell|frappe)/, /^\.\.\/(parts|ListView|useListState)/] },
  theme: { deny: [/^@tanstack/, /frappe/, /react-router/, /^\.\.\/(shell|list|frappe)/] },
  primitives: { deny: [/^@tanstack/, /frappe/, /react-router/, /^\.\.\/(shell|list|frappe)/] },
  shell: { deny: [/^@tanstack/, /frappe/, /react-router/, /^\.\.\/(list|frappe)/] },
  list: { deny: [/^@tanstack/, /frappe/, /react-router/, /^\.\.\/(shell|frappe)/, /^\.\.\/\.\.\/(shell|frappe)/] },
  frappe: { deny: [/^\.\.\/shell/] },
  "index.ts": { deny: [/^@tanstack/, /^\.\/frappe/] },
};
for (const file of walk(path.join(root, "src")).filter((f) => /\.(ts|tsx)$/.test(f))) {
  const a = area(file);
  const rule = RULES[a];
  if (!rule) { problems.push(`unknown source area for ${path.relative(root, file)}`); continue; }
  const src = fs.readFileSync(file, "utf8");
  for (const spec of importsOf(src)) {
    if (rule.deny.some((re) => re.test(spec))) problems.push(`${path.relative(root, file)} imports "${spec}" (not allowed in ${a})`);
  }
  if (a !== "frappe" && /\b(fetch|XMLHttpRequest)\s*\(/.test(src)) problems.push(`${path.relative(root, file)} makes network calls (only src/frappe may)`);
}

// ---- B. built core entry -----------------------------------------------------------------------------------------
const dist = path.join(root, "dist");
if (fs.existsSync(path.join(dist, "index.js"))) {
  const seen = new Set();
  const queue = [path.join(dist, "index.js")];
  while (queue.length) {
    const f = queue.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    const src = fs.readFileSync(f, "utf8");
    for (const spec of importsOf(src)) {
      if (spec.startsWith(".")) queue.push(path.resolve(path.dirname(f), spec));
      else if (/^@tanstack\//.test(spec)) problems.push(`dist: ${path.relative(dist, f)} imports ${spec}`);
    }
    if (path.relative(dist, f).split(path.sep)[0] === "frappe") problems.push(`dist: core entry reaches the Frappe layer (${path.relative(dist, f)})`);
    if (/\/api\/(method|resource)|csrf/i.test(src)) problems.push(`dist: ${path.relative(dist, f)} references Frappe endpoints`);
  }
  console.log(`  core entry reaches ${seen.size} modules — none import @tanstack/* or the Frappe layer` + (problems.length ? " (see problems)" : ""));
} else {
  console.log("  (dist/ not built yet — source rules only)");
}

if (problems.length) {
  console.error(problems.map((p) => `✖ ${p}`).join("\n"));
  process.exit(1);
}
console.log("✔ boundaries OK");
