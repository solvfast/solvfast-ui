// FrappeListView on the playground's SIMULATED Frappe site (?view=frappe): review screenshots + real-browser checks.
// No network, no live site.   node e2e/frappe-review.mjs <playgroundUrl> <outDir>      exits non-zero if a check fails
import fs from "node:fs";
import { chromium } from "playwright-core";

const [URL, OUT] = process.argv.slice(2);
const COMBOS = [["light", "en"], ["dark", "en"], ["light", "ar"], ["dark", "ar"]];
const T = {
  en: { search: "Search…", filter: "Filter", add: "Add filter", field: "Field", value: "Value", allocated: "Allocated To", any: "Match any", all: "Match all", groupBy: /Group by/, status: "Status", del: "Delete", loadMore: "Load more", select: "Select value", open: "Open", closed: "Closed" },
  ar: { search: "بحث…", filter: "تصفية", add: "إضافة عامل تصفية", field: "الحقل", value: "القيمة", allocated: "مُسندة إلى", any: "مطابقة أيٍّ", all: "مطابقة الكل", groupBy: /تجميع حسب/, status: "الحالة", del: "حذف", loadMore: "تحميل المزيد", select: "اختر قيمة", open: "Open", closed: "Closed" },
};
const rows = (p) => p.locator("tbody tr:not([aria-hidden]):not([data-group-header])");
const ready = (p) => p.waitForFunction(() => document.querySelectorAll("tbody tr:not([aria-hidden])").length > 0 && !document.querySelector("tbody tr[aria-hidden]"));
const STATES = [
  ["page", "default", "desktop", null],
  ["search", "default", "desktop", async (p, s) => { await p.getByPlaceholder(s.search).fill("visa"); await p.waitForTimeout(700); }],
  ["c2-hint", "default", "desktop", async (p, s) => {
    await p.getByRole("button", { name: s.filter, exact: true }).click();
    const dlg = p.getByRole("dialog");
    await dlg.getByRole("button", { name: s.add }).click(); await dlg.getByRole("button", { name: s.add }).click();
    const values = dlg.getByRole("combobox", { name: s.value });
    await values.nth(0).click(); await p.getByRole("option", { name: s.open, exact: true }).click();
    await values.nth(1).click(); await p.getByRole("option", { name: s.closed, exact: true }).click();
    await dlg.getByRole("combobox", { name: /Match|المطابقة/ }).click(); await p.getByRole("option").nth(1).click();
    // a person's pace: Radix's Select gives focus back to its trigger 100–160 ms after a choice; Escape + typing inside
    // that window (automation only) ends with the search box blurred
    await p.waitForTimeout(300);
    await p.keyboard.press("Escape");
    // wait until the popover has closed and handed focus back, or that focus return can land after the typing
    await p.getByRole("dialog").waitFor({ state: "detached" });
    await p.waitForFunction(() => document.activeElement && document.activeElement !== document.body); // Radix restores focus in a 0 ms timer
    await p.getByPlaceholder(s.search).fill("call"); await p.waitForTimeout(700);
  }],
  ["grouped-partial", "grouped", "desktop", async (p, s) => {
    await p.getByRole("button", { name: s.groupBy }).click(); await p.getByRole("menuitem", { name: s.status }).click(); await p.keyboard.press("Escape"); await p.waitForTimeout(600);
  }],
  ["link-search", "default", "desktop", async (p, s) => {
    await p.getByRole("button", { name: s.filter, exact: true }).click();
    const dlg = p.getByRole("dialog");
    await dlg.getByRole("button", { name: s.add }).click();
    await dlg.getByRole("combobox", { name: s.field }).click(); await p.getByRole("option", { name: s.allocated }).click();
    await dlg.getByRole("combobox", { name: s.value }).click(); // straight away (in jsdom a pause was needed)
    await p.getByRole("option", { name: "sara@example.com" }).waitFor({ timeout: 3000 });
  }],
  ["confirm-delete", "default", "desktop", async (p, s) => { await p.getByRole("button", { name: s.del, exact: true }).first().click(); await p.waitForTimeout(300); }],
  ["error", "error", "desktop", null],
  ["mobile", "default", "mobile", null],
];

const browser = await chromium.launch();
fs.mkdirSync(OUT, { recursive: true });
const failures = [];
for (const [theme, lang] of COMBOS) {
  for (const [state, demo, vp, act] of STATES) {
    const viewport = vp === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
    const ctx = await browser.newContext({ viewport, reducedMotion: "reduce", deviceScaleFactor: 1 });
    await ctx.addInitScript(([t, l]) => { localStorage.setItem("app_theme", t); localStorage.setItem("app_lang", l); }, [theme, lang]);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => failures.push(`${theme}-${lang}/${state}: page error ${e.message}`));
    await page.goto(`${URL}?view=frappe&demo=${demo}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    try {
      if (demo === "error") await page.getByRole("alert").waitFor({ timeout: 5000 }); else await ready(page);
      if (act) await act(page, T[lang]);
      if (state === "mobile") {
        const w = await page.evaluate(() => document.documentElement.scrollWidth);
        if (w > 390) failures.push(`${theme}-${lang}/mobile: page ${w}px wide at 390px`);
      }
      if (state === "c2-hint" && !(await page.getByRole("status").isVisible())) failures.push(`${theme}-${lang}/c2-hint: no hint`);
      if (state === "grouped-partial" && !(await page.getByRole("button", { name: T[lang].loadMore }).isVisible())) failures.push(`${theme}-${lang}/grouped: no Load more`);
    } catch (e) { failures.push(`${theme}-${lang}/${state}: ${e.message.split("\n")[0]}`); }
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${OUT}/${theme}-${lang}__${state}.png` });
    await ctx.close();
  }
}
await browser.close();
console.log(failures.length ? `✖ ${failures.length} problem(s):\n${failures.join("\n")}` : `✔ ${COMBOS.length * STATES.length} shots; link search opens straight after picking a field; C2 hint, Load more and mobile width checked`);
process.exit(failures.length ? 1 : 0);
