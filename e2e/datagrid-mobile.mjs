// DataGrid on a phone (P36): the showcase's "DataGrid on phones" section at 360 and 390 px, English and Arabic, light
// and dark. The page must not scroll sideways; the `layout="auto"` and `layout="cards"` grids show a card per row
// with every essential value (Name, Share %) fully on screen — not clipped, not truncated, not covered; the row
// controls (Edit, ⋯, Add Row) are on screen; editing a card inline, adding and deleting a row work without overflow.
// At 1280 px the auto grid is a table, and becomes cards in the narrow column (container width, not the window).
// The default `layout="table"` grid is reported (it scrolls inside its frame — the host's explicit opt-in).
//   npm run showcase:build && npx vite preview --config showcase/vite.config.ts --port 4877 --strictPort
//   node e2e/datagrid-mobile.mjs [baseUrl] [screenshotDir]          exits non-zero on any failure
import fs from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:4877/";
const SHOTS = process.argv[3];
const ID = "datagrid-responsive";
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const failures = [];
const fail = (where, what) => { failures.push(`${where}: ${what}`); console.log(`  ✖ ${what}`); };
const browser = await chromium.launch();

async function open(theme, lang, viewport) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce", hasTouch: viewport.width < 600, isMobile: viewport.width < 600 });
  await ctx.addInitScript(([t, l]) => {
    if (!location.protocol.startsWith("http")) return;
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("sfui-showcase-theme", t); localStorage.setItem("sfui-showcase-lang", l);
      sessionStorage.setItem("seeded", "1");
    }
  }, [theme, lang]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console ${m.text()}`); });
  await page.goto(`${BASE}#${ID}`);
  await page.locator(`#${ID}-content h3`).first().waitFor({ timeout: 15_000 });
  await page.locator(`[data-testid="dg-cards"] [data-card]`).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}

const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Why `el` is not fully readable on screen ("" = it is). */
const VISIBLE = (el) => {
  el.scrollIntoView({ block: "center", inline: "nearest" });
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return "zero size";
  if (r.left < -0.5 || r.right > innerWidth + 0.5) return "off-screen x " + Math.round(r.left) + ".." + Math.round(r.right);
  if (el.scrollWidth > el.clientWidth + 1) return "truncated (" + el.scrollWidth + " > " + el.clientWidth + ")";
  for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
    const cs = getComputedStyle(a);
    if (cs.overflowX !== "visible") { const ar = a.getBoundingClientRect(); if (r.left < ar.left - 0.5 || r.right > ar.right + 0.5) return "clipped by " + a.tagName.toLowerCase(); }
  }
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  if (!hit || !(el.contains(hit) || hit.contains(el))) return "covered by " + (hit ? hit.tagName.toLowerCase() + "." + String(hit.className).slice(0, 40) : "nothing");
  return "";
};

async function checkGrid(page, where, testId) {
  const grid = page.locator(`[data-testid="${testId}"]`);
  const layout = await grid.locator("[data-layout]").first().getAttribute("data-layout");
  if (layout !== "cards") fail(where, `${testId}: layout ${layout}, expected cards`);
  const cards = grid.locator("[data-card]");
  const n = await cards.count();
  if (n < 1) fail(where, `${testId}: no cards`);
  let checked = 0;
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i);
    for (const [col, sel] of [["Name", `[data-col="name"]`], ["Share %", `dd[data-col="share"]`]]) {
      const el = card.locator(sel);
      const text = (await el.textContent())?.trim();
      if (!text) fail(where, `${testId} row ${i + 1}: ${col} empty`);
      const why = await el.evaluate(VISIBLE);
      if (why) fail(where, `${testId} row ${i + 1}: ${col} "${text}" ${why}`); else checked++;
    }
    for (const name of [new RegExp(`^(Edit row|تعديل الصف) ${i + 1}$`), new RegExp(`^(Row ${i + 1} actions|إجراءات الصف ${i + 1})$`)]) {
      const b = card.getByRole("button", { name });
      const why = await b.evaluate(VISIBLE);
      if (why) fail(where, `${testId} row ${i + 1}: button ${name} ${why}`);
    }
  }
  const add = grid.getByRole("button", { name: /^(Add Row|إضافة صف)$/ });
  const whyAdd = await add.evaluate(VISIBLE);
  if (whyAdd) fail(where, `${testId}: Add Row ${whyAdd}`);
  return { n, checked };
}

// 1. Phones: 360 / 390 × en / ar × light / dark
for (const width of [360, 390]) {
  for (const lang of ["en", "ar"]) {
    for (const theme of ["light", "dark"]) {
      const where = `${width}px ${lang} ${theme}`;
      console.log(`• ${where}`);
      const { ctx, page, errors } = await open(theme, lang, { width, height: 844 });
      const dir = await page.evaluate(() => document.documentElement.dir || getComputedStyle(document.body).direction);
      if ((lang === "ar") !== (dir === "rtl")) fail(where, `direction ${dir}`);
      const o = await overflow(page);
      if (o > 0) fail(where, `page scrolls sideways by ${o}px`);
      const a = await checkGrid(page, where, "dg-auto");
      const c = await checkGrid(page, where, "dg-cards");
      const tbl = await page.locator(`[data-testid="dg-table"] table`).evaluate((t) => { const f = t.parentElement; return { layout: t.closest("[data-layout]").dataset.layout, scrolls: f.scrollWidth > f.clientWidth, frame: Math.round(f.getBoundingClientRect().right) }; });
      if (tbl.layout !== "table") fail(where, `dg-table: layout ${tbl.layout}`);
      if (tbl.frame > width) fail(where, `dg-table frame ends at ${tbl.frame}px`);
      if (SHOTS) await page.locator(`#${ID}`).screenshot({ path: `${SHOTS}/dg-${width}-${lang}-${theme}.png` });

      // inline editing of a card (auto grid): tap Share % of row 1 → its editor, focused, on screen; type; Escape
      const auto = page.locator(`[data-testid="dg-auto"]`);
      const first = auto.locator("[data-card]").first();
      await first.locator(`dd[data-col="share"]`).tap();
      const editor = first.locator(`[data-dg-editor][data-col="share"] input`);
      await editor.waitFor({ timeout: 5000 });
      if (!(await editor.evaluate((el) => el === document.activeElement))) fail(where, "share editor not focused after tapping the value");
      const whyEd = await editor.evaluate(VISIBLE);
      if (whyEd) fail(where, `share editor ${whyEd}`);
      const nameEd = first.locator(`[data-dg-editor][data-col="name"] input`);
      const whyName = await nameEd.evaluate(VISIBLE);
      if (whyName) fail(where, `name editor ${whyName}`);
      if ((await overflow(page)) > 0) fail(where, "page scrolls sideways while editing");
      if (SHOTS) await auto.screenshot({ path: `${SHOTS}/dg-${width}-${lang}-${theme}-editing.png` });
      await editor.fill("45");
      await editor.press("Tab");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(100);
      if (await first.locator("[data-dg-editor]").count()) fail(where, "still editing after Escape");
      const share = (await first.locator(`dd[data-col="share"]`).textContent())?.trim();
      if (share !== "45%") fail(where, `share after edit: ${share}`);
      const total = (await auto.locator("[data-total]").textContent())?.trim();
      if (!/115/.test(total ?? "")) fail(where, `total after edit: ${total}`);

      // add a row, then delete it from its ⋯ menu
      await auto.getByRole("button", { name: /^(Add Row|إضافة صف)$/ }).click();
      const n2 = await auto.locator("[data-card]").count();
      if (n2 !== a.n + 1) fail(where, `add row: ${n2} cards`);
      if ((await overflow(page)) > 0) fail(where, "page scrolls sideways after Add Row");
      await auto.getByRole("button", { name: new RegExp(`^(Row ${n2} actions|إجراءات الصف ${n2})$`) }).click();
      const del = page.getByRole("menuitem", { name: /^(Delete|حذف)$/ });
      await del.waitFor();
      await page.waitForTimeout(300); // the menu settles (open animation / collision placement)
      const whyDel = await del.evaluate(VISIBLE);
      if (whyDel) fail(where, `row menu Delete ${whyDel}`);
      if (SHOTS && width === 390) await page.screenshot({ path: `${SHOTS}/dg-${width}-${lang}-${theme}-menu.png` });
      await del.click();
      await page.waitForTimeout(150);
      const n3 = await auto.locator("[data-card]").count();
      if (n3 !== a.n) fail(where, `delete row: ${n3} cards`);

      if (errors.length) fail(where, errors.join(" | "));
      console.log(`  ${failures.some((f) => f.startsWith(where)) ? "✖" : "✔"} page overflow ${o}px · auto ${a.n} cards (${a.checked} values visible) · cards ${c.n} cards (${c.checked} values visible) · table ${tbl.scrolls ? "scrolls inside its frame (opt-in)" : "fits"} · edit / add / delete ok`);
      await ctx.close();
    }
  }
}

// 2. Desktop: the auto grid is a table at full width and cards in the narrow column (its container, not the window)
for (const lang of ["en", "ar"]) {
  const where = `1280px ${lang}`;
  console.log(`• ${where}`);
  const { ctx, page, errors } = await open("light", lang, { width: 1280, height: 900 });
  const auto = page.locator(`[data-testid="dg-auto"] [data-layout]`).first();
  const l1 = await auto.getAttribute("data-layout");
  if (l1 !== "table") fail(where, `auto at full width: ${l1}`);
  await page.getByRole("button", { name: /^(Narrow column|عمود ضيّق)/ }).click();
  await page.waitForTimeout(200);
  const l2 = await auto.getAttribute("data-layout");
  if (l2 !== "cards") fail(where, `auto in the narrow column: ${l2}`);
  if (SHOTS) await page.locator(`[data-testid="dg-auto"]`).screenshot({ path: `${SHOTS}/dg-1280-${lang}-narrow.png` });
  if ((await overflow(page)) > 0) fail(where, "page scrolls sideways");
  if (errors.length) fail(where, errors.join(" | "));
  console.log(`  ${failures.some((f) => f.startsWith(where)) ? "✖" : "✔"} auto: ${l1} at full width → ${l2} in a 352 px column`);
  await ctx.close();
}

await browser.close();
console.log(failures.length ? `\n${failures.length} failure(s)` : "\nall checks passed");
process.exit(failures.length ? 1 : 0);
