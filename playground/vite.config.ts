import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  // exact-match aliases: "@ui" must not swallow "@ui/frappe"
  resolve: { alias: [
    { find: /^@ui\/frappe$/, replacement: path.resolve(__dirname, "../src/frappe/index.ts") },
    { find: /^@ui\/toast$/, replacement: path.resolve(__dirname, "../src/toast/index.ts") },
    { find: /^@ui$/, replacement: path.resolve(__dirname, "../src/index.ts") },
  ] },
  css: { postcss: { plugins: [tailwindcss({ config: path.resolve(__dirname, "tailwind.config.ts") }), autoprefixer()] } },
  build: { outDir: path.resolve(__dirname, "dist"), emptyOutDir: true },
});
