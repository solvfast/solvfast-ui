// Dev helper: list the custom classes each CSS file defines (used to build the sf- rename map).
import fs from "node:fs"; import postcss from "postcss"; import sp from "postcss-selector-parser";
for (const f of process.argv.slice(2)) {
  const root = postcss.parse(fs.readFileSync(f, "utf8"));
  const set = new Set();
  root.walkRules((r) => { if (r.parent?.type === "atrule" && /keyframes/.test(r.parent.name)) return;
    sp((s) => s.walkClasses((c) => set.add(c.value))).processSync(r.selector); });
  console.log(`\n== ${f.split("/").slice(-2).join("/")} (${set.size}):\n` + [...set].sort().join(" "));
}
