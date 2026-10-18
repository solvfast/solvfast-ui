// Library build: ESM, one output module per source module (consumers bundle only what they import);
// every npm import stays external. Entry points: core (src/index.ts), src/frappe (5.4) and src/toast (0.2.0).
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const entries: Record<string, string> = { index: path.resolve(__dirname, "src/index.ts") };
if (fs.existsSync(path.resolve(__dirname, "src/frappe/index.ts"))) entries["frappe/index"] = path.resolve(__dirname, "src/frappe/index.ts");
if (fs.existsSync(path.resolve(__dirname, "src/toast/index.ts"))) entries["toast/index"] = path.resolve(__dirname, "src/toast/index.ts");

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    lib: { entry: entries, formats: ["es"] },
    rollupOptions: {
      external: (id) => !id.startsWith(".") && !path.isAbsolute(id) && !id.startsWith("\0"),
      output: { preserveModules: true, preserveModulesRoot: "src", entryFileNames: "[name].js" },
    },
  },
});
