/**
 * Showcase smoke test (the one-page site). Every section × light/dark × English/Arabic opens from its address with no
 * page errors and no console errors; <html> carries the theme and direction; nothing scrolls sideways (desktop and
 * phone); the site's browsing works (sections collapsed by default, the section toggle, the collapsible rail, the
 * header turning into a pill, the phone menu); and the interactive examples work. Run against a built showcase:
 *   npm run showcase:build && npm run showcase:preview    # http://127.0.0.1:4850/
 *   node e2e/showcase-smoke.mjs [baseUrl] [screenshotDir]
 */
import fs from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:4850/";
const SHOTS = process.argv[3];
const PAGES = [...fs.readFileSync(new URL("../showcase/src/routes.ts", import.meta.url), "utf8")
  .matchAll(/\{ id: "([a-z-]+)", title: [^\n]*Component: from\(/g)].map((m) => m[1]);
const HERO = "overview";
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const failures = [];
const fail = (where, what) => failures.push(`${where}: ${what}`);
const browser = await chromium.launch();

async function open(theme, lang, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce" });
  await ctx.addInitScript(([t, l]) => {
    if (!location.protocol.startsWith("http")) return; // about:blank, between fresh loads, has no storage
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

/** A fresh load at `#id`: only that section is open. Returns the section. */
async function go(page, id) {
  await page.goto("about:blank");
  await page.goto(`${BASE}#${id}`);
  const sec = page.locator(`#${id}`);
  await sec.locator(id === HERO ? "h3" : `#${id}-content h3`).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(250);
  return sec;
}

const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// 1. Every section, four combinations.
for (const theme of ["light", "dark"]) {
  for (const lang of ["en", "ar"]) {
    const combo = `${theme}-${lang}`;
    const { ctx, page, errors } = await open(theme, lang);
    for (const id of PAGES) {
      const where = `${combo} #${id}`;
      errors.length = 0;
      try {
        const sec = await go(page, id);
        const s = await page.evaluate(() => ({
          dark: document.documentElement.classList.contains("dark"), dir: document.documentElement.dir, lang: document.documentElement.lang,
          current: document.querySelectorAll('nav a[aria-current="true"]').length,
          open: document.querySelectorAll('[id$="-content"]').length,
        }));
        if (s.dark !== (theme === "dark")) fail(where, `theme ${s.dark ? "dark" : "light"}`);
        if (s.dir !== (lang === "ar" ? "rtl" : "ltr") || s.lang !== lang) fail(where, `dir ${s.dir} lang ${s.lang}`);
        const over = await overflow(page);
        if (over > 0) fail(where, `horizontal overflow ${over}px`);
        if (s.current !== 1) fail(where, `${s.current} current nav items`);
        if (s.open !== (id === HERO ? 0 : 1)) fail(where, `${s.open} sections open (expected only this one)`);
        const box = await sec.boundingBox();
        const atEnd = await page.evaluate(() => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2);
        if (!box || box.y < 0 || (box.y > 200 && !atEnd)) fail(where, `section not scrolled into view (top ${box && Math.round(box.y)})`);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${combo}-${id}.png` });
      } catch (e) { fail(where, e.message.split("\n")[0]); }
      for (const e of errors) fail(where, e);
    }
    await ctx.close();
  }
}

// 2. Browsing and the interactive examples, in light-en and dark-ar.
for (const [theme, lang] of [["light", "en"], ["dark", "ar"]]) {
  const ar = lang === "ar";
  const T = (en, a) => (ar ? a : en);
  const { ctx, page, errors } = await open(theme, lang);
  const check = async (name, fn) => {
    errors.length = 0;
    try { await fn(); } catch (e) { fail(`${theme}-${lang} ${name}`, e.message.split("\n")[0]); }
    for (const e of errors) fail(`${theme}-${lang} ${name}`, e);
  };
  const home = async () => { await page.goto("about:blank"); await page.goto(BASE); await page.locator(`#${HERO} h3`).first().waitFor(); };

  await check("collapsed by default; the toggle opens and closes", async () => {
    await home();
    if (await page.locator('[id$="-content"]').count()) throw new Error("a section is open on a plain load");
    await page.locator("#badge").getByRole("button", { name: T("Expand section", "توسيع القسم") }).click();
    await page.locator("#badge-content h3").first().waitFor();
    await page.locator("#badge").getByRole("button", { name: T("Collapse section", "طيّ القسم") }).click();
    await page.locator("#badge-content").waitFor({ state: "detached" });
  });
  await check("header turns into a pill on scroll", async () => {
    await home();
    if (await page.locator("header .rounded-full.sf-glass-pane").count()) throw new Error("pill before scrolling");
    await page.mouse.wheel(0, 600);
    await page.locator("header .rounded-full.sf-glass-pane").waitFor();
  });
  await check("rail collapses to icons and expands", async () => {
    await home();
    const aside = page.locator("aside");
    if ((await aside.boundingBox()).width < 100) await page.getByRole("button", { name: T("Expand sidebar", "توسيع الشريط الجانبي") }).click();
    await page.getByRole("button", { name: T("Collapse sidebar", "طيّ الشريط الجانبي") }).click();
    await page.waitForTimeout(300);
    if ((await aside.boundingBox()).width > 80) throw new Error("rail did not collapse");
    await page.getByRole("button", { name: T("Expand sidebar", "توسيع الشريط الجانبي") }).click();
    await page.waitForTimeout(300);
    if ((await aside.boundingBox()).width < 200) throw new Error("rail did not expand");
  });
  await check("sidebar link opens its section", async () => {
    await home();
    await page.locator("aside nav").getByRole("link", { name: T("Sheet", "اللوحة الجانبية") }).click();
    await page.locator("#sheet-content h3").first().waitFor();
    if (!page.url().endsWith("#sheet")) throw new Error(page.url());
  });
  await check("old #/page address still opens the section", async () => {
    await page.goto("about:blank"); await page.goto(`${BASE}#/calendar`);
    await page.locator("#calendar-content h3").first().waitFor();
  });

  await check("radio group", async () => {
    const sec = await go(page, "radio-group");
    await sec.getByText(T("Yearly — save 20%", "سنوي — وفّر 20%")).click();
    await sec.getByText('value: "yearly"').waitFor();
    if (!(await sec.getByRole("radio", { name: T("Lifetime (not available)", "مدى الحياة (غير متاح)") }).isDisabled())) throw new Error("disabled radio is enabled");
  });
  await check("table", async () => {
    const sec = await go(page, "table");
    const example = sec.locator("table").first();             // the second table is the props reference
    if ((await example.locator("tbody tr").count()) !== 4) throw new Error("expected 4 rows");
    await sec.locator("tfoot").getByText("1200.00").waitFor();
  });
  await check("toast", async () => {
    const sec = await go(page, "toast");
    await sec.getByRole("button", { name: T("Show a toast", "إظهار تنبيه") }).click();
    const li = page.locator('[data-sonner-toast][data-mounted="true"]');
    await li.first().waitFor();
    const pos = await page.locator("[data-sonner-toaster]").first().getAttribute("data-x-position");
    if (pos !== (ar ? "left" : "right")) throw new Error(`toast on the ${pos}`);
  });
  await check("stepper", async () => {
    const sec = await go(page, "stepper");
    const current = () => sec.locator('li[aria-current="step"]').first().innerText();
    const before = await current();
    await sec.getByRole("button", { name: T("Next", "التالي") }).click();
    if ((await current()) === before) throw new Error("Next did not move the current step");
  });
  await check("stat cards", async () => {
    const sec = await go(page, "stat-cards");
    if ((await sec.locator(".sf-glass--lg").count()) < 4) throw new Error("StatCards missing");
    await sec.getByRole("button", { name: new RegExp(T("Field Library", "مكتبة الحقول")) }).click();
    await sec.getByText("onClick → field_library").waitFor();
  });
  await check("tabs", async () => {
    const sec = await go(page, "tabs");
    await sec.getByRole("tab", { name: T("Fields", "الحقول") }).first().click();
    await sec.getByText(T("11 fields in 3 sections.", "11 حقلاً في 3 أقسام.")).waitFor();
  });
  await check("dialog", async () => {
    const sec = await go(page, "dialog");
    await sec.getByRole("button", { name: T("Rename", "إعادة التسمية") }).click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
  });
  await check("alert-dialog", async () => {
    const sec = await go(page, "alert-dialog");
    await sec.getByRole("button", { name: T("Delete", "حذف") }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: T("Delete", "حذف") }).click();
    await page.getByRole("alertdialog").waitFor({ state: "detached" });
    await sec.getByText(/1$/).first().waitFor();
  });
  await check("sheet opens from the reading end", async () => {
    const sec = await go(page, "sheet");
    await sec.getByRole("button", { name: T("End", "النهاية") }).click();
    await page.waitForTimeout(400);
    const b = await page.getByRole("dialog").boundingBox();
    const atRight = b.x + b.width >= 1440 - 2;
    if (atRight === ar) throw new Error(`end sheet at x=${Math.round(b.x)} (${ar ? "expected left" : "expected right"})`);
    await page.keyboard.press("Escape");
  });
  await check("popover", async () => {
    const sec = await go(page, "popover");
    await sec.getByRole("button", { name: T("Dimensions", "الأبعاد") }).click();
    await page.getByRole("dialog").getByText(T("Card size", "حجم البطاقة")).waitFor();
    await page.keyboard.press("Escape");
  });
  await check("dropdown checkbox + radio", async () => {
    const sec = await go(page, "dropdown-menu");
    await sec.getByRole("button", { name: T("More", "المزيد") }).click();
    await page.getByRole("menuitemcheckbox").click();
    await sec.getByText("compact: true").waitFor();
    await sec.getByRole("button", { name: T("More", "المزيد") }).click();
    await page.getByRole("menuitemradio", { name: T("Name", "الاسم") }).click();
    await sec.getByText("sort: name").waitFor();
  });
  await check("command palette (Ctrl+K)", async () => {
    const sec = await go(page, "command");
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog").waitFor();
    await page.keyboard.type(ar ? "تقويم" : "calendar");
    await page.keyboard.press("Enter");
    await sec.getByText("picked: new-calendar").waitFor();
  });
  await check("calendar: three glass calendars", async () => {
    const sec = await go(page, "calendar");
    if ((await sec.locator(".rdp-root.sf-calendar").count()) < 3) throw new Error("calendars missing");
  });
  await check("date field picks a day", async () => {
    const sec = await go(page, "date-time-fields");
    await sec.locator("#sc-date").click();
    const grid = page.getByRole("grid");
    await grid.waitFor();
    await grid.locator("button:not([disabled])").filter({ hasText: /^(20|٢٠)$/ }).first().click();
    await sec.getByText(/date: "2026-10-20"/).waitFor();
  });
  await check("list view search + rows", async () => {
    const sec = await go(page, "list-view");
    const rows = sec.locator("tbody tr");
    await rows.first().waitFor();
    const before = await rows.count();
    await sec.getByRole("textbox").first().fill("zzzz-nothing");
    await page.waitForTimeout(400);
    const after = await rows.count();
    if (!(before > 1 && after < before)) throw new Error(`search did not narrow rows (${before} → ${after})`);
  });
  await check("list features: select all shows the bulk bar", async () => {
    const sec = await go(page, "list-features");
    await sec.locator("tbody tr").first().waitFor();
    await sec.getByRole("checkbox").first().click();
    await sec.getByRole("button", { name: T("Export", "تصدير") }).waitFor();
  });
  await check("filters → frappe", async () => {
    const sec = await go(page, "filters");
    await sec.getByText("Suite 201").waitFor();
    await sec.getByRole("button", { name: /^(Filter|تصفية)/ }).click();
    if ((await page.getByRole("dialog").getByRole("combobox").count()) < 4) throw new Error("filter popover shows no conditions");
    await page.keyboard.press("Escape");
    await sec.getByText('"filters"').waitFor();
  });
  await check("frappe list (simulated) + error", async () => {
    const sec = await go(page, "frappe-list");
    await sec.locator("tbody tr").first().waitFor({ timeout: 10_000 });
    await sec.getByText(/permission/i).first().waitFor({ timeout: 10_000 });
  });
  await check("shell parts", async () => {
    const sec = await go(page, "shell-parts");
    await sec.getByRole("button", { name: T("Open menu", "فتح القائمة") }).click();
    await page.getByRole("menu").waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("menu").waitFor({ state: "detached" });
    await sec.locator("button:has(svg.lucide-bell)").click();
    await page.getByText(T("Notifications", "الإشعارات")).first().waitFor();
  });
  await check("app shell (embedded + full screen)", async () => {
    await go(page, "app-shell");
    await page.frameLocator("#app-shell iframe").getByText("currentPath:").waitFor({ timeout: 15_000 });
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

// 3. Phone width: no sideways scroll; the menu drawer opens from the start edge and opens a section.
{
  const { ctx, page, errors } = await open("light", "ar", { width: 390, height: 844 });
  for (const id of PAGES) {
    errors.length = 0;
    try {
      await go(page, id);
      const over = await overflow(page);
      if (over > 0) fail(`phone-ar #${id}`, `horizontal overflow ${over}px`);
      if (SHOTS && ["overview", "list-view", "frappe-list", "date-time-fields"].includes(id)) await page.screenshot({ path: `${SHOTS}/phone-ar-${id}.png` });
    } catch (e) { fail(`phone-ar #${id}`, e.message.split("\n")[0]); }
    for (const e of errors) fail(`phone-ar #${id}`, e);
  }
  try {
    await page.goto("about:blank"); await page.goto(BASE);
    await page.locator(`#${HERO} h3`).first().waitFor();
    await page.getByRole("button", { name: "القائمة" }).click();
    await page.waitForTimeout(400);
    const b = await page.getByRole("dialog").boundingBox();
    if (b.x + b.width < 390 - 2) throw new Error(`menu sheet not at the start (right) edge: x=${Math.round(b.x)}`);
    await page.getByRole("dialog").getByRole("link", { name: "التقويم" }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    await page.locator("#calendar-content h3").first().waitFor();
    if (!page.url().endsWith("#calendar")) throw new Error(page.url());
  } catch (e) { fail("phone-ar menu", e.message.split("\n")[0]); }
  await ctx.close();
}

await browser.close();
console.log(`${PAGES.length} sections × 4 combinations + browsing + interactions + phone`);
if (failures.length) { console.log(`FAIL (${failures.length})\n` + failures.join("\n")); process.exit(1); }
console.log("PASS");
