// @vitest-environment node
// P36 guards for e2e/frappe-site (real-site matrix runner, staging seed / teardown, legacy scripts). Everything here is
// local: no DNS, no network, no Frappe. Python is spawned as /usr/bin/python3 -I -B, which cannot import frappe, and the
// scripts run with SFUI_NO_FRAPPE=1 so reaching the frappe import is itself a refusal — proving the guards come first.
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  DENYLIST, GuardError, REPO_ROOT, checkPrivateDir, evaluateGuards, loadAccounts, parseAllowlist, parseStagingUrl,
  productionReason, readApproval, redact,
} from "../e2e/frappe-site/guards.mjs";
import { TESTS, categorize, parseCoverage, parseSection5, testsForRow } from "../e2e/frappe-site/matrix/catalogue.mjs";
import { render } from "../e2e/frappe-site/matrix/render.mjs";

const SITE_DIR = path.join(REPO_ROOT, "e2e/frappe-site");
const PY = "/usr/bin/python3";
const hasPy = fs.existsSync(PY);
const NOW = new Date("2026-11-08T12:00:00Z");
let tmp: string;
const mk = (name: string, mode = 0o700) => { const d = path.join(tmp, name); fs.mkdirSync(d, { recursive: true }); fs.chmodSync(d, mode); return d; };
const approval = (dir: string, extra: Record<string, unknown> = {}, mode = 0o600) => {
  const f = path.join(dir, "APPROVED_STAGING");
  fs.writeFileSync(f, JSON.stringify({ site: "sfui-staging.example.test", url: "https://staging.example.test", approved_by: "test", approved_at: "2026-11-08T00:00:00Z", isolated_from_production: true, allow_write: true, ...extra }));
  fs.chmodSync(f, mode);
};
const code = (fn: () => unknown) => { try { fn(); return "ok"; } catch (e) { return (e as GuardError).code ?? String(e); } };

beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfui-p36-guards-")); });
afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe("production deny list", () => {
  it("refuses every listed production name, the production suffixes and loopback, case- and dot-insensitively", () => {
    for (const n of DENYLIST.exact) expect(productionReason(n), n).not.toBeNull();
    for (const n of ["new-client.solvfaster.com", "INTERNAL.SOLVFASTER.COM.", "x.dev.drooby.ai", "localhost", "127.0.0.1", "127.9.9.9", "::1", "[::1]", "0.0.0.0"]) expect(productionReason(n), n).not.toBeNull();
    expect(productionReason("10.0.0.5", { local: ["10.0.0.5"] })).toMatch(/this machine/);
  });
  it("matches exact names and suffixes only — never substrings", () => {
    for (const n of ["staging-dev.example.test", "sfui-staging.example.test", "solvfaster.com.example.test", "devbox.example.test"]) expect(productionReason(n), n).toBeNull();
  });
  it("lists the site directory names seen on the shared server", () => {
    for (const n of ["internal.solvfaster.com", "pms.solvfaster.com", "hr.solvfaster.com", "pos.solvfaster.com", "aidev.solvfaster.com", "pmodev.solvfaster.com", "dev.drooby.ai", "test_vzad.localhost"]) expect(DENYLIST.exact).toContain(n);
  });
});

describe("staging URL and site allowlist", () => {
  it("refuses missing, non-http, credentialed, production and loopback URLs (incl. numeric loopback forms)", () => {
    expect(code(() => parseStagingUrl(undefined))).toBe("url-missing");
    expect(code(() => parseStagingUrl("ftp://staging.example.test"))).toBe("url-invalid");
    expect(code(() => parseStagingUrl("https://u:p@staging.example.test"))).toBe("url-credentials");
    for (const u of ["https://internal.solvfaster.com", "https://erp.solvfaster.com/app", "http://127.0.0.1:8000", "http://2130706433/", "http://0x7f.1/", "http://[::1]:8000", "http://localhost:18104"]) expect(code(() => parseStagingUrl(u)), u).toBe("url-production");
  });
  it("accepts a staging URL", () => {
    expect(parseStagingUrl("https://staging.example.test/").origin).toBe("https://staging.example.test");
  });
  it("needs an explicit allowlist without any production entry", () => {
    expect(code(() => parseAllowlist(""))).toBe("site-missing");
    expect(code(() => parseAllowlist("sfui-staging.example.test, pms.solvfaster.com"))).toBe("site-production");
    expect(parseAllowlist("a.example.test, b.example.test")).toEqual(["a.example.test", "b.example.test"]);
  });
});

describe("private directory and approval", () => {
  it("refuses a private dir inside the repo, inside any git work tree, missing, or not mode 700", () => {
    expect(code(() => checkPrivateDir(path.join(REPO_ROOT, "e2e")))).toBe("private-in-repo");
    const g = mk("gitrepo/inner");
    fs.mkdirSync(path.join(tmp, "gitrepo/.git"));
    expect(code(() => checkPrivateDir(g))).toBe("private-in-repo");
    expect(code(() => checkPrivateDir(path.join(tmp, "nope")))).toBe("private-absent");
    expect(code(() => checkPrivateDir(mk("open", 0o755)))).toBe("private-mode");
    expect(checkPrivateDir(mk("ok"))).toBe(path.join(tmp, "ok"));
  });
  it("needs an APPROVED_STAGING naming the allowlisted site, the same origin, isolation, a recent date and allow_write for --write", () => {
    const url = new URL("https://staging.example.test");
    const allowlist = ["sfui-staging.example.test"];
    const d = mk("appr");
    const read = (o: { write?: boolean } = {}) => code(() => readApproval(d, { url, allowlist, now: NOW, ...o }));
    expect(read()).toBe("approval-missing");
    approval(d, {}, 0o644); expect(read()).toBe("approval-mode");
    approval(d, { site: "other.example.test" }); expect(read()).toBe("approval-site");
    approval(d, { site: "pos.solvfaster.com" }); expect(read()).toBe("approval-production");
    approval(d, { url: "https://other.example.test" }); expect(read()).toBe("approval-url");
    approval(d, { isolated_from_production: false }); expect(read()).toBe("approval-isolation");
    approval(d, { approved_at: "2026-09-01T00:00:00Z" }); expect(read()).toBe("approval-stale");
    approval(d, { approved_by: "" }); expect(read()).toBe("approval-invalid");
    approval(d, { allow_write: false }); expect(read()).toBe("ok"); expect(read({ write: true })).toBe("approval-write");
    approval(d); expect(read({ write: true })).toBe("ok");
  });
  it("loads only synthetic @example.com accounts from a mode-600 accounts.json", () => {
    const d = mk("acc");
    const f = path.join(d, "accounts.json");
    const all = (usr: (k: string) => string) => ({ accounts: Object.fromEntries(["manager", "writer", "reader", "restricted", "field"].map((k) => [k, { usr: usr(k), pwd: "x" }])) });
    fs.writeFileSync(f, JSON.stringify(all((k) => `sfui-${k}@example.com`))); fs.chmodSync(f, 0o644);
    expect(code(() => loadAccounts(d))).toBe("accounts-mode");
    fs.chmodSync(f, 0o600);
    expect(Object.keys(loadAccounts(d))).toHaveLength(5);
    fs.writeFileSync(f, JSON.stringify(all((k) => (k === "manager" ? "admin@solvfaster.com" : `sfui-${k}@example.com`))));
    expect(code(() => loadAccounts(d))).toBe("accounts-invalid");
  });
  it("evaluateGuards reports every verdict and does not check the approval after an earlier failure", () => {
    const d = mk("eval"); approval(d);
    const env = { SFUI_STAGING_URL: "https://staging.example.test", SFUI_STAGING_SITE: "sfui-staging.example.test", SFUI_STAGING_PRIVATE: d };
    expect(evaluateGuards({ env, now: NOW, local: [] }).ok).toBe(true);
    const bad = evaluateGuards({ env: { ...env, SFUI_STAGING_URL: "https://internal.solvfaster.com" }, now: NOW, local: [] });
    expect(bad.ok).toBe(false);
    expect(bad.verdicts.find((v) => v.check.startsWith("owner approval"))?.code).toBe("approval-unchecked");
  });
});

describe("redaction", () => {
  it("removes passwords, session ids, CSRF tokens and cookies from anything recorded", () => {
    const r = redact({ usr: "sfui-reader@example.com", pwd: "FAKE-PWD-NOT-A-SECRET", headers: { Cookie: "sid=abc", "X-Frappe-CSRF-Token": "tok" }, csrf_token: "tok", list: [{ api_secret: "s" }], note: "Set-Cookie: sid=abcdef; Path=/", body: '{"pwd":"FAKE-PWD-NOT-A-SECRET"}' });
    const s = JSON.stringify(r);
    for (const secret of ["FAKE-PWD-NOT-A-SECRET", "abcdef", '"tok"', '"s"']) expect(s).not.toContain(secret);
    expect(r.usr).toBe("sfui-reader@example.com");
  });
});

const node = (args: string[], env: Record<string, string>) => spawnSync(process.execPath, [path.join(SITE_DIR, "run-matrix.mjs"), ...args], { env: { PATH: "/usr/bin:/bin", ...env }, cwd: tmp, encoding: "utf8", timeout: 30000 });

describe("run-matrix.mjs refusals (no network)", () => {
  it("--dry-run with fake staging values: every guard passes, the plan prints, nothing is contacted", () => {
    const d = mk("dry-ok"); approval(d, { approved_at: new Date().toISOString() });
    const r = node(["--dry-run", "--write"], { SFUI_STAGING_URL: "https://staging.example.test", SFUI_STAGING_SITE: "sfui-staging.example.test", SFUI_STAGING_PRIVATE: d });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/PLAN \(\d+ tests\)/);
    expect(r.stdout).toMatch(/nothing was contacted/);
    expect(r.stdout).toMatch(/"applicable_rows":301/);
  }, 30000);
  it("refuses a production URL, a missing approval, and a real run against production (exit 2 before any request)", () => {
    const d = mk("dry-prod"); approval(d, { approved_at: new Date().toISOString() });
    const base = { SFUI_STAGING_SITE: "sfui-staging.example.test", SFUI_STAGING_PRIVATE: d };
    const prod = node(["--dry-run"], { ...base, SFUI_STAGING_URL: "https://internal.solvfaster.com" });
    expect(prod.status).toBe(2);
    expect(prod.stdout).toMatch(/REFUSED staging URL is not production: .*internal\.solvfaster\.com/);
    const none = node(["--dry-run"], { ...base, SFUI_STAGING_URL: "https://staging.example.test", SFUI_STAGING_PRIVATE: mk("dry-none") });
    expect(none.status).toBe(2);
    expect(none.stdout).toMatch(/REFUSED owner approval .*no APPROVED_STAGING/);
    const real = node(["--write"], { ...base, SFUI_STAGING_URL: "http://127.0.0.1:8000" });
    expect(real.status).toBe(2);
    expect(real.stderr).toMatch(/nothing was contacted/);
  }, 30000);
  it("refuses a harness URL other than the local guarded preview", () => {
    const d = mk("dry-h"); approval(d, { approved_at: new Date().toISOString() });
    const r = node(["--dry-run", "--browser"], { SFUI_STAGING_URL: "https://staging.example.test", SFUI_STAGING_SITE: "sfui-staging.example.test", SFUI_STAGING_PRIVATE: d, SFUI_HARNESS_URL: "https://pms.solvfaster.com" });
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/REFUSED harness URL/);
  }, 30000);
  it("legacy validate.mjs refuses anything but the guarded harness", () => {
    const r = spawnSync(process.execPath, [path.join(SITE_DIR, "validate.mjs"), "https://pms.solvfaster.com", tmp, tmp], { cwd: tmp, encoding: "utf8", timeout: 30000 });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/REFUSED \(P36\)/);
  }, 30000);
});

const py = (script: string, args: string[], env: Record<string, string> = {}, cwd = tmp) =>
  spawnSync(PY, ["-I", "-B", path.join(SITE_DIR, script), ...args], { env: { PATH: "/usr/bin:/bin", SFUI_NO_FRAPPE: "1", ...env }, cwd, encoding: "utf8", timeout: 30000 });

describe.skipIf(!hasPy)("Python staging seed / teardown guards (python without frappe)", () => {
  const site = "sfui-staging.example.test";
  it("plan mode prints the plan without importing frappe", () => {
    const r = py("staging-seed.py", [site, mk("py-plan")], { SFUI_STAGING_SITE: site });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/PLAN for STAGING site/);
    expect(r.stdout).toMatch(/sfui-restricted@example\.com/);
  }, 30000);
  it("refuses production sites, a missing allowlist, a missing approval — and reaches the frappe import only after every guard", () => {
    const d = mk("py-apply");
    const prod = py("staging-seed.py", ["internal.solvfaster.com", d, "--apply"], { SFUI_STAGING_SITE: "internal.solvfaster.com" });
    expect(prod.status).toBe(2); expect(prod.stderr).toMatch(/REFUSED: .*production/);
    const noList = py("staging-seed.py", [site, d, "--apply"]);
    expect(noList.status).toBe(2); expect(noList.stderr).toMatch(/SFUI_STAGING_SITE/);
    const noAppr = py("staging-seed.py", [site, d, "--apply"], { SFUI_STAGING_SITE: site });
    expect(noAppr.status).toBe(2); expect(noAppr.stderr).toMatch(/no APPROVED_STAGING/);
    approval(d, { approved_at: new Date().toISOString(), allow_write: false });
    const noWrite = py("staging-seed.py", [site, d, "--apply"], { SFUI_STAGING_SITE: site });
    expect(noWrite.status).toBe(2); expect(noWrite.stderr).toMatch(/allow_write/);
    approval(d, { approved_at: new Date().toISOString() });
    const reached = py("staging-seed.py", [site, d, "--apply"], { SFUI_STAGING_SITE: site });
    expect(reached.status).toBe(2); expect(reached.stderr).toMatch(/SFUI_NO_FRAPPE=1/);
    const td = py("staging-teardown.py", ["hr.solvfaster.com", d, "--execute"], { SFUI_STAGING_SITE: "hr.solvfaster.com" });
    expect(td.status).toBe(2); expect(td.stderr).toMatch(/REFUSED: .*production/);
  }, 30000);
  it("refuses to run from inside a production bench (checked by path, nothing is run there)", () => {
    const r = spawnSync(PY, ["-I", "-B", "-c", `import sys; sys.path.insert(0, ${JSON.stringify(SITE_DIR)}); import staging_guards as G; G.check_cwd("/home/frappe/lovable_bench/sites")`], { env: { PATH: "/usr/bin:/bin" }, cwd: tmp, encoding: "utf8" });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/inside the production bench/);
  });
  it("the production CRM scripts are disabled with the P36 message (kept, not deleted)", () => {
    for (const s of ["seed-crm-site.py", "teardown-crm-site.py"]) {
      const r = py(s, ["internal.solvfaster.com", mk(`crm-${s}`), "--apply"]);
      expect(r.status, s).toBe(1);
      expect(r.stderr, s).toMatch(/REFUSED \(P36\): .*production site internal\.solvfaster\.com/);
    }
  }, 30000);
  it("the legacy ToDo seed refuses without the staging allowlist", () => {
    const r = py("seed.py", ["sfui-test.localhost", mk("legacy")]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/SFUI_STAGING_SITE/);
  }, 30000);
});

describe("P36 validation matrix", () => {
  const md = fs.readFileSync(path.join(REPO_ROOT, "docs/audit/p35/COVERAGE.md"), "utf8");
  const rows = parseCoverage(md);
  const ids = new Set(rows.map((r) => r.id));
  it("maps every COVERAGE row, same ids, denominator 301", () => {
    expect(rows).toHaveLength(307);
    const cats = rows.map((r) => categorize(r).cat);
    expect(cats.filter((c) => c === "na")).toHaveLength(6);
    expect(cats.filter((c) => ["a", "b", "c", "d", "e"].includes(c))).toHaveLength(301);
    expect(rows.filter((r) => categorize(r).cat === "d").map((r) => r.id).sort()).toEqual(["FV.I9", "FV.L7", "LV.A6b", "LV.C14", "LV.F19"]);
  });
  it("every (c), (d) and (e) row has a concrete test, every test names existing rows, and every §5 row is (c) or (e)", () => {
    for (const r of rows) if (["c", "d", "e"].includes(categorize(r).cat)) expect(testsForRow(r.id), r.id).not.toHaveLength(0);
    for (const t of TESTS) for (const id of t.rows) expect(ids.has(id), `${t.id} → ${id}`).toBe(true);
    const s5 = parseSection5(md);
    expect(s5).toHaveLength(62);
    for (const id of s5) expect(["c", "e"], id).toContain(categorize(rows.find((r) => r.id === id)!).cat);
    for (const t of TESTS) {
      expect(t.cite.length, t.id).toBeGreaterThan(0);
      if (t.automated === "api") expect(typeof (t as { run?: unknown }).run, t.id).toBe("function");
    }
  });
  it("docs/audit/p36/VALIDATION-MATRIX.md is the rendering of the catalogue", () => {
    expect(fs.readFileSync(path.join(REPO_ROOT, "docs/audit/p36/VALIDATION-MATRIX.md"), "utf8")).toBe(render());
  });
});
