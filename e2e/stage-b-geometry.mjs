// Real-browser geometry checks for the R2 visual items (SIMULATED backend, playground on 127.0.0.1):
//   V9: the Link dropdown aligns with its input (start edge and width) in LTR and RTL (the single focus ring is checked on the screenshots);
//   V8: Arabic version lines keep their word order (bidi isolates present around the English tokens);
//   V1: the form title has no raw HTML.      node e2e/stage-b-geometry.mjs http://127.0.0.1:4833/ /tmp/a6-shots/r3
import fs from "node:fs";
import { chromium } from "playwright-core";
const [URL, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const res = [];
for (const [theme, lang] of [["light", "en"], ["dark", "en"], ["light", "ar"], ["dark", "ar"]]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem("app_theme", t); localStorage.setItem("app_lang", l); }, [theme, lang]);
  const p = await ctx.newPage();
  // V9 + V1
  await p.goto(`${URL}?view=frappe-sim&c=form-todo`, { waitUntil: "networkidle" });
  await p.locator("[data-doctype]").first().waitFor();
  const title = await p.locator("h2").first().innerText();
  res.push([`${theme}-${lang} V1 title`, !/[<>]/.test(title), title]);
  const input = p.getByLabel("Allocated To").first();
  await input.click(); await input.fill("sa"); await p.waitForTimeout(1500);
  const geo = await p.evaluate(() => {
    const i = document.querySelector('input[aria-label="Allocated To"], input[id*="allocated_to"]') ?? document.activeElement;
    const wrap = i.closest(".sf-field-fill") ?? i.parentElement;
    const pop = document.querySelector("[role=listbox], [data-radix-popper-content-wrapper]");
    const r = (e) => (e ? e.getBoundingClientRect() : null);
    const rings = [...document.querySelectorAll("*")].filter((e) => { const s = getComputedStyle(e); return (s.boxShadow !== "none" && /rgb/.test(s.boxShadow) && e.contains(document.activeElement)) || (s.outlineStyle !== "none" && s.outlineWidth !== "0px" && e === document.activeElement); }).length;
    return { wrap: r(wrap)?.toJSON(), pop: r(pop)?.toJSON(), rings };
  });
  await p.screenshot({ path: `${OUT}/geom-${theme}-${lang}__link.png` });
  if (geo.wrap && geo.pop) {
    const dStart = lang === "ar" ? geo.wrap.right - geo.pop.right : geo.pop.left - geo.wrap.left;
    res.push([`${theme}-${lang} V9 dropdown start offset px`, Math.abs(dStart) <= 2, Math.round(dStart)]);
    res.push([`${theme}-${lang} V9 dropdown width vs input`, Math.abs(geo.pop.width - geo.wrap.width) <= 2, `${Math.round(geo.pop.width)} vs ${Math.round(geo.wrap.width)}`]);
  } else res.push([`${theme}-${lang} V9 geometry`, false, JSON.stringify(geo)]);
  // V8
  await p.goto(`${URL}?view=frappe-sim&c=timeline`, { waitUntil: "networkidle" });
  await p.getByText(/Please confirm/).first().waitFor({ timeout: 8000 });
  const line = await p.evaluate(() => [...document.querySelectorAll("li, div, p")].map((e) => e.textContent).find((t) => /Status|Priority/.test(t ?? "") && /Closed|Low/.test(t ?? "") && (t ?? "").length < 400) ?? "");
  const hasIso = /⁨/.test(line);
  res.push([`${theme}-${lang} V8 isolates present`, lang === "ar" ? hasIso : true, JSON.stringify(line.slice(0, 120))]);
  await p.screenshot({ path: `${OUT}/geom-${theme}-${lang}__timeline.png` });
  await ctx.close();
}
await browser.close();
for (const [n, ok, v] of res) console.log(`${ok ? "PASS" : "FAIL"}  ${n}  ${v}`);
process.exit(res.some((r) => !r[1]) ? 1 : 0);
