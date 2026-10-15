// The List View page must not scroll sideways on a phone: at 360 and 390 px the document is no wider than the
// viewport (the table scrolls inside its card instead). Sear's default list and the playground's every-option list,
// in English and Arabic.   node e2e/list-mobile.mjs <url> [<url> …]      exits non-zero if any page is too wide
import { chromium } from "playwright-core";

const urls = process.argv.slice(2);
const browser = await chromium.launch();
let failed = false;
for (const base of urls) {
  for (const demo of ["", "&demo=features"]) {
    for (const width of [360, 390]) {
      for (const lang of ["en", "ar"]) {
        const ctx = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
        await ctx.addInitScript((l) => { localStorage.setItem("app_theme", "light"); localStorage.setItem("app_lang", l); }, lang);
        const page = await ctx.newPage();
        const res = await page.goto(`${base}?view=list${demo}`, { waitUntil: "networkidle" });
        if (!res?.ok()) { await ctx.close(); continue; }
        const { doc, table, scrolls } = await page.evaluate(() => {
          const t = document.querySelector("table"); const w = t?.parentElement;
          return { doc: document.documentElement.scrollWidth, table: w ? Math.round(w.getBoundingClientRect().right) : 0, scrolls: w ? w.scrollWidth > w.clientWidth : false };
        });
        const ok = doc <= width && table <= width;
        if (!ok) failed = true;
        console.log(`${ok ? "✔" : "✖"} ${base}${demo || " (default)"} ${width}px ${lang}: page ${doc}px${scrolls ? ", table scrolls in its card" : ""}`);
        await ctx.close();
      }
    }
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
