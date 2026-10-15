// Transition audit: every element's transition (property + duration), with and without prefers-reduced-motion, on
// the playground's primitives, shell and list pages (plus the list's confirm dialog).
//   node e2e/transition-audit.mjs <playgroundUrl> <out.json>            record
//   node e2e/transition-audit.mjs --diff <before.json> <after.json> [allowedClass]
// With --diff, lists every element whose transition changed and exits non-zero if any of them lacks `allowedClass`.
import fs from "node:fs";
import { chromium } from "playwright-core";

if (process.argv[2] === "--diff") {
  const [, , , beforeP, afterP, allowed] = process.argv;
  const before = JSON.parse(fs.readFileSync(beforeP, "utf8")), after = JSON.parse(fs.readFileSync(afterP, "utf8"));
  let changed = 0, outside = 0, missing = 0;
  const kinds = {};
  for (const key of Object.keys(before)) {
    const a = before[key], b = after[key];
    if (!b) { missing++; continue; }
    for (const [path, ea] of Object.entries(a)) {
      const eb = b[path];
      if (!eb) { missing++; continue; }
      if (ea.p === eb.p && ea.d === eb.d) continue;
      changed++;
      const ok = allowed && eb.c.split(/\s+/).includes(allowed);
      if (!ok) { outside++; console.log(`  OUTSIDE ${key} ${path} <${eb.t} class="${eb.c.slice(0, 80)}"> ${ea.d} → ${eb.d}`); }
      const k = `${key.split("/").pop()}: ${ea.d} → ${eb.d}`; kinds[k] = (kinds[k] ?? 0) + 1;
    }
  }
  for (const [k, n] of Object.entries(kinds).sort()) console.log(`  ${n} × ${k}`);
  console.log(`changed: ${changed}   outside "${allowed}": ${outside}   elements not found: ${missing}`);
  process.exit(outside || missing ? 1 : 0);
}

const [URL, OUT] = process.argv.slice(2);
const PAGES = [
  ["primitives", "", null],
  ["shell", "?view=shell", null],
  ["list-features", "?view=list&demo=features", null],
  ["list-confirm", "?view=list&demo=features", async (p) => { await p.getByRole("button", { name: "Delete", exact: true }).first().click(); await p.waitForTimeout(400); }],
];
const browser = await chromium.launch();
const result = {};
for (const [name, query, act] of PAGES) {
  for (const motion of ["no-preference", "reduce"]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: motion });
    await ctx.addInitScript(() => { localStorage.setItem("app_theme", "light"); localStorage.setItem("app_lang", "en"); });
    const page = await ctx.newPage();
    await page.goto(URL + query, { waitUntil: "networkidle" });
    await page.mouse.move(0, 0);
    if (act) await act(page);
    result[`${name}/${motion}`] = await page.evaluate(() => {
      const out = {};
      const pathOf = (el) => { const parts = []; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const sib = e.parentElement ? [...e.parentElement.children].filter((x) => x.tagName === e.tagName) : [e]; parts.unshift(`${e.tagName.toLowerCase()}:${sib.indexOf(e)}`); } return parts.join("/"); };
      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        out[pathOf(el)] = { t: el.tagName.toLowerCase(), c: typeof el.className === "string" ? el.className : "", p: cs.transitionProperty, d: cs.transitionDuration };
      }
      return out;
    });
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(OUT, JSON.stringify(result));
console.log(Object.entries(result).map(([k, v]) => `${k}: ${Object.keys(v).length} elements`).join("\n"));
