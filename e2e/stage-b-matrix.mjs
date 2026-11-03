// Stage B visual matrix (brief §10) for the 0.4.0 Frappe components over the SIMULATED backend (?view=frappe-sim).
// Serve playground/dist on 127.0.0.1 only, then:  node e2e/stage-b-matrix.mjs http://127.0.0.1:4833/ /tmp/a6-shots
// Writes <theme>-<lang>[-dir]__<scenario>.png and prints problems (page errors, console errors, horizontal overflow).
import fs from "node:fs";
import { chromium } from "playwright-core";

const [URL, OUT] = process.argv.slice(2);
const NATURAL = [["light", "en", null], ["dark", "en", null], ["light", "ar", null], ["dark", "ar", null]];
const MIXED = [["light", "ar", "ltr"], ["dark", "ar", "ltr"], ["light", "en", "rtl"], ["dark", "en", "rtl"]];
const L = {
  en: { save: /^Save$/, filter: /^Filter$/, bulk: /Actions|Bulk/ },
  ar: { save: /^حفظ$/, filter: /^تصفية$/, bulk: /إجراءات/ },
};
const wait = (p, ms = 900) => p.waitForTimeout(ms);
const SC = [
  { id: "form-contact", ready: (p) => p.getByText("Sara").first().waitFor({ timeout: 8000 }) },
  { id: "form-contact", name: "form-contact-row-form", ready: (p) => p.getByText("sara.alotaibi").first().waitFor(), act: async (p) => { await p.getByText("sara.alotaibi").first().click(); await wait(p); } },
  { id: "form-new", ready: (p) => p.locator("form, [data-doctype]").first().waitFor(), act: async (p, l) => { await p.getByRole("button", { name: l.save }).click(); await wait(p, 500); } },
  { id: "form-todo", name: "form-link-dropdown", ready: (p) => p.locator("[data-doctype]").first().waitFor(), act: async (p) => { const i = p.getByLabel("Allocated To").first(); await i.click(); await i.fill("sa"); await wait(p, 1500); } },
  { id: "form-error", ready: (p) => p.getByRole("alert").first().waitFor({ timeout: 8000 }) },
  { id: "form-loading", act: async (p) => wait(p, 800) },
  { id: "form-save-error", ready: (p) => p.getByText("Sara").first().waitFor(), act: async (p, l) => { const i = p.getByRole("textbox").first(); await i.fill("Sara Z"); await p.getByRole("button", { name: l.save }).click(); await wait(p, 800); } },
  { id: "form-readonly", ready: (p) => p.getByText("Hotel block").first().waitFor() },
  { id: "form-workflow", ready: (p) => p.getByText("Annual travel").first().waitFor(), act: async (p) => wait(p, 800) },
  { id: "list", ready: (p) => p.locator("tbody tr").first().waitFor({ timeout: 8000 }) },
  { id: "list", name: "list-bulk-menu", ready: (p) => p.locator("tbody tr").first().waitFor(), act: async (p) => { const cb = p.getByRole("checkbox"); await cb.nth(1).check(); await cb.nth(2).check(); await wait(p, 400); const m = p.getByRole("button", { name: /Actions|Bulk|إجراءات/ }).first(); if (await m.count()) { await m.click(); await wait(p, 400); } } },
  { id: "list", name: "list-filters", ready: (p) => p.locator("tbody tr").first().waitFor(), act: async (p, l) => { await p.getByRole("button", { name: l.filter }).first().click(); await wait(p, 500); const add = p.getByRole("button", { name: /Add filter|إضافة عامل/ }).first(); if (await add.count()) await add.click(); await wait(p, 400); } },
  { id: "list-empty", act: async (p) => wait(p, 1200) },
  { id: "list-error", ready: (p) => p.getByRole("alert").first().waitFor({ timeout: 8000 }) },
  { id: "list-loading", act: async (p) => wait(p, 800) },
  { id: "timeline", ready: (p) => p.getByText(/Please confirm/).first().waitFor({ timeout: 8000 }), act: async (p) => wait(p, 600) },
  { id: "workflow", ready: (p) => p.getByText(/Please confirm/).first().waitFor({ timeout: 8000 }), act: async (p) => wait(p, 600) },
];
const MIXED_FOR = new Set(["form-contact", "list", "timeline"]);

const browser = await chromium.launch();
fs.mkdirSync(OUT, { recursive: true });
const problems = [];
let shots = 0;
for (const s of SC.filter((x) => !process.env.ONLY || (x.name ?? x.id) === process.env.ONLY)) {
  const combos = [...NATURAL, ...(MIXED_FOR.has(s.name ?? s.id) ? MIXED : [])];
  for (const [theme, lang, dir] of combos) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    await ctx.addInitScript(([t, l]) => { localStorage.setItem("app_theme", t); localStorage.setItem("app_lang", l); }, [theme, lang]);
    const page = await ctx.newPage();
    const tag = `${theme}-${lang}${dir ? "-" + dir : ""}/${s.name ?? s.id}`;
    page.on("pageerror", (e) => problems.push(`${tag}: pageerror ${e.message.split("\n")[0]}`));
    page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) problems.push(`${tag}: console ${m.text().slice(0, 140)}`); });
    await page.goto(`${URL}?view=frappe-sim&c=${s.id}${dir ? `&dir=${dir}` : ""}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    try {
      await (s.ready?.(page) ?? wait(page, 600));
      await s.act?.(page, L[lang]);
      const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      if (w[0] > w[1] + 1) problems.push(`${tag}: horizontal overflow ${w[0]} > ${w[1]}`);
    } catch (e) { problems.push(`${tag}: ${e.message.split("\n")[0]}`); }
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${OUT}/${theme}-${lang}${dir ? "-" + dir : ""}__${s.name ?? s.id}.png`, fullPage: false });
    shots++;
    await ctx.close();
  }
}
await browser.close();
console.log(`${shots} shots in ${OUT}`);
console.log(problems.length ? `${problems.length} problem(s):\n${problems.join("\n")}` : "no problems");
