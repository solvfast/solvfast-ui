/**
 * Sear reference harness (dev-only, never published). Renders the shared showcase with Sear's REAL components and
 * CSS, read straight from the Sear and DS source trees (SEAR_SRC / DS_SRC), so screenshots can be pixel-compared
 * against the package. Refuses to build if the Sear files no longer match the recorded baseline (upstream/SHA256SUMS).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

const SEAR_FE = process.env.SEAR_FE ?? "/home/frappe/lovable_bench/apps/sear_product/frontend";
const DS_FE = process.env.DS_FE ?? "/home/frappe/lovable_bench/apps/design_system/frontend";
const repo = path.resolve(__dirname, "../..");

// Baseline guard: the live Sear files must equal the pinned copies in upstream/sear-7abc895-dirty.
const pinned: Record<string, string> = {
  "src/sear-studio.css": "sear-studio.css", "src/index.css": "index.css", "tailwind.config.ts": "tailwind.config.ts",
  "src/sear_studio/components/DateTimeField.tsx": "DateTimeField.tsx", "src/sear_studio/lib/datetime.ts": "datetime.ts",
  "src/contexts/AppContext.tsx": "AppContext.tsx",
  "src/sear_studio_app/StudioShell.tsx": "StudioShell.tsx", "src/sear_studio_app/SearStudioLayout.tsx": "SearStudioLayout.tsx",
  "src/sear_studio/components/NotificationCenter.tsx": "NotificationCenter.tsx",
  "src/sear_studio/pages/Notifications/notificationCenterStore.ts": "notificationCenterStore.ts",
  "src/shared/injection/binaDropdown.js": "binaDropdown.js",
  "src/hooks/useDataGrid.ts": "data-grid/useDataGrid.ts", "src/lib/data-grid/filter-engine.ts": "data-grid/filter-engine.ts",
  "src/lib/data-grid/frappe-meta.ts": "data-grid/frappe-meta.ts", "src/lib/data-grid/storage.ts": "data-grid/storage.ts",
  "src/lib/data-grid/cell-render.tsx": "data-grid/cell-render.tsx",
  "src/sear_studio/pages/FieldLibrary/FieldLibraryListPage.tsx": "data-grid/FieldLibraryListPage.tsx",
  "src/sear_studio/components/overview/DefinitionsGrid.tsx": "overview/DefinitionsGrid.tsx",
  "src/sear_studio/components/overview/overviewShared.tsx": "overview/overviewShared.tsx",
  "src/sear_studio/components/overview/types.ts": "overview/types.ts",
};
const sha = (f: string) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
for (const [live, copy] of Object.entries(pinned)) {
  if (sha(path.join(SEAR_FE, live)) !== sha(path.join(repo, "upstream/sear-7abc895-dirty", copy))) {
    throw new Error(`Sear changed since the 7abc895-dirty baseline: ${live}. Parity results would not be comparable.`);
  }
}

const require = createRequire(import.meta.url);
const { loadConfig } = require("tailwindcss/lib/lib/load-config");
const searTw = loadConfig(path.join(SEAR_FE, "tailwind.config.ts"));
const content = [
  path.join(__dirname, "*.{ts,tsx,html}"),
  path.join(repo, "playground/src/showcase/**/*.tsx"),
  path.join(DS_FE, "src/components/ui/**/*.tsx"),
  path.join(SEAR_FE, "src/sear_studio/components/DateTimeField.tsx"),
  // the shell (increment 5.2)
  path.join(SEAR_FE, "src/sear_studio_app/StudioShell.tsx"),
  path.join(SEAR_FE, "src/sear_studio/components/NotificationCenter.tsx"),
  path.join(SEAR_FE, "src/sear_studio/components/daleel/**/*.tsx"),
  // the list (increment 5.3)
  path.join(DS_FE, "src/components/data-grid/**/*.tsx"),
  path.join(SEAR_FE, "src/lib/data-grid/**/*.tsx"),
  path.join(SEAR_FE, "src/sear_studio/pages/FieldLibrary/FieldLibraryListPage.tsx"),
  // the number cards
  path.join(SEAR_FE, "src/sear_studio/components/overview/**/*.tsx"),
];

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@ui", replacement: path.join(__dirname, "sear-ui.ts") },
      // Sear's router (only Sear's shell uses it; the package has no router)
      { find: /^react-router-dom$/, replacement: path.join(SEAR_FE, "node_modules/react-router-dom") },
      { find: /^@ds\//, replacement: path.join(DS_FE, "src") + "/" },
      { find: /^@sear\//, replacement: path.join(SEAR_FE, "src/sear_studio") + "/" },
      { find: /^@\//, replacement: path.join(SEAR_FE, "src") + "/" },
    ],
    // One copy of every shared runtime (Sear does the same through its own dedupe list).
    dedupe: ["react", "react-dom", "react/jsx-runtime", "@tanstack/react-query", "lucide-react", "class-variance-authority", "clsx", "tailwind-merge",
      "cmdk", "react-day-picker", "date-fns", "@radix-ui/react-slot", "@radix-ui/react-select", "@radix-ui/react-popover",
      "@radix-ui/react-dropdown-menu", "@radix-ui/react-dialog", "@radix-ui/react-alert-dialog", "@radix-ui/react-tooltip",
      "@radix-ui/react-tabs", "@radix-ui/react-switch", "@radix-ui/react-checkbox", "@radix-ui/react-label",
      "@radix-ui/react-separator", "@radix-ui/react-avatar", "@radix-ui/react-scroll-area", "@radix-ui/react-direction"],
  },
  css: { postcss: { plugins: [tailwindcss({ ...searTw, content }), autoprefixer()] } },
  server: { fs: { allow: [repo, SEAR_FE, DS_FE] } },
  build: { outDir: path.join(__dirname, "dist"), emptyOutDir: true },
});
