// Real-site validation harness (PREPARED, NOT RUN — see README.md): builds harness/ and serves it on 127.0.0.1:4821
// with /api and /app proxied to the site's server, naming the site with X-Frappe-Site-Name. Same origin for the page.
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

const target = process.env.SFUI_FRAPPE_TARGET ?? "http://127.0.0.1:18104";
const site = process.env.SFUI_FRAPPE_SITE ?? "sfui-test.localhost";
const proxy = Object.fromEntries(["/api", "/app"].map((p) => [p, { target, changeOrigin: false, headers: { "X-Frappe-Site-Name": site } }]));

export default defineConfig({
  root: path.resolve(__dirname, "harness"),
  plugins: [react()],
  resolve: { alias: [
    { find: /^@ui\/frappe$/, replacement: path.resolve(__dirname, "../../src/frappe/index.ts") },
    { find: /^@ui$/, replacement: path.resolve(__dirname, "../../src/index.ts") },
  ] },
  css: { postcss: { plugins: [tailwindcss({ config: path.resolve(__dirname, "../../playground/tailwind.config.ts") }), autoprefixer()] } },
  build: { outDir: path.resolve(__dirname, "dist"), emptyOutDir: true },
  preview: { host: "127.0.0.1", port: 4821, strictPort: true, proxy },
});
