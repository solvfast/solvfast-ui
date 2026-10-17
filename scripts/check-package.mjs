// Package audit (release checklist): run after `npm run build`.   node scripts/check-package.mjs
// - every `exports` target exists, and every JS entry has its types;
// - every bare import in dist/**/*.js and *.d.ts is a declared dependency or peer dependency (or Node built-in);
// - every declared dependency is actually used;
// - nothing in the tarball holds an absolute local path.
import fs from "node:fs";
import path from "node:path";
import { builtinModules } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const problems = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

// 1. exports
for (const [key, target] of Object.entries(pkg.exports)) {
  const targets = typeof target === "string" ? [target] : Object.values(target);
  for (const t of targets) if (!fs.existsSync(path.join(root, t))) problems.push(`exports["${key}"] → ${t} does not exist`);
  if (typeof target === "object" && !target.types) problems.push(`exports["${key}"] has no types`);
}

// 2–3. imports vs declared dependencies
const declared = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {})]);
const builtins = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));
const used = new Set();
const pkgName = (spec) => spec.split("/").slice(0, spec.startsWith("@") ? 2 : 1).join("/");
const files = walk(path.join(root, "dist")).filter((f) => /\.(js|cjs|d\.ts|d\.cts)$/.test(f));
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g)) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (!spec || spec.startsWith(".") || spec.startsWith("/")) continue;
    const name = pkgName(spec);
    if (builtins.has(spec) || builtins.has(name)) continue;
    used.add(name);
    if (!declared.has(name)) problems.push(`${path.relative(root, f)} imports "${spec}", which is not a dependency or peer dependency`);
  }
}
for (const d of Object.keys(pkg.dependencies ?? {})) if (!used.has(d)) problems.push(`dependency "${d}" is declared but never imported by dist/`);

// 4. tarball contents: no absolute local paths
const listing = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }))[0];
for (const { path: p } of listing.files) {
  const full = path.join(root, p);
  if (fs.existsSync(full) && /\/home\/|\/tmp\/|\/Users\//.test(fs.readFileSync(full, "utf8"))) problems.push(`${p} contains an absolute local path`);
}

console.log(`  exports: ${Object.keys(pkg.exports).length} · built files scanned: ${files.length} · npm imports: ${[...used].sort().join(", ")}`);
console.log(`  tarball: ${listing.entryCount} files, ${(listing.size / 1024).toFixed(1)} kB packed (${listing.name}@${listing.version})`);
if (problems.length) { console.error(problems.map((p) => `✖ ${p}`).join("\n")); process.exit(1); }
console.log("✔ package OK");
