// Grouped List View: every group shares one column layout. Measures each column's left edge and width in the header
// and in every data row of every group, grouped by "Created By", then again with one group collapsed and at 390 px
// (where the table must scroll horizontally inside its card).
//   node e2e/list-groups.mjs <playgroundUrl>          exits non-zero on any mismatch
import { chromium } from "playwright-core";

const URL = process.argv[2];
const TOL = 0.5; // px
const browser = await chromium.launch();
let failed = false;

async function measure(page) {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll(".sf-datagrid table tr")];
    const headerCells = document.querySelector(".sf-datagrid table thead tr").children.length;
    const out = [];
    for (const tr of rows) {
      if (tr.children.length !== headerCells) continue; // group header rows span the table
      out.push({
        where: tr.closest("thead") ? "header" : `group ${tr.closest("tbody")?.dataset.group ?? "?"}`,
        cols: [...tr.children].map((c) => { const r = c.getBoundingClientRect(); return [r.left, r.width]; }),
        text: [...tr.children].map((c) => c.textContent.trim().slice(0, 12)),
      });
    }
    const wrap = document.querySelector(".sf-datagrid table").parentElement;
    return { rows: out, tables: document.querySelectorAll(".sf-datagrid table").length, scroll: [wrap.scrollWidth, wrap.clientWidth], wrapRight: wrap.getBoundingClientRect().right, vw: innerWidth };
  });
}

function check(label, m) {
  const ref = m.rows[0];
  let bad = 0;
  for (const r of m.rows) {
    if (r.cols.length !== ref.cols.length) { bad++; continue; }
    r.cols.forEach(([l, w], i) => { if (Math.abs(l - ref.cols[i][0]) > TOL || Math.abs(w - ref.cols[i][1]) > TOL) bad++; });
  }
  const groups = new Set(m.rows.filter((r) => r.where !== "header").map((r) => r.where)).size;
  const ok = bad === 0 && groups > 1;
  if (!ok) failed = true;
  console.log(`${ok ? "✔" : "✖"} ${label}: ${m.tables} table(s), ${m.rows.length} rows in ${groups} groups + header, ${bad} column mismatches` +
    (bad ? `\n    header columns: ${ref.cols.map(([l, w]) => `${l.toFixed(1)}+${w.toFixed(1)}`).join(" | ")}` : ""));
  if (bad) {
    const first = m.rows.find((r) => r.cols.some(([l, w], i) => Math.abs(l - ref.cols[i]?.[0]) > TOL || Math.abs(w - ref.cols[i]?.[1]) > TOL));
    console.log(`    first mismatch (${first.where}): ${first.cols.map(([l, w]) => `${l.toFixed(1)}+${w.toFixed(1)}`).join(" | ")}`);
  }
}

for (const [vw, lang] of [[1440, "en"], [1440, "ar"], [390, "en"]]) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, reducedMotion: "reduce" });
  await ctx.addInitScript((l) => { localStorage.setItem("app_theme", "light"); localStorage.setItem("app_lang", l); }, lang);
  const page = await ctx.newPage();
  await page.goto(`${URL}?view=list&demo=features`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: lang === "ar" ? /تجميع حسب/ : /Group by/ }).first().click();
  await page.getByRole("menuitem", { name: lang === "ar" ? "أنشئت بواسطة" : "Created By" }).click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check(`${vw}px ${lang} grouped`, await measure(page));
  await page.locator(".sf-datagrid [aria-expanded=true]").first().click(); // collapse the first group
  await page.waitForTimeout(200);
  check(`${vw}px ${lang} first group collapsed`, await measure(page));
  if (vw < 500) {
    const m = await measure(page);
    const scrolls = m.scroll[0] > m.scroll[1], fits = m.wrapRight <= m.vw;
    if (!scrolls || !fits) failed = true;
    console.log(`${scrolls && fits ? "✔" : "✖"} ${vw}px: the table scrolls inside its card (${m.scroll[0]} > ${m.scroll[1]} px; card ends at ${Math.round(m.wrapRight)} ≤ ${m.vw} px)`);
  }
  await ctx.close();
}
await browser.close();
console.log(failed ? "✖ grouped columns are not consistent" : "✔ every group shares the header's column layout");
process.exit(failed ? 1 : 0);
