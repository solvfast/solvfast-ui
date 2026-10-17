import type { Config } from "tailwindcss";
import sfPreset from "../tailwind-preset";
// Path A, as a consumer: the package preset + content globs (showcase, the playground demos it reuses, the package).
export default {
  presets: [sfPreset],
  content: [__dirname + "/index.html", __dirname + "/src/**/*.{ts,tsx}", __dirname + "/../playground/src/**/*.{ts,tsx}", __dirname + "/../src/**/*.{ts,tsx}"],
} satisfies Config;
