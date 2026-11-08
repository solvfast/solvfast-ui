// Real-site harness (P36; PREPARED, NOT RUN — see README.md): builds harness/ and serves it on 127.0.0.1:4821 with /api,
// /app and the file paths proxied to the owner-approved STAGING site, naming the site with X-Frappe-Site-Name.
// `vite build` needs no site. `vite preview` / `vite` refuse to start unless every P36 guard passes (guards.mjs: the
// SFUI_STAGING_URL host is not production / loopback / this machine, SFUI_STAGING_SITE allowlist, a mode-700 private
// dir outside every repo holding APPROVED_STAGING). There is no default target: the old 127.0.0.1:18104 default is gone
// (loopback ports on the shared server are production Frappe processes).
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { evaluateGuards } from "./guards.mjs";

function stagingProxy() {
  const g = evaluateGuards({ env: process.env });
  if (!g.ok || !g.url || !g.site) {
    const why = g.verdicts.filter((v) => !v.ok).map((v) => `  - ${v.check}: ${v.detail}`).join("\n");
    throw new Error(`REFUSED (P36): the harness proxy only reaches an approved staging site.\n${why}`);
  }
  const target = g.url;
  const site = g.site;
  return Object.fromEntries(["/api", "/app", "/files", "/private/files"].map((p) => [p, { target, changeOrigin: true, secure: true, headers: { "X-Frappe-Site-Name": site } }]));
}

export default defineConfig(({ command, isPreview }) => ({
  root: path.resolve(__dirname, "harness"),
  plugins: [react()],
  resolve: { alias: [
    { find: /^@ui\/frappe$/, replacement: path.resolve(__dirname, "../../src/frappe/index.ts") },
    { find: /^@ui$/, replacement: path.resolve(__dirname, "../../src/index.ts") },
  ] },
  css: { postcss: { plugins: [tailwindcss({ config: path.resolve(__dirname, "../../playground/tailwind.config.ts") }), autoprefixer()] } },
  build: { outDir: path.resolve(__dirname, "dist"), emptyOutDir: true },
  ...(command === "serve" || isPreview
    ? (() => {
        const proxy = stagingProxy();
        const at = { host: "127.0.0.1", port: 4821, strictPort: true, proxy };
        return { preview: at, server: at };
      })()
    : {}),
}));
