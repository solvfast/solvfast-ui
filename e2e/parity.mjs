// Visual parity: screenshots of the playground (@solvfast/ui) and the Sear reference harness (tools/parity), same
// showcase, same states, then a pixel diff.   node e2e/parity.mjs <oursUrl> <searUrl> <outDir>
import fs from "node:fs";
import { chromium } from "playwright-core";

const [OURS, SEAR, OUT] = process.argv.slice(2);
const COMBOS = [["light", "en"], ["dark", "en"], ["light", "ar"], ["dark", "ar"]];
const STATES = [
  ["popover", '[data-testid="popover-trigger"]'],
  ["popover-command", '[data-testid="popover-command-trigger"]'],
  ["menu", '[data-testid="menu-trigger"]'],
  ["select", '[data-testid="select-trigger"]'],
  ["date", '[data-testid="date-field"] button'],
  ["dialog", '[data-testid="dialog-trigger"]'],
  ["sheet", '[data-testid="sheet-trigger"]'],
];
const HIDE = "*{caret-color:transparent!important}";

async function open(browser, url, theme, lang, viewport) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce", deviceScaleFactor: 1 });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem("app_theme", t); localStorage.setItem("app_lang", l); }, [theme, lang]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: HIDE });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  // cmdk scrolls its first item into view on mount (window + overflow containers); the timing differs between
  // builds, so normalise every scroll position before shooting — layout is what's being compared, not scroll.
  await page.evaluate(() => { window.scrollTo(0, 0); for (const e of document.querySelectorAll("*")) { e.scrollTop = 0; e.scrollLeft = 0; } });
  return { ctx, page, errors };
}

const browser = await chromium.launch();
const report = { errors: {}, reducedTransparency: {} };
for (const [name, url] of [["ours", OURS], ["sear", SEAR]]) {
  const dir = `${OUT}/${name}`;
  fs.mkdirSync(dir, { recursive: true });
  for (const [theme, lang] of COMBOS) {
    const tag = `${theme}-${lang}`;
    for (const [vpName, viewport] of [["desktop", { width: 1280, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
      let { ctx, page, errors } = await open(browser, url, theme, lang, viewport);
      await page.screenshot({ path: `${dir}/${tag}__${vpName}__page.png`, fullPage: true });
      await ctx.close();
      for (const [state, sel] of STATES) {
        if (vpName === "mobile" && !["dialog", "popover", "menu", "sheet"].includes(state)) continue;
        ({ ctx, page, errors } = await open(browser, url, theme, lang, viewport));
        await page.locator(sel).first().scrollIntoViewIfNeeded();
        await page.locator(sel).first().click();
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${dir}/${tag}__${vpName}__${state}.png` });
        await ctx.close();
      }
      if (errors.length) report.errors[`${name}/${tag}/${vpName}`] = errors;
    }
  }
  // prefers-reduced-transparency: the popover surface (Sear keeps it translucent — the bug this package fixes)
  const { ctx, page } = await open(browser, url, "light", "en", { width: 1280, height: 900 });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
  await page.locator('[data-testid="popover-trigger"]').click();
  await page.waitForTimeout(500);
  report.reducedTransparency[name] = await page.locator("[data-radix-popper-content-wrapper] > *").first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { backdropFilter: s.backdropFilter, backgroundColor: s.backgroundColor };
  });
  await page.screenshot({ path: `${OUT}/${name}-reduced-transparency-popover.png` });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
