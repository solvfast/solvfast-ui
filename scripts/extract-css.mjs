// Builds styles/{theme,glass,base}.css from the PINNED upstream sources (upstream/ds-v0.3.0) plus the
// authored Sear re-targets (styles/src/sf-overrides.css), in Sear's order. Re-run after any change to src/ class usage:
//   npm run extract-css
//
// Transforms, in order:
//   1. rename   — every custom (non-Tailwind) class the DS CSS defines becomes `sf-<name>`; the same map is
//                 used for the TSX (VENDORED.md). Tailwind's `dark` keeps its name.
//   2. scope    — `:root` → `.sf-theme`, the token block `.dark` → `.sf-theme.dark`, and element/global
//                 selectors (html, body, h1…, *, :where(button…)) are prefixed with `:where(.sf-theme)` so the
//                 package never styles a page that hasn't opted in through <ThemeProvider>.
//   3. drop     — themes and features the package doesn't ship (glass-ds `dim`/`senaiy` themes and the OS
//                 auto-dark block: ThemeProvider always sets data-theme).
//   4. shake    — a selector survives only if every `sf-` class it needs is used somewhere in src/ or the
//                 overrides; then unreferenced @keyframes / @property and empty at-rules are removed.
// Order inside each file is the upstream order, so the cascade matches Sear's.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import sp from "postcss-selector-parser";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const up = (p) => path.join(root, "upstream/ds-v0.3.0/styles", p);
const read = (p) => fs.readFileSync(p, "utf8");
const NOT_RENAMED = new Set(["dark"]);

// ---- 1. the rename map: every class the three DS CSS sources define ----------------------------------------
const sources = { ds: up("ds.css"), tokens: up("glass-ds/tokens.css"), engine: up("glass-ds/engine.css"), adapter: up("glass/glass.css") };
const custom = new Set();
for (const f of Object.values(sources)) {
  postcss.parse(read(f)).walkRules((r) => {
    if (r.parent?.type === "atrule" && /keyframes$/.test(r.parent.name)) return;
    sp((s) => s.walkClasses((c) => { if (!NOT_RENAMED.has(c.value)) custom.add(c.value); })).processSync(r.selector);
  });
}
export const RENAME = Object.fromEntries([...custom].sort().map((c) => [c, `sf-${c}`]));

// ---- usage scan: sf- classes used by the package source (not the CSS itself, or nothing could ever be shaken) -------------------------------
const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []);
const used = new Set();
for (const f of walk(path.join(root, "src")).filter((f) => /\.(tsx?|css)$/.test(f))) {
  for (const m of read(f).matchAll(/sf-[a-z0-9-]+/g)) used.add(m[0]);
}
used.add("sf-theme"); // set by ThemeProvider
used.add("sf-app");   // the app-root class (AppShell from 5.2; documented for consumers without AppShell)

// ---- 2+3. rename + scope one stylesheet ------------------------------------------------------------------------
const SCOPE = ":where(.sf-theme)";
const GLOBAL_TAGS = /^(html|body|h[1-6]|\*|:host)$/;
function transform(css, { dropDims = false } = {}) {
  const r = postcss.parse(css);
  r.walkAtRules("import", (a) => a.remove());
  if (dropDims) {
    r.walkRules((rule) => { if (/data-theme="(dim|senaiy)"/.test(rule.selector)) rule.remove(); });
    r.walkAtRules("media", (a) => { if (/prefers-color-scheme/.test(a.params)) a.remove(); });
  }
  r.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/.test(rule.parent.name)) return;
    rule.selector = sp((sels) => {
      sels.each((sel) => {
        sel.walkClasses((c) => { if (RENAME[c.value]) c.value = RENAME[c.value]; });
        const first = sel.first;
        const text = sel.toString().trim();
        // :root / :root[data-theme=…] → .sf-theme
        let hasRoot = false;
        sel.walkPseudos((p) => { if (p.value === ":root") { p.replaceWith(sp.className({ value: "sf-theme" })); hasRoot = true; } });
        if (hasRoot) return;
        if (text === ".dark") { sel.prepend(sp.className({ value: "sf-theme" })); return; }
        // element / universal / :where(...) globals → scoped under :where(.sf-theme)
        if (first && (first.type === "tag" || first.type === "universal" || (first.type === "pseudo" && first.value === ":where"))) {
          if (first.type === "tag" && first.value === "html") { first.replaceWith(sp.pseudo({ value: ":where", nodes: [sp.selector({ nodes: [sp.className({ value: "sf-theme" })] })] })); return; }
          if (first.type === "tag" && !GLOBAL_TAGS.test(first.value)) return; // e.g. button.foo — already class-qualified below
          sel.prepend(sp.combinator({ value: " " }));
          sel.prepend(sp.pseudo({ value: ":where", nodes: [sp.selector({ nodes: [sp.className({ value: "sf-theme" })] })] }));
        }
      });
    }).processSync(rule.selector);
  });
  return r;
}

// ---- 4. tree-shake ----------------------------------------------------------------------------------------------
function shake(r) {
  r.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/.test(rule.parent.name)) return;
    const kept = [];
    sp((sels) => sels.each((sel) => {
      let ok = true;
      sel.walkClasses((c) => { if (c.value.startsWith("sf-") && !used.has(c.value)) ok = false; });
      if (ok) kept.push(sel.toString().trim());
    })).processSync(rule.selector);
    if (!kept.length) rule.remove(); else rule.selector = kept.join(",\n");
  });
  const decls = () => { let s = ""; r.walkDecls((d) => { s += ` ${d.prop}:${d.value};`; }); return s; };
  r.walkAtRules(/keyframes$/, (a) => { if (!new RegExp(`(animation(-name)?:[^;]*\\b${a.params}\\b)`).test(decls())) a.remove(); });
  r.walkAtRules("property", (a) => { if (!decls().includes(a.params)) a.remove(); });
  let changed = true;
  while (changed) { changed = false; r.walkAtRules((a) => { if (a.nodes && a.nodes.length === 0) { a.remove(); changed = true; } }); }
  r.walkComments((c) => { if (!c.text.startsWith("!")) c.remove(); });
  return r;
}

// ---- assemble ----------------------------------------------------------------------------------------------------
const banner = (what) => `/*! @solvfast/ui — ${what}. GENERATED by scripts/extract-css.mjs from upstream/ds-v0.3.0 (DS tag v0.3.0, 92fc1cd)\n    and styles/src/sf-overrides.css (Sear 7abc895-dirty). Do not edit by hand. */\n`;

// theme.css — ds.css minus its element base rules (those go to base.css), plus the Sear re-targets.
const ds = transform(read(sources.ds));
const baseRules = postcss.root();
ds.walkRules((rule) => {
  const inBase = rule.parent?.type === "atrule" && rule.parent.name === "layer" && rule.parent.params === "base";
  if (inBase && /(:where\(\.sf-theme\)\s+(body|h1)|^:where\(\.sf-theme\)$|:where\(\.sf-theme\)\[lang)/m.test(rule.selector)) {
    baseRules.append(rule.clone()); rule.remove();
  }
});
ds.walkAtRules("media", (a) => { if (a.nodes?.some((n) => n.type === "rule" && /^:where\(\.sf-theme\)$/.test(n.selector))) { baseRules.append(a.clone()); a.remove(); } });
// Overrides FIRST: in Sear, sear-studio.css is @imported at the top of index.css, before the DS rules, so where an
// override ties a DS rule on specificity the DS rule wins on source order (e.g. the mobile dialog surface).
const theme = shake(postcss.root().append(postcss.parse(read(path.join(root, "styles/src/sf-overrides.css")))).append(ds));
const glass = shake(postcss.root()
  .append(transform(read(sources.tokens), { dropDims: true }))
  .append(transform(read(sources.engine)))
  .append(transform(read(sources.adapter))));
const base = postcss.root().append(postcss.parse("@layer base {}"));
base.first.append(baseRules.nodes);

fs.mkdirSync(path.join(root, "styles"), { recursive: true });
fs.writeFileSync(path.join(root, "styles/theme.css"), banner("theme (Tailwind source: process with the consumer's Tailwind, after its three layers)") + theme.toString().replace(/\n{3,}/g, "\n\n"));
fs.writeFileSync(path.join(root, "styles/glass.css"), banner("glass engine subset (plain CSS; load AFTER the Tailwind stylesheet)") + glass.toString().replace(/\n{3,}/g, "\n\n"));
fs.writeFileSync(path.join(root, "styles/base.css"), banner("opt-in element rules (Tailwind source)") + base.toString().replace(/\n{3,}/g, "\n\n"));
// Every package class used by a theme.css/base.css rule: the preset safelists them, so Tailwind never purges a
// package rule just because the consumer's content glob doesn't happen to contain the class name.
const sfInTheme = new Set();
for (const r of [theme, base]) r.walkRules((rule) => { for (const m of rule.selector.matchAll(/\.(sf-[a-z0-9-]+)/g)) sfInTheme.add(m[1]); });
fs.writeFileSync(path.join(root, "styles/sf-classes.json"), JSON.stringify([...sfInTheme].sort(), null, 2) + "\n");
fs.writeFileSync(path.join(root, "styles/rename-map.json"), JSON.stringify(RENAME, null, 2) + "\n");
const kb = (f) => (fs.statSync(path.join(root, "styles", f)).size / 1024).toFixed(1) + " kB";
console.log(`custom classes renamed: ${custom.size}; used sf- classes: ${used.size}`);
console.log(`theme.css ${kb("theme.css")} · glass.css ${kb("glass.css")} · base.css ${kb("base.css")}`);
