// Stylesheets for dist/styles:
//   theme.css, base.css — Tailwind SOURCE (path A: the consumer's Tailwind processes them; see docs/CONSUMING.md)
//   glass.css           — plain CSS (both paths; load after the Tailwind stylesheet)
//   full-base.css       — path B's opt-in element rules (base.css with @apply resolved)
//   full.css            — path B, for apps WITHOUT Tailwind: compiled here over the package's own dist/*.js with the
//                         package preset, in the same layer order as path A, then glass.css appended. Tailwind's
//                         preflight + default `--tw-*` variables are re-scoped under `:where(.sf-theme)` so the
//                         package never resets a page that hasn't opted in through <ThemeProvider>.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import sp from "postcss-selector-parser";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist/styles");
fs.mkdirSync(out, { recursive: true });
for (const f of ["theme.css", "glass.css", "base.css"]) fs.copyFileSync(path.join(root, "styles", f), path.join(out, f));

// The preset is TypeScript; esbuild (via vite) has already produced nothing for it yet, so load it with jiti
// through Tailwind's own loader (the same path a consumer's tailwind.config.ts takes).
const require = createRequire(import.meta.url);
const { loadConfig } = require("tailwindcss/lib/lib/load-config");
const preset = loadConfig(path.join(root, "tailwind-preset.ts"));
const cfg = (content) => ({ presets: [preset], content });

const compile = async (css, content, plugins = []) =>
  (await postcss([tailwindcss(cfg(content)), autoprefixer, ...plugins]).process(css, { from: undefined })).css;

// Selectors that Tailwind's base layer emits on its own (preflight + default variables), from a reference build.
const reference = postcss.parse(await compile("@tailwind base;", [{ raw: "" }]));
const tailwindBaseSelectors = new Set();
reference.walkRules((r) => tailwindBaseSelectors.add(r.selector));

const SCOPE = ":where(.sf-theme)";
const scopeSelector = (selector) =>
  sp((sels) => {
    const next = [];
    sels.each((sel) => {
      const text = sel.toString().trim();
      if (/^(html|:host)$/.test(text)) { next.push(SCOPE); return; }
      if (text === "*") next.push(SCOPE);
      // pseudo-only selectors (`::before`, `::backdrop`, `::-webkit-…`) also apply to the scope element's OWN
      // pseudo-elements, as the unscoped preflight does for <html> (found by the path A/B comparison).
      if (text.startsWith(":")) next.push(`${SCOPE}${text}`);
      next.push(`${SCOPE} ${text}`);
    });
    sels.removeAll();
    for (const s of next) sels.append(sp().astSync(s).first);
  }).processSync(selector);

const theme = fs.readFileSync(path.join(root, "styles/theme.css"), "utf8");
const compiled = postcss.parse(await compile(`@tailwind base;\n@tailwind components;\n@tailwind utilities;\n${theme}`, [path.join(root, "dist/**/*.js")]));
let scoped = 0;
compiled.walkRules((r) => {
  if (r.parent?.type === "atrule" && /keyframes$/.test(r.parent.name)) return;
  if (tailwindBaseSelectors.has(r.selector)) { r.selector = scopeSelector(r.selector); scoped++; }
});
const glass = fs.readFileSync(path.join(root, "styles/glass.css"), "utf8");
const banner = "/*! @solvfast/ui full.css — precompiled for apps WITHOUT Tailwind (path B). Do not combine with theme.css/glass.css. */\n";
fs.writeFileSync(path.join(out, "full.css"), banner + compiled.toString() + "\n" + glass);
// full-base.css — path B's version of the opt-in base.css (its @apply resolved here). Only the package's own rules are
// kept: Tailwind's base output is dropped (full.css already carries it, scoped).
const baseCompiled = postcss.parse(await compile(`@tailwind base;\n${fs.readFileSync(path.join(root, "styles/base.css"), "utf8")}`, [path.join(root, "dist/**/*.js")]));
// (content = the package dist, like full.css: Tailwind keeps @layer rules only when their classes — here `sf-theme` — appear in content)
baseCompiled.walkRules((r) => { if (tailwindBaseSelectors.has(r.selector)) r.remove(); });
baseCompiled.walkAtRules((a) => { if (a.nodes && a.nodes.length === 0) a.remove(); });
fs.writeFileSync(path.join(out, "full-base.css"), "/*! @solvfast/ui full-base.css — opt-in element rules for path B (apps without Tailwind). */\n" + baseCompiled.toString());
const kb = (f) => (fs.statSync(path.join(out, f)).size / 1024).toFixed(1);
console.log(`  full.css ${kb("full.css")} kB · full-base ${kb("full-base.css")} kB (Tailwind base rules re-scoped: ${scoped}); theme ${kb("theme.css")} · glass ${kb("glass.css")} · base ${kb("base.css")} kB`);
