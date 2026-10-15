// Full package build into dist/:  npm run build
//   1. styles/*.css regenerated from the pinned upstream sources (extract-css)
//   2. JS (vite.lib.config.ts)            3. type declarations (tsconfig.build.json)
//   4. stylesheets: theme/glass/base copied; full.css compiled for consumers without Tailwind (build-css)
//   5. Tailwind preset → CommonJS          6. boundary check (core never reaches Frappe / @tanstack)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = (n) => path.join(root, "node_modules/.bin", n);
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: "inherit" });
const step = (s) => console.log(`\n▸ ${s}`);

step("1/6 extract CSS from upstream"); run("node", ["scripts/extract-css.mjs"]);
step("2/6 JavaScript"); run(bin("vite"), ["build", "-c", "vite.lib.config.ts", "--logLevel", "warn"]);
step("3/6 type declarations"); run(bin("tsc"), ["-p", "tsconfig.build.json"]);
step("4/6 stylesheets"); run("node", ["scripts/build-css.mjs"]);
step("5/6 Tailwind preset → CommonJS");
run(bin("esbuild"), ["tailwind-preset.ts", "--bundle", "--format=cjs", "--platform=node", "--external:tailwindcss-animate", "--log-level=warning",
  `--outfile=${path.join(root, "dist/tailwind-preset.cjs")}`, "--footer:js=module.exports = module.exports.default;"]);
fs.writeFileSync(path.join(root, "dist/tailwind-preset.d.cts"), 'import type { Config } from "tailwindcss";\ndeclare const preset: Partial<Config>;\nexport = preset;\n');
step("6/6 boundaries"); run("node", ["scripts/check-boundaries.mjs"]);
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
console.log(`\n✔ ${pkg.name}@${pkg.version} built → dist/`);
