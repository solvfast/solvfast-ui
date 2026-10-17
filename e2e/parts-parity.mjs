// Tab-strip parity: the package's Tabs (playground ?view=parts) vs Sear's real SegmentedTabs (tools/parity ?view=parts),
// incl. the Working Hours "Coverage" toggle and hover on an inactive, the active and a disabled tab. Then, on ours only,
// the standalone Calendar's surface must equal an open DateField popover's (same glass, same radius).
//   node e2e/parts-parity.mjs <oursUrl> <searUrl> <outDir>      then: python3 e2e/compare.py <outDir>/sear <outDir>/ours <outDir>/diff
import fs from "node:fs";
import { chromium } from "playwright-core";

const [OURS, SEAR, OUT] = process.argv.slice(2);
const COMBOS = [["light", "en"], ["dark", "en"], ["light", "ar"], ["dark", "ar"]];
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const STRIPS = ["tabs-plain", "tabs-icons", "tabs-working-hours"];
const HOVERS = [["hover-inactive", 1], ["hover-active", 0], ["hover-disabled", 2]];
const browser = await chromium.launch();
const errors = {};
const problems = [];

async function open(url, theme, lang, viewport) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce", deviceScaleFactor: 1 });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem("app_theme", t); localStorage.setItem("app_lang", l); }, [theme, lang]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => ((errors[`${url}/${theme}-${lang}`] ??= []).push(e.message)));
  await page.goto(`${url}?view=parts`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  return { ctx, page };
}

for (const [name, url] of [["ours", OURS], ["sear", SEAR]]) {
  const dir = `${OUT}/${name}`;
  fs.mkdirSync(dir, { recursive: true });
  for (const [theme, lang] of COMBOS) {
    for (const [vp, viewport] of Object.entries(VIEWPORTS)) {
      const { ctx, page } = await open(url, theme, lang, viewport);
      for (const s of STRIPS) await page.locator(`[data-testid=${s}]`).screenshot({ path: `${dir}/${theme}-${lang}__${vp}-${s}.png` });
      if (vp === "desktop") {
        for (const [state, i] of HOVERS) {
          await page.locator("[data-testid=tabs-plain] [role=tab]").nth(i).hover({ force: true });
          await page.waitForTimeout(350);
          await page.locator("[data-testid=tabs-plain]").screenshot({ path: `${dir}/${theme}-${lang}__${vp}-tabs-plain-${state}.png` });
          await page.mouse.move(0, 0);
          await page.waitForTimeout(350);
        }
      }
      await ctx.close();
    }
  }
}

// The standalone Calendar vs the DateField's open popover (ours).
for (const [theme, lang] of COMBOS) {
  const { ctx, page } = await open(OURS, theme, lang, VIEWPORTS.desktop);
  const pick = (el) => { const s = getComputedStyle(el); return { bg: s.backgroundColor, img: s.backgroundImage, blur: s.backdropFilter, shadow: s.boxShadow, radius: s.borderRadius }; };
  const inline = await page.locator("[data-testid=calendar-inline] .rdp-root").evaluate(pick);
  await page.locator("[data-testid=date-field] button").click();
  const popover = page.locator("[data-radix-popper-content-wrapper] > *").first();
  await popover.waitFor();
  await page.waitForTimeout(400);
  const pop = await popover.evaluate(pick);
  const inner = await popover.locator(".rdp-root").evaluate(pick);
  for (const k of ["bg", "img", "blur", "shadow", "radius"]) if (inline[k] !== pop[k]) problems.push(`${theme}-${lang} calendar ${k}: inline ${inline[k]} ≠ popover ${pop[k]}`);
  if (inner.bg !== "rgba(0, 0, 0, 0)" || inner.blur !== "none" || inner.shadow !== "none" || inner.img !== "none") problems.push(`${theme}-${lang} calendar inside the popover is not transparent: ${JSON.stringify(inner)}`);
  await ctx.close();
}

await browser.close();
fs.writeFileSync(`${OUT}/errors.json`, JSON.stringify(errors, null, 2));
console.log(Object.keys(errors).length ? `page errors: ${JSON.stringify(errors).slice(0, 600)}` : "no page errors");
console.log(problems.length ? `calendar surface: FAIL\n${problems.join("\n")}` : "calendar surface: standalone = popover glass in 4 combos; inside the popover the calendar is transparent");
