// Button motion per variant — measured, not read from CSS.  node e2e/motion-check.mjs <oursUrl> [searUrl]
// Reports transition-duration at rest and while pressed, with and without prefers-reduced-motion.
// Expected in the package: every variant 180 ms at rest and 120 ms pressed — the DS Button's documented motion
// (design_system button.tsx:10) — and no motion under reduced motion. Sear's values are reported for comparison: its
// glass variants run on the glass engine's 0.4 s / 0.26 s (pressed 0.16 s), an intended difference.
import { chromium } from "playwright-core";
const targets = [["package", process.argv[2]], ...(process.argv[3] ? [["sear", process.argv[3]]] : [])];
const b = await chromium.launch(); const res = {};
for (const [name, url] of targets) for (const reducedMotion of ["no-preference", "reduce"]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion });
  await ctx.addInitScript(() => { localStorage.setItem("app_theme", "light"); localStorage.setItem("app_lang", "en"); });
  const p = await ctx.newPage(); await p.goto(url, { waitUntil: "networkidle" });
  const btns = p.locator('[data-testid="buttons"] > div').nth(2).locator("button"); // size "default" row
  const n = await btns.count();
  for (let i = 0; i < n - 1; i++) { // last one is "Disabled"
    const btn = btns.nth(i);
    const label = (await btn.innerText()).trim();
    const read = () => btn.evaluate((e) => { const s = getComputedStyle(e); return `${s.transitionDuration} [${s.transitionProperty}]`; });
    const rest = await read(); const box = await btn.boundingBox();
    await p.mouse.move(box.x + 6, box.y + 6); await p.mouse.down(); const pressed = await read(); await p.mouse.up(); await p.mouse.move(0, 0);
    (res[label] ??= {})[`${name}/${reducedMotion}`] = { rest, pressed };
  }
  await ctx.close();
}
await b.close();
let ok = true;
for (const [label, r] of Object.entries(res)) {
  console.log(`\n${label}`); for (const [k, v] of Object.entries(r)) console.log(`  ${k.padEnd(24)} rest: ${v.rest}\n  ${"".padEnd(24)} pressed: ${v.pressed}`);
  const rm = r["package/reduce"]; if (![rm.rest, rm.pressed].every((x) => /^(1e-05s|0s)(, (1e-05s|0s))* \[/.test(x))) { ok = false; console.log("  ✖ transitions under reduced motion"); }
  const pkg = r["package/no-preference"], sear = r["sear/no-preference"];
  const only = (v, d) => v.split(" [")[0].split(", ").every((x) => x === d);
  if (!only(pkg.rest, "0.18s") || !only(pkg.pressed, "0.12s")) { ok = false; console.log("  ✖ expected 180 ms at rest / 120 ms pressed"); }
  else console.log(`  ✔ 180/120 ms${sear ? ` (Sear: ${sear.rest.split(" [")[0]} / ${sear.pressed.split(" [")[0]})` : ""}`);
}
console.log(ok ? "\n✔ every button variant 180/120 ms; no motion under reduced motion" : "\n✖ motion check failed"); process.exit(ok ? 0 : 1);
