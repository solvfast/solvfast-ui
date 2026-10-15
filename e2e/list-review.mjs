// Screenshots of the List View controls Sear never had (rule C4: design review), plus the error and loading states.
//   node e2e/list-review.mjs <playgroundUrl> <outDir>
import fs from "node:fs";
import { chromium } from "playwright-core";

const [URL, OUT] = process.argv.slice(2);
const COMBOS = [["light", "en"], ["dark", "en"], ["light", "ar"], ["dark", "ar"]];
const T = {
  en: { select: "Select", sortBy: "Sort by", groupBy: "Group by", createdBy: "Created By", customize: "Customize filters", del: "Delete" },
  ar: { select: "تحديد", sortBy: "ترتيب حسب", groupBy: "تجميع حسب", createdBy: "أنشئت بواسطة", customize: "تخصيص عوامل التصفية", del: "حذف" },
};
const menu = async (p, trigger, item) => {
  await p.getByRole("button", { name: trigger }).first().click();
  await p.waitForTimeout(300);
  if (item) { await p.getByRole("menuitem", { name: item }).click(); await p.keyboard.press("Escape"); }
};
const STATES = [
  ["features", "features", "desktop", null],
  ["selected", "features", "desktop", async (p, s) => { const boxes = p.getByRole("checkbox", { name: s.select, exact: true }); await boxes.nth(1).click(); await boxes.nth(3).click(); }],
  ["sort-menu", "features", "desktop", async (p, s) => menu(p, new RegExp(s.sortBy))],
  ["group-menu", "features", "desktop", async (p, s) => menu(p, new RegExp(s.groupBy))],
  ["grouped", "features", "desktop", async (p, s) => menu(p, new RegExp(s.groupBy), s.createdBy)],
  ["quick-picker", "features", "desktop", async (p, s) => { await p.getByRole("button", { name: s.customize }).click(); }],
  ["confirm-delete", "features", "desktop", async (p, s) => { await p.getByRole("button", { name: s.del, exact: true }).first().click(); }],
  ["error", "error", "desktop", null],
  ["loading", "loading", "desktop", null],
  ["features-mobile", "features", "mobile", null],
];

const browser = await chromium.launch();
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
for (const [theme, lang] of COMBOS) {
  for (const [state, demo, vp, act] of STATES) {
    const viewport = vp === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
    const ctx = await browser.newContext({ viewport, reducedMotion: "reduce", deviceScaleFactor: 1 });
    await ctx.addInitScript(([t, l]) => { localStorage.setItem("app_theme", t); localStorage.setItem("app_lang", l); }, [theme, lang]);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${theme}-${lang}/${state}: ${e.message}`));
    await page.goto(`${URL}?view=list&demo=${demo}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    if (act) { await act(page, T[lang]); await page.waitForTimeout(700); } else await page.mouse.move(0, 0);
    await page.screenshot({ path: `${OUT}/${theme}-${lang}__${state}.png` });
    await ctx.close();
  }
}
await browser.close();
console.log(errors.length ? `page errors:\n${errors.join("\n")}` : `no page errors · ${COMBOS.length * STATES.length} shots`);
