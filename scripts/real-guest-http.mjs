// REAL Frappe over HTTP, as Guest, through the package's own built client (dist/frappe/client.js).
// Read-only: anonymous requests only (no login, no session, no writes). Target: the bench's gunicorn on 127.0.0.1:8003
// with the site's Host header. Records each raw HTTP response (status + JSON body, tracebacks removed) and what the
// package derived from it, into tests/fixtures/real-15.110-sada/guest-http.json.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { createFrappeClient } = await import(path.join(root, "dist/frappe/client.js"));
const HOST = process.argv[2] ?? "internal.solvfaster.com";
const raw = [];

/** fetch-compatible: forwards to 127.0.0.1:8003 with the site's Host header and records the raw response. */
function siteFetch(url, init = {}) {
  const u = new URL(url, "http://placeholder");
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: 8003, method: init.method ?? "GET", path: u.pathname + u.search,
      headers: { ...(init.headers ?? {}), Host: HOST } }, (res) => {
      let body = ""; res.setEncoding("utf8"); res.on("data", (c) => (body += c));
      res.on("end", () => {
        let json = null; try { json = JSON.parse(body); } catch { json = { _non_json: body.slice(0, 120) }; }
        if (json && typeof json === "object") { delete json.exc; delete json.exception; delete json._debug_messages; }
        raw.push({ request: { method: init.method, path: u.pathname, csrfHeader: init.headers?.["X-Frappe-CSRF-Token"] ?? null }, status: res.statusCode, body: json });
        resolve(new Response(body, { status: res.statusCode, headers: { "content-type": res.headers["content-type"] ?? "" } }));
      });
    });
    req.on("error", reject); if (init.body) req.write(init.body); req.end();
  });
}

const results = [];
const run = async (name, fn) => {
  try { const v = await fn(); results.push({ name, ok: true, value: v }); }
  catch (e) { results.push({ name, ok: false, error: { name: e.name, status: e.status, excType: e.excType, kind: e.kind, message: e.message, messages: e.messages } }); }
};
const guest = createFrappeClient({ fetch: siteFetch, csrfToken: () => undefined });
const bogusCsrf = createFrappeClient({ fetch: siteFetch, csrfToken: "bogus-token" });

await run("getMetaBundle(Sada Post Type) as Guest", () => guest.getMetaBundle("Sada Post Type"));
await run("getList(Sada Post Type) as Guest", () => guest.getList("Sada Post Type", { fields: ["name"] }));
await run("reportview.get(Sada Post Type) as Guest", () => guest.call("frappe.desk.reportview.get", { doctype: "Sada Post Type", fields: '["name"]' }));
await run("searchLink(Sada Post Type) as Guest", () => guest.searchLink("Sada Post Type", ""));
await run("getDoc(Sada Post Type, post Type1) as Guest", () => guest.getDoc("Sada Post Type", "post Type1"));
await run("unknown method as Guest", () => guest.call("frappe.no_such_module.no_such_method", {}));
await run("getMetaBundle with a bogus CSRF header as Guest", () => bogusCsrf.getMetaBundle("Sada Post Type"));

const out = path.join(root, "tests/fixtures/real-15.110-sada/guest-http.json");
fs.writeFileSync(out, JSON.stringify({ _meta: { host: HOST, target: "127.0.0.1:8003", note: "anonymous requests; tracebacks removed" }, raw, results }, null, 1));
for (const r of results) console.log(r.ok ? "OK  " : "ERR ", r.name, "→", r.ok ? JSON.stringify(r.value).slice(0, 80) : `${r.error.status} kind=${r.error.kind} exc=${r.error.excType} msg=${(r.error.message || "").slice(0, 70)}`);
