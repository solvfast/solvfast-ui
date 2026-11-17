/**
 * 0.10 consolidation, in a real browser: the showcase section "0.10 — lifecycle diagram & record editing"
 * (showcase/src/pages/consolidation-010.tsx) for English and Arabic (right-to-left) × light and dark × 1440 and 390 px.
 * Builds the showcase (skip with --no-build), serves it with `vite preview` on a free port of its own (never 4850),
 * takes screenshots and asserts:
 *   diagram — no two state cards overlap; every arrow starts on its `from` card's border and ends at its `to` card's
 *     (within TOL px, in the canvas' own unscaled coordinates); no arrow runs through a third card; the routing kinds
 *     and rows the spec expects; Arabic mirrors the layout (x → width − x − w, a row's first state on the right) and
 *     reads right to left; edge labels overlap neither each other nor a card; the hidden transitions list has one item
 *     per transition; the self-loop is drawn; every arrow-head id on the page is unique and each arrow uses its own
 *     graph's; LifecycleGraphDialog opens, closes with Escape and gives focus back to its button.
 *   editing — editScope "record": one Edit (data-record-edit), no section buttons, it opens every section, Save held
 *     (disabled) until a value changes, Not Saved only after a change, Cancel (data-record-cancel-edit) closes all and
 *     puts the values back; editScope "section": per-section Edit / Cancel, opening shows no Not Saved, typing shows it
 *     and enables Save, Cancel restores. Read view: a two-column section keeps Desk's columns (DOM order, side by side
 *     at 1440 — mirrored in Arabic — and stacked at 390), labels are dt / dd in a dl, Arabic labels are not upper-cased
 *     and have no letter-spacing (English ones are: the positive control).
 *   no page errors or console errors.
 * Prints a JSON summary; exits 1 on any failed assertion.
 *   node e2e/consolidation-010.mjs [--no-build] [--shots <dir>] [--base <url>]   (--base: use a running server)
 */
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, "showcase/src/pages/consolidation-010-spec.json"), "utf8"));
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const SHOTS = arg("--shots") ?? "/home/frappe/sfui-dev/integration-0.10/browser-shots";
const CHROME = process.env.CHROME ?? "/home/frappe/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome";
const SECTION = "release-010";
const TOL = 8; // px, canvas units: arrows stop 4 px short of a card by design (the arrow head covers the gap)
const CARD_H = 58; // the layout's state height (LifecycleGraphView H)
// A text field commits its value 500 ms after the last keystroke (FrappeField DebouncedText), or on blur: "typing shows
// Not Saved" waits for the indicator up to this long.
const COMMIT_WAIT = 3000;
fs.mkdirSync(SHOTS, { recursive: true });

// ---- serve ---------------------------------------------------------------------------------------------------------
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
let server;
let BASE = arg("--base");
if (!BASE) {
  if (!process.argv.includes("--no-build")) {
    const b = spawnSync("npm", ["run", "-s", "showcase:build"], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
    if (b.status !== 0) { console.error("showcase build failed"); process.exit(2); }
  }
  const port = await freePort();
  server = spawn("npx", ["vite", "preview", "--config", "showcase/vite.config.ts", "--port", String(port), "--strictPort"], { cwd: ROOT, stdio: "ignore", detached: true });
  BASE = `http://127.0.0.1:${port}/`;
  for (let i = 0; ; i++) {
    try { if ((await fetch(BASE)).ok) break; } catch { /* not yet */ }
    if (i > 100) { console.error("preview server did not start"); process.exit(2); }
    await new Promise((r) => setTimeout(r, 200));
  }
}
const stopServer = () => { if (server) { try { process.kill(-server.pid); } catch { /* gone */ } server = undefined; } };
process.on("exit", stopServer);

// ---- helpers ---------------------------------------------------------------------------------------------------------
const observations = []; // non-fatal findings (not in the brief's assertion list): printed and reported, never fail the run
const observe = (where, what, detail) => observations.push({ where, what, detail });
const summary = {}; // combo → { pass, fail, failures[] , checks{} }
let current;
function check(name, ok, detail) {
  current.checks[name] = ok ? "pass" : `FAIL${detail !== undefined ? `: ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`;
  if (ok) current.pass++; else { current.fail++; current.failures.push(`${name}${detail !== undefined ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`); }
}
const distToRect = (p, r) => {
  const inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  if (inside) return Math.min(p.x - r.x, r.x + r.w - p.x, p.y - r.y, r.y + r.h - p.y);
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
};
const overlap = (a, b, eps = 0.5) => a.x + eps < b.x + b.w && b.x + eps < a.x + a.w && a.y + eps < b.y + b.h && b.y + eps < a.y + a.h;
const r1 = (n) => Math.round(n * 10) / 10;

/** Reads one rendered LifecycleGraphView (inside `rootSel`): cards and paths in the canvas' unscaled coordinates, labels
 *  and cards on screen, the hidden list, directions and arrow-head references. */
function probeGraph(rootSel) {
  const root = document.querySelector(rootSel);
  const g = root?.querySelector("[data-lifecycle-graph]");
  if (!g) return null;
  const svg = g.querySelector("svg");
  const canvas = svg.parentElement;
  const width = svg.width.baseVal.value;
  const scale = canvas.getBoundingClientRect().width / width;
  const cards = [...canvas.querySelectorAll(":scope > [data-state]")].map((el) => {
    const sr = el.getBoundingClientRect();
    // what the card covers on screen: its box and whatever sticks out of it (the Current badge, the done tick); the
    // screen-reader-only text (1 px, clipped) is not drawn
    let u = { l: sr.left, t: sr.top, r: sr.right, b: sr.bottom };
    for (const d of el.querySelectorAll("*")) {
      const dr = d.getBoundingClientRect();
      if (dr.width <= 1 || dr.height <= 1 || d.closest(".sr-only")) continue;
      u = { l: Math.min(u.l, dr.left), t: Math.min(u.t, dr.top), r: Math.max(u.r, dr.right), b: Math.max(u.b, dr.bottom) };
    }
    const labelEl = el.querySelector(".font-semibold");
    return { id: el.dataset.state, x: parseFloat(el.style.left), y: parseFloat(el.style.top), w: el.offsetWidth, h: el.offsetHeight,
      screen: { x: u.l, y: u.t, w: u.r - u.l, h: u.b - u.t }, box: { x: sr.x, y: sr.y, w: sr.width, h: sr.height }, direction: labelEl ? getComputedStyle(labelEl).direction : null,
      text: labelEl?.textContent ?? "", overflow: labelEl ? labelEl.scrollWidth > labelEl.clientWidth + 1 || labelEl.getBoundingClientRect().right > sr.right + 1 || labelEl.getBoundingClientRect().left < sr.left - 1 : false };
  });
  const markerIds = [...svg.querySelectorAll("marker")].map((m) => m.id);
  const paths = [...svg.querySelectorAll("path[data-edge]")].map((p) => {
    const len = p.getTotalLength();
    const samples = Array.from({ length: 41 }, (_, i) => { const q = p.getPointAtLength((len * i) / 40); return { x: q.x, y: q.y }; });
    const bb = p.getBBox();
    const ref = /url\(#([^)]+)\)/.exec(p.getAttribute("marker-end") ?? "")?.[1] ?? null;
    return { id: p.dataset.edge, kind: p.dataset.edgeKind, len, start: samples[0], end: samples[40], samples, bbox: { w: bb.width, h: bb.height }, marker: ref, markerLocal: !!ref && markerIds.includes(ref) };
  });
  const labels = [...canvas.children].filter((el) => el.tagName === "DIV" && !el.hasAttribute("data-state")).map((el) => {
    const span = el.querySelector("span") ?? el;
    const r = span.getBoundingClientRect();
    return { text: span.textContent, screen: { x: r.x, y: r.y, w: r.width, h: r.height } };
  });
  const ul = g.querySelector("[data-lifecycle-transitions]");
  const ulStyle = ul ? getComputedStyle(ul) : null;
  return {
    dir: g.getAttribute("dir"), width, height: svg.height.baseVal.value, scale, origin: { x: canvas.getBoundingClientRect().x, y: canvas.getBoundingClientRect().y }, cards, paths, labels, markerIds,
    list: ul ? { tag: ul.tagName, items: [...ul.querySelectorAll("li")].map((li) => li.textContent), label: ul.getAttribute("aria-label"),
      hidden: ulStyle.position === "absolute" && ul.getBoundingClientRect().width <= 1 && ul.getBoundingClientRect().height <= 1 } : null,
  };
}

const enLayouts = new Map(); // graph → { width, x: {id: x} } from the English run, for the mirror check

/** The diagram assertions for one probe against its spec. */
function assertGraph(tag, data, spec, lang) {
  if (!data) return check(`${tag}: rendered`, false, "no [data-lifecycle-graph]");
  const rtl = lang === "ar";
  const byId = new Map(data.cards.map((c) => [c.id, c]));
  check(`${tag}: one card per state`, data.cards.length === spec.states.length && spec.states.every((s) => byId.has(s.id)), data.cards.map((c) => c.id));
  check(`${tag}: card height = layout's ${CARD_H}`, data.cards.every((c) => Math.abs(c.h - CARD_H) < 0.5), data.cards.map((c) => [c.id, c.h]));
  const over = [];
  for (let i = 0; i < data.cards.length; i++) for (let j = i + 1; j < data.cards.length; j++) if (overlap(data.cards[i], data.cards[j], 0)) over.push([data.cards[i].id, data.cards[j].id]);
  check(`${tag}: no two cards overlap`, over.length === 0, over);
  check(`${tag}: state names fit their cards`, data.cards.every((c) => !c.overflow), data.cards.filter((c) => c.overflow).map((c) => c.text));
  // arrows
  check(`${tag}: one arrow per transition`, data.paths.length === spec.transitions.length, `${data.paths.length} paths for ${spec.transitions.length} transitions`);
  const bad = [];
  const through = [];
  let maxDev = 0;
  for (const t of spec.transitions) {
    const p = data.paths.find((x) => x.id === t.id);
    if (!p) { bad.push(`${t.id}: missing`); continue; }
    const from = byId.get(t.from), to = byId.get(t.to);
    const ds = distToRect(p.start, from), de = distToRect(p.end, to);
    maxDev = Math.max(maxDev, ds, de);
    if (ds > TOL) bad.push(`${t.id}: start ${r1(ds)}px from ${t.from}`);
    if (de > TOL) bad.push(`${t.id}: end ${r1(de)}px from ${t.to}`);
    // the nearest card to each end is the right one
    const nearest = (pt) => data.cards.reduce((a, c) => (distToRect(pt, c) < distToRect(pt, a) ? c : a));
    if (nearest(p.start).id !== t.from && distToRect(p.start, nearest(p.start)) < ds - 0.5) bad.push(`${t.id}: start nearest ${nearest(p.start).id}`);
    if (nearest(p.end).id !== t.to && distToRect(p.end, nearest(p.end)) < de - 0.5) bad.push(`${t.id}: end nearest ${nearest(p.end).id}`);
    for (const c of data.cards) {
      if (c.id === t.from || c.id === t.to) continue;
      const inner = { x: c.x + 3, y: c.y + 3, w: c.w - 6, h: c.h - 6 };
      if (p.samples.some((q) => q.x > inner.x && q.x < inner.x + inner.w && q.y > inner.y && q.y < inner.y + inner.h)) through.push(`${t.id} through ${c.id}`);
    }
    const kind = spec.expectKinds?.[t.id];
    if (kind && p.kind !== kind) bad.push(`${t.id}: kind ${p.kind}, expected ${kind}`);
  }
  check(`${tag}: arrow ends on their cards (max ${r1(maxDev)}px ≤ ${TOL})`, bad.length === 0, bad);
  check(`${tag}: no arrow runs through a third card`, through.length === 0, through);
  const loops = data.paths.filter((p) => p.kind === "loop");
  const wantLoops = spec.transitions.filter((t) => t.from === t.to).length;
  check(`${tag}: self-loop drawn`, loops.length === wantLoops && loops.every((p) => p.len > 60 && p.bbox.w >= 20 && p.bbox.h >= 20), loops.map((p) => ({ id: p.id, len: r1(p.len), w: r1(p.bbox.w), h: r1(p.bbox.h) })));
  check(`${tag}: every arrow head is this graph's`, data.paths.every((p) => p.markerLocal), data.paths.filter((p) => !p.markerLocal).map((p) => p.id));
  // rows
  if (spec.expectRows) {
    const ys = spec.expectRows.map((row) => row.map((id) => byId.get(id)?.y));
    const ok = ys.every((r) => r.every((y) => y === r[0])) && ys.every((r, i) => i === 0 || r[0] > ys[i - 1][0]);
    check(`${tag}: rows as the spec`, ok, ys);
  }
  // mirror + direction
  const sorted = [...data.cards].sort((a, b) => a.id.localeCompare(b.id));
  if (!rtl) enLayouts.set(tag.split(" ").pop(), { width: data.width, x: Object.fromEntries(sorted.map((c) => [c.id, c.x])) });
  check(`${tag}: direction ${rtl ? "rtl" : "ltr"}`, data.dir === (rtl ? "rtl" : "ltr") && data.cards.every((c) => c.direction === (rtl ? "rtl" : "ltr")), { dir: data.dir, cards: [...new Set(data.cards.map((c) => c.direction))] });
  if (spec.expectRows) {
    const two = spec.expectRows.filter((r) => r.length > 1);
    const order = two.map((r) => [r[0], r[1], byId.get(r[0]).x, byId.get(r[1]).x]);
    check(`${tag}: a row's first state on the ${rtl ? "right" : "left"}`, order.every(([, , a, b]) => (rtl ? a > b : a < b)), order);
  }
  if (rtl) {
    const en = enLayouts.get(tag.split(" ").pop());
    if (!en) check(`${tag}: mirrored`, false, "no English layout to compare");
    else {
      const off = sorted.filter((c) => Math.abs(c.x - (en.width - en.x[c.id] - c.w)) > 0.5).map((c) => [c.id, c.x, en.width - en.x[c.id] - c.w]);
      check(`${tag}: mirrored (x = width − x_en − w)`, en.width === data.width && off.length === 0, off);
    }
    // the loop and side lanes go to the other side too
    const loop = data.paths.find((p) => p.kind === "loop");
    if (loop) { const c = byId.get(spec.transitions.find((t) => t.id === loop.id).from); check(`${tag}: loop on the start side in RTL`, Math.min(...loop.samples.map((q) => q.x)) < c.x - 10, r1(Math.min(...loop.samples.map((q) => q.x)) - c.x)); }
  }
  // labels
  const labelled = spec.transitions.filter((t) => t[lang]);
  check(`${tag}: one label per labelled transition`, data.labels.length === labelled.length && labelled.every((t) => data.labels.some((x) => x.text === t[lang])), data.labels.map((x) => x.text));
  const lo = [];
  for (let i = 0; i < data.labels.length; i++) for (let j = i + 1; j < data.labels.length; j++) if (overlap(data.labels[i].screen, data.labels[j].screen)) lo.push([data.labels[i].text, data.labels[j].text]);
  check(`${tag}: labels do not overlap each other`, lo.length === 0, lo);
  const lc = [];
  for (const x of data.labels) for (const c of data.cards) if (overlap(x.screen, c.screen)) lc.push([x.text, c.id]);
  check(`${tag}: labels do not overlap cards (incl. Current badge / done tick)`, lc.length === 0, lc);
  // observation: a self-loop tangled with other arrows (other edges' points inside its box) or with labels
  for (const lp of data.paths.filter((p) => p.kind === "loop")) {
    const xs = lp.samples.map((q) => q.x), ys = lp.samples.map((q) => q.y);
    const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    const crossing = data.paths.filter((p) => p.id !== lp.id && p.samples.some((q) => q.x > box.x + 1 && q.x < box.x + box.w - 1 && q.y > box.y + 1 && q.y < box.y + box.h - 1)).map((p) => p.id);
    if (crossing.length) observe(tag, `self-loop ${lp.id} is crossed by other arrows`, crossing);
  }
  const onScreen = (q) => ({ x: data.origin.x + q.x * data.scale, y: data.origin.y + q.y * data.scale });
  for (const x of data.labels) {
    const own = spec.transitions.find((t) => t[lang] === x.text)?.id;
    const hit = data.paths.filter((p) => p.id !== own && p.samples.some((q) => { const v = onScreen(q); return v.x > x.screen.x && v.x < x.screen.x + x.screen.w && v.y > x.screen.y && v.y < x.screen.y + x.screen.h; })).map((p) => p.id);
    if (hit.length) observe(tag, `label "${x.text}" lies on another arrow`, hit);
  }
  // text alternative
  check(`${tag}: hidden transitions list, one item per transition`, !!data.list && data.list.tag === "UL" && data.list.hidden && data.list.items.length === spec.transitions.length,
    data.list ? { items: data.list.items.length, hidden: data.list.hidden } : "no list");
}

// ---- the run -----------------------------------------------------------------------------------------------------------
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const T = {
  en: { notSaved: "Not Saved", save: "Save" },
  ar: { notSaved: "غير محفوظ", save: "حفظ" },
};
const flat = (sec) => sec.columns.flat();

try {
  for (const lang of ["en", "ar"]) {
    for (const theme of ["light", "dark"]) {
      for (const vw of [1440, 390]) {
        const combo = `${lang}-${theme}-${vw}`;
        current = summary[combo] = { pass: 0, fail: 0, failures: [], checks: {} };
        const ctx = await browser.newContext({ viewport: { width: vw, height: vw > 500 ? 900 : 844 }, reducedMotion: "reduce", deviceScaleFactor: 1 });
        await ctx.addInitScript(([t, l]) => {
          if (!location.protocol.startsWith("http")) return;
          localStorage.setItem("sfui-showcase-theme", t); localStorage.setItem("sfui-showcase-lang", l);
        }, [theme, lang]);
        const page = await ctx.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(`pageerror ${e.message}`));
        // the browser's own favicon probe (the showcase has none) is not the page's error
        page.on("console", (m) => { if (m.type() === "error" && !/\/favicon\.ico$/.test(m.location()?.url ?? "")) errors.push(`console ${m.text()} ${m.location()?.url ?? ""}`); });
        const shot = async (what, loc) => { try { await (loc ?? page).screenshot({ path: path.join(SHOTS, `${combo}-${what}.png`) }); } catch (e) { check(`screenshot ${what}`, false, e.message.split("\n")[0]); } };
        try {
          await page.goto(`${BASE}#${SECTION}`);
          await page.locator(`#${SECTION}-content h3`).first().waitFor({ timeout: 20_000 });
          const html = await page.evaluate(() => ({ dark: document.documentElement.classList.contains("dark"), dir: document.documentElement.dir, lang: document.documentElement.lang }));
          check("page: theme / dir / lang", html.dark === (theme === "dark") && html.dir === (lang === "ar" ? "rtl" : "ltr") && html.lang === lang, html);
          const hOver = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          check("page: no horizontal overflow", hOver <= 0, `${hOver}px`);

          // -- diagrams
          for (const [demo, spec] of [["graph-sada", SPEC.sada], ["graph-branching", SPEC.branching]]) {
            const loc = page.locator(`[data-demo="${demo}"]`);
            await loc.scrollIntoViewIfNeeded();
            await loc.locator("[data-state]").first().waitFor();
            await page.waitForTimeout(100);
            assertGraph(`diagram ${demo}`, await page.evaluate(probeGraph, `[data-demo="${demo}"]`), spec, lang);
            await shot(demo, loc);
          }
          const ids = await page.evaluate(() => [...document.querySelectorAll("[data-lifecycle-graph] marker")].map((m) => m.id));
          check("diagram: arrow-head ids unique across the page (2 graphs)", ids.length === 4 && new Set(ids).size === ids.length, ids);

          // -- dialog
          const trigger = page.locator("[data-open-lifecycle-dialog]");
          await trigger.scrollIntoViewIfNeeded();
          await trigger.click();
          const dlg = page.locator("[data-lifecycle-diagram]");
          await dlg.waitFor({ state: "visible" });
          await dlg.locator("[data-state]").first().waitFor();
          await page.waitForTimeout(250);
          const dlgInfo = await page.evaluate(() => { const d = document.querySelector("[data-lifecycle-diagram]"); return { role: d.getAttribute("role"), dir: d.getAttribute("dir"), focusInside: d.contains(document.activeElement) }; });
          check("dialog: opens (role dialog, focus inside, direction)", dlgInfo.role === "dialog" && dlgInfo.focusInside && dlgInfo.dir === (lang === "ar" ? "rtl" : "ltr"), dlgInfo);
          assertGraph("dialog graph-branching", await page.evaluate(probeGraph, "[data-lifecycle-diagram]"), SPEC.branching, lang);
          const ids3 = await page.evaluate(() => [...document.querySelectorAll("[data-lifecycle-graph] marker")].map((m) => m.id));
          check("dialog: arrow-head ids unique with three graphs on the page", ids3.length === 6 && new Set(ids3).size === 6, ids3);
          await shot("dialog");
          await page.keyboard.press("Escape");
          await dlg.waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
          const after = await page.evaluate(() => ({ open: !!document.querySelector("[data-lifecycle-diagram]"), focus: document.activeElement?.hasAttribute("data-open-lifecycle-dialog") ?? false }));
          check("dialog: Escape closes it and focus returns to its button", !after.open && after.focus, after);

          // -- forms
          for (const scope of ["record", "section"]) {
            const root = page.locator(`[data-demo="form-${scope}"]`);
            await root.scrollIntoViewIfNeeded();
            await root.locator("[data-section]").nth(SPEC.form.sections.length - 1).waitFor({ timeout: 15_000 });
            await root.locator("[data-read-row]").first().waitFor();
            await page.waitForTimeout(150);
            const tag = `form ${scope}`;
            const indicator = async () => (await root.locator("[data-form-indicator]").allTextContents()).map((s) => s.trim());
            const notSaved = async () => (await indicator()).includes(T[lang].notSaved);
            const saveBtn = root.getByRole("button", { name: T[lang].save, exact: true });
            const saveState = async () => { const n = await saveBtn.count(); if (!n) return { shown: false }; return { shown: true, disabled: await saveBtn.first().isDisabled(), held: (await saveBtn.first().getAttribute("data-primary-held")) !== null }; };
            const openKeys = () => root.locator("[data-section]").evaluateAll((els) => els.filter((e) => e.hasAttribute("data-section-open")).map((e) => e.getAttribute("data-section")));
            const allKeys = await root.locator("[data-section]").evaluateAll((els) => els.map((e) => e.getAttribute("data-section")));
            check(`${tag}: ${SPEC.form.sections.length} sections`, allKeys.length === SPEC.form.sections.length, allKeys);

            // read view (only once per combo: both forms render the same read view; do it on "record")
            if (scope === "record") {
              const rv = await root.evaluate((el, specSecs) => {
                const secs = [...el.querySelectorAll("[data-section]")];
                return specSecs.map((s, i) => {
                  const sec = secs[i];
                  const cols = [...sec.querySelectorAll("[data-read-column]")].map((c) => { const r = c.getBoundingClientRect(); return { rows: [...c.querySelectorAll("[data-read-row]")].map((x) => x.getAttribute("data-read-row")), x: r.x, right: r.right, top: r.top, bottom: r.bottom }; });
                  const rows = [...sec.querySelectorAll("[data-read-row]")].map((row) => {
                    const dt = row.querySelector(":scope > dt"), dd = row.querySelector(":scope > dd");
                    const cs = dt ? getComputedStyle(dt) : null;
                    const r = row.getBoundingClientRect();
                    return { f: row.getAttribute("data-read-row"), inDl: row.parentElement?.tagName === "DL", dt: !!dt, dd: !!dd, transform: cs?.textTransform, spacing: cs?.letterSpacing, top: r.top, label: dt?.textContent?.trim() };
                  });
                  return { title: sec.getAttribute("aria-label"), cols, rows };
                });
              }, SPEC.form.sections);
              const two = rv[0];
              const want = flat(SPEC.form.sections[0]);
              check("read: two-column section keeps Desk's columns in the DOM", two.cols.length === 2 && JSON.stringify(two.cols.map((c) => c.rows)) === JSON.stringify(SPEC.form.sections[0].columns) && JSON.stringify(two.rows.map((r) => r.f)) === JSON.stringify(want), two.cols.map((c) => c.rows));
              const [c0, c1] = two.cols;
              if (vw > 640) check(`read: columns side by side, first on the ${lang === "ar" ? "right" : "left"}`, c0 && c1 && (lang === "ar" ? c0.x > c1.right - 1 : c0.right <= c1.x + 1) && Math.abs(c0.top - c1.top) < 2, c0 && c1 ? { c0: [r1(c0.x), r1(c0.right)], c1: [r1(c1.x), r1(c1.right)] } : null);
              else check("read: columns stacked on a phone, first above", c0 && c1 && c0.bottom <= c1.top + 1, c0 && c1 ? { c0: [r1(c0.top), r1(c0.bottom)], c1: r1(c1.top) } : null);
              const colOrder = two.cols.every((c) => { const ts = c.rows.map((f) => two.rows.find((r) => r.f === f).top); return ts.every((t, i) => i === 0 || t > ts[i - 1]); });
              check("read: each column reads top to bottom", colOrder);
              const allRows = rv.flatMap((s) => s.rows);
              check("read: every row is dt + dd inside a dl", allRows.length >= Object.keys(SPEC.form.fields).length && allRows.every((r) => r.inDl && r.dt && r.dd), allRows.filter((r) => !(r.inDl && r.dt && r.dd)).map((r) => r.f));
              const wantLabels = allRows.every((r) => r.label === SPEC.form.fields[r.f]?.[lang]);
              check(`read: labels in ${lang}`, wantLabels, allRows.map((r) => r.label));
              if (lang === "ar") check("read: Arabic labels not upper-cased, no letter-spacing", allRows.every((r) => r.transform === "none" && (r.spacing === "normal" || r.spacing === "0px")), [...new Set(allRows.map((r) => `${r.transform}/${r.spacing}`))]);
              else check("read: English labels small capitals with letter-spacing (control)", allRows.every((r) => r.transform === "uppercase" && r.spacing !== "normal" && r.spacing !== "0px"), [...new Set(allRows.map((r) => `${r.transform}/${r.spacing}`))]);
              await shot("form-read", root);
            }

            check(`${tag}: no Not Saved before editing`, !(await notSaved()), await indicator());
            const subjOrig = SPEC.form.values.subject;
            if (scope === "record") {
              check("record: one Edit (data-record-edit)", (await root.locator("[data-record-edit]").count()) === 1);
              check("record: no section Edit / Cancel buttons", (await root.locator("[data-section-edit], [data-section-cancel]").count()) === 0);
              await root.locator("[data-record-edit]").click();
              await root.locator("[data-record-cancel-edit]").waitFor();
              const open = await openKeys();
              check("record: Edit opens every section", open.length === allKeys.length, open);
              check("record: still no section buttons while editing", (await root.locator("[data-section-edit], [data-section-cancel]").count()) === 0);
              check("record: the Edit is gone, one Cancel (data-record-cancel-edit)", (await root.locator("[data-record-edit]").count()) === 0 && (await root.locator("[data-record-cancel-edit]").count()) === 1);
              check("record: opening is not a change (no Not Saved)", !(await notSaved()), await indicator());
              const s0 = await saveState();
              check("record: Save shown and disabled until a change", s0.shown && s0.disabled && s0.held, s0);
              await shot("form-record-open", root);
              const input = root.locator('input[id^="sf-ff-subject-"]');
              await input.fill("Changed by the browser test");
              await root.locator("[data-form-indicator]", { hasText: T[lang].notSaved }).waitFor({ timeout: COMMIT_WAIT }).catch(() => {});
              check("record: typing shows Not Saved", await notSaved(), await indicator());
              const s1 = await saveState();
              check("record: typing enables Save", s1.shown && !s1.disabled && !s1.held, s1);
              await shot("form-record-dirty", root);
              await root.locator("[data-record-cancel-edit]").click();
              await page.waitForTimeout(250);
              const open2 = await openKeys();
              const subj = (await root.locator('[data-read-row="subject"] dd').textContent())?.trim();
              check("record: Cancel closes every section", open2.length === 0 && (await root.locator("[data-record-cancel-edit]").count()) === 0 && (await root.locator("[data-record-edit]").count()) === 1, open2);
              check("record: Cancel restores the values", subj === subjOrig, subj);
              check("record: clean after Cancel (no Not Saved, no Save)", !(await notSaved()) && !(await saveState()).shown, { ind: await indicator(), save: await saveState() });
            } else {
              check("section: no record Edit", (await root.locator("[data-record-edit], [data-record-cancel-edit]").count()) === 0);
              const edits = await root.locator("[data-section-edit]").evaluateAll((els) => els.map((e) => e.getAttribute("data-section-edit")));
              check("section: an Edit per section", JSON.stringify(edits) === JSON.stringify(allKeys), edits);
              const first = allKeys[0];
              await root.locator(`[data-section-edit="${first}"]`).click();
              await root.locator(`[data-section-cancel="${first}"]`).waitFor();
              const open = await openKeys();
              check("section: Edit opens only its section", open.length === 1 && open[0] === first, open);
              check("section: the other sections keep their Edit", (await root.locator("[data-section-edit]").count()) === allKeys.length - 1 && (await root.locator("[data-section-cancel]").count()) === 1);
              check("section: opening shows no Not Saved", !(await notSaved()), await indicator());
              const s0 = await saveState();
              check("section: Save shown and disabled until a change", s0.shown && s0.disabled && s0.held, s0);
              const input = root.locator('input[id^="sf-ff-subject-"]');
              await input.fill("Changed in one section");
              await root.locator("[data-form-indicator]", { hasText: T[lang].notSaved }).waitFor({ timeout: COMMIT_WAIT }).catch(() => {});
              check("section: typing shows Not Saved", await notSaved(), await indicator());
              const s1 = await saveState();
              check("section: typing enables Save", s1.shown && !s1.disabled && !s1.held, s1);
              await shot("form-section-dirty", root);
              await root.locator(`[data-section-cancel="${first}"]`).click();
              await page.waitForTimeout(250);
              const subj = (await root.locator('[data-read-row="subject"] dd').textContent())?.trim();
              check("section: Cancel closes the section and restores its values", (await openKeys()).length === 0 && subj === subjOrig, { open: await openKeys(), subj });
              check("section: clean after Cancel", !(await notSaved()), await indicator());
              // a second section opened, then the first: two open, independent
              await root.locator(`[data-section-edit="${allKeys[1]}"]`).click();
              await root.locator(`[data-section-edit="${allKeys[2]}"]`).click();
              const two = await openKeys();
              check("section: sections open independently", two.length === 2 && two.includes(allKeys[1]) && two.includes(allKeys[2]) && !(await notSaved()), two);
              await root.locator(`[data-section-cancel="${allKeys[1]}"]`).click();
              await root.locator(`[data-section-cancel="${allKeys[2]}"]`).click();
            }
          }
          // observation probes (1440 only): a click on Save, or Ctrl+S, straight after typing — inside the field's
          // 500 ms commit delay — on the sectionEdit form (Save held disabled until a change) and on a plain form
          if (vw > 640) {
            for (const [scope, how] of [["section", "click"], ["section", "ctrl+s"], ["plain", "click"]]) {
              const root = page.locator(`[data-demo="form-${scope}"]`);
              await root.scrollIntoViewIfNeeded();
              await root.locator('input[id^="sf-ff-subject-"], [data-section-edit]').first().waitFor();
              if (scope === "section") { await root.locator("[data-section-edit]").first().click(); }
              const input = root.locator('input[id^="sf-ff-subject-"]');
              const before = await input.inputValue();
              await input.click(); await input.press("End"); await page.keyboard.type(" +probe");
              const save = root.getByRole("button", { name: T[lang].save, exact: true });
              const disabledAtClick = await save.isDisabled().catch(() => null);
              if (how === "click") { const bb = await save.boundingBox(); await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); }
              else await page.keyboard.press("Control+s");
              await page.waitForTimeout(1200);
              const ind = (await root.locator("[data-form-indicator]").allTextContents()).map((x) => x.trim());
              const saved = !ind.includes(T[lang].notSaved) && (scope === "plain" || (await root.locator("[data-section-open]").count()) === 0);
              observe(`${combo} form-${scope}`, `type then ${how} at once: ${saved ? "saved on the first try" : "NOT saved on the first try (Save / Ctrl+S must be repeated)"}`, { disabledAtClick, indicator: ind, before });
              if (!saved) {
                if (scope === "section") { const c = root.locator("[data-section-cancel]").first(); if (await c.count()) await c.click(); }
              }
            }
          }
        } catch (e) {
          check("run", false, e.message.split("\n")[0]);
          await shot("error");
        }
        check("no page / console errors", errors.length === 0, errors.slice(0, 5));
        await ctx.close();
      }
    }
  }
} finally {
  await browser.close();
  stopServer();
}

const failed = Object.values(summary).reduce((n, c) => n + c.fail, 0);
const passed = Object.values(summary).reduce((n, c) => n + c.pass, 0);
const grouped = {};
for (const o of observations) (grouped[o.what] ??= []).push(o.where);
const out = {
  base: BASE, screenshots: SHOTS, passed, failed, observations: Object.entries(grouped).map(([what, where]) => ({ what, where })),
  combos: Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, { pass: v.pass, fail: v.fail, failures: v.failures }])),
};
fs.writeFileSync(path.join(SHOTS, "summary.json"), JSON.stringify({ ...out, checks: Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, v.checks])) }, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(failed ? 1 : 0);
