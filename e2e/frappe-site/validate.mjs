// Real-site validation of @solvfast/ui's Frappe layer — READ-ONLY. PREPARED, NOT RUN (deferred; see README.md).
//   node e2e/frappe-site/validate.mjs <harnessUrl> <privateDir> <outDir>
// <privateDir> holds validator.json (the test account; never printed or saved elsewhere) and expected.json (seed.py:
// totals computed in Python from the inserted rows). Writes results.json, results.md and screenshots to <outDir>.
// Only reads: login (creates a session), getdoctype, get_list, get_count, search_link, has_permission, the /app page.
import fs from "node:fs";
import { chromium } from "playwright-core";

const [BASE, PRIV, OUT] = process.argv.slice(2);
const creds = JSON.parse(fs.readFileSync(`${PRIV}/validator.json`, "utf8"));
const X = JSON.parse(fs.readFileSync(`${PRIV}/expected.json`, "utf8"));
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(id, name, ok, expected, actual) {
  results.push({ id, name, ok: !!ok, expected, actual });
  console.log(`${ok ? "✔" : "✖"} ${id} ${name}${ok ? "" : ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const login = await ctx.request.post(`${BASE}/api/method/login`, { form: { usr: creds.usr, pwd: creds.pwd } });
check("L0", "the read-only validation account logs in", login.ok(), 200, login.status());

const parse = (v) => (typeof v === "string" ? JSON.parse(v) : v);
async function open(lang = "en") {
  const page = await ctx.newPage();
  const posts = [];
  page.on("request", (r) => {
    if (!r.url().includes("/api/method/") || r.method() !== "POST") return;
    let args = {};
    try { args = JSON.parse(r.postData() || "{}"); } catch { /* form body */ }
    posts.push({ method: r.url().split("/api/method/")[1], args, csrf: !!r.headers()["x-frappe-csrf-token"] });
  });
  page.on("pageerror", (e) => check("PE", `no page error (${e.message.slice(0, 80)})`, false, "none", e.message));
  await page.goto(`${BASE}/?due=${X.due_on.date}&created=${X.created_on.date}&lang=${lang}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelectorAll("tbody tr:not([aria-hidden])").length > 0 || document.querySelector("[role=alert]"), null, { timeout: 20000 });
  return { page, posts };
}
const last = (posts, method) => {
  const p = posts.filter((x) => x.method === method).at(-1);
  return p && { ...p.args, fields: parse(p.args.fields), filters: parse(p.args.filters), or_filters: parse(p.args.or_filters), csrf: p.csrf };
};
const settle = async (page) => { await page.waitForTimeout(600); await page.waitForLoadState("networkidle"); await page.waitForTimeout(200); };
const total = async (page) => Number((await page.getByText(/^Total: \d+$/).first().textContent()).match(/\d+/)[0]);
const rows = (page) => page.locator("tbody tr:not([aria-hidden]):not([data-group-header])").count();
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });
const human = (page) => page.waitForTimeout(300); // a person's pace between choices (Radix focus hand-back)
async function closePopover(page) {
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" }).catch(() => {});
}

// V1 list loading
{
  const { page, posts } = await open();
  await settle(page);
  const l = last(posts, "frappe.client.get_list"), c = last(posts, "frappe.desk.reportview.get_count");
  check("V1", "list loads: first page and the total", (await rows(page)) === Math.min(20, X.total) && (await total(page)) === X.total,
    { rows: Math.min(20, X.total), total: X.total }, { rows: await rows(page), total: await total(page) });
  check("V1b", "only the visible columns' fields + name are fetched, in the DocType's default order, with the CSRF header",
    same(l?.fields, ["name", "description", "status", "priority", "date", "reference_type"]) && l?.order_by === "modified desc" && l?.limit_page_length === 20 && l?.csrf,
    { fields: ["name", "description", "status", "priority", "date", "reference_type"], order_by: "modified desc", csrf: true },
    { fields: l?.fields, order_by: l?.order_by, csrf: l?.csrf });
  check("V1c", "the total comes from reportview.get_count with the same filters as the rows",
    !!c && same(c.filters, l.filters) && same(c.or_filters, l.or_filters), "same filters", c ? { filters: c.filters, or_filters: c.or_filters } : "no count request");
  check("V1d", "rich-text descriptions show as text (no HTML tags)", !(await page.locator("tbody").innerText()).includes("<p>"), "no <p>", "checked");
  await shot(page, "v1-list");
  await page.close();
}

// V2 search
{
  const { page, posts } = await open();
  await settle(page);
  const before = posts.filter((p) => p.method === "frappe.client.get_list").length;
  const input = page.getByPlaceholder("Search…");
  await input.pressSequentially(X.search.text, { delay: 60 });
  await settle(page);
  const after = posts.filter((p) => p.method === "frappe.client.get_list").length;
  const l = last(posts, "frappe.client.get_list");
  check("V2", `search “${X.search.text}”: total`, (await total(page)) === X.search.count, X.search.count, await total(page));
  check("V2b", "search uses or_filters across the DocType's search fields", same(l.or_filters, X.search.fields.map((f) => [f, "like", `%${X.search.text}%`])),
    X.search.fields.map((f) => [f, "like", `%${X.search.text}%`]), l.or_filters);
  check("V2c", "one row request for the whole typed word (debounced)", after - before === 1, 1, after - before);
  await shot(page, "v2-search");
  await page.close();
}

// V3 Match any / Match all
{
  const { page, posts } = await open();
  await settle(page);
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByRole("button", { name: "Add filter" }).click();
  await dlg.getByRole("button", { name: "Add filter" }).click();
  await dlg.getByRole("combobox", { name: "Field" }).nth(1).click();
  await page.getByRole("option", { name: "Priority", exact: true }).click(); await human(page);
  await dlg.getByRole("combobox", { name: "Value" }).nth(0).click();
  await page.getByRole("option", { name: "Open", exact: true }).click(); await human(page);
  await dlg.getByRole("combobox", { name: "Value" }).nth(1).click();
  await page.getByRole("option", { name: "High", exact: true }).click(); await human(page);
  await dlg.getByRole("combobox", { name: "Match" }).click();
  await page.getByRole("option", { name: "Match any" }).click(); await human(page);
  await closePopover(page);
  await settle(page);
  const c = last(posts, "frappe.desk.reportview.get_count");
  check("V3", "Match any (Status = Open or Priority = High): total", (await total(page)) === X.match_any.count, X.match_any.count, await total(page));
  check("V3b", "the count request carries the OR conditions as or_filters", same(c.or_filters, [["status", "=", "Open"], ["priority", "=", "High"]]) && same(c.filters, []),
    { filters: [], or_filters: [["status", "=", "Open"], ["priority", "=", "High"]] }, { filters: c.filters, or_filters: c.or_filters });
  await shot(page, "v3-match-any");
  await page.getByRole("button", { name: /^Filter/ }).click();
  await page.getByRole("dialog").getByRole("combobox", { name: "Match" }).click();
  await page.getByRole("option", { name: "Match all" }).click(); await human(page);
  await closePopover(page);
  await settle(page);
  check("V3c", "Match all (Status = Open and Priority = High): total", (await total(page)) === X.match_all.count, X.match_all.count, await total(page));
  await page.close();
}

// V4 link search
{
  const { page, posts } = await open();
  await settle(page);
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByRole("button", { name: "Add filter" }).click();
  await dlg.getByRole("combobox", { name: "Field" }).click();
  await page.getByRole("option", { name: "Allocated To", exact: true }).click(); await human(page);
  await dlg.getByRole("combobox", { name: "Value" }).click();
  await page.getByRole("option", { name: X.link.value }).waitFor({ timeout: 10000 });
  const s = last(posts, "frappe.desk.search.search_link");
  const options = await page.getByRole("option").allInnerTexts();
  check("V4", "link search asks Frappe's search_link on the field's DocType", s?.doctype === "User" && s?.reference_doctype === "ToDo",
    { doctype: "User", reference_doctype: "ToDo" }, { doctype: s?.doctype, reference_doctype: s?.reference_doctype });
  check("V4b", "the synthetic users are offered", X.users.every((u) => options.some((o) => o.includes(u))), X.users, options);
  await shot(page, "v4-link-search");
  await page.getByRole("option", { name: X.link.value }).click(); await human(page);
  await closePopover(page);
  await settle(page);
  check("V4c", `Allocated To = ${X.link.value}: total`, (await total(page)) === X.link.count, X.link.count, await total(page));
  await page.close();
}

// V5–V7 saved filters: dates and a removed field
for (const [id, label, exp, filters] of [
  ["V5", "Due on the date", X.due_on.count, [["date", "=", X.due_on.date]]],
  ["V6", "Created on the date", X.created_on.count, [["creation", "between", [X.created_on.date, X.created_on.date]]]],
  ["V7", "Old view", X.open.count, [["status", "=", "Open"]]],
]) {
  const { page, posts } = await open();
  await settle(page);
  await page.getByRole("button", { name: "Saved", exact: true }).click();
  await page.getByRole("button", { name: label, exact: true }).click();
  await closePopover(page);
  await settle(page);
  const l = last(posts, "frappe.client.get_list");
  const name = { V5: `Due Date = ${X.due_on.date}: total`, V6: `Created On = ${X.created_on.date} covers the whole day: total`, V7: "an old saved filter on a removed field still loads (the field is dropped)" }[id];
  check(id, name, (await total(page)) === exp && !(await page.getByRole("alert").count()), exp, await total(page));
  check(`${id}b`, "request filters", same(l.filters, filters), filters, l.filters);
  await shot(page, `${id.toLowerCase()}-saved-${label.toLowerCase().replace(/\W+/g, "-")}`);
  await page.close();
}

// Arabic: standard fields localized on the real site
{
  const { page } = await open("ar");
  await settle(page);
  await page.getByRole("button", { name: "تصفية", exact: true }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByRole("button", { name: "إضافة عامل تصفية" }).click();
  await dlg.getByRole("combobox", { name: "الحقل" }).click();
  const opts = await page.getByRole("option").allInnerTexts();
  check("V8", "Arabic: ID / Created On / Last Updated are localized", ["المعرّف", "تاريخ الإنشاء", "آخر تحديث"].every((o) => opts.includes(o)), ["المعرّف", "تاريخ الإنشاء", "آخر تحديث"], opts.slice(-3));
  await shot(page, "v8-arabic-fields");
  await page.close();
}

// R — direct read-only calls from the page (same origin, the account's session)
{
  const { page } = await open();
  await settle(page);
  const call = (method, args, withCsrf = true) => page.evaluate(async ([m, a, c]) => {
    const r = await fetch(`/api/method/${m}`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", ...(c ? { "X-Frappe-CSRF-Token": window.csrf_token } : {}) }, body: JSON.stringify(a) });
    let b = {}; try { b = await r.json(); } catch { /* not JSON */ }
    return { status: r.status, exc_type: b.exc_type ?? null, message: b.message ?? null };
  }, [method, args, withCsrf]);
  const J = JSON.stringify;
  const anyOr = J([["status", "=", "Open"], ["priority", "=", "High"]]);

  const noCsrf = await call("frappe.desk.reportview.get_count", { doctype: "ToDo", filters: "[]", or_filters: "[]" }, false);
  const withCsrf = await call("frappe.desk.reportview.get_count", { doctype: "ToDo", filters: "[]", or_filters: "[]" });
  check("R1", "CSRF: a POST without the token is refused", noCsrf.status >= 400 && noCsrf.exc_type === "CSRFTokenError", "4xx CSRFTokenError", noCsrf);
  check("R1b", "CSRF: the same POST with the token succeeds", withCsrf.status === 200 && withCsrf.message === X.total, X.total, withCsrf);
  const w = await call("frappe.client.has_permission", { doctype: "ToDo", docname: X.a_todo, perm_type: "write" });
  const r = await call("frappe.client.has_permission", { doctype: "ToDo", docname: X.a_todo, perm_type: "read" });
  check("R2", "the account is read-only on ToDo (asked, not attempted)", w.message?.has_permission === false && r.message?.has_permission === true,
    { write: false, read: true }, { write: w.message?.has_permission, read: r.message?.has_permission });
  const searCount = await call("frappe.client.get_count", { doctype: "ToDo", filters: "[]", or_filters: anyOr });
  const ourCount = await call("frappe.desk.reportview.get_count", { doctype: "ToDo", filters: "[]", or_filters: anyOr });
  check("R3", "Sear's count call (frappe.client.get_count) ignores or_filters on Frappe 15; reportview.get_count honours them",
    searCount.message === X.total && ourCount.message === X.match_any.count && X.total !== X.match_any.count,
    { "frappe.client.get_count": X.total, "reportview.get_count": X.match_any.count }, { "frappe.client.get_count": searCount.message, "reportview.get_count": ourCount.message });
  const unknown = await call("frappe.client.get_list", { doctype: "ToDo", fields: J(["name"]), filters: J([["old_priority_field", "=", "x"]]) });
  check("R4", "a filter on a removed field makes Frappe reject the request (why the package drops it)", unknown.status === 417 && unknown.exc_type === "DataError", "417 DataError", unknown);
  const midnight = await call("frappe.desk.reportview.get_count", { doctype: "ToDo", filters: J([["creation", "=", X.created_on.date]]), or_filters: "[]" });
  const day = await call("frappe.desk.reportview.get_count", { doctype: "ToDo", filters: J([["creation", "between", [X.created_on.date, X.created_on.date]]]), or_filters: "[]" });
  check("R5", "Created On = date compares with midnight only (Sear); between covers the day (package)",
    midnight.message === X.created_on.at_midnight && day.message === X.created_on.count,
    { equals: X.created_on.at_midnight, between: X.created_on.count }, { equals: midnight.message, between: day.message });
  await page.close();
}

await browser.close();
const ok = results.every((r) => r.ok);
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ site: "sfui-test.localhost (isolated, synthetic)", frappe: "15.110.0", when: new Date().toISOString(), ok, results }, null, 1));
fs.writeFileSync(`${OUT}/results.md`, [`# Live validation — ${ok ? "PASS" : "FAIL"} (${results.filter((r) => r.ok).length}/${results.length})`, "",
  "| | Check | Expected | Actual |", "|---|---|---|---|",
  ...results.map((r) => `| ${r.ok ? "✔" : "✖"} ${r.id} | ${r.name} | \`${JSON.stringify(r.expected)}\` | \`${JSON.stringify(r.actual)}\` |`)].join("\n") + "\n");
console.log(ok ? `\n✔ all ${results.length} checks passed` : `\n✖ ${results.filter((r) => !r.ok).length} of ${results.length} failed`);
process.exit(ok ? 0 : 1);
