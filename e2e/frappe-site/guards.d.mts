// Types for guards.mjs (P36), so tests/frappe-site-guards.test.ts typechecks without allowJs.
export declare const REPO_ROOT: string;
export declare const DENYLIST: {
  about: string;
  suffixes: string[];
  exact: string[];
  loopback: string[];
  loopback_prefixes: string[];
  production_benches: string[];
};
export declare const APPROVAL_FILE: string;
export declare const ACCOUNTS_FILE: string;
export declare const ACCOUNT_KEYS: string[];
export declare const MAX_APPROVAL_AGE_DAYS: number;
export declare class GuardError extends Error {
  code: string;
  constructor(code: string, message: string);
}
export declare function normalizeHost(host: string): string;
export declare function localAddresses(): string[];
export declare function productionReason(name: string, opts?: { local?: string[] }): string | null;
export declare function parseStagingUrl(raw: string | undefined, opts?: { local?: string[] }): URL;
export declare function parseAllowlist(raw: string | undefined, opts?: { local?: string[] }): string[];
export declare function findGitAncestor(dir: string): string | null;
export declare function checkPrivateDir(raw: string | undefined, opts?: { repoRoot?: string }): string;
export interface Approval { site: string; url: string; approved_by: string; approved_at: string; allow_write: boolean }
export declare function readApproval(
  privateDir: string,
  opts: { url: URL; allowlist: string[]; write?: boolean; now?: Date; local?: string[] },
): Approval;
export declare function loadAccounts(privateDir: string, opts?: { required?: string[] }): Record<string, { usr: string; pwd: string }>;
export declare function redact<T>(value: T, depth?: number): T;
export interface Verdict { check: string; ok: boolean; code?: string; detail: string }
export declare function evaluateGuards(opts?: {
  env?: Record<string, string | undefined>;
  write?: boolean;
  now?: Date;
  local?: string[];
  repoRoot?: string;
}): {
  ok: boolean;
  verdicts: Verdict[];
  url: string | null;
  site: string | null;
  approval: { approved_by: string; approved_at: string; allow_write: boolean } | null;
  privateDir: string | null;
  accounts: { ok: boolean; keys?: string[]; detail?: string };
};
