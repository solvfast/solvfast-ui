import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: { alias: { "@ui": path.resolve(__dirname, "../src/index.ts") } },
  css: { postcss: { plugins: [tailwindcss({ config: path.resolve(__dirname, "tailwind.config.ts") }), autoprefixer()] } },
  build: { outDir: path.resolve(__dirname, "dist"), emptyOutDir: true },
});
