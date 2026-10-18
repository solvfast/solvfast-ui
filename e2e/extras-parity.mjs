// 0.2.0 parity: Table, RadioGroup, Stepper and a toast — the package (playground ?view=extras) vs Sear's real components
// (tools/parity ?view=extras: Sear's table/radio-group/sonner shims onto the Design System, Sear's own Stepper), same JSX.
//   node e2e/extras-parity.mjs <oursUrl> <searUrl> <outDir>      then: python3 e2e/compare.py <outDir>/sear <outDir>/ours <outDir>/diff
import fs from "node:fs";
import { chromium } from "playwright-core";

const [OURS, SEAR, OUT] = process.argv.slice(2);
const COMBOS = [["light", "en"], ["dark", "en"], ["light", "ar"], ["dark", "ar"]];
const browser = await chromium.launch();
const errors = {};
for (const [name, url] of [["ours", OURS], ["sear", SEAR]]) {
  const dir = `${OUT}/${name}`;
  fs.mkdirSync(dir, { recursive: true });
  for (const [theme, lang] of COMBOS) {
    for (const vp of ["desktop", "phone"]) {
      const ctx = await browser.newContext({ viewport: vp === "phone" ? { width: 390, height: 844 } : { width: 1440, height: 900 }, reducedMotion: "reduce", deviceScaleFactor: 1 });
      await ctx.addInitScript(([t, l]) => { localStorage.setItem("app_theme", t); localStorage.setItem("app_lang", l); }, [theme, lang]);
      const page = await ctx.newPage();
      page.on("pageerror", (e) => ((errors[`${name}/${theme}-${lang}/${vp}`] ??= []).push(e.message)));
      await page.goto(`${url}?view=extras`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
      const shot = (sel, state) => page.locator(sel).first().screenshot({ path: `${dir}/${theme}-${lang}__${vp}-${state}.png` });
      if (vp === "phone") { await shot("[data-testid=stepper]", "stepper"); await ctx.close(); continue; }
      await shot("[data-testid=table]", "table");
      await shot("[data-testid=radio]", "radio");
      await shot("[data-testid=stepper]", "stepper");
      await page.locator("[data-testid=table] tbody tr").nth(1).hover();
      await page.waitForTimeout(300);
      await shot("[data-testid=table]", "table-row-hover");
      await page.mouse.move(0, 0);
      await page.keyboard.press("Tab");                       // the first focusable: the checked radio
      await page.waitForTimeout(200);
      await shot("[data-testid=radio]", "radio-focus");
      await page.locator("label[for=r-yearly]").click();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
      await shot("[data-testid=radio]", "radio-selected");
      await page.locator("[data-testid=toast-trigger]").click();
      await page.locator('[data-sonner-toast][data-mounted="true"]').waitFor();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(700);
      await shot("[data-sonner-toast]", "toast");
      const pos = await page.locator("[data-sonner-toaster]").first().evaluate((el) => [el.getAttribute("data-x-position"), el.getAttribute("data-y-position"), el.getAttribute("dir")].join(" "));
      fs.writeFileSync(`${dir}/${theme}-${lang}__toast-position.txt`, pos + "\n");
      await ctx.close();
    }
  }
}
await browser.close();
fs.writeFileSync(`${OUT}/errors.json`, JSON.stringify(errors, null, 2));
console.log(Object.keys(errors).length ? `page errors: ${JSON.stringify(errors).slice(0, 600)}` : "no page errors");
