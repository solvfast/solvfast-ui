// Shell parity: the package AppShell (playground ?view=shell) vs Sear's real StudioShell (tools/parity ?view=shell),
// same configuration, same routes, same states.   node e2e/shell-parity.mjs <oursUrl> <searUrl> <outDir>
import fs from "node:fs";
import { chromium } from "playwright-core";

const [OURS, SEAR, OUT] = process.argv.slice(2);
const BASE = "/workspace/build/sear_studio";
const COMBOS = [["light", "en"], ["dark", "en"], ["light", "ar"], ["dark", "ar"]];

// [name, route, viewport, localStorage extras, action]
const STATES = [
  ["page", "/overview", "desktop", {}, null],
  ["nested", "/calendars/holidays", "desktop", {}, null],
  ["collapsed", "/overview", "desktop", { studio_sidebar_collapsed: "1" }, null],
  ["collapsed-tooltip", "/overview", "desktop", { studio_sidebar_collapsed: "1" }, async (p) => { await p.locator("aside nav button").nth(1).hover(); }],
  ["switcher", "/overview", "desktop", {}, async (p) => { await p.locator('aside button[aria-haspopup="menu"]').click(); }],
  ["switcher-sub", "/overview", "desktop", {}, async (p) => {
    await p.locator('aside button[aria-haspopup="menu"]').click(); await p.waitForTimeout(400);
    await p.locator('[role="menuitem"][aria-haspopup="menu"]').first().click();
  }],
  ["switcher-current", "/overview", "desktop", {}, async (p) => {
    // the current app ("Sear Studio", in the Build section) is below the fold of the scrolling sub-menu
    await p.locator('aside button[aria-haspopup="menu"]').click(); await p.waitForTimeout(400);
    await p.locator('[role="menuitem"][aria-haspopup="menu"]').first().click(); await p.waitForTimeout(400);
    await p.locator('[role="menu"]').last().evaluate((el) => { el.scrollTop = el.scrollHeight; });
  }],
  ["notifications", "/overview", "desktop", {}, async (p, lang) => { await p.locator(`button[aria-label="${lang === "ar" ? "الإشعارات" : "Notifications"}"]`).click(); }],
  ["notifications-unread", "/overview", "desktop", {}, async (p, lang) => {
    await p.locator(`button[aria-label="${lang === "ar" ? "الإشعارات" : "Notifications"}"]`).click(); await p.waitForTimeout(300);
    await p.locator("aside button[aria-pressed]").nth(1).click();
  }],
  ["mobile", "/overview", "mobile", {}, null],
  ["mobile-more", "/overview", "mobile", {}, async (p) => { await p.locator('nav[class*="!fixed"] button').last().click(); }],
];

const browser = await chromium.launch();
const errors = {};
for (const [name, url] of [["ours", OURS], ["sear", SEAR]]) {
  const dir = `${OUT}/${name}`;
  fs.mkdirSync(dir, { recursive: true });
  for (const [theme, lang] of COMBOS) {
    for (const [state, route, vp, extra, act] of STATES) {
      const viewport = vp === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
      const ctx = await browser.newContext({ viewport, reducedMotion: "reduce", deviceScaleFactor: 1 });
      await ctx.addInitScript(([t, l, x]) => {
        localStorage.setItem("app_theme", t); localStorage.setItem("app_lang", l);
        for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v);
      }, [theme, lang, extra]);
      const page = await ctx.newPage();
      page.on("pageerror", (e) => ((errors[`${name}/${theme}-${lang}/${state}`] ??= []).push(e.message)));
      await page.goto(`${url}?view=shell&path=${encodeURIComponent(BASE + route)}`, { waitUntil: "networkidle" });
      // (no style injection after load: a late <style> made path B re-render the bell glass slightly differently —
      //  a test-harness artefact; no shell state focuses a text field, so there is no caret to hide)
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      if (act) { await act(page, lang); await page.waitForTimeout(900); }
      if (!act) await page.mouse.move(0, 0); // no stray hover; open menus/tooltips keep the pointer where the action left it
      await page.screenshot({ path: `${dir}/${theme}-${lang}__${state}.png` });
      await ctx.close();
    }
  }
}
await browser.close();
fs.writeFileSync(`${OUT}/errors.json`, JSON.stringify(errors, null, 2));
console.log(Object.keys(errors).length ? `page errors: ${JSON.stringify(errors).slice(0, 400)}` : "no page errors");
