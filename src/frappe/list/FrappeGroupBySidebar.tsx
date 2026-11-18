/**
 * Desk's list sidebar over a DocType: "Assigned To", "Created By" and the user's own group-by fields with server counts
 * (`frappe.desk.listview.get_group_by_count`, listview.py:33-89; list_sidebar_group_by.js) and the tag stats
 * (`frappe.desk.reportview.get_sidebar_stats`, reportview.py:623-696; list_sidebar.js:192-250). Clicking a value filters
 * the list exactly as Desk does; clicking the applied value again removes that filter.
 */
import { useQueries, useQuery } from "@tanstack/react-query";
import { GroupBySidebar, type GroupBySidebarSection } from "../../list/parts/GroupBySidebar";
import { useListActions } from "../../list/ListActionsContext";
import { useLocale } from "../../theme/ThemeProvider";
import type { FrappeClient } from "../client";
import { useFrappeClient } from "../FrappeProvider";
import { checkFilterValue, type FrappeFilter } from "../query";

export interface GroupByCount { name: string | null; count: number }
/** Desk's default sidebar group-by fields (list_sidebar_group_by.js:9). */
export const DEFAULT_SIDEBAR_GROUP_BY = ["assigned_to", "owner"];
/** The filter field a sidebar field stands for: Desk's `assigned_to` is `_assign` (list_sidebar_group_by.js:108, 250). */
export const sidebarFilterField = (field: string) => (field === "assigned_to" ? "_assign" : field);

/** Desk labels a Check group value "No" when `name == "0"` (loose, list_sidebar_group_by.js:222-223): 0, "0" or false.
 *  Frappe sends these values as JSON numbers (int(1) / smallint column, no cast in get_group_by_count, listview.py:62-71). */
const isCheckNo = (name: unknown) => name === 0 || name === "0" || name === false;

/** Desk drops the field's own condition before counting (list_sidebar_group_by.js:163-169). */
export function filtersWithout(filters: readonly FrappeFilter[] | undefined, field: string): FrappeFilter[] {
  const f = sidebarFilterField(field);
  return (filters ?? []).filter((x) => (x.length === 4 ? x[1] : x[0]) !== f);
}

/** Desk's post-processing of the counts (list_sidebar_group_by.js:177-188): no zero counts, no Guest / Administrator,
 *  the session user first. */
export function sortGroupByCounts(counts: GroupByCount[], user: string | undefined): GroupByCount[] {
  const live = counts.filter((c) => c.count !== 0);
  const me = user ? live.find((c) => c.name === user) : undefined;
  // a null name ("Not Set") is never in the list, with or without a session user
  const dropped = user ? ["Guest", "Administrator", user] : ["Guest", "Administrator"];
  const rest = live.filter((c) => c.name === null || !dropped.includes(c.name));
  return me ? [me, ...rest] : rest;
}

/** Frappe sends Int and Check group values as JSON numbers (int / bigint column, no cast in get_group_by_count,
 *  listview.py:62-71). `GroupByCount.name` is a string: a number becomes its decimal string; anything else (strings,
 *  null) and `count` are passed as sent. */
const normalizeGroupByCount = (x: GroupByCount): GroupByCount =>
  typeof (x as { name?: unknown } | null)?.name === "number" ? { ...x, name: String(x.name) } : x;

/** `get_group_by_count` per field, with the current filters minus the field's own (one request per field). */
export function useGroupByCounts(doctype: string, fields: readonly string[], filters: readonly FrappeFilter[] | undefined, opts: { client?: FrappeClient; enabled?: boolean; user?: string } = {}) {
  const fallback = useFrappeClient();
  const client = opts.client ?? fallback;
  const enabled = opts.enabled !== false && !!filters;
  const results = useQueries({
    queries: fields.map((field) => {
      const current = filtersWithout(filters, field);
      return {
        queryKey: ["sf-frappe", "group-by-count", doctype, field, current],
        enabled,
        staleTime: 30_000,
        queryFn: async () => {
          const res = await client.call("frappe.desk.listview.get_group_by_count", { doctype, current_filters: JSON.stringify(current), field });
          return Array.isArray(res.message) ? (res.message as GroupByCount[]).map(normalizeGroupByCount) : [];
        },
      };
    }),
  });
  return fields.map((field, i) => ({
    field,
    counts: sortGroupByCounts(results[i]?.data ?? [], opts.user),
    loading: enabled && !!results[i]?.isPending,
    error: !!results[i]?.error,
  }));
}

/** `get_sidebar_stats(["_user_tags"])` → `[[tag, count], …, ["No Tags", n]]`. */
export function useTagStats(doctype: string, filters: readonly FrappeFilter[] | undefined, opts: { client?: FrappeClient; enabled?: boolean } = {}) {
  const fallback = useFrappeClient();
  const client = opts.client ?? fallback;
  const current = filtersWithout(filters, "_user_tags");
  const q = useQuery({
    queryKey: ["sf-frappe", "sidebar-stats", doctype, current],
    enabled: opts.enabled !== false && !!filters,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await client.call("frappe.desk.reportview.get_sidebar_stats", { stats: JSON.stringify(["_user_tags"]), doctype, filters: JSON.stringify(current) });
      const stats = ((res.message as { stats?: Record<string, unknown> } | undefined)?.stats ?? {})._user_tags;
      return Array.isArray(stats) ? (stats as [string, number][]) : [];
    },
  });
  return { stats: q.data ?? [], loading: opts.enabled !== false && !!filters && q.isPending, error: !!q.error };
}

export interface FrappeGroupBySidebarProps {
  doctype: string;
  /** Group-by fields (Desk: `assigned_to`, `owner`, then `user_settings.group_by_fields`). */
  fields: string[];
  /** The list's current (AND) filters; counts are for these. */
  filters: FrappeFilter[] | undefined;
  /** Section label per field. */
  labelOf: (field: string) => string;
  /** Display name of a user id (full name). */
  userName?: (id: string) => string;
  /** Fields whose values are users (labels via `userName`, the session user as "Me"). */
  userFields?: string[];
  /** Check fields (0 / 1 → No / Yes). */
  checkFields?: string[];
  /** Desk's tag stats ("Tags"). Default true; false when List View Settings `disable_sidebar_stats` (list_sidebar.js:31-35). */
  tags?: boolean;
  user?: string;
  client?: FrappeClient;
  className?: string;
}

/** Rendered inside `ListView`'s `aside` (it needs the list's `ListActionsContext` to filter). */
export function FrappeGroupBySidebar({ doctype, fields, filters, labelOf, userName = (u) => u, userFields = [], checkFields = [], tags = true, user, client, className }: FrappeGroupBySidebarProps) {
  const { t } = useLocale();
  const actions = useListActions();
  const counts = useGroupByCounts(doctype, fields, filters, { client, user });
  const tagStats = useTagStats(doctype, filters, { client, enabled: tags });
  const label = (field: string, name: string | null) => {
    if (name === null || name === "") return t("listNotSet");
    if (user && name === user) return t("listMe");
    if (checkFields.includes(field)) return isCheckNo(name) ? t("no") : t("yes");
    if (field === "assigned_to" || userFields.includes(field)) return userName(name);
    return name;
  };
  // a Check value is applied as "0" / "1" whatever its JSON type (the request coerces it to 0 / 1)
  const valueOf = (field: string, name: string | null) => {
    const v = name ?? "";
    return v !== "" && checkFields.includes(field) ? (isCheckNo(v) ? "0" : "1") : v;
  };
  // Numbers from the server arrive as strings (useGroupByCounts), so a value is a string end to end — the label, the
  // applied condition and its match — and the request turns it back into the column's number (query.ts `coerce`).
  // Desk shows `__(name)` (the number as is) and filters `= name` (list_sidebar_group_by.js:216-271).
  const sections: GroupBySidebarSection[] = counts.map((c) => ({
    field: c.field, label: labelOf(c.field), loading: c.loading, error: c.error,
    items: c.counts.map((x) => ({ value: valueOf(c.field, x.name), label: label(c.field, x.name), count: Number(x.count) || 0 })),
  }));
  if (tags) {
    sections.push({
      field: "_user_tags", label: t("listTags"), loading: tagStats.loading, error: tagStats.error,
      items: tagStats.stats.filter(([, n]) => Number(n) > 0).map(([tag, n]) => (tag === "No Tags" ? { value: "", label: t("listNoTags"), count: Number(n) } : { value: String(tag), label: String(tag), count: Number(n) })),
    });
  }
  // what is applied now, per sidebar field (Desk marks the applied value, list_sidebar_group_by.js:200-212)
  const active: Record<string, string | undefined> = {};
  for (const c of actions?.query?.conditions ?? []) {
    const field = c.field === "_assign" ? "assigned_to" : c.field;
    if (c.field === "_user_tags") active[field] = c.operator === "not_like" && c.value === "," ? "" : c.operator === "like" ? c.value : undefined;
    else if (c.operator === "is_not_set") active[field] = "";
    // a Check condition as the request reads it ("true" from the filter builder, "1" from the sidebar → "1")
    else if (c.operator === "equals" && checkFields.includes(field)) active[field] = String(checkFilterValue(String(c.value)));
    else if (c.operator === "equals" || (c.field === "_assign" && c.operator === "like")) active[field] = c.value;
  }
  const onSelect = (field: string, value: string | null) => {
    if (!actions) return;
    const f = sidebarFilterField(field);
    if (value === null) { actions.removeCondition?.(f); return; }
    // list_sidebar_group_by.js:259-271 (`_assign like %v%`, "" → `is not set`, else `=`); tags: list_sidebar.js:236-247
    // (`like %tag%`; "No Tags" → `not like %,%`)
    if (f === "_user_tags") actions.applyCondition(f, value === "" ? "not_like" : "like", value === "" ? "," : value);
    else if (value === "") actions.applyCondition(f, "is_not_set", "");
    else actions.applyCondition(f, f === "_assign" ? "like" : "equals", value);
  };
  return <GroupBySidebar sections={sections} active={active} onSelect={onSelect} className={className} />;
}
