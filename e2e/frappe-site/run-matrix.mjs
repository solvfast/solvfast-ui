#!/usr/bin/env node
// P36 real-site matrix runner for @solvfast/ui. PREPARED, NOT RUN against any site (only --dry-run has been run).
//
//   node e2e/frappe-site/run-matrix.mjs --dry-run                 # no network: guards + plan
//   node e2e/frappe-site/run-matrix.mjs                           # read checks (needs APPROVED_STAGING)
//   node e2e/frappe-site/run-matrix.mjs --write                   # + write / server-rejection checks (allow_write: true)
//   node e2e/frappe-site/run-matrix.mjs --browser                 # + harness checks (SFUI_HARNESS_URL, Playwright)
//   options: --only F-SAVE-2,L-PERM-1   --out <dir> (default <SFUI_STAGING_PRIVATE>/results/<timestamp>)
//
// Environment: SFUI_STAGING_URL (the staging origin), SFUI_STAGING_SITE (allowlist), SFUI_STAGING_PRIVATE (mode-700 dir
// holding APPROVED_STAGING, accounts.json and expected.json from staging-seed.py). Credentials are never printed or
// written: every recorded request / response goes through redact(), and only shapes and statuses are kept.
import fs from "node:fs";
import path from "node:path";
import { evaluateGuards, loadAccounts, redact, productionReason, normalizeHost, localAddresses, REPO_ROOT } from "./guards.mjs";
import { TESTS, CATEGORY_LABEL, categorize, testsForRow, parseCoverage, FRAPPE_REF } from "./matrix/catalogue.mjs";

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
const DRY = flag("--dry-run"), WRITE = flag("--write"), BROWSER = flag("--browser");
const ONLY = opt("--only")?.split(",").map((s) => s.trim()).filter(Boolean);
const known = new Set(["--dry-run", "--write", "--browser", "--only", "--out", ...(ONLY ? [opt("--only")] : []), ...(opt("--out") ? [opt("--out")] : [])]);
const unknown = argv.filter((a) => !known.has(a));
if (unknown.length) { console.error(`unknown argument(s): ${unknown.join(" ")}`); process.exit(64); }

const rows = parseCoverage(fs.readFileSync(path.join(REPO_ROOT, "docs/audit/p35/COVERAGE.md"), "utf8"));
const selected = TESTS.filter((t) => !ONLY || ONLY.includes(t.id));
if (ONLY && selected.length !== ONLY.length) { console.error(`unknown test id(s): ${ONLY.filter((i) => !TESTS.some((t) => t.id === i)).join(", ")}`); process.exit(64); }

/** Why a test would not run with these flags (null = it runs). */
function skipReason(t) {
  if (t.automated === "manual") return `manual: ${t.infra ?? "steps for a person"}`;
  if (t.automated === "browser") return BROWSER ? null : "browser check: needs --browser and SFUI_HARNESS_URL";
  if (t.kind === "write" || t.kind === "reject") return WRITE ? null : "write / server-rejection check: needs --write and allow_write in APPROVED_STAGING";
  return null;
}

function plan() {
  const by = (k) => selected.filter((t) => (skipReason(t) === null) === k);
  const counts = {};
  for (const r of rows) { const c = categorize(r).cat; counts[c] = (counts[c] ?? 0) + 1; }
  return {
    tests_total: selected.length,
    would_run: by(true).map((t) => `${t.id} [${t.kind}] ${t.feature}`),
    would_not_run: by(false).map((t) => `${t.id} — ${skipReason(t)}`),
    matrix: { applicable_rows: rows.length - (counts.na ?? 0), ...Object.fromEntries(Object.entries(counts).map(([k, v]) => [CATEGORY_LABEL[k], v])) },
  };
}

// ---- guards (always first; nothing below runs if one fails) ---------------------------------------------------------
const local = localAddresses();
const g = evaluateGuards({ env: process.env, write: WRITE, local });
let harness = null;
if (BROWSER) {
  const raw = process.env.SFUI_HARNESS_URL;
  let ok = false, detail = "SFUI_HARNESS_URL is not set (the local harness, e.g. http://127.0.0.1:4821)";
  if (raw) {
    try {
      const u = new URL(raw);
      // the ONLY loopback URL allowed: the harness itself (vite preview on 127.0.0.1:4821, whose proxy is guarded)
      ok = u.protocol === "http:" && normalizeHost(u.hostname) === "127.0.0.1" && u.port === "4821";
      detail = ok ? u.origin : "SFUI_HARNESS_URL must be exactly http://127.0.0.1:4821 (the guarded harness preview)";
      harness = ok ? u.origin : null;
    } catch { detail = "SFUI_HARNESS_URL is not a URL"; }
  }
  g.verdicts.push({ check: "harness URL is the local guarded preview", ok, detail });
  g.ok = g.ok && ok;
}

console.log(`P36 matrix runner — ${DRY ? "DRY RUN (no network)" : "REAL RUN"}; flags: ${[WRITE && "--write", BROWSER && "--browser", ONLY && `--only ${ONLY.join(",")}`].filter(Boolean).join(" ") || "(read only)"}`);
for (const v of g.verdicts) console.log(`  ${v.ok ? "ok     " : "REFUSED"} ${v.check}: ${v.detail}`);
console.log(`  ${g.accounts.ok ? "ok     " : "note   "} accounts.json: ${g.accounts.ok ? `present (${g.accounts.keys.join(", ")})` : `${g.accounts.detail} — required before a real run`}`);

if (DRY) {
  const p = plan();
  console.log(`\nPLAN (${p.tests_total} tests): ${p.would_run.length} would run, ${p.would_not_run.length} would not with these flags`);
  for (const l of p.would_run) console.log(`  run   ${l}`);
  for (const l of p.would_not_run) console.log(`  skip  ${l}`);
  console.log(`\nMATRIX ${JSON.stringify(p.matrix)}`);
  const out = opt("--out");
  if (out) {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, "dry-run-plan.json"), JSON.stringify({ ran: false, environment: "dry-run (no network)", when: new Date().toISOString(), guards: g.verdicts, plan: p }, null, 1));
  }
  console.log(g.ok ? "\ndry run: every guard passed (nothing was contacted)" : "\ndry run: REFUSED — a real run would not start");
  process.exit(g.ok ? 0 : 2);
}
if (!g.ok) { console.error("\nREFUSED: fix the guards above; nothing was contacted"); process.exit(2); }

// ---- real run ------------------------------------------------------------------------------------------------------
const BASE = g.url;
if (productionReason(new URL(BASE).hostname, { local })) { console.error("REFUSED: production host"); process.exit(2); } // belt and braces
const accounts = loadAccounts(g.privateDir);
const X = JSON.parse(fs.readFileSync(path.join(g.privateDir, "expected.json"), "utf8"));
if (X.site !== g.site) { console.error(`REFUSED: expected.json is for ${X.site}, the approval names ${g.site}`); process.exit(2); }
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(opt("--out") ?? path.join(g.privateDir, "results", stamp));
fs.mkdirSync(OUT, { recursive: true });
const TAG = `SFUI P36 RUN ${stamp.slice(0, 19)}`;

const shape = (v, d = 0) => {
  if (d > 4) return "…";
  if (Array.isArray(v)) return v.length ? [`len ${v.length}`, shape(v[0], d + 1)] : [];
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).slice(0, 40).map(([k, x]) => [k, shape(x, d + 1)]));
  return v === null ? "null" : typeof v;
};

class Session {
  constructor(key) { this.key = key; this.cookies = new Map(); this.csrf = null; this.log = []; }
  cookieHeader() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "); }
  keep(res) {
    for (const c of res.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); this.cookies.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim()); }
  }
  async login() {
    const a = accounts[this.key];
    const res = await fetch(`${BASE}/api/method/login`, { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Frappe-Site-Name": g.site }, body: new URLSearchParams({ usr: a.usr, pwd: a.pwd }) });
    this.keep(res);
    const page = await fetch(`${BASE}/app`, { redirect: "manual", headers: { Cookie: this.cookieHeader(), "X-Frappe-Site-Name": g.site } });
    this.keep(page);
    this.csrf = (await page.text()).match(/frappe\.csrf_token\s*=\s*"([^"]+)"/)?.[1] ?? null;
    return { status: res.status, csrf: !!this.csrf };
  }
  async call(method, args = {}, http = "POST", { csrf = true } = {}) {
    const headers = { Accept: "application/json", Cookie: this.cookieHeader(), "X-Frappe-Site-Name": g.site };
    let url = `${BASE}/api/method/${method}`, body;
    if (http === "GET") url += `?${new URLSearchParams(Object.entries(args).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]))}`;
    else { headers["Content-Type"] = "application/json"; if (csrf && this.csrf) headers["X-Frappe-CSRF-Token"] = this.csrf; body = JSON.stringify(args); }
    return this.finish(method, http, args, await fetch(url, { method: http, headers, body, redirect: "manual" }));
  }
  async upload({ doctype, docname, is_private, filename, content }) {
    const fd = new FormData();
    fd.set("doctype", doctype); fd.set("docname", docname); fd.set("is_private", is_private);
    fd.set("file", new Blob([content], { type: "text/plain" }), filename);
    const headers = { Accept: "application/json", Cookie: this.cookieHeader(), "X-Frappe-Site-Name": g.site, ...(this.csrf ? { "X-Frappe-CSRF-Token": this.csrf } : {}) };
    return this.finish("upload_file", "POST", { doctype, docname, is_private, filename }, await fetch(`${BASE}/api/method/upload_file`, { method: "POST", headers, body: fd, redirect: "manual" }));
  }
  async finish(method, http, args, res) {
    this.keep(res);
    const contentType = res.headers.get("content-type") ?? "";
    let body = null;
    if (contentType.includes("json")) { try { body = await res.json(); } catch { body = null; } } else { await res.arrayBuffer(); }
    const r = { status: res.status, exc_type: body?.exc_type ?? null, message: body?.message, body, contentType };
    this.log.push(redact({ as: this.key, user: accounts[this.key].usr, http, path: `/api/method/${method}`, args: shape(args), status: r.status, exc_type: r.exc_type, content_type: contentType, response_shape: shape(body) }));
    return r;
  }
}

const sessions = {};
async function as(key) { if (!sessions[key]) { sessions[key] = new Session(key); const l = await sessions[key].login(); if (l.status !== 200) throw new Error(`login of the ${key} account failed (HTTP ${l.status})`); } return sessions[key]; }

let versions = null;
try { versions = (await (await as("manager")).call("frappe.utils.change_log.get_versions", {}, "GET")).message; } catch (e) { console.error(`cannot log in as manager: ${e.message}`); process.exit(1); }
const environment = { url: BASE, site: g.site, frappe: versions?.frappe?.version ?? "unknown", apps: Object.keys(versions ?? {}), runner: `node ${process.version}`, when: new Date().toISOString(), approval: g.approval, flags: { write: WRITE, browser: BROWSER } };

const results = [];
for (const t of selected) {
  const skip = skipReason(t);
  const base = { requirement_ids: t.rows, test: t.id, feature: `${t.area}: ${t.feature}`, expected: t.expect, cite: t.cite, environment: { site: g.site, url: BASE, frappe: environment.frappe }, users: t.users.map((k) => accounts[k]?.usr ?? `${k} (no account)`), source: "real-server" };
  if (skip) { results.push({ ...base, result: "BLOCKED", actual: null, evidence: [], issue: skip }); console.log(`- ${t.id} BLOCKED (${skip})`); continue; }
  if (t.automated === "browser") { results.push({ ...base, ...(await runBrowser(t)) }); continue; }
  const checks = [], records = [];
  let blocked = null;
  const used = new Set();
  const ctx = {
    X, tag: TAG,
    as: (k) => { used.add(k); return new Proxy({}, { get: (_o, m) => async (...a) => (await as(k))[m](...a) }); },
    has: (k) => !!accounts[k],
    check: (label, ok, expected, actual) => checks.push({ label, ok: !!ok, expected, actual: redact(actual) }),
    record: (label, data) => records.push({ label, data: redact(data) }),
    block: (reason) => { blocked = reason; },
  };
  let error = null;
  try { await t.run(ctx); } catch (e) { error = `${e.name}: ${e.message}`; }
  const evidence = [...used].flatMap((k) => sessions[k]?.log.splice(0) ?? []);
  const result = error || checks.some((c) => !c.ok) ? "FAIL" : blocked || !checks.length ? "BLOCKED" : "PASS";
  results.push({ ...base, result, actual: { checks, records }, evidence, issue: error ?? blocked ?? (result === "FAIL" ? "see failed checks — compare with the expected Frappe behaviour, then file a package issue or correct the expectation" : "") });
  console.log(`${result === "PASS" ? "✔" : result === "FAIL" ? "✖" : "-"} ${t.id} ${result}${error ? ` — ${error}` : ""}`);
}

async function runBrowser(t) {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch();
  const evidence = [], checks = [];
  try {
    for (const key of t.users.filter((k) => accounts[k])) {
      const ctxb = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
      const page = await ctxb.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
      const login = await ctxb.request.post(`${harness}/api/method/login`, { form: { usr: accounts[key].usr, pwd: accounts[key].pwd } });
      const params = new URLSearchParams(harnessParams(t, key));
      await page.goto(`${harness}/?${params}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
      const shot = path.join(OUT, `${t.id}-${key}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      evidence.push({ as: key, url: `/?${params}`, login: login.status(), screenshot: path.basename(shot), page_errors: errors });
      checks.push({ label: `${key}: page renders without page errors`, ok: login.ok() && !errors.length, expected: "no page error", actual: errors });
      if (t.id === "L-HDR-1") {
        const add = page.getByRole("button", { name: /^\+?\s*Add /i });
        const before = await add.count();
        await page.locator("tbody input[type=checkbox], tbody [role=checkbox]").first().click();
        await page.waitForTimeout(300);
        const actions = await page.getByRole("button", { name: /Actions/i }).count();
        const addDuring = await add.count();
        await page.screenshot({ path: path.join(OUT, `${t.id}-${key}-selected.png`) });
        await page.locator("tbody input[type=checkbox], tbody [role=checkbox]").first().click();
        await page.waitForTimeout(300);
        const after = await add.count();
        checks.push({ label: "Add visible → Actions replaces it → Add restored", ok: before > 0 && actions > 0 && addDuring === 0 && after > 0, expected: { before: ">0", actions: ">0", addDuring: 0, after: ">0" }, actual: { before, actions, addDuring, after } });
      }
      if (t.id === "S-UI-1" && key === "reader") {
        const add = await page.getByRole("button", { name: /^\+?\s*Add /i }).count();
        checks.push({ label: "reader: no Add button", ok: add === 0, expected: 0, actual: add });
      }
      await ctxb.close();
    }
  } finally { await browser.close(); }
  const asserted = ["L-HDR-1", "S-UI-1"].includes(t.id);
  const failed = checks.some((c) => !c.ok);
  return { result: failed ? "FAIL" : asserted ? "PASS" : "BLOCKED", actual: { checks }, evidence, issue: failed ? "see checks" : asserted ? "" : "screenshots captured; the behaviour assertion is a manual review" };
}

function harnessParams(t, key) {
  const p = X.parents;
  if (t.id.startsWith("L-") || t.id === "S-UI-1") return { view: "list", doctype: "SFUI Test Parent", selection: "header", as: key };
  if (t.id.startsWith("V-")) return { view: "views", doctype: "SFUI Test Parent", as: key };
  return { view: "form", doctype: "SFUI Test Parent", name: p.draft_owned_by_writer[0], as: key };
}

// ---- per-row aggregation (same ids, same denominator as COVERAGE.md) -------------------------------------------------
const byTest = Object.fromEntries(results.map((r) => [r.test, r]));
const rowResults = rows.map((r) => {
  const { cat, sub, note } = categorize(r);
  const ts = testsForRow(r.id).filter((id) => byTest[id]);
  const rs = ts.map((id) => byTest[id].result);
  const result = cat === "na" ? "N/A" : !ts.length ? null : rs.includes("FAIL") ? "FAIL" : rs.every((x) => x === "PASS") ? "PASS" : "BLOCKED";
  return { requirement_id: r.id, requirement: r.req, p35_status: r.now, category: cat, sub: sub ?? null, note: note ?? null, tests: ts, result, source: ts.length ? "real-server" : "simulator / unit (P35 evidence; not re-run here)" };
});
const tally = (xs) => xs.reduce((a, x) => ({ ...a, [x ?? "not in scope"]: (a[x ?? "not in scope"] ?? 0) + 1 }), {});
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ ran: true, environment, frappe_reference: FRAPPE_REF, tests: results, rows: rowResults, totals: { tests: tally(results.map((r) => r.result)), rows: tally(rowResults.map((r) => r.result)) } }, null, 1));
fs.writeFileSync(path.join(OUT, "results.md"), [
  `# P36 real-site matrix — ${environment.site} (${environment.frappe}), ${environment.when}`, "",
  `Flags: write=${WRITE} browser=${BROWSER}. Tests: ${JSON.stringify(tally(results.map((r) => r.result)))}. Rows: ${JSON.stringify(tally(rowResults.map((r) => r.result)))}.`, "",
  "| Test | Rows | Feature | Users | Result | Issue |", "|---|---|---|---|---|---|",
  ...results.map((r) => `| ${r.test} | ${r.requirement_ids.join(" ")} | ${r.feature} | ${r.users.join(", ")} | ${r.result} | ${String(r.issue ?? "").replace(/\|/g, "/")} |`),
].join("\n") + "\n");
console.log(`\nresults: ${OUT}/results.json, results.md (credentials redacted)`);
process.exit(results.some((r) => r.result === "FAIL") ? 1 : 0);
