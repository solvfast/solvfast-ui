// The component showcase: an isolated Vite app (no dependencies of its own). It imports the package from source through
// the same aliases as the playground and builds to showcase/dist with relative paths and hash routes, so the output
// can be opened from any static host. Port 4850 is strict: if it is taken, the server says so instead of moving.
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

export default defineConfig({
  root: __dirname,
  base: "./",
  plugins: [react()],
  resolve: { alias: [
    { find: /^@ui\/frappe$/, replacement: path.resolve(__dirname, "../src/frappe/index.ts") },
    { find: /^@ui\/toast$/, replacement: path.resolve(__dirname, "../src/toast/index.ts") },
    { find: /^@ui$/, replacement: path.resolve(__dirname, "../src/index.ts") },
  ] },
  css: { postcss: { plugins: [tailwindcss({ config: path.resolve(__dirname, "tailwind.config.ts") }), autoprefixer()] } },
  build: { outDir: path.resolve(__dirname, "dist"), emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  server: { host: "127.0.0.1", port: 4850, strictPort: true },
  preview: { host: "127.0.0.1", port: 4850, strictPort: true },
});
