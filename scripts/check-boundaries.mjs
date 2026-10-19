// Enforces the dependency boundaries of architecture §4. Fails (exit 1) on any violation.
//  A. src/: what each module folder may import.
//  B. dist/: nothing reachable from the core entry (dist/index.js) imports @tanstack/*, the Frappe layer, or
//     talks to Frappe (`/api/method`, `/api/resource`, `csrf`); nor the optional-peer entries (toast → sonner,
//     chart → recharts, form → react-hook-form). Each optional entry reaches only the theme / primitives it needs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []);
// `import type` / `export type` are erased at compile time: no runtime dependency, so not a boundary crossing.
const stripTypeOnly = (src) => src.replace(/^\s*(import|export)\s+type\s[^;]*;?/gm, "");
const importsOf = (src0) => { const src = stripTypeOnly(src0); return [...src.matchAll(/(?:import|export)\s[^"']*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g)].map((m) => m[1] || m[2] || m[3]); };
const problems = [];

// ---- A. source rules -------------------------------------------------------------------------------------------
const area = (file) => {
  const rel = path.relative(path.join(root, "src"), file).split(path.sep);
  if (rel[0] === "list" && rel[1] === "model") return "list/model";
  return rel.length === 1 ? rel[0] : rel[0];
};
const RULES = {
  lib: { deny: [/^react(?!-day-picker)/, /^@radix-ui/, /^@tanstack/, /frappe/, /^\.\.\/(theme|primitives|shell|list|frappe)/] },
  "list/model": { deny: [/^react/, /^@radix-ui/, /^@tanstack/, /frappe/, /^\.\.\/\.\.\/(theme|primitives|shell|frappe)/, /^\.\.\/(parts|ListView|useListState)/] },
  theme: { deny: [/^@tanstack/, /frappe/, /react-router/, /^\.\.\/(shell|list|frappe)/] },
  primitives: { deny: [/^@tanstack/, /frappe/, /react-router/, /^sonner/, /^recharts/, /^react-hook-form/, /^\.\.\/(shell|list|frappe|toast|chart|form)/] },
  cards: { deny: [/^@tanstack/, /frappe/, /react-router/, /^\.\.\/(shell|list|frappe)/] },
  shell: { deny: [/^@tanstack/, /frappe/, /react-router/, /^\.\.\/(list|frappe)/] },
  list: { deny: [/^@tanstack/, /frappe/, /react-router/, /^\.\.\/(shell|frappe)/, /^\.\.\/\.\.\/(shell|frappe)/] },
  frappe: { deny: [/^\.\.\/shell/] },
  toast: { deny: [/^@tanstack/, /frappe/, /react-router/, /^\.\.\/(shell|list|frappe|cards|chart|form)/] },
  chart: { deny: [/^@tanstack/, /frappe/, /react-router/, /^sonner/, /^react-hook-form/, /^\.\.\/(shell|list|frappe|cards|toast|form)/] },
  form: { deny: [/^@tanstack/, /frappe/, /react-router/, /^sonner/, /^recharts/, /^\.\.\/(shell|list|frappe|cards|toast|chart)/] },
  "index.ts": { deny: [/^@tanstack/, /^\.\/(frappe|toast|chart|form)/, /^sonner/, /^recharts/, /^react-hook-form/] },
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
      else if (/^(@tanstack\/|sonner|recharts|react-hook-form)/.test(spec)) problems.push(`dist: ${path.relative(dist, f)} imports ${spec}`);
    }
    if (path.relative(dist, f).split(path.sep)[0] === "frappe") problems.push(`dist: core entry reaches the Frappe layer (${path.relative(dist, f)})`);
    for (const entry of ["toast", "chart", "form"]) if (path.relative(dist, f).split(path.sep)[0] === entry) problems.push(`dist: core entry reaches the ${entry} entry (${path.relative(dist, f)})`);
    if (/\/api\/(method|resource)|csrf/i.test(src)) problems.push(`dist: ${path.relative(dist, f)} references Frappe endpoints`);
  }
  console.log(`  core entry reaches ${seen.size} modules — none import @tanstack/*, sonner, recharts, react-hook-form, the Frappe layer or the toast / chart / form entries` + (problems.length ? " (see problems)" : ""));

  // the toast entry: built whenever src/toast exists; uses the theme and sonner — never React Query, the Frappe layer, the shell or the List View
  if (fs.existsSync(path.join(root, "src/toast/index.ts"))) {
    const entry = path.join(dist, "toast/index.js");
    if (!fs.existsSync(entry)) problems.push("dist: src/toast exists but dist/toast/index.js was not built");
    else {
      const tseen = new Set(); const tq = [entry]; const npm = new Set();
      while (tq.length) {
        const f = tq.pop();
        if (tseen.has(f)) continue;
        tseen.add(f);
        for (const spec of importsOf(fs.readFileSync(f, "utf8"))) {
          if (spec.startsWith(".")) tq.push(path.resolve(path.dirname(f), spec)); else npm.add(spec.split("/").slice(0, spec.startsWith("@") ? 2 : 1).join("/"));
        }
        const top = path.relative(dist, f).split(path.sep)[0];
        if (["frappe", "shell", "list"].includes(top)) problems.push(`dist: the toast entry reaches ${top}/ (${path.relative(dist, f)})`);
      }
      if (npm.has("@tanstack/react-query")) problems.push("dist: the toast entry imports @tanstack/react-query");
      console.log(`  toast entry reaches ${tseen.size} modules; npm imports: ${[...npm].sort().join(", ")}`);
    }
  }

  // the chart and form entries (0.3.0): built whenever their src folder exists; each uses its own optional peer and at most
  // the theme / primitives / lib — never React Query, sonner, the other peer, the Frappe layer, the shell or the List View
  for (const [name, peer, others] of [["chart", "recharts", ["react-hook-form", "sonner", "@tanstack/react-query"]], ["form", "react-hook-form", ["recharts", "sonner", "@tanstack/react-query"]]]) {
    if (!fs.existsSync(path.join(root, `src/${name}/index.ts`))) continue;
    const entry = path.join(dist, `${name}/index.js`);
    if (!fs.existsSync(entry)) { problems.push(`dist: src/${name} exists but dist/${name}/index.js was not built`); continue; }
    const eseen = new Set(); const eq = [entry]; const npm = new Set();
    while (eq.length) {
      const f = eq.pop();
      if (eseen.has(f)) continue;
      eseen.add(f);
      for (const spec of importsOf(fs.readFileSync(f, "utf8"))) {
        if (spec.startsWith(".")) eq.push(path.resolve(path.dirname(f), spec)); else npm.add(spec.split("/").slice(0, spec.startsWith("@") ? 2 : 1).join("/"));
      }
      const top = path.relative(dist, f).split(path.sep)[0];
      if (["frappe", "shell", "list", "cards", "toast", "chart", "form"].filter((t) => t !== name).includes(top)) problems.push(`dist: the ${name} entry reaches ${top}/ (${path.relative(dist, f)})`);
    }
    for (const o of others) if (npm.has(o)) problems.push(`dist: the ${name} entry imports ${o}`);
    if (!npm.has(peer)) problems.push(`dist: the ${name} entry does not import ${peer} (expected)`);
    console.log(`  ${name} entry reaches ${eseen.size} modules; npm imports: ${[...npm].sort().join(", ")}`);
  }

  // the Frappe entry: built whenever src/frappe exists; may use core and @tanstack/react-query, never the shell
  if (fs.existsSync(path.join(root, "src/frappe/index.ts"))) {
    const entry = path.join(dist, "frappe/index.js");
    if (!fs.existsSync(entry)) problems.push("dist: src/frappe exists but dist/frappe/index.js was not built");
    else {
      const fseen = new Set(); const fq = [entry]; const npm = new Set();
      while (fq.length) {
        const f = fq.pop();
        if (fseen.has(f)) continue;
        fseen.add(f);
        for (const spec of importsOf(fs.readFileSync(f, "utf8"))) {
          if (spec.startsWith(".")) fq.push(path.resolve(path.dirname(f), spec)); else npm.add(spec.split("/").slice(0, spec.startsWith("@") ? 2 : 1).join("/"));
        }
        if (path.relative(dist, f).split(path.sep)[0] === "shell") problems.push(`dist: the Frappe entry reaches the shell (${path.relative(dist, f)})`);
      }
      console.log(`  frappe entry reaches ${fseen.size} modules; npm imports: ${[...npm].sort().join(", ")}`);
    }
  }
} else {
  console.log("  (dist/ not built yet — source rules only)");
}

if (problems.length) {
  console.error(problems.map((p) => `✖ ${p}`).join("\n"));
  process.exit(1);
}
console.log("✔ boundaries OK");
