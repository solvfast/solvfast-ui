/**
 * Showcase smoke test: every page × light/dark × English/Arabic loads with no page errors and no console errors,
 * <html> carries the theme and direction, nothing scrolls sideways (desktop and phone), and the interactive examples
 * work. Run against a built showcase:
 *   npm run showcase:build && npm run showcase:preview    # http://127.0.0.1:4850/
 *   node e2e/showcase-smoke.mjs [baseUrl] [screenshotDir]
 */
import fs from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:4850/";
const SHOTS = process.argv[3];
const PAGES = [...fs.readFileSync(new URL("../showcase/src/routes.ts", import.meta.url), "utf8")
  .matchAll(/\{ id: "([a-z-]+)", title: [^\n]*Component: from\(/g)].map((m) => m[1]);
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const failures = [];
const fail = (where, what) => failures.push(`${where}: ${what}`);
const browser = await chromium.launch();

async function open(theme, lang, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce" });
  await ctx.addInitScript(([t, l]) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("sfui-showcase-theme", t); localStorage.setItem("sfui-showcase-lang", l);
      sessionStorage.setItem("seeded", "1");
    }
  }, [theme, lang]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console ${m.text()}`); });
  return { ctx, page, errors };
}

async function go(page, id) {
  await page.goto(`${BASE}#/${id}`);
  await page.locator("main h1").waitFor();
  await page.locator("main section h2").first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(250);
}

// 1. Every page, four combinations.
for (const theme of ["light", "dark"]) {
  for (const lang of ["en", "ar"]) {
    const combo = `${theme}-${lang}`;
    const { ctx, page, errors } = await open(theme, lang);
    for (const id of PAGES) {
      const where = `${combo} #/${id}`;
      errors.length = 0;
      try {
        await go(page, id);
        const s = await page.evaluate(() => ({
          dark: document.documentElement.classList.contains("dark"), dir: document.documentElement.dir,
          lang: document.documentElement.lang, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          active: document.querySelector('nav a[aria-current="page"]')?.getAttribute("href"),
        }));
        if (s.dark !== (theme === "dark")) fail(where, `theme ${s.dark ? "dark" : "light"}`);
        if (s.dir !== (lang === "ar" ? "rtl" : "ltr") || s.lang !== lang) fail(where, `dir ${s.dir} lang ${s.lang}`);
        if (s.overflow > 0) fail(where, `horizontal overflow ${s.overflow}px`);
        if (s.active !== `#/${id}`) fail(where, `sidebar active ${s.active}`);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${combo}-${id}.png` });
      } catch (e) { fail(where, e.message.split("\n")[0]); }
      for (const e of errors) fail(where, e);
    }
    await ctx.close();
  }
}

// 2. Interactions, in light-en and dark-ar.
for (const [theme, lang] of [["light", "en"], ["dark", "ar"]]) {
  const ar = lang === "ar";
  const T = (en, a) => (ar ? a : en);
  const { ctx, page, errors } = await open(theme, lang);
  const check = async (name, fn) => {
    errors.length = 0;
    try { await fn(); } catch (e) { fail(`${theme}-${lang} ${name}`, e.message.split("\n")[0]); }
    for (const e of errors) fail(`${theme}-${lang} ${name}`, e);
  };
  const main = page.locator("main");

  await check("stat cards", async () => {
    await go(page, "stat-cards");
    if ((await main.locator(".sf-glass--lg").count()) < 4) throw new Error("StatCards missing");
    await main.getByRole("button", { name: new RegExp(T("Field Library", "مكتبة الحقول")) }).click();
    await main.getByText("onClick → field_library").waitFor();
  });
  await check("dialog", async () => {
    await go(page, "dialog");
    await main.getByRole("button", { name: T("Rename", "إعادة التسمية") }).click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
  });
  await check("alert-dialog", async () => {
    await go(page, "alert-dialog");
    await main.getByRole("button", { name: T("Delete", "حذف") }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: T("Delete", "حذف") }).click();
    await page.getByRole("alertdialog").waitFor({ state: "detached" });
    await main.getByText(/1$/).first().waitFor();
  });
  await check("sheet opens from the reading end", async () => {
    await go(page, "sheet");
    await main.getByRole("button", { name: T("End", "النهاية") }).click();
    await page.waitForTimeout(400);
    const b = await page.getByRole("dialog").boundingBox();
    const atRight = b.x + b.width >= 1440 - 2;
    if (atRight === ar) throw new Error(`end sheet at x=${Math.round(b.x)} (${ar ? "expected left" : "expected right"})`);
    await page.keyboard.press("Escape");
  });
  await check("popover", async () => {
    await go(page, "popover");
    await main.getByRole("button", { name: T("Dimensions", "الأبعاد") }).click();
    await page.getByRole("dialog").getByText(T("Card size", "حجم البطاقة")).waitFor();
    await page.keyboard.press("Escape");
  });
  await check("dropdown checkbox + radio", async () => {
    await go(page, "dropdown-menu");
    await main.getByRole("button", { name: T("More", "المزيد") }).click();
    await page.getByRole("menuitemcheckbox").click();
    await main.getByText("compact: true").waitFor();
    await main.getByRole("button", { name: T("More", "المزيد") }).click();
    await page.getByRole("menuitemradio", { name: T("Name", "الاسم") }).click();
    await main.getByText("sort: name").waitFor();
  });
  await check("command palette (Ctrl+K)", async () => {
    await go(page, "command");
    await page.keyboard.press("Control+k");
    const dlg = page.getByRole("dialog");
    await dlg.waitFor();
    await page.keyboard.type(ar ? "تقويم" : "calendar");
    await page.keyboard.press("Enter");
    await main.getByText("picked: new-calendar").waitFor();
  });
  await check("calendar range", async () => {
    await go(page, "calendar");
    if ((await main.locator(".rdp-month_grid, table[role=grid], [role=grid]").count()) < 3) throw new Error("calendars missing");
  });
  await check("date field picks a day", async () => {
    await go(page, "date-time-fields");
    await main.locator("#sc-date").click();
    const grid = page.getByRole("grid");
    await grid.waitFor();
    await grid.locator("button:not([disabled])").filter({ hasText: /^(20|٢٠)$/ }).first().click();
    await main.getByText(/date: "2026-10-20"/).waitFor();
  });
  await check("list view search + rows", async () => {
    await go(page, "list-view");
    const rows = main.locator("tbody tr");
    await rows.first().waitFor();
    const before = await rows.count();
    await main.getByRole("textbox").first().fill("zzzz-nothing");
    await page.waitForTimeout(400);
    const after = await rows.count();
    if (!(before > 1 && after < before)) throw new Error(`search did not narrow rows (${before} → ${after})`);
  });
  await check("list features: select all shows the bulk bar", async () => {
    await go(page, "list-features");
    await main.locator("tbody tr").first().waitFor();
    await main.getByRole("checkbox").first().click();
    await main.getByRole("button", { name: T("Export", "تصدير") }).waitFor();
  });
  await check("filters → frappe", async () => {
    await go(page, "filters");
    await main.getByText("Suite 201").waitFor();
    await main.getByRole("button", { name: /^(Filter|تصفية)/ }).click();
    const pop = page.getByRole("dialog");
    if ((await pop.getByRole("combobox").count()) < 4) throw new Error("filter popover shows no conditions");
    await page.keyboard.press("Escape");
    await main.getByText('"filters"').waitFor();
    await main.getByText(/"suite"/).waitFor();
  });
  await check("frappe list (simulated) + error", async () => {
    await go(page, "frappe-list");
    await main.locator("tbody tr").first().waitFor({ timeout: 10_000 });
    await main.getByText(/permission/i).first().waitFor({ timeout: 10_000 });
  });
  await check("shell parts", async () => {
    await go(page, "shell-parts");
    await main.getByRole("button", { name: T("Open menu", "فتح القائمة") }).click();
    await page.getByRole("menu").waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("menu").waitFor({ state: "detached" });
    await main.locator("button:has(svg.lucide-bell)").click();
    await page.getByText(T("Notifications", "الإشعارات")).first().waitFor();
  });
  await check("app shell (embedded + full screen)", async () => {
    await go(page, "app-shell");
    const frame = page.frameLocator("main iframe");
    await frame.getByText("currentPath:").waitFor({ timeout: 15_000 });
    await page.goto(`${BASE}#/demo/app-shell`);
    await page.getByText("currentPath:").waitFor();
    await page.getByRole("button", { name: T("Field Library", "مكتبة الحقول") }).first().click();
    await page.getByText(/currentPath: .*field_library/).waitFor();
  });
  await check("theme + language toggles", async () => {
    await go(page, "button");
    await page.getByRole("button", { name: T("Toggle theme", "تبديل السمة") }).click();
    if ((await page.evaluate(() => document.documentElement.classList.contains("dark"))) === (theme === "dark")) throw new Error("theme did not toggle");
    await page.getByRole("button", { name: T("Switch to Arabic", "التبديل إلى الإنجليزية") }).click();
    if ((await page.evaluate(() => document.documentElement.dir)) === (ar ? "rtl" : "ltr")) throw new Error("direction did not toggle");
  });
  await ctx.close();
}

// 3. Phone width: no sideways scroll, the menu sheet navigates.
{
  const { ctx, page, errors } = await open("light", "ar", { width: 390, height: 844 });
  for (const id of PAGES) {
    errors.length = 0;
    try {
      await go(page, id);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 0) fail(`phone-ar #/${id}`, `horizontal overflow ${overflow}px`);
      if (SHOTS && ["overview", "list-view", "frappe-list", "date-time-fields"].includes(id)) await page.screenshot({ path: `${SHOTS}/phone-ar-${id}.png`, fullPage: false });
    } catch (e) { fail(`phone-ar #/${id}`, e.message.split("\n")[0]); }
    for (const e of errors) fail(`phone-ar #/${id}`, e);
  }
  try {
    await go(page, "overview");
    await page.getByRole("button", { name: "القائمة" }).click();
    await page.waitForTimeout(400);
    const b = await page.getByRole("dialog").boundingBox();
    if (b.x + b.width < 390 - 2) throw new Error(`menu sheet not at the start (right) edge: x=${Math.round(b.x)}`);
    await page.getByRole("dialog").getByRole("link", { name: "التقويم" }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    if (!page.url().endsWith("#/calendar")) throw new Error(page.url());
  } catch (e) { fail("phone-ar menu", e.message.split("\n")[0]); }
  await ctx.close();
}

await browser.close();
console.log(`${PAGES.length} pages × 4 combinations + interactions + phone`);
if (failures.length) { console.log(`FAIL (${failures.length})\n` + failures.join("\n")); process.exit(1); }
console.log("PASS");
