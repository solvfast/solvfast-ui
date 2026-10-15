import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  // the playground's demo data (e.g. the simulated Frappe site) imports the package by its playground aliases
  resolve: { alias: [
    { find: /^@ui\/frappe$/, replacement: path.resolve(__dirname, "src/frappe/index.ts") },
    { find: /^@ui$/, replacement: path.resolve(__dirname, "src/index.ts") },
  ] },
  test: { environment: "jsdom", include: ["tests/**/*.test.{ts,tsx}"] },
});
