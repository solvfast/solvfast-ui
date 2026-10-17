// Number-card parity: the package's StatCard / IconStatCard (playground ?view=cards) vs the Design System's stat-card
// markup and Sear's real DefinitionsGrid (tools/parity ?view=cards), both in Sear's CSS.
//   node e2e/cards-parity.mjs <oursUrl> <searUrl> <outDir>      then: python3 e2e/compare.py <outDir>/sear <outDir>/ours <outDir>/diff
import fs from "node:fs";
import { chromium } from "playwright-core";

const [OURS, SEAR, OUT] = process.argv.slice(2);
const COMBOS = [["light", "en"], ["dark", "en"], ["light", "ar"], ["dark", "ar"]];
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const browser = await chromium.launch();
const errors = {};
for (const [name, url] of [["ours", OURS], ["sear", SEAR]]) {
  const dir = `${OUT}/${name}`;
  fs.mkdirSync(dir, { recursive: true });
  for (const [theme, lang] of COMBOS) {
    for (const [vp, viewport] of Object.entries(VIEWPORTS)) {
      const ctx = await browser.newContext({ viewport, reducedMotion: "reduce", deviceScaleFactor: 1 });
      await ctx.addInitScript(([t, l]) => { localStorage.setItem("app_theme", t); localStorage.setItem("app_lang", l); }, [theme, lang]);
      const page = await ctx.newPage();
      page.on("pageerror", (e) => ((errors[`${name}/${theme}-${lang}/${vp}`] ??= []).push(e.message)));
      await page.goto(`${url}?view=cards`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
      const shot = (part) => page.locator(`[data-testid=${part}]`).screenshot({ path: `${dir}/${theme}-${lang}__${vp}-${part}.png` });
      await shot("ds-stats");
      await shot("icon-cards");
      if (vp === "desktop") {
        await page.locator("[data-testid=icon-cards] a").first().hover();
        await page.waitForTimeout(400);
        await shot("icon-cards").then(() => fs.renameSync(`${dir}/${theme}-${lang}__${vp}-icon-cards.png`, `${dir}/${theme}-${lang}__${vp}-icon-cards-hover.png`));
        await page.mouse.move(0, 0);
        await page.waitForTimeout(400);
        await shot("icon-cards");
      }
      await ctx.close();
    }
  }
}
await browser.close();
fs.writeFileSync(`${OUT}/errors.json`, JSON.stringify(errors, null, 2));
console.log(Object.keys(errors).length ? `page errors: ${JSON.stringify(errors).slice(0, 600)}` : "no page errors");
