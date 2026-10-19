// List parity: the package ListView (playground ?view=list) vs Sear's real Field Library page (tools/parity ?view=list).
//   node e2e/list-parity.mjs <oursUrl> <searUrl> <outDir>
import fs from "node:fs";
import { chromium } from "playwright-core";

const [OURS, SEAR, OUT] = process.argv.slice(2);
const COMBOS = [["light", "en"], ["dark", "en"], ["light", "ar"], ["dark", "ar"]];
const T = {
  en: { search: "Search…", name: "Name", fields: "Fields", filter: "Filter", columns: "Columns", saved: "Saved", add: "Add filter", addColumn: "Add column", createdBy: "Created By", visa: "visa" },
  ar: { search: "بحث…", name: "الاسم", fields: "الحقول", filter: "تصفية", columns: "الأعمدة", saved: "المحفوظة", add: "إضافة عامل تصفية", addColumn: "إضافة عمود", createdBy: "أنشئت بواسطة", visa: "تأشيرة" },
};
const btn = (p, name) => p.getByRole("button", { name, exact: true });
const STATES = [
  ["page", "desktop", null],
  ["search", "desktop", async (p, s) => { await p.getByPlaceholder(s.search).fill(s.visa); }],
  ["empty", "desktop", async (p, s) => { await p.getByPlaceholder(s.search).fill("zzzz"); }],
  ["sort-name", "desktop", async (p, s) => { await p.locator("thead th button", { hasText: s.name }).click(); }],
  ["sort-fields-desc", "desktop", async (p, s) => { const h = p.locator("thead th button", { hasText: s.fields }); await h.click(); await h.click(); }],
  ["filter-open", "desktop", async (p, s) => { await btn(p, s.filter).click(); }],
  ["filter-condition", "desktop", async (p, s) => { await btn(p, s.filter).click(); await p.waitForTimeout(300); await btn(p, s.add).click(); }],
  ["columns-open", "desktop", async (p, s) => { await btn(p, s.columns).click(); }],
  // 0.3.0: PMO's column manager (user request) — a hidden field is added from "Add column"; Sear's is a checkbox list.
  ["column-shown", "desktop", async (p, s) => {
    await btn(p, s.columns).click(); await p.waitForTimeout(300);
    if (await btn(p, s.addColumn).count()) await btn(p, s.addColumn).click();
    await p.getByText(s.createdBy, { exact: true }).click(); await p.keyboard.press("Escape");
  }],
  ["saved-open", "desktop", async (p, s) => { await btn(p, s.saved).click(); }],
  ["mobile", "mobile", null],
];

const browser = await chromium.launch();
const errors = {};
for (const [name, url] of [["ours", OURS], ["sear", SEAR]]) {
  const dir = `${OUT}/${name}`;
  fs.mkdirSync(dir, { recursive: true });
  for (const [theme, lang] of COMBOS) {
    for (const [state, vp, act] of STATES) {
      const viewport = vp === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
      const ctx = await browser.newContext({ viewport, reducedMotion: "reduce", deviceScaleFactor: 1 });
      await ctx.addInitScript(([t, l]) => { localStorage.setItem("app_theme", t); localStorage.setItem("app_lang", l); }, [theme, lang]);
      const page = await ctx.newPage();
      page.on("pageerror", (e) => ((errors[`${name}/${theme}-${lang}/${state}`] ??= []).push(e.message)));
      await page.goto(`${url}?view=list`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      if (act) { await act(page, T[lang]); await page.waitForTimeout(900); }
      else await page.mouse.move(0, 0);
      await page.screenshot({ path: `${dir}/${theme}-${lang}__${state}.png` });
      await ctx.close();
    }
  }
}
await browser.close();
fs.writeFileSync(`${OUT}/errors.json`, JSON.stringify(errors, null, 2));
console.log(Object.keys(errors).length ? `page errors: ${JSON.stringify(errors).slice(0, 600)}` : "no page errors");
