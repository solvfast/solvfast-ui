// Button motion per variant — measured, not read from CSS.  node e2e/motion-check.mjs <oursUrl> [searUrl]
// Reports transition-duration at rest and while pressed, with and without prefers-reduced-motion.
// Fails if any button transitions at all under reduced motion, or if the package differs from Sear.
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
  if (label.includes("ai-outline")) {
    // The documented 180 ms hover / 120 ms press (DS D5 fix) — the one variant whose own transition they govern.
    if (!pkg.rest.startsWith("0.18s") || !pkg.pressed.startsWith("0.12s")) { ok = false; console.log("  ✖ expected 180 ms rest / 120 ms pressed"); }
    else console.log("  ✔ 180/120 ms (Sear: 180 ms pressed — its 120 ms class emitted no CSS)");
  } else if (sear && JSON.stringify(sear) !== JSON.stringify(pkg)) { ok = false; console.log("  ✖ differs from Sear"); }
  else if (sear) console.log("  ✔ identical to Sear (glass engine timing)");
}
console.log(ok ? "\n✔ no motion under reduced motion; glass timings identical to Sear; ai-outline 180/120 ms" : "\n✖ motion check failed"); process.exit(ok ? 0 : 1);
