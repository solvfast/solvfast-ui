/**
 * readFrappeBoot — what a page served by Frappe can inject so a React app has what Desk gets from its boot, without a
 * new whitelisted endpoint: the CSRF token, the session user and roles, the formatting settings and the translation
 * dictionary. The server side (the page's `get_context`) renders it as a JSON data block; the page assigns it to
 * `window.__sf_boot` (and `window.csrf_token`). Shape (all optional except `user`):
 *
 *   { user, full_name, roles[], lang, csrf_token,
 *     sysdefaults: { date_format, time_format, number_format, float_precision, currency_precision, currency,
 *                    rounding_method, hide_currency_symbol, use_number_format_from_currency, first_day_of_the_week, … },
 *     time_zone: { system, user },
 *     currencies: { <name>: { symbol, symbol_on_right, number_format, fraction_units } },
 *     translations: { <source>: <translated> } }
 *
 * Desk equivalents: frappe.session.user / user_fullname, frappe.user_roles, frappe.boot.lang, frappe.csrf_token,
 * frappe.boot.sysdefaults (frappe.defaults.get_defaults), frappe.boot.time_zone (boot.py set_time_zone), the `:Currency`
 * boot docs (boot.py load_currency_docs) and frappe.boot.__messages (translate.get_messages_for_boot).
 * A guest page gets `{ user: "Guest" }` only.
 */
import type { FormatContext, CurrencyInfo, RoundingMethod } from "./format";
import type { FrappeSession } from "./permissions";
import type { TranslationDictionary } from "./translate";

export interface FrappeBootPayload {
  user: string;
  full_name?: string;
  roles?: string[];
  lang?: string;
  csrf_token?: string;
  sysdefaults?: Record<string, unknown>;
  time_zone?: { system?: string; user?: string };
  currencies?: Record<string, CurrencyInfo>;
  translations?: TranslationDictionary;
  [key: string]: unknown;
}

export interface FrappeBoot {
  session: FrappeSession;
  /** The session language (e.g. "ar"); the app decides whether the UI follows it. */
  lang?: string;
  /** For the client (`createFrappeClient({ csrfToken })`); the page also sets `window.csrf_token`. Absent for guests. */
  csrfToken?: string;
  formatContext: FormatContext;
  translations?: TranslationDictionary;
  /** The raw sysdefaults that were sent (e.g. `first_day_of_the_week`, `link_field_results_limit`). */
  sysdefaults: Record<string, unknown>;
  isGuest: boolean;
}

const ROUNDING: RoundingMethod[] = ["Banker's Rounding (legacy)", "Banker's Rounding", "Commercial Rounding"];
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
/** Frappe defaults are strings ("3", "", "1"); an empty or non-numeric value means "not set". */
const num = (v: unknown) => { if (v === null || v === undefined || v === "") return undefined; const n = Number(v); return Number.isFinite(n) ? n : undefined; };

/** The FormatContext of a boot (only the keys the boot carried; formatValue's defaults fill the rest). */
export function formatContextFromBoot(p: Pick<FrappeBootPayload, "sysdefaults" | "time_zone" | "currencies" | "translations">): FormatContext {
  const d = p.sysdefaults ?? {};
  const ctx: FormatContext = {};
  if (str(d.date_format)) ctx.dateFormat = str(d.date_format);
  if (str(d.time_format)) ctx.timeFormat = str(d.time_format);
  if (str(d.number_format)) ctx.numberFormat = str(d.number_format);
  if (num(d.float_precision) !== undefined) ctx.floatPrecision = num(d.float_precision);
  if (num(d.currency_precision) !== undefined) ctx.currencyPrecision = num(d.currency_precision);
  if (str(d.currency)) ctx.currency = str(d.currency);
  if (d.hide_currency_symbol !== undefined) ctx.hideCurrencySymbol = d.hide_currency_symbol === "Yes";
  if (d.use_number_format_from_currency !== undefined) ctx.useNumberFormatFromCurrency = Number(d.use_number_format_from_currency) === 1;
  if (ROUNDING.includes(d.rounding_method as RoundingMethod)) ctx.roundingMethod = d.rounding_method as RoundingMethod;
  if (p.time_zone && (str(p.time_zone.system) || str(p.time_zone.user))) ctx.timeZone = { system: str(p.time_zone.system), user: str(p.time_zone.user) ?? str(p.time_zone.system) };
  if (p.currencies && typeof p.currencies === "object") ctx.currencies = p.currencies;
  const dict = p.translations;
  if (dict && Object.keys(dict).length) ctx.translate = (text: string) => dict[text] || text; // Desk's `__` for Select values / link labels
  return ctx;
}

/**
 * The boot the page injected (`window.__sf_boot` by default), mapped for FrappeProvider: `<FrappeProvider boot={readFrappeBoot()}>`.
 * Undefined when there is none or it is malformed (e.g. Vite's dev server, which does not render the template).
 */
export function readFrappeBoot(source: unknown = (globalThis as { __sf_boot?: unknown }).__sf_boot): FrappeBoot | undefined {
  if (!source || typeof source !== "object" || Array.isArray(source)) return undefined;
  const p = source as FrappeBootPayload;
  if (!str(p.user)) return undefined;
  const isGuest = p.user === "Guest";
  const roles = Array.isArray(p.roles) ? p.roles.filter((r): r is string => typeof r === "string") : undefined;
  const translations = p.translations && typeof p.translations === "object" && !Array.isArray(p.translations) ? p.translations : undefined;
  return {
    session: { user: p.user, ...(str(p.full_name) ? { fullName: p.full_name } : {}), ...(roles ? { roles } : isGuest ? { roles: ["Guest"] } : {}) },
    lang: str(p.lang),
    csrfToken: isGuest ? undefined : str(p.csrf_token),
    formatContext: formatContextFromBoot({ ...p, translations }),
    translations: translations && Object.keys(translations).length ? translations : undefined,
    sysdefaults: p.sysdefaults && typeof p.sysdefaults === "object" ? p.sysdefaults : {},
    isGuest,
  };
}
