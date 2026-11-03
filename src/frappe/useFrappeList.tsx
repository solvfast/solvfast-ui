/**
 * useFrappeMeta / useFrappeList — the List View in server mode over a Frappe DocType (Sear hooks/useDataGrid.ts,
 * whose Frappe path had never run). `useFrappeList` returns the props to spread onto `ListView`: it builds the
 * request from the list's state (query.ts), fetches rows and the count with the SAME filters, loads grouped lists in
 * chunks with "Load more" (rule C1), and explains narrowed search (rule C2).
 */
import * as React from "react";
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { fieldOf, mergeColumns, type ColumnDef } from "../list/model/columns";
import type { GroupByOption } from "../list/model/group";
import type { FilterField, FiscalYear } from "../list/model/filters";
import type { LoadOptions } from "../list/parts/FilterBuilder";
import type { ListQueryState } from "../list/useListState";
import { loc, type Localized } from "../lib/localized";
import { useLocale } from "../theme/ThemeProvider";
import { FrappeError, type DocMeta, type FrappeClient } from "./client";
import { useFrappeClient } from "./FrappeProvider";
import { buildFrappeListMeta, type ListDocMeta } from "./meta";
import { buildListRequest, type FrappeFilter } from "./query";
import { rowMetaColumns } from "./list/cells";
import { formatValue, type FormatContext } from "./services/format";
import { useFormatContext } from "./FrappeProvider";
import type { MetaBundle } from "./contract";
import { hasIndicator, indicatorFields, type IndicatorConfig, type IndicatorWorkflow } from "./list/indicator";
import { COUNT_UPPER_BOUND, reportviewCount, reportviewGet, type ReportviewUser } from "./list/reportview";
import { applyColumnSettings, fetchListSettings } from "./list/settings";

/** `getdoctype`: the DocType first, then its child-table DocTypes; plus the user's saved `user_settings` (JSON string). */
export async function loadDocTypeBundle(client: FrappeClient, doctype: string): Promise<{ meta: ListDocMeta; children: Record<string, DocMeta>; userSettings: Record<string, unknown> }> {
  const res = await client.call("frappe.desk.form.load.getdoctype", { doctype });
  const docs = (res.docs ?? []) as ListDocMeta[];
  const meta = docs.find((d) => d?.name === doctype);
  if (!meta) throw new FrappeError(`No metadata for DocType "${doctype}"`, 404, "DoesNotExistError");
  let userSettings: Record<string, unknown> = {};
  try { const raw = res.user_settings; const p = typeof raw === "string" ? JSON.parse(raw || "{}") : raw; if (p && typeof p === "object") userSettings = p as Record<string, unknown>; } catch { /* ignore */ }
  return { meta, children: Object.fromEntries(docs.filter((d) => d && d.name !== doctype).map((d) => [d.name, d as DocMeta])), userSettings };
}

export function useFrappeMeta(doctype: string, opts: { client?: FrappeClient } = {}) {
  const fallback = useFrappeClient();
  const client = opts.client ?? fallback;
  const { t } = useLocale();
  const q = useQuery({ queryKey: ["sf-frappe", "list-meta", doctype], queryFn: () => loadDocTypeBundle(client, doctype), staleTime: 5 * 60_000 });
  const meta = React.useMemo(() => (q.data ? buildFrappeListMeta(q.data.meta, t, q.data.children) : undefined), [q.data, t]);
  // plain types only: React Query's own types live in @tanstack/query-core, which consumers may not be able to resolve
  const refetch = React.useCallback(async (): Promise<void> => { await q.refetch(); }, [q]);
  const bundle = React.useMemo<MetaBundle | undefined>(() => (q.data ? ({ doctype, meta: q.data.meta, children: q.data.children } as unknown as MetaBundle) : undefined), [q.data, doctype]);
  return { meta, bundle, doc: q.data?.meta, userSettings: q.data?.userSettings, loading: q.isPending, error: q.error as Error | null, refetch };
}

/** After the app writes (insert, delete, update), reload a DocType's lists and counts — or every Frappe list. */
export async function invalidateFrappeList(queryClient: QueryClient, doctype?: string): Promise<void> {
  await Promise.all(["list", "count"].map((kind) => queryClient.invalidateQueries({ queryKey: doctype ? ["sf-frappe", kind, doctype] : ["sf-frappe", kind] })));
}

/** Link-field options from Frappe's own link search (`frappe.desk.search.search_link`). */
export function frappeLinkSearch(client: FrappeClient, referenceDoctype?: string): LoadOptions {
  return async (field: FilterField, text: string) => {
    if (!field.link_doctype) return [];
    const res = await client.searchLink(field.link_doctype, text, { referenceDoctype });
    return res.map((r) => ({ value: r.value, label: r.label || r.value }));
  };
}

export interface FrappeListOptions<T> {
  doctype: string;
  /** Curated columns; the DocType's other fields are added after them (hidden unless `in_list_view`). */
  columns?: ColumnDef<T>[];
  /** Always AND-ed into every request (e.g. a project scope). Changing them clears the selection. */
  baseFilters?: FrappeFilter[];
  /** Search these fields. Default: title field + the DocType's search fields + ID. */
  searchFields?: string[];
  /** Fields offered in "Group by" (opt-in). */
  groupByFields?: string[];
  /** Grouped lists load this many rows at a time. Default 200. */
  chunkSize?: number;
  /** Default 20. */
  pageSize?: number;
  /** Labels for the DocType's fields (DocField labels come as defined on the server, untranslated). A curated column's
   *  label also names its field in filters and search. */
  fieldLabels?: Record<string, Localized>;
  client?: FrappeClient;
  /** "Fiscal Year" in the date filters. Default: the site's Fiscal Year records when it has them (ERPNext), read as the
   *  logged-in user; `false` = never offer it. */
  fiscalYears?: FiscalYear[] | false;
  /**
   * Row metadata columns Desk draws (indicator, assignees, comment count, likes). Default: offered in the column
   * manager, hidden at first (0.3.x lists look as before). `true`: shown by default. `false`: none. An object turns
   * single columns off.
   */
  rowMeta?: boolean | { indicator?: boolean; assignees?: boolean; comments?: boolean; likes?: boolean };
  /** The DocType's Workflow, for the indicator (Desk reads it from `frappe.boot`). */
  workflow?: IndicatorWorkflow;
  /** `listview_settings.get_indicator` equivalent. */
  getIndicator?: IndicatorConfig["getIndicator"];
  /** Read List View Settings (`get_list_settings`). Default true. */
  listSettings?: boolean;
  /** Site / user formats for `formatValue` (number format, currency, date format …). Default: the provider's `formatContext`. */
  formatContext?: FormatContext;
}

type Row = Record<string, unknown>;
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function useFrappeList<T = Row>(o: FrappeListOptions<T>) {
  const fallback = useFrappeClient();
  const client = o.client ?? fallback;
  const { t, language } = useLocale();
  const m = useFrappeMeta(o.doctype, { client });
  const meta = m.meta;
  const settingsQ = useQuery({ queryKey: ["sf-frappe", "list-settings", o.doctype], queryFn: () => fetchListSettings(client, o.doctype), enabled: o.listSettings !== false, staleTime: 5 * 60_000 });
  const settings = settingsQ.data ?? null;
  const settingsReady = o.listSettings === false || !settingsQ.isPending;
  const [userInfo, setUserInfo] = React.useState<Record<string, ReportviewUser>>({});
  const [userNames, setUserNames] = React.useState<Record<string, string>>({});
  const [exactCount, setExactCount] = React.useState(false);
  const providerFormat = useFormatContext();
  const formatCtx = React.useMemo<FormatContext>(() => ({ checkLabels: { yes: t("yes"), no: t("no") }, ...providerFormat, ...o.formatContext }), [providerFormat, o.formatContext, t]);

  // a field's label: the app's `fieldLabels`, else the label of a curated column showing that field, else the DocType's
  const curatedLabel = React.useMemo(() => new Map((o.columns ?? []).map((c) => [fieldOf(c), c.label])), [o.columns]);
  const label = React.useCallback((name: string, fallbackLabel: Localized) => loc(o.fieldLabels?.[name] ?? curatedLabel.get(name) ?? fallbackLabel, language), [o.fieldLabels, curatedLabel, language]);
  const indicatorCfg = React.useMemo<IndicatorConfig | null>(() => {
    if (!meta || o.rowMeta === false || (typeof o.rowMeta === "object" && o.rowMeta.indicator === false)) return null;
    const cfg: IndicatorConfig = {
      isSubmittable: meta.isSubmittable, workflow: o.workflow, states: meta.states, hasField: meta.hasField, getIndicator: o.getIndicator,
      words: { draft: t("listDraft"), cancelled: t("listCancelled"), submitted: t("listSubmitted"), enabled: t("yes"), disabled: t("no") },
    };
    return hasIndicator(cfg) ? cfg : null;
  }, [meta, o.rowMeta, o.workflow, o.getIndicator, t]);
  const rm = o.rowMeta === false ? {} : typeof o.rowMeta === "object" ? o.rowMeta : {};
  const commentsOff = !!settings?.disable_comment_count;
  const columns = React.useMemo<ColumnDef<T>[]>(() => {
    const generated = (meta?.columns ?? []).map((c) => ({ ...c, label: label(c.key, c.label) })) as unknown as ColumnDef<T>[];
    // Desk always puts the Subject (title field, else the ID) first and shows it (list_view.js:375-486). Apps that curate
    // their own columns keep full control.
    const subjectKey = generated.some((c) => c.key === meta?.titleField) ? meta?.titleField : "name";
    const subject = !o.columns?.length ? generated.filter((c) => c.key === subjectKey).map((c) => ({ ...c, hidden: false })) : [];
    const rest = subject.length ? generated.filter((c) => c.key !== subjectKey) : generated;
    const merged = mergeColumns(o.columns ?? [], [...subject, ...rest]);
    const on = (k: "assignees" | "comments" | "likes") => o.rowMeta !== false && rm[k] !== false && (k !== "comments" || !commentsOff) && !!meta?.hasField(k === "assignees" ? "_assign" : k === "comments" ? "_comments" : "_liked_by");
    const extra = rowMetaColumns({
      indicator: indicatorCfg, assignees: on("assignees"), comments: on("comments"), likes: on("likes"), userInfo,
      hidden: o.rowMeta !== true,
      labels: { indicator: t("listIndicator"), assigned: t("listAssigned"), comments: t("listComments"), likes: t("listLikes") },
    });
    // Desk's order: subject, status indicator, the DocType's own columns, then assignees / comments / likes
    const withIndicator = extra.indicator ? [merged[0], extra.indicator as unknown as ColumnDef<T>, ...merged.slice(1)].filter(Boolean) : merged;
    const all = [...withIndicator, ...(extra.trailing as unknown as ColumnDef<T>[])];
    // cell display = Desk's formatter (docs 12 §9): numbers, currency, dates by the site's formats
    const FORMATTED = new Set(["Int", "Float", "Percent", "Currency", "Date", "Datetime", "Time"]);
    const formatted = all.map((c) => {
      const df = meta?.fieldDefs[fieldOf(c)];
      const f = fieldOf(c);
      // User links (owner, modified_by, Link → User) show the full name, as Desk does; the id when it is not known
      if (!c.render && (f === "owner" || f === "modified_by" || (df?.fieldtype === "Link" && df.options === "User"))) {
        return { ...c, render: (row: T) => {
          const id = (row as Row)[f];
          if (id === null || id === undefined || id === "") return <span className="text-muted-foreground">—</span>;
          const key = String(id);
          return <span title={key}>{userInfo[key]?.fullname || userNames[key] || formatCtx.linkTitles?.[`User::${key}`] || key}</span>;
        } };
      }
      if (c.render || !df || !FORMATTED.has(df.fieldtype)) return c;
      return { ...c, render: (row: T) => { const v = (row as Row)[fieldOf(c)]; return v === null || v === undefined || v === "" ? <span className="text-muted-foreground">—</span> : <span dir="ltr" className="whitespace-nowrap tabular-nums">{formatValue(v, df, row as never, formatCtx)}</span>; } };
    });
    return applyColumnSettings(formatted, settings, meta?.titleField ?? "name");
  }, [formatCtx, meta, o.columns, o.rowMeta, label, indicatorCfg, userInfo, userNames, commentsOff, settings, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const filterFields = React.useMemo(() => (meta?.filterFields ?? []).map((f) => ({ ...f, label: label(f.name, f.label) })), [meta, label]);

  const [state, setState] = React.useState<ListQueryState | null>(null);
  // Only the list built from the DocType reports state: the placeholder shown while the meta loads has no columns, and
  // its state would fetch rows with `name` only before the real request.
  const metaRef = React.useRef(meta);
  metaRef.current = meta;
  const onStateChange = React.useCallback((next: ListQueryState) => {
    if (metaRef.current) setState((prev) => (sameJson(prev, next) ? prev : next));
  }, []);

  // Fiscal years (ERPNext's "Fiscal Year" DocType; none when the site lacks it or the user can't read it). Loaded only
  // when needed — the filter opens, or the query already has a Fiscal Year condition — and once per session.
  const qc = useQueryClient();
  const fyQuery = React.useMemo(() => ({
    queryKey: ["sf-frappe", "fiscal-years"],
    queryFn: () => client
      .getList<{ name: string; year_start_date: string; year_end_date: string }>("Fiscal Year", { fields: ["name", "year_start_date", "year_end_date"], order_by: "year_start_date desc", limit_page_length: 50 })
      .then((rows) => rows.map((r) => ({ name: r.name, from: String(r.year_start_date).slice(0, 10), to: String(r.year_end_date).slice(0, 10) })))
      .catch(() => [] as FiscalYear[]),
    staleTime: 60 * 60_000,
    retry: false,
  }), [client]);
  const auto = o.fiscalYears === undefined;
  const needFy = !!state?.query.conditions.some((c) => c.operator === "fiscal_year");
  const fy = useQuery({ ...fyQuery, enabled: auto && needFy });
  const fiscalYears = o.fiscalYears === false ? undefined : (o.fiscalYears ?? fy.data);
  const loadFiscalYears = React.useMemo(() => (auto ? () => qc.fetchQuery(fyQuery) : undefined), [auto, qc, fyQuery]);
  // a Fiscal Year condition waits for the years' dates (else it would be dropped and the list shown unfiltered)
  const waitFy = auto && needFy && fiscalYears === undefined;

  // a Currency column shows its amount in the currency named by its `options` field, which the row must carry
  const currencyFields = React.useMemo(() => Object.values(meta?.fieldDefs ?? {}).filter((d) => d.fieldtype === "Currency" && d.options && !String(d.options).includes(":")).map((d) => String(d.options)), [meta]);
  const req = React.useMemo(
    () => (meta && state && !waitFy && settingsReady ? buildListRequest({ meta, columns: columns as never, state, baseFilters: o.baseFilters, searchFields: o.searchFields, chunkSize: o.chunkSize, fiscalYears, rowFields: true, extraFields: [...(indicatorCfg ? indicatorFields(indicatorCfg) : []), ...currencyFields] }) : null),
    [meta, state, waitFy, columns, o.baseFilters, o.searchFields, o.chunkSize, fiscalYears],
  );

  const list = useInfiniteQuery({
    queryKey: ["sf-frappe", "list", o.doctype, req && [req.fields, req.filters, req.or_filters, req.order_by, req.limit_start, req.limit_page_length, commentsOff]],
    enabled: !!req,
    initialPageParam: req?.limit_start ?? 0,
    // Desk's own row source (`reportview.get`): comment counts and assignee profiles exist only there (docs 13 §1.3)
    queryFn: async ({ pageParam }) => (await reportviewGet<T>(client, o.doctype, {
      fields: req!.fields, filters: req!.filters, or_filters: req!.or_filters, order_by: req!.order_by,
      limit_start: pageParam, limit_page_length: req!.limit_page_length, withCommentCount: !commentsOff, group_by: req!.group_by,
    })),
    // grouped: the next chunk starts where the loaded rows end; paged: one page per query
    getNextPageParam: (last, _all, lastParam) => (req?.grouped && last.rows.length === req.limit_page_length ? lastParam + last.rows.length : undefined),
    placeholderData: keepPreviousData,
  });
  const countOff = !!settings?.disable_count;
  const count = useQuery({
    queryKey: ["sf-frappe", "count", o.doctype, req && [req.filters, req.or_filters, exactCount]],
    enabled: !!req && !countOff,
    queryFn: () => reportviewCount(client, o.doctype, { filters: req!.filters, or_filters: req!.or_filters, distinct: req!.joinsChild, limit: exactCount ? undefined : COUNT_UPPER_BOUND }),
    placeholderData: keepPreviousData,
  });

  const rows = React.useMemo(() => list.data?.pages.flatMap((p) => p.rows) ?? [], [list.data]);
  // Full names of the users the rows mention in owner / User-link columns that `user_info` (assignees only) does not cover.
  // Best effort: a site that hides the User list leaves ids.
  const userFields = React.useMemo(() => Object.values(meta?.fieldDefs ?? {}).filter((d) => d.fieldname === "owner" || d.fieldname === "modified_by" || (d.fieldtype === "Link" && d.options === "User")).map((d) => d.fieldname).concat(["owner", "modified_by"]), [meta]);
  React.useEffect(() => {
    const ids = new Set<string>();
    for (const r of rows as Row[]) for (const f of userFields) { const v = r[f]; if (typeof v === "string" && v && !userInfo[v] && !userNames[v] && v !== "Administrator") ids.add(v); }
    if (!ids.size) return;
    let live = true;
    void client.getList<{ name: string; full_name?: string }>("User", { fields: ["name", "full_name"], filters: [["name", "in", [...ids]]], limit_page_length: ids.size })
      .then((us) => { if (live) setUserNames((p) => ({ ...p, ...Object.fromEntries([...ids].map((id) => [id, us.find((u) => u.name === id)?.full_name || id])) })); })
      .catch(() => { if (live) setUserNames((p) => ({ ...p, ...Object.fromEntries([...ids].map((id) => [id, id])) })); });
    return () => { live = false; };
  }, [rows, userFields, userInfo, userNames, client]);
  React.useEffect(() => {
    const merged = Object.assign({}, ...(list.data?.pages.map((p) => p.userInfo) ?? []));
    if (Object.keys(merged).length) setUserInfo((prev) => (sameJson(prev, { ...prev, ...merged }) ? prev : { ...prev, ...merged }));
  }, [list.data]);
  const err = m.error ?? list.error ?? count.error;
  const titleLabel = filterFields.find((f) => f.name === meta?.titleField)?.label ?? meta?.titleField ?? "";

  const groupByOptions = React.useMemo<GroupByOption<T>[]>(() => (o.groupByFields ?? []).filter((f) => meta?.known.has(f)).map((f) => {
    const isCheck = meta?.fieldtypes.get(f) === "Check";
    return {
      key: f,
      label: filterFields.find((x) => x.name === f)?.label ?? f,
      groupOf: (row: T) => {
        const v = (row as Row)[f];
        if (v === null || v === undefined || v === "") return { key: "__none__", label: "—" };
        return { key: String(v), label: isCheck ? (v ? t("yes") : t("no")) : String(v) };
      },
    };
  }), [o.groupByFields, meta, filterFields, t]);

  const loadOptions = React.useMemo(() => frappeLinkSearch(client, o.doctype), [client, o.doctype]);

  return {
    meta,
    bundle: m.bundle,
    userSettings: m.userSettings,
    settings,
    ready: !!meta,
    request: req,
    refetch: () => { if (m.error) void m.refetch(); else { void list.refetch(); void count.refetch(); } },
    listProps: {
      mode: "server" as const,
      rows,
      total: count.data?.count ?? rows.length,
      // Desk: "1,000+" at the 1001 bound (click to count exactly); no count at all when List View Settings disable it
      totalLabel: countOff ? "" : count.data?.capped ? `${(count.data.count - 1).toLocaleString(language === "ar" ? "ar-EG" : "en-US")}+` : undefined,
      hasMore: countOff || !!count.data?.capped,
      onTotalClick: count.data?.capped ? () => setExactCount(true) : undefined,
      loading: !err && (m.loading || !state || list.isPending),
      error: err ? (err instanceof Error && err.message ? err.message : true) : undefined,
      onRetry: () => { if (m.error) void m.refetch(); else { void list.refetch(); void count.refetch(); } },
      onStateChange,
      onLoadMore: req?.grouped && list.hasNextPage ? () => void list.fetchNextPage() : undefined,
      searchHint: req?.searchNarrowed ? t("searchTitleOnly").replace("{field}", titleLabel) : undefined,
      columns,
      filterFields,
      quickFilterFields: meta?.quickFilterFields,
      groupByOptions,
      loadOptions,
      fiscalYears,
      loadFiscalYears,
      rowKey: (row: T) => String((row as Row).name),
      selectionScope: JSON.stringify(o.baseFilters ?? []),
      pageSize: o.pageSize,
    },
  };
}
