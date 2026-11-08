/**
 * The awesome bar's rows, built as Desk builds them — frappe/public/js/frappe/ui/toolbar/search_utils.js (SU) and
 * awesome_bar.js (AB), Frappe v15.110. Desk builds every row on the CLIENT from boot lists (no server call, AB:71, 81,
 * 263-265); this module does the same from a `DeskSearchBoot` the app passes (Desk: `frappe.boot`).
 *
 * Rows are Core `SearchItem`s whose `data` is a `DeskSearchTarget` (the Desk route + route options) and whose `href` is
 * the Desk URL (`/app/…`, router.js:423-453, 466-478).
 */
import { fillTemplate, fuzzySearch } from "./fuzzy";
import type { SearchItem, SearchResultGroup } from "../../shell/search/types";

/** A Desk route as `frappe.set_route` takes it: ["List", "Customer"], ["Form", "Customer", "C-1"], ["query-report", "X"]. */
export type DeskRoute = string[];

/** What a row opens (the adapter hands it to `onNavigate`). */
export interface DeskSearchTarget {
  route: DeskRoute;
  /** `frappe.route_options` (AB:114-116), e.g. `{ name: ["like", "%acme%"] }`; carried as list URL params. */
  routeOptions?: Record<string, unknown>;
  /** The Desk URL of `route` + `routeOptions`. */
  url: string;
  /** Desk's row type: "List", "Report", "New", "", "In List", "Page", "Workspace", "Dashboard", "Recent", "Global". */
  kind: string;
  /** Global-search rows: the DocType and name. */
  doctype?: string;
  name?: string;
}

/** The `frappe.boot` lists the awesome bar reads (all optional; a missing list contributes no rows). */
export interface DeskSearchBoot {
  /** `boot.user.can_read` (utils/user.py:204-208). */
  can_read?: string[];
  /** `boot.user.can_create`. */
  can_create?: string[];
  /** `boot.user.can_search` (non-table, non-single, not "User Cannot Search"). */
  can_search?: string[];
  /** `boot.user.can_get_report` (`frappe.model.can_get_report`, model.js:386-388). */
  can_get_report?: string[];
  /** `boot.single_types` (boot.py:69). */
  single_types?: string[];
  /** `boot.user.all_reports` (boot.py:190-191) — keyed by report name. */
  all_reports?: Record<string, { title?: string; ref_doctype?: string; report_type?: string }>;
  /** `boot.page_info` (boot.py:74) — keyed by page name. */
  page_info?: Record<string, { title?: string; route?: string }>;
  /** `boot.allowed_workspaces` (boot.py:181). */
  allowed_workspaces?: { name: string }[];
  /** `boot.dashboards` (boot.py:183). */
  dashboards?: { name: string }[];
  /** `boot.frequently_visited_links` (boot.py:112; route_history.py:45-54). */
  frequently_visited_links?: { route: string; count: number }[];
}

/** Map Desk's `frappe.boot` (or any object of that shape) to a `DeskSearchBoot`. */
export function deskSearchBootFrom(boot: unknown): DeskSearchBoot {
  const b = (boot && typeof boot === "object" ? boot : {}) as Record<string, unknown>;
  const user = (b.user && typeof b.user === "object" ? b.user : {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined);
  const obj = <T,>(v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as T) : undefined);
  const named = (v: unknown) => (Array.isArray(v) ? v.filter((x) => x && typeof x.name === "string").map((x) => ({ name: String(x.name) })) : undefined);
  return {
    can_read: list(user.can_read), can_create: list(user.can_create), can_search: list(user.can_search), can_get_report: list(user.can_get_report),
    single_types: list(b.single_types),
    all_reports: obj(user.all_reports), page_info: obj(b.page_info),
    allowed_workspaces: named(b.allowed_workspaces), dashboards: named(b.dashboards),
    frequently_visited_links: Array.isArray(b.frequently_visited_links) ? (b.frequently_visited_links as { route: string; count: number }[]) : undefined,
  };
}

/** `frappe.router.slug` (router.js:580-582). */
export const deskSlug = (name: string) => name.toLowerCase().replace(/ /g, "-");

/** `frappe.router.make_url(convert_from_standard_route(route))` (router.js:423-453, 466-478) + route options as URL
 *  params (list_view.js:2130-2148 reads `?field=["like","%x%"]`). */
export function deskRouteUrl(route: DeskRoute, routeOptions?: Record<string, unknown>): string {
  const view = (route[0] ?? "").toLowerCase();
  let r: string[] = route;
  if (view === "list") r = route[2] && route[2] !== "list" ? [deskSlug(route[1]), "view", route[2].toLowerCase(), ...route.slice(3)] : [deskSlug(route[1])];
  else if (view === "form") r = route[2] ? [deskSlug(route[1]), route[2]] : [deskSlug(route[1])];
  else if (view === "tree") r = [deskSlug(route[1]), "view", "tree"];
  const path = r.map((p) => encodeURIComponent(String(p))).join("/");
  const qs = routeOptions && Object.keys(routeOptions).length
    ? "?" + new URLSearchParams(Object.entries(routeOptions).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])).toString()
    : "";
  return (path ? `/app/${path}` : "/app") + qs;
}

export interface AwesomeBarContext {
  boot: DeskSearchBoot;
  /** Desk's `__` (default: identity). Matching runs on the TRANSLATED names (SU:579-582). */
  translate?: (text: string) => string;
  /** This tab's route history, oldest first (`frappe.route_history`, router.js:11, 303-305). */
  history?: DeskRoute[];
  /** `frappe.route_titles` (route joined by "/" → title) for non-list routes in the history. */
  routeTitles?: Record<string, string>;
  /** The DocType of the list on screen (Desk: `cur_list`), for "Find {0} in {1}" (AB:316-340), and its title field. */
  currentList?: { doctype: string; titleField?: string };
}

const tr = (ctx: AwesomeBarContext) => ctx.translate ?? ((s: string) => s);
const item = (id: string, label: { text: string; marks: number[] }, index: number, target: Omit<DeskSearchTarget, "url">): SearchItem => {
  const url = deskRouteUrl(target.route, target.routeOptions);
  return { id, label: label.text, labelMarks: label.marks, index, type: target.kind, href: url, data: { ...target, url } satisfies DeskSearchTarget };
};
/** `__(template, [marked])` with the marked string's runs kept. */
const fmt = (ctx: AwesomeBarContext, template: string, value: string, marks: number[] = []) => fillTemplate(tr(ctx)(template), value, marks);

/** `get_creatables` — "new X" (SU:156-179): the first word is `__("new")`; New rows for `can_create`, index 1 + score. */
export function getCreatables(txt: string, ctx: AwesomeBarContext): SearchItem[] {
  const __ = tr(ctx);
  if (txt.split(" ")[0].toLowerCase() !== __("new")) return [];
  const out: SearchItem[] = [];
  for (const dt of ctx.boot.can_create ?? []) {
    const label = __(dt);
    const hit = fuzzySearch(txt.substr(4), label);
    if (hit.score) out.push(item(`new:${dt}`, fmt(ctx, "New {0}", label, hit.marks), 1 + hit.score, { route: ["Form", dt, "new"], kind: "New" }));
  }
  return out;
}

/** `get_search_in_list` — "x in Customer" (SU:129-154): can_read ∩ can_search, index 1 + score, `name like %x%`. */
export function getSearchInList(txt: string, ctx: AwesomeBarContext): SearchItem[] {
  const __ = tr(ctx);
  if (!(txt.split(" ").includes("in") && txt.slice(-2) !== "in")) return [];
  const parts = txt.split(" in ");
  const search = new Set(ctx.boot.can_search ?? []);
  const out: SearchItem[] = [];
  for (const dt of ctx.boot.can_read ?? []) {
    if (!search.has(dt)) continue;
    const label = __(dt);
    const hit = fuzzySearch(parts[1] ?? "", label);
    if (!hit.score) continue;
    const t = __("Find {0} in {1}");
    const a = t.indexOf("{0}"), b = t.indexOf("{1}");
    const p0 = __(parts[0]);
    // both placeholders filled; marks follow {1}
    const text = t.replace("{0}", p0).replace("{1}", label);
    const shift = b > a ? b - 3 + p0.length : b;
    out.push(item(`in:${dt}`, { text, marks: hit.marks.map((m) => m + shift) }, 1 + hit.score, {
      route: ["List", dt], routeOptions: { name: ["like", `%${parts[0]}%`] }, kind: "In List",
    }));
  }
  return out;
}

/** `get_doctypes` (SU:181-235): singles (index score+0.05), New (score+0.015, can_create), List (score+0.05), Report view
 *  (score+0.04, can_get_report) — for can_read DocTypes that match. */
export function getDoctypes(txt: string, ctx: AwesomeBarContext): SearchItem[] {
  const __ = tr(ctx);
  const singles = new Set(ctx.boot.single_types ?? []);
  const search = new Set(ctx.boot.can_search ?? []);
  const create = new Set(ctx.boot.can_create ?? []);
  const report = new Set(ctx.boot.can_get_report ?? []);
  const out: SearchItem[] = [];
  for (const dt of ctx.boot.can_read ?? []) {
    const label = __(dt);
    const hit = fuzzySearch(txt, label);
    if (!hit.score) continue;
    if (singles.has(dt)) {
      out.push(item(`single:${dt}`, fmt(ctx, "{0} ", label, hit.marks), hit.score + 0.05, { route: ["Form", dt, dt], kind: "" }));
    } else if (search.has(dt)) {
      if (create.has(dt)) out.push(item(`new:${dt}`, fmt(ctx, "New {0}", label, hit.marks), hit.score + 0.015, { route: ["Form", dt, "new"], kind: "New" }));
      // "Price List List" → "Price List" (SU:186-191)
      const listLabel = dt.endsWith("List") ? { text: label, marks: hit.marks } : fmt(ctx, "{0} List", label, hit.marks);
      out.push(item(`list:${dt}`, listLabel, hit.score + 0.05, { route: ["List", dt], kind: "List" }));
      if (report.has(dt)) out.push(item(`report:${dt}`, fmt(ctx, "{0} Report", label, hit.marks), hit.score + 0.04, { route: ["List", dt, "Report"], kind: "Report" }));
    }
  }
  return out;
}

/** `get_reports` (SU:237-259): Report Builder → its list's Report view, else query-report. */
export function getReports(txt: string, ctx: AwesomeBarContext): SearchItem[] {
  const __ = tr(ctx);
  const out: SearchItem[] = [];
  for (const [name, r] of Object.entries(ctx.boot.all_reports ?? {})) {
    const label = __(name);
    const hit = fuzzySearch(txt, label);
    if (hit.score <= 0) continue;
    const route = r.report_type === "Report Builder" && r.ref_doctype ? ["List", r.ref_doctype, "Report", name] : ["query-report", name];
    out.push(item(`rpt:${name}`, fmt(ctx, "Report {0}", label, hit.marks), hit.score, { route, kind: "Report" }));
  }
  return out;
}

/** `get_pages` (SU:261-284) — "Hub" skipped. The calendar / hub / email-inbox keyword rows (SU:285-313) are kept for
 *  calendar and inbox only (Hub is gone from v15 sites). */
export function getPages(txt: string, ctx: AwesomeBarContext): SearchItem[] {
  const __ = tr(ctx);
  const out: SearchItem[] = [];
  const byTitle = new Map<string, { name: string; route?: string }>();
  for (const [name, p] of Object.entries(ctx.boot.page_info ?? {})) byTitle.set(p.title ?? name, { name, route: p.route });
  for (const [title, p] of byTitle) {
    if (title === "Hub" || title === "hub") continue;
    const label = __(title);
    const hit = fuzzySearch(txt, label);
    if (hit.score) out.push(item(`page:${p.name}`, fmt(ctx, "Open {0}", label, hit.marks), hit.score, { route: [p.route || p.name], kind: "Page" }));
  }
  const lower = txt.toLowerCase();
  if (__("calendar").indexOf(lower) === 0) out.push(item("cal", fmt(ctx, "Open {0}", __("Calendar")), fuzzySearch(txt, "Calendar").score, { route: ["List", "Event", "Calendar"], kind: "Calendar" }));
  if (__("email inbox").indexOf(lower) === 0) out.push(item("inbox", fmt(ctx, "Open {0}", __("Email Inbox")), fuzzySearch(txt, "email inbox").score, { route: ["List", "Communication", "Inbox"], kind: "Inbox" }));
  return out;
}

/** `get_workspaces` (SU:317-336). */
export function getWorkspaces(txt: string, ctx: AwesomeBarContext): SearchItem[] {
  const __ = tr(ctx);
  return (ctx.boot.allowed_workspaces ?? []).flatMap((w) => {
    const label = __(w.name);
    const hit = fuzzySearch(txt, label);
    return hit.score > 0 ? [item(`ws:${w.name}`, fmt(ctx, "Open {0}", label, hit.marks), hit.score, { route: [deskSlug(w.name)], kind: "Workspace" })] : [];
  });
}

/** `get_dashboards` (SU:338-357). */
export function getDashboards(txt: string, ctx: AwesomeBarContext): SearchItem[] {
  const __ = tr(ctx);
  return (ctx.boot.dashboards ?? []).flatMap((d) => {
    const label = __(d.name);
    const hit = fuzzySearch(txt, label);
    return hit.score > 0 ? [item(`dash:${d.name}`, fmt(ctx, "{0} Dashboard", label, hit.marks), hit.score, { route: ["dashboard-view", d.name], kind: "Dashboard" })] : [];
  });
}

/** `get_recent_pages(keywords)` (SU:9-110): this tab's routes whose match text contains `keywords` (not lower-cased —
 *  Desk's quirk, SU:15-22), newest first, index 80. */
export function getRecentPages(keywords: string, ctx: AwesomeBarContext): SearchItem[] {
  const __ = tr(ctx);
  const values: [string, DeskRoute][] = [];
  for (const route of ctx.history ?? []) {
    if (route[0] === "Form") values.push([route[2], route]);
    else if (["List", "Tree", "Workspaces", "query-report"].includes(route[0]) || route[2] === "Report") { if (route[1]) values.push([route[1], route]); }
    else if (route[0]) values.push([ctx.routeTitles?.[route.join("/")] || route[0], route]);
  }
  let out: SearchItem[] = [];
  values.forEach(([text, route], i) => {
    const hay = __(text || "").toLowerCase().replace(/-/g, " ");
    if (!(keywords === hay || hay.indexOf(keywords) !== -1)) return;
    let label: string;
    if (route[0] === "Form") label = route.length > 2 && route[1] !== route[2] ? `${__(route[1])} ${route[2]}` : __(route[1]);
    else if (["List", "Tree", "Workspaces", "query-report"].includes(route[0]) && route.length > 1) {
      const tpl = { List: "{0} List", Tree: "{0} Tree", Workspaces: "{0} Workspace", "query-report": "{0} Report" }[route[0]]!;
      label = fmt(ctx, tpl, __(route[1])).text;
    } else label = text;
    out = [item(`recent:${i}:${route.join("/")}`, { text: label, marks: [] }, 80, { route, kind: "Recent" }), ...out];
  });
  return out;
}

/** `frappe.utils.get_route_label` (utils.js:930-946). */
function routeLabel(routeStr: string, ctx: AwesomeBarContext): string {
  const __ = tr(ctx);
  const r = routeStr.split("/");
  if (r[2] === "Report" || r[0] === "query-report") return fmt(ctx, "{0} Report", __(r[3] ?? "") || __(r[1] ?? "")).text;
  if (r[0] === "List") return fmt(ctx, "{0} List", __(r[1] ?? "")).text;
  if (r[0] === "modules") return fmt(ctx, "{0} Modules", __(r[1] ?? "")).text;
  if (r[0] === "dashboard") return fmt(ctx, "{0} Dashboard", __(r[1] ?? "")).text;
  return __(r[0] ?? "").replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}

/** `get_frequent_links` (SU:112-127): the boot's frequently visited links (index = visits), else the recent pages. */
export function getFrequentLinks(ctx: AwesomeBarContext): SearchItem[] {
  const links = ctx.boot.frequently_visited_links ?? [];
  if (!links.length) return getRecentPages("", ctx);
  return links.map((l) => item(`freq:${l.route}`, { text: routeLabel(l.route, ctx), marks: [] }, l.count, { route: l.route.split("/"), kind: "Frequent" }));
}

/** `deduplicate` (AB:231-261): List routes cut to 2 parts (except Report / Inbox views); a later duplicate with a higher
 *  index replaces the earlier one unless it is a recent row. Rows without a route are kept. */
export function dedupeAwesomeBar(items: SearchItem[]): SearchItem[] {
  const out: SearchItem[] = [];
  const keys: string[] = [];
  for (const it of items) {
    const t = it.data as DeskSearchTarget | undefined;
    if (!t?.route) { out.push(it); keys.push(""); continue; }
    const route = t.route[0] === "List" && t.route[2] !== "Report" && t.route[2] !== "Inbox" ? t.route.slice(0, 2) : t.route;
    const key = route.join("/") + (t.routeOptions ? "?" + JSON.stringify(t.routeOptions) : "");
    const at = keys.indexOf(key);
    if (at < 0) { out.push(it); keys.push(key); }
    else if ((out[at].index ?? 0) < (it.index ?? 0) && t.kind !== "Recent") out[at] = it;
  }
  return out;
}

/** "Find {0} in {1}" for the list on screen (`make_search_in_current`, AB:316-340): index 90, `<title_field|name> like`. */
export function getSearchInCurrent(txt: string, ctx: AwesomeBarContext): SearchItem[] {
  const cur = ctx.currentList;
  if (!cur || txt.indexOf(" in") !== -1) return [];
  const __ = tr(ctx);
  const field = cur.titleField || "name";
  const text = __("Find {0} in {1}").replace("{0}", txt).replace("{1}", __(cur.doctype));
  return [item(`cur:${cur.doctype}`, { text, marks: [] }, 90, { route: ["List", cur.doctype], routeOptions: { [field]: ["like", `%${txt}%`] }, kind: "Current List" })];
}

/** `build_options(txt)` (AB:208-229) without the client-only executables / marketplace rows. */
function buildOptions(txt: string, ctx: AwesomeBarContext): SearchItem[] {
  return dedupeAwesomeBar([
    ...getCreatables(txt, ctx), ...getSearchInList(txt, ctx), ...getDoctypes(txt, ctx), ...getReports(txt, ctx),
    ...getPages(txt, ctx), ...getWorkspaces(txt, ctx), ...getDashboards(txt, ctx), ...getRecentPages(txt, ctx),
  ]).sort((a, b) => (b.index ?? 0) - (a.index ?? 0));
}

/**
 * The awesome bar rows for a query of 2+ characters (AB:75-81), WITHOUT "Search for …" (the Core bar adds it, index
 * 100): `set_specifics` for "<prefix> <type>" (AB:191-199), the defaults ("Find in current list"), `build_options`,
 * then `deduplicate` (AB:90).
 */
export function awesomeBarItems(txt: string, ctx: AwesomeBarContext): SearchItem[] {
  const opts: SearchItem[] = [];
  const last = txt.lastIndexOf(" ");
  if (last !== -1) {
    const end = txt.slice(last + 1).toLowerCase();
    for (const r of buildOptions(txt.slice(0, last), ctx)) if (r.type && r.type.toLowerCase().indexOf(end) === 0) opts.push(r);
  }
  opts.push(...getSearchInCurrent(txt, ctx), ...buildOptions(txt, ctx));
  return dedupeAwesomeBar(opts);
}

/** Below 2 characters: recent pages + frequent links (AB:82-87). */
export function awesomeBarRecent(txt: string, ctx: AwesomeBarContext): SearchItem[] {
  return dedupeAwesomeBar([...dedupeAwesomeBar(getRecentPages(txt, ctx)), ...getFrequentLinks(ctx)]);
}

/** `sort_uniques` of the dialog (SU:493-518): List routes with a view cut to 2 parts, a duplicate keeps the LOWER index. */
function sortUniques(items: SearchItem[]): SearchItem[] {
  const out: SearchItem[] = [];
  const keys: string[] = [];
  for (const it of items) {
    const t = it.data as DeskSearchTarget | undefined;
    if (!t?.route) { out.push(it); continue; }
    const key = (t.route[0] === "List" && t.route[2] ? t.route.slice(0, 2) : t.route).join("/") + (t.routeOptions ? "?" + JSON.stringify(t.routeOptions) : "");
    const at = keys.indexOf(key);
    if (at < 0) { keys.push(key); out.push(it); }
    else if ((out[at].index ?? 0) > (it.index ?? 0)) out[at] = it;
  }
  return out.sort((a, b) => (b.index ?? 0) - (a.index ?? 0));
}

/** The dialog's client-side groups (`get_nav_results`, SU:492-576), in Desk's order; empty groups are dropped by the UI. */
export function navGroups(txt: string, ctx: AwesomeBarContext): SearchResultGroup[] {
  const __ = tr(ctx);
  const all = sortUniques(getDoctypes(txt, ctx));
  const lists = all.filter((d) => d.type !== "");
  const setup = all.filter((d) => d.type === "");
  const inKeyword = txt.split(" in ")[0];
  const g = (id: string, title: string, items: SearchItem[]): SearchResultGroup => ({ id: `nav:${id}`, title, items, kind: "nav" });
  return [
    g("recents", __("Recents"), sortUniques(getRecentPages(txt, ctx))),
    g("create", __("Create a new ..."), sortUniques(getCreatables(txt, ctx))),
    g("lists", __("Lists"), lists),
    g("reports", __("Reports"), sortUniques(getReports(txt, ctx))),
    g("pages", __("Administration"), sortUniques(getPages(txt, ctx))),
    g("workspaces", __("Workspace"), sortUniques(getWorkspaces(txt, ctx))),
    g("dashboards", __("Dashboard"), sortUniques(getDashboards(txt, ctx))),
    g("setup", __("Setup"), setup),
    g("in", __("Find '{0}' in ...").replace("{0}", inKeyword), sortUniques(getSearchInList(txt, ctx))),
  ];
}
