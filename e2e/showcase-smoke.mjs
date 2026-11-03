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
  // 0.3.0 — merged components
  await check("toggle + toggle group", async () => {
    const sec = await go(page, "toggle");
    const bold = sec.getByRole("button", { name: T("Bold", "عريض") }).first();
    await bold.click();
    if ((await bold.getAttribute("aria-pressed")) !== "true") throw new Error("toggle not pressed");
    await sec.getByRole("radio", { name: T("Center", "الوسط") }).click();
    await sec.getByText('align: "center"').waitFor();
  });
  await check("slider: arrow keys follow the reading direction", async () => {
    const sec = await go(page, "slider");
    await sec.getByRole("slider").focus();
    await page.keyboard.press(ar ? "ArrowLeft" : "ArrowRight");
    await sec.getByText("value: 51").waitFor();
  });
  await check("progress fills from the reading start", async () => {
    const sec = await go(page, "progress");
    const bar = await sec.getByRole("progressbar").boundingBox();
    const fill = await sec.getByRole("progressbar").locator("div").first().boundingBox();
    // the indicator is the full width, translated: its visible part touches the right edge iff it moved right
    const fromRight = fill.x > bar.x + 1;
    if (fromRight !== ar) throw new Error(`fill anchored ${fromRight ? "right" : "left"}`);
  });
  await check("accordion + collapsible", async () => {
    const sec = await go(page, "accordion");
    await sec.getByRole("button", { name: T("Who can see this project?", "من يمكنه رؤية هذا المشروع؟") }).click();
    await sec.getByText(T("Members of the project team and its sponsors.", "أعضاء فريق المشروع ورعاته.")).waitFor();
    await sec.getByRole("button", { name: T("Show 3 more", "عرض 3 أخرى") }).click();
    await sec.getByText("INV-006").waitFor();
  });
  await check("search combobox: loads, searches, picks", async () => {
    const sec = await go(page, "search-combobox");
    await sec.getByRole("combobox").click();
    await page.getByRole("status").waitFor();                       // loading, not "empty"
    await page.getByRole("option", { name: /solvfast\/docs/ }).waitFor();
    await page.getByPlaceholder(T("Search repositories…", "ابحث في المستودعات…")).fill("api");
    await page.waitForFunction(() => document.querySelectorAll('[role="option"]').length === 1);
    await page.getByRole("option", { name: /solvfast\/api/ }).click();
    await sec.getByText('value: "solvfast/api"').waitFor();
    if (!(await sec.getByRole("combobox").innerText()).includes("solvfast/api")) throw new Error("trigger does not show the value");
  });
  await check("rich text: toolbar works, untrusted HTML runs nothing", async () => {
    const sec = await go(page, "rich-text");
    const xss = await page.evaluate(() => window.__sfXss);
    if (xss !== undefined) throw new Error(`XSS payload ran (__sfXss=${xss})`);
    const out = await sec.getByTestId("rte-xss").innerHTML();
    if (/onerror|javascript:|<script|<img/i.test(out)) throw new Error(`unsanitized output: ${out}`);
    const box = sec.getByRole("textbox", { name: T("Description", "الوصف") });
    await box.click();
    await page.keyboard.press("Control+End");
    await sec.getByRole("button", { name: T("Bold", "عريض") }).click();
    await page.keyboard.type("Z9");
    await page.waitForFunction(() => /<b>Z9<\/b>|<strong>Z9<\/strong>/.test(document.querySelector('[data-testid="rte-html"]')?.textContent ?? ""));
  });
  await check("form: validation message, then submit", async () => {
    const sec = await go(page, "form");
    await sec.getByRole("button", { name: T("Save", "حفظ") }).click();
    await sec.getByText(T("Name is required", "الاسم مطلوب")).waitFor();
    const name = sec.getByRole("textbox", { name: T("Name", "الاسم") });
    if ((await name.getAttribute("aria-invalid")) !== "true") throw new Error("field not marked invalid");
    await name.fill("Rana");
    await sec.getByRole("button", { name: T("Save", "حفظ") }).click();
    await sec.getByText('submitted: {"name":"Rana","email":""}').waitFor();
  });
  await check("chart: bars and lines render", async () => {
    const sec = await go(page, "chart");
    await sec.locator(".recharts-surface").first().waitFor();
    if ((await sec.locator(".recharts-bar-rectangle").count()) < 12) throw new Error("bars missing");
    if ((await sec.locator(".recharts-line-curve").count()) < 2) throw new Error("lines missing");
  });
  await check("hover card", async () => {
    const sec = await go(page, "hover-card");
    await sec.getByText("@rana").hover();
    const card = page.getByText(T("Project manager · 12 open tasks", "مديرة مشاريع · 12 مهمة مفتوحة"));
    await card.waitFor();
    if (!(await card.evaluate((el) => !!el.closest(".sf-popper")))) throw new Error("no sf-popper");
  });
  await check("context menu + sub-menu", async () => {
    const sec = await go(page, "context-menu");
    await sec.getByTestId("ctx-area").click({ button: "right" });
    await page.getByRole("menu").waitFor();
    await page.getByRole("menuitem", { name: T("Move to", "نقل إلى") }).hover();
    await page.getByRole("menuitem", { name: T("Current sprint", "الدورة الحالية") }).click();
    await sec.getByText("picked: sprint").waitFor();
  });
  await check("menubar", async () => {
    const sec = await go(page, "menubar");
    await sec.getByRole("menuitem", { name: T("File", "ملف") }).click();
    await page.getByRole("menuitem", { name: T("Print", "طباعة") }).click();
    await sec.getByText("picked: print").waitFor();
  });
  await check("breadcrumb", async () => {
    const sec = await go(page, "breadcrumb");
    await sec.getByRole("navigation", { name: T("Breadcrumb", "مسار التنقل") }).waitFor();
  });
  await check("pagination", async () => {
    const sec = await go(page, "pagination");
    await sec.getByRole("link", { name: T("Next page", "الصفحة التالية") }).click();
    await sec.getByText("page: 3").waitFor();
    if ((await sec.getByRole("link", { name: "3" }).getAttribute("aria-current")) !== "page") throw new Error("aria-current did not move");
  });
  await check("navigation menu", async () => {
    const sec = await go(page, "navigation-menu");
    await sec.getByRole("button", { name: T("Projects", "المشاريع") }).click();
    const link = page.getByRole("link", { name: new RegExp(T("All projects", "كل المشاريع")) });
    await link.waitFor();
    if (!(await link.evaluate((el) => !!el.closest(".sf-popper")))) throw new Error("viewport without sf-popper");
  });
  await check("page header: back, editable title, title in the shell's top bar", async () => {
    const sec = await go(page, "page-header");
    await sec.getByRole("button", { name: T("Back", "رجوع") }).first().click();
    await sec.getByText("onBack: back").waitFor();
    await sec.getByRole("button", { name: T("Website redesign", "إعادة تصميم الموقع") }).first().click();
    const box = sec.getByRole("textbox", { name: T("Edit title", "تعديل العنوان") });
    await box.fill("Q4 launch");
    await box.press("Enter");
    await sec.getByText('title: "Q4 launch"').waitFor();
    const frame = page.frameLocator("#page-header iframe");
    await frame.getByText("PRJ-0042").waitFor({ timeout: 15_000 });
    const h1 = await frame.locator("h1").allInnerTexts();
    if (h1.length !== 1 || h1[0] !== T("Website redesign", "إعادة تصميم الموقع")) throw new Error(`frame h1s: ${JSON.stringify(h1)}`);
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
  // Phase 26 — the Frappe layer group (simulated site). Each section: open, drive its main controls, read the outcome.
  await check("frappe gallery: cards link to sections", async () => {
    const sec = await go(page, "frappe-gallery");
    if ((await sec.getByRole("link", { name: T("Open section", "فتح القسم") }).count()) < 15) throw new Error("gallery cards missing");
    if (!(await sec.getByRole("note").first().isVisible())) throw new Error("status strip missing");
  });
  await check("frappe list view: scenarios, session, realtime event, bulk bar", async () => {
    const sec = await go(page, "frappe-list-view");
    await sec.locator("tbody tr").first().waitFor({ timeout: 10_000 });
    await sec.getByRole("button", { name: T("Simulate server event (list_update)", "محاكاة حدث من الخادم (list_update)") }).click();
    await sec.getByText(/realtime: list_update/).waitFor();
    await page.waitForFunction(() => /Server event #1/.test(document.querySelector("#frappe-list-view-content tbody")?.textContent ?? ""), null, { timeout: 5000 });
    await sec.getByRole("checkbox").nth(1).click();
    await sec.getByRole("button", { name: T("Delete", "حذف") }).first().waitFor();          // bulk bar (System Manager)
    await sec.getByRole("radio", { name: /Sales User/ }).click();
    await sec.locator("tbody tr").first().waitFor({ timeout: 10_000 });
    await sec.getByRole("checkbox").nth(1).click();
    await page.waitForTimeout(300);
    if (await sec.getByRole("button", { name: T("Delete", "حذف") }).count()) throw new Error("bulk Delete offered without the right");
    const scenario = sec.locator(`[aria-label="${T("Scenario", "السيناريو")}"]`);
    await scenario.getByRole("radio", { name: T("Empty", "فارغ"), exact: true }).click();
    await sec.getByText(T("You haven't created a ToDo yet", "لم تُنشئ ToDo بعد")).first().waitFor({ timeout: 10_000 });
    await scenario.getByRole("radio", { name: /403/ }).click();
    await sec.getByText(T("Not permitted", "غير مسموح")).first().waitFor({ timeout: 10_000 });
    await scenario.getByRole("radio", { name: T("Loading", "جارٍ التحميل") }).click();
    await page.waitForTimeout(500);
    const skeletonRows = await sec.locator("tbody tr").count();
    if (!skeletonRows || (await sec.locator("tbody").innerText()).trim() !== "") throw new Error(`no loading skeleton (${skeletonRows} rows)`);
  });
  await check("frappe forms: new ToDo mandatory, Travel Request depends_on, 403, 417", async () => {
    const sec = await go(page, "frappe-forms");
    const main = sec.getByTestId("forms-main");
    const scenario = sec.locator(`[aria-label="${T("Scenario", "السيناريو")}"]`);
    await main.getByRole("button", { name: T("Save", "حفظ") }).first().waitFor({ timeout: 10_000 });
    await scenario.getByRole("radio", { name: /New ToDo|مهمة جديدة/ }).click();
    await main.getByRole("button", { name: T("Save", "حفظ") }).first().click();
    await page.getByRole("dialog").waitFor({ timeout: 5000 });                                    // Missing Fields
    await page.keyboard.press("Escape");
    await scenario.getByRole("radio", { name: /New Travel Request|طلب سفر جديد/ }).click();
    const visa = main.getByText(/^Visa country/);
    await main.getByText(/^Needs a visa/).waitFor({ timeout: 10_000 });
    if (await visa.count()) throw new Error("depends_on field visible before its condition");
    await main.getByRole("checkbox", { name: /Needs a visa/ }).click();
    await visa.first().waitFor({ timeout: 5000 });
    await scenario.getByRole("radio", { name: /403/ }).click();
    await main.getByText(T("Not permitted", "غير مسموح")).first().waitFor({ timeout: 10_000 });
    await scenario.getByRole("radio", { name: /417/ }).click();
    const first = main.getByRole("textbox", { name: /First Name/ }).first();
    await first.waitFor({ timeout: 10_000 });
    await first.fill("Sarah");
    await first.press("Tab");
    await main.getByRole("button", { name: T("Save", "حفظ") }).first().click();
    await main.getByRole("button", { name: T("Reload", "إعادة التحميل") }).first().waitFor({ timeout: 10_000 });
  });
  // Phase 27 D — the seven SIMULATED permission scenarios drive the client session and the simulator's server-side evaluation
  const permissionPicker = (demo) => demo.locator(`[aria-label="${T("Permission scenario", "سيناريو الأذونات")}"]`);
  await check("frappe forms: permission scenarios — read-only form, forced save 403, restricted DocType 403", async () => {
    const sec = await go(page, "frappe-forms");
    const demo = sec.getByTestId("scenario-form-demo");
    const picker = permissionPicker(demo);
    if ((await picker.getByRole("radio").count()) !== 7) throw new Error("not seven scenarios");
    await demo.getByTestId("sim-permission-strip").waitFor();
    if (!/SIMULATED — in-browser simulator; permission decisions are the simulator's approximation of the Frappe server|محاكاة — محاكٍ داخل المتصفّح/.test(await demo.getByTestId("sim-permission-strip").innerText())) throw new Error("strip text");
    await picker.getByRole("radio", { name: T("Read-only role", "دور للقراءة فقط"), exact: true }).click();
    await demo.getByText("Riyadh offsite").first().waitFor({ timeout: 10_000 });
    await page.waitForTimeout(300);
    if (await demo.getByRole("button", { name: T("Save", "حفظ"), exact: true }).count()) throw new Error("Save offered without write");
    if (await demo.getByText(/^Internal notes/).count()) throw new Error("permlevel-1 field shown to the read-only role");
    await demo.getByTestId("forced-save").click();
    await demo.getByText(/savedocs TR-0001 → 403 PermissionError/).waitFor({ timeout: 5000 });
    await picker.getByRole("radio", { name: T("Restricted fields (permlevel 1)", "حقول مقيّدة (permlevel 1)"), exact: true }).click();
    await demo.getByRole("button", { name: T("Save", "حفظ"), exact: true }).first().waitFor({ timeout: 10_000 });   // level-0 write
    if (await demo.getByText(/^Internal notes/).count()) throw new Error("permlevel-1 field shown without level-1 read");
    await picker.getByRole("radio", { name: T("Restricted DocType", "نوع مستند مقيّد"), exact: true }).click();
    await demo.getByText(T("Not permitted", "غير مسموح")).first().waitFor({ timeout: 10_000 });
  });
  await check("frappe record: status chip, timeline, add a comment", async () => {
    const sec = await go(page, "frappe-record");
    await sec.getByRole("textbox").first().waitFor({ timeout: 15_000 });
    await sec.getByText(/changed the value|غيّر/).first().waitFor({ timeout: 10_000 });          // a Version line
    await sec.getByRole("textbox").first().fill("Smoke comment Q7");
    await sec.getByRole("button", { name: T("Comment", "تعليق") }).first().click();
    await sec.getByText("Smoke comment Q7").waitFor({ timeout: 10_000 });
  });
  await check("frappe workflow: stepper, Approve through the simulator, generic lifecycle", async () => {
    const sec = await go(page, "frappe-workflow");
    await sec.locator('li[aria-current="step"]').first().waitFor({ timeout: 15_000 });
    await sec.getByRole("button", { name: T("Actions", "الإجراءات") }).first().click();
    await page.getByRole("menuitem", { name: "Approve" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: T("Confirm", "تأكيد") }).click();
    await sec.getByText(/onApplied: Approve → Approved/).waitFor({ timeout: 10_000 });
    await sec.getByRole("button", { name: /Move to Proposal sent|نقل إلى أُرسل العرض/ }).click();
    await sec.getByText("onAction: proposal").waitFor();
  });
  await check("frappe assign: add through the simulator, generic picker, composer mention", async () => {
    const sec = await go(page, "frappe-assign");
    const add = sec.getByRole("button", { name: T("Add assignment", "إضافة إسناد") }).nth(1);   // FrappeAssignTo, list variant (names as text)
    await add.waitFor({ timeout: 10_000 });
    await add.click();
    const search = page.getByRole("combobox", { name: T("Search users…", "ابحث عن مستخدمين…") });
    await search.fill("omar");
    await page.getByRole("option", { name: /omar/i }).first().click();
    await page.getByRole("button", { name: T("Add", "إضافة"), exact: true }).last().click();
    await sec.getByText(/omar/i).first().waitFor({ timeout: 10_000 });
    const box = sec.getByRole("textbox").last();
    await box.fill("Ping @sar");
    await page.getByRole("option", { name: /Sara Q/ }).first().click();
    await box.press("Control+Enter");
    await sec.getByText(/data-id="sara@example.com"/).waitFor({ timeout: 5000 });
  });
  await check("frappe permissions: seven scenarios — rights beside the simulated server's answers, filtered list, rule-9 state", async () => {
    const sec = await go(page, "frappe-permissions");
    const demo = sec.getByTestId("scenario-permissions-demo");
    const picker = permissionPicker(demo);
    if ((await picker.getByRole("radio").count()) !== 7) throw new Error("not seven scenarios");
    await demo.getByTestId("sim-permission-strip").waitFor();
    const probe = demo.getByTestId("server-probe");
    await probe.getByText(/keys: name, purpose$/).waitFor({ timeout: 10_000 });               // read-only: permlevel column dropped
    if (!(await probe.innerText()).includes("403")) throw new Error("read-only role: no 403 from the simulated server");
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="scenario-list"] tbody tr').length === 3, null, { timeout: 10_000 });
    if (await demo.getByTestId("scenario-form").getByRole("button", { name: T("Save", "حفظ"), exact: true }).count()) throw new Error("read-only role offered Save");
    await picker.getByRole("radio", { name: T("User Permissions", "أذونات المستخدم"), exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="scenario-list"] tbody tr').length === 2 && /TR-0002, TR-0003/.test(document.querySelector('[data-testid="server-probe"]')?.textContent ?? ""), null, { timeout: 10_000 });
    await picker.getByRole("radio", { name: T("Restricted DocType", "نوع مستند مقيّد"), exact: true }).click();
    await demo.getByTestId("scenario-list").getByText(T("Not permitted", "غير مسموح")).first().waitFor({ timeout: 10_000 });
    await demo.getByTestId("scenario-form").getByText(T("Not permitted", "غير مسموح")).first().waitFor({ timeout: 10_000 });
    await picker.getByRole("radio", { name: T("Unknown roles", "أدوار مجهولة"), exact: true }).click();
    await demo.getByTestId("scenario-new-form").locator('[data-permissions="unknown"]').waitFor({ timeout: 10_000 });
    await picker.getByRole("radio", { name: T("Administrator", "المدير (Administrator)"), exact: true }).click();
    await page.waitForFunction(() => /keys: name, purpose, internal_notes/.test(document.querySelector('[data-testid="server-probe"]')?.textContent ?? ""), null, { timeout: 10_000 });
  });
  await check("frappe permissions: role picker drives the rights and the form", async () => {
    const sec = await go(page, "frappe-permissions");
    const sessions = sec.locator(`[aria-label="${T("Session", "الجلسة")}"]`);
    await sec.getByText("canImport(meta, roles, level0)").waitFor({ timeout: 10_000 });
    await sessions.getByRole("radio", { name: /Sales User/ }).click();
    await page.waitForTimeout(400);
    if ((await sec.getByText(T("hidden", "مخفي")).count()) < 4) throw new Error("Sales User still sees the gated entries");
    await sessions.getByRole("radio", { name: T("Roles unknown", "أدوار غير معروفة") }).click();
    await sec.locator('[data-permissions="unknown"]').waitFor({ timeout: 5000 });
    await sessions.getByRole("radio", { name: /Data Entry/ }).click();
    await page.waitForTimeout(400);
    if ((await sec.locator("text=canImport(meta, roles, level0)").locator("xpath=..").innerText()).includes(T("no", "لا"))) throw new Error("Data Entry cannot import");
  });
  await check("frappe import/export: Export for everyone, Import → FrappeDataImport on the simulated server, 403s in the dialog", async () => {
    const sec = await go(page, "frappe-import-export");
    const list = sec.getByTestId("io-list");
    await list.locator("tbody tr").first().waitFor({ timeout: 10_000 });
    await list.getByTestId("sf-list-menu").click();
    await page.getByRole("menuitem", { name: T("Export", "تصدير"), exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^Export$/ }).click();
    await sec.getByText(/download frappe\.core\.doctype\.data_import\.data_import\.download_template/).first().waitFor({ timeout: 5000 });
    // Import (System Manager): FrappeDataImport — upload a DEMO CSV, the simulated server previews and imports (1 of 3 rows valid)
    await list.getByTestId("sf-list-menu").click();
    await page.getByRole("menuitem", { name: T("Import", "استيراد"), exact: true }).click();
    const dlg = page.getByRole("dialog");
    await dlg.locator('input[type="file"]').setInputFiles({ name: "demo.csv", mimeType: "text/csv", buffer: Buffer.from("Purpose,Lead traveller,Destination,Budget\nDemo: Dubai trade fair,omar@example.com,Dubai,500\n,lina@example.com,Riyadh,100\nDemo: unknown traveller,ghost@example.com,London,50\n") });
    await dlg.getByRole("button", { name: T("Upload and Preview", "رفع ومعاينة") }).click();
    await dlg.getByRole("button", { name: T("Start Import", "بدء الاستيراد") }).click({ timeout: 10_000 });
    await dlg.getByText(T("Partial Success", "نجاح جزئي")).first().waitFor({ timeout: 10_000 });
    await page.keyboard.press("Escape");
    await dlg.waitFor({ state: "hidden", timeout: 5000 });
    // a user with no role on Travel Request: the simulated server refuses the export
    await sec.getByRole("button", { name: /server refuses|الخادم يرفض/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^Export$/ }).click();
    await page.getByRole("dialog").getByText(/Not permitted|غير مسموح/).first().waitFor({ timeout: 5000 });
    await page.keyboard.press("Escape");
    // Sales User: Export offered (Desk), Import not; exporting records → the simulated server's 403 in the dialog
    await sec.locator(`[aria-label="${T("Session", "الجلسة")}"]`).getByRole("radio", { name: /Sales User/ }).click();
    await list.locator("tbody tr").first().waitFor({ timeout: 10_000 });
    await list.getByTestId("sf-list-menu").click();
    const items = await page.getByRole("menuitem").allInnerTexts();
    if (items.some((x) => /^(Import|استيراد)$/.test(x.trim()))) throw new Error("Import offered to Sales User");
    if (!items.some((x) => x.trim() === T("Export", "تصدير"))) throw new Error(`Export missing for Sales User: ${items.join(", ")}`);
    await page.keyboard.press("Escape");
    await list.locator("tbody tr").first().getByRole("checkbox").click();
    await list.getByRole("button", { name: T("Export", "تصدير"), exact: true }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: /^Export$/ }).click();
    await page.getByRole("dialog").getByText(/Not permitted|غير مسموح/).first().waitFor({ timeout: 5000 });
    await page.keyboard.press("Escape");
  });
  await check("frappe rtl: two panes with their own dir/lang; html keeps the page's", async () => {
    const sec = await go(page, "frappe-rtl");
    await sec.locator("tbody tr").first().waitFor({ timeout: 10_000 });
    const panes = sec.locator("[data-sf-portal-host]").locator("xpath=..");
    const dirs = await panes.evaluateAll((els) => els.map((e) => `${e.getAttribute("lang")}/${e.getAttribute("dir")}`));
    if (dirs.join(",") !== "ar/rtl,en/ltr") throw new Error(`panes: ${dirs.join(",")}`);
    if ((await page.evaluate(() => document.documentElement.dir)) !== (ar ? "rtl" : "ltr")) throw new Error("html dir changed");
  });
  await check("frappe themes: one light and one dark pane; html theme unchanged", async () => {
    const sec = await go(page, "frappe-themes");
    await sec.locator("tbody tr").first().waitFor({ timeout: 15_000 });
    const panes = sec.locator("[data-sf-portal-host]").locator("xpath=..");
    const themes = await panes.evaluateAll((els) => els.map((e) => e.getAttribute("data-theme")));
    if (themes.join(",") !== "light,dark") throw new Error(`panes: ${themes.join(",")}`);
    if ((await page.evaluate(() => document.documentElement.classList.contains("dark"))) !== (theme === "dark")) throw new Error("html theme changed");
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
      if (SHOTS && ["overview", "list-view", "frappe-list", "date-time-fields", "frappe-list-view", "frappe-forms", "frappe-rtl"].includes(id)) await page.screenshot({ path: `${SHOTS}/phone-ar-${id}.png` });
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
