import type { Config } from "tailwindcss";
import sfPreset from "../tailwind-preset";
// Path A: the package preset + a content glob that covers the package source (a real consumer points at dist/).
export default { presets: [sfPreset], content: [__dirname + "/index.html", __dirname + "/src/**/*.{ts,tsx}", __dirname + "/../src/**/*.{ts,tsx}"] } satisfies Config;
