// Path-B test only: a non-Tailwind app styles ITS OWN layout with its own CSS. To compare path B against path A
// pixel-for-pixel, generate that app CSS from the showcase's own layout classes (utilities only — no preflight,
// no package rules). Usage: node e2e/consumers/b-layout-css.mjs <consumerDir>
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
const require = createRequire(import.meta.url);
const { loadConfig } = require("tailwindcss/lib/lib/load-config");
const dir = path.resolve(process.argv[2]);
const preset = loadConfig(path.resolve("tailwind-preset.ts"));
const css = await postcss([tailwindcss({ presets: [preset], corePlugins: { preflight: false }, content: [path.join(dir, "src/**/*.tsx")] })])
  .process("@tailwind utilities;", { from: undefined });
// A real non-Tailwind app doesn't redefine the package's utility classes; re-declaring them AFTER full.css would
// reorder the cascade (e.g. `.text-sm` line-height overriding `.leading-none`). Keep only what full.css lacks.
const full = postcss.parse(fs.readFileSync(path.resolve("dist/styles/full.css"), "utf8"));
const inFull = new Set(); full.walkRules((r) => inFull.add(r.selector));
const app = postcss.parse(css.css); let dropped = 0;
app.walkRules((r) => { if (inFull.has(r.selector)) { r.remove(); dropped++; } });
fs.writeFileSync(path.join(dir, "src/layout.css"), "/* app-owned layout CSS (generated for the path-B parity test) */\n" + app.toString());
console.log(`  (${dropped} rules already in full.css left out)`);
console.log(`  layout.css ${(css.css.length / 1024).toFixed(1)} kB`);
