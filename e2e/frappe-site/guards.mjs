// P36 safety guards for the real-site matrix runner (run-matrix.mjs) and the harness (vite.config.ts).
// PREPARED, NOT RUN against any site. Everything here is local: no DNS, no network, no Frappe import.
//
// A run is allowed only when ALL hold (each one is a separate verdict so --dry-run can show every failure):
//   1. SFUI_STAGING_URL parses (http/https), and its host is not production: not in production-denylist.json (exact or
//      suffix), not loopback / unspecified, not a literal address of this machine;
//   2. SFUI_STAGING_SITE is an explicit allowlist (comma-separated) of which no entry is production;
//   3. SFUI_STAGING_PRIVATE is a directory outside this repository and outside every git work tree, mode 700;
//   4. <private>/APPROVED_STAGING (JSON) names the site (in the allowlist), the URL (same origin as SFUI_STAGING_URL),
//      approved_by, approved_at (≤ 30 days old), isolated_from_production: true — and allow_write: true for --write.
// Credentials are read only from <private>/accounts.json (mode 600) and never printed: use redact() on anything logged.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "../..");
export const DENYLIST = JSON.parse(fs.readFileSync(path.join(HERE, "production-denylist.json"), "utf8"));
export const APPROVAL_FILE = "APPROVED_STAGING";
export const ACCOUNTS_FILE = "accounts.json";
export const ACCOUNT_KEYS = ["manager", "writer", "reader", "restricted", "field"];
export const MAX_APPROVAL_AGE_DAYS = 30;

export class GuardError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GuardError";
    this.code = code;
  }
}

/** Lower-case, no trailing dot, no IPv6 brackets, no port. */
export function normalizeHost(host) {
  let h = String(host ?? "").trim().toLowerCase();
  if (h.startsWith("[")) h = h.slice(1, h.indexOf("]") > 0 ? h.indexOf("]") : undefined);
  else if ((h.match(/:/g) ?? []).length === 1) h = h.split(":")[0];
  return h.replace(/\.+$/, "");
}

/** The literal addresses of this machine (no DNS). */
export function localAddresses() {
  const out = new Set();
  for (const list of Object.values(os.networkInterfaces())) for (const a of list ?? []) out.add(normalizeHost(a.address));
  try { out.add(normalizeHost(os.hostname())); } catch { /* no hostname */ }
  return [...out];
}

/** Why a host / site name is production (or forbidden), or null. Exact names and suffixes only — never substrings. */
export function productionReason(name, { local = [] } = {}) {
  const h = normalizeHost(name);
  if (!h) return "empty name";
  if (DENYLIST.exact.includes(h)) return `${h} is a production site on the shared server (production-denylist.json)`;
  const suffix = DENYLIST.suffixes.find((s) => h.endsWith(s));
  if (suffix) return `${h} matches the production domain *${suffix}`;
  if (DENYLIST.loopback.includes(h) || DENYLIST.loopback_prefixes.some((p) => h.startsWith(p)) || h.startsWith("::ffff:127.") || h.startsWith("::ffff:7f"))
    return `${h} is loopback / unspecified: on the shared server those ports are production Frappe processes`;
  if (local.map(normalizeHost).includes(h)) return `${h} is an address of this machine (production server)`;
  return null;
}

export function parseStagingUrl(raw, { local = [] } = {}) {
  if (!raw) throw new GuardError("url-missing", "SFUI_STAGING_URL is not set");
  let u;
  try { u = new URL(raw); } catch { throw new GuardError("url-invalid", `SFUI_STAGING_URL is not a URL`); }
  if (!/^https?:$/.test(u.protocol)) throw new GuardError("url-invalid", `SFUI_STAGING_URL must be http(s), got ${u.protocol}`);
  if (u.username || u.password) throw new GuardError("url-credentials", "SFUI_STAGING_URL must not carry credentials");
  const why = productionReason(u.hostname, { local });
  if (why) throw new GuardError("url-production", `refusing SFUI_STAGING_URL: ${why}`);
  return u;
}

export function parseAllowlist(raw, { local = [] } = {}) {
  const list = String(raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!list.length) throw new GuardError("site-missing", "SFUI_STAGING_SITE (the explicit allowlist of staging site names) is not set");
  for (const s of list) {
    const why = productionReason(s, { local });
    if (why) throw new GuardError("site-production", `refusing SFUI_STAGING_SITE entry: ${why}`);
  }
  return list;
}

/** The nearest ancestor (or the dir itself) that holds a `.git`, or null. */
export function findGitAncestor(dir) {
  let d = path.resolve(dir);
  for (;;) {
    if (fs.existsSync(path.join(d, ".git"))) return d;
    const up = path.dirname(d);
    if (up === d) return null;
    d = up;
  }
}

const isInside = (child, parent) => {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
};

export function checkPrivateDir(raw, { repoRoot = REPO_ROOT } = {}) {
  if (!raw) throw new GuardError("private-missing", "SFUI_STAGING_PRIVATE is not set");
  const p = path.resolve(raw);
  if (isInside(p, repoRoot)) throw new GuardError("private-in-repo", "SFUI_STAGING_PRIVATE must be outside this repository");
  const git = findGitAncestor(p);
  if (git) throw new GuardError("private-in-repo", `SFUI_STAGING_PRIVATE must be outside every git work tree (found one at ${git})`);
  let st;
  try { st = fs.statSync(p); } catch { throw new GuardError("private-absent", `SFUI_STAGING_PRIVATE ${p} does not exist (create it with mode 700)`); }
  if (!st.isDirectory()) throw new GuardError("private-absent", `SFUI_STAGING_PRIVATE ${p} is not a directory`);
  if ((st.mode & 0o777) !== 0o700) throw new GuardError("private-mode", `SFUI_STAGING_PRIVATE must be mode 700 (is ${(st.mode & 0o777).toString(8)})`);
  return p;
}

/** Read and check <private>/APPROVED_STAGING. `site` = the site in use; `url` = the parsed SFUI_STAGING_URL. */
export function readApproval(privateDir, { url, allowlist, write = false, now = new Date(), local = [] }) {
  const f = path.join(privateDir, APPROVAL_FILE);
  if (!fs.existsSync(f)) throw new GuardError("approval-missing", `no ${APPROVAL_FILE} in the private directory: the owner's written approval of the staging site is required`);
  const st = fs.statSync(f);
  if ((st.mode & 0o077) !== 0) throw new GuardError("approval-mode", `${APPROVAL_FILE} must not be readable by group / others (mode 600)`);
  let a;
  try { a = JSON.parse(fs.readFileSync(f, "utf8")); } catch { throw new GuardError("approval-invalid", `${APPROVAL_FILE} is not valid JSON`); }
  for (const k of ["site", "url", "approved_by", "approved_at"]) if (!a?.[k] || typeof a[k] !== "string") throw new GuardError("approval-invalid", `${APPROVAL_FILE}: missing "${k}"`);
  const siteWhy = productionReason(a.site, { local });
  if (siteWhy) throw new GuardError("approval-production", `${APPROVAL_FILE} names a production site: ${siteWhy}`);
  if (!allowlist.includes(a.site)) throw new GuardError("approval-site", `${APPROVAL_FILE} site "${a.site}" is not in SFUI_STAGING_SITE`);
  let au;
  try { au = new URL(a.url); } catch { throw new GuardError("approval-invalid", `${APPROVAL_FILE}: "url" is not a URL`); }
  if (au.origin !== url.origin) throw new GuardError("approval-url", `${APPROVAL_FILE} url (${au.origin}) differs from SFUI_STAGING_URL (${url.origin})`);
  if (a.isolated_from_production !== true) throw new GuardError("approval-isolation", `${APPROVAL_FILE}: "isolated_from_production": true is required (own database, Redis and workers, not shared with production)`);
  const at = Date.parse(a.approved_at);
  if (!Number.isFinite(at)) throw new GuardError("approval-invalid", `${APPROVAL_FILE}: approved_at is not a date`);
  const ageDays = (now.getTime() - at) / 86400000;
  if (ageDays < -1 || ageDays > MAX_APPROVAL_AGE_DAYS) throw new GuardError("approval-stale", `${APPROVAL_FILE}: approved_at must be within the last ${MAX_APPROVAL_AGE_DAYS} days`);
  if (write && a.allow_write !== true) throw new GuardError("approval-write", `--write needs "allow_write": true in ${APPROVAL_FILE}`);
  return { site: a.site, url: au.origin, approved_by: a.approved_by, approved_at: a.approved_at, allow_write: a.allow_write === true };
}

/** <private>/accounts.json: { accounts: { manager: { usr, pwd }, … } } written by staging-seed.py. Never log the result. */
export function loadAccounts(privateDir, { required = ACCOUNT_KEYS } = {}) {
  const f = path.join(privateDir, ACCOUNTS_FILE);
  if (!fs.existsSync(f)) throw new GuardError("accounts-missing", `no ${ACCOUNTS_FILE} in the private directory (staging-seed.py --apply writes it)`);
  if ((fs.statSync(f).mode & 0o077) !== 0) throw new GuardError("accounts-mode", `${ACCOUNTS_FILE} must be mode 600`);
  let a;
  try { a = JSON.parse(fs.readFileSync(f, "utf8")); } catch { throw new GuardError("accounts-invalid", `${ACCOUNTS_FILE} is not valid JSON`); }
  const acc = a?.accounts ?? {};
  for (const k of required) if (!acc[k]?.usr || !acc[k]?.pwd) throw new GuardError("accounts-invalid", `${ACCOUNTS_FILE}: account "${k}" is incomplete`);
  for (const [k, v] of Object.entries(acc)) if (!/@example\.com$/.test(String(v.usr))) throw new GuardError("accounts-invalid", `${ACCOUNTS_FILE}: account "${k}" is not a synthetic @example.com user`);
  return acc;
}

const SECRET_KEY = /^(pwd|password|new_password|old_password|sid|csrf_token|api_key|api_secret|secret|token|authorization|cookie|set-cookie|x-frappe-csrf-token|_session_data)$/i;
/** A deep copy with secret-looking keys and cookie / token fragments replaced. Pure; safe on any JSON-like value. */
export function redact(value, depth = 0) {
  if (depth > 12) return "[depth]";
  if (typeof value === "string") {
    return value
      .replace(/\b(sid|system_user|user_id|full_name|user_image)=[^;\s,]*/gi, (_m, k) => `${k}=[REDACTED]`)
      .replace(/("?(?:pwd|password|csrf_token|api_secret)"?\s*[:=]\s*)"?[^",&\s}]+"?/gi, '$1"[REDACTED]"')
      .replace(/\btoken [A-Za-z0-9]+:[A-Za-z0-9]+/g, "token [REDACTED]");
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SECRET_KEY.test(k) ? "[REDACTED]" : redact(v, depth + 1)]));
  }
  return value;
}

/**
 * Every guard as a verdict list (nothing thrown), for --dry-run and for the real run (which refuses on any failure).
 * `network` = the run would contact the site (always true except for --dry-run, which still evaluates every guard).
 */
export function evaluateGuards({ env = process.env, write = false, now = new Date(), local = localAddresses(), repoRoot = REPO_ROOT } = {}) {
  const verdicts = [];
  const add = (check, fn) => {
    try {
      const value = fn();
      verdicts.push({ check, ok: true, detail: value instanceof URL ? value.origin : Array.isArray(value) ? value.join(", ") : typeof value === "string" ? value : value?.site ? `site ${value.site}, approved by ${value.approved_by} at ${value.approved_at}${value.allow_write ? ", allow_write" : ""}` : "ok" });
      return value;
    } catch (e) {
      verdicts.push({ check, ok: false, code: e.code ?? "error", detail: e.message });
      return undefined;
    }
  };
  const url = add("staging URL is not production", () => parseStagingUrl(env.SFUI_STAGING_URL, { local }));
  const allowlist = add("site allowlist has no production name", () => parseAllowlist(env.SFUI_STAGING_SITE, { local }));
  const priv = add("private dir: outside every repo, mode 700", () => checkPrivateDir(env.SFUI_STAGING_PRIVATE, { repoRoot }));
  let approval;
  if (url && allowlist && priv) approval = add(`owner approval (${APPROVAL_FILE})${write ? " incl. allow_write" : ""}`, () => readApproval(priv, { url, allowlist, write, now, local }));
  else verdicts.push({ check: `owner approval (${APPROVAL_FILE})`, ok: false, code: "approval-unchecked", detail: "not checked: an earlier guard failed" });
  const accounts = priv ? (() => { try { return { ok: true, keys: Object.keys(loadAccounts(priv)) }; } catch (e) { return { ok: false, detail: e.message }; } })() : { ok: false, detail: "no private dir" };
  return {
    ok: verdicts.every((v) => v.ok),
    verdicts,
    url: url ? url.origin : null,
    site: approval?.site ?? null,
    approval: approval ? { approved_by: approval.approved_by, approved_at: approval.approved_at, allow_write: approval.allow_write } : null,
    privateDir: priv ?? null,
    accounts, // presence only; credentials are never returned from here
  };
}
