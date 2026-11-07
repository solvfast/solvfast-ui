/**
 * FrappeCalendarView — Desk's Calendar view (frappe/public/js/frappe/views/calendar/calendar.js, month mode) on the
 * Core `CalendarMonth`. Desk's field map lives in app code (`frappe.views.calendar[doctype]`, `<doctype>_calendar.js`)
 * or a "Calendar View" document — not in the DocType meta — so it is passed (`fieldMap`) or guessed from the meta
 * (`calendarFieldMapFromMeta`: the first Date / Datetime field …).
 *
 * Rows of the visible weeks are read with the list's own filters and search:
 * - `source: "reportview"` (default): `frappe.desk.reportview.get` with `[start, "<=", last day]` and
 *   `[end, ">=", first day]` (start alone when there is no end field) — works for any DocType the user can read.
 *   DIFFERS from get_events: a row whose end date is empty is NOT shown (Desk's `ifnull(end, '2199-12-31')`,
 *   calendar.py:49-55, keeps it).
 * - `source: { method }`: Desk's `get_events` call (calendar.js:279-290, 358-367; default method
 *   `frappe.desk.calendar.get_events`, calendar.py:31-57), args `doctype, start, end, field_map, filters`.
 *
 * Not reproduced from Desk: week / day views, drag to move or resize events (`update_event`), creating an event by
 * selecting days, the weekend toggle, "Calendar View" documents, time-zone conversion (`convertToUserTz`).
 */
import * as React from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { CalendarMonth } from "../../list/views/CalendarMonth";
import { dayOf, monthGrid, monthStart, ymd, type CalendarEvent } from "../../list/views/calendarModel";
import { ViewToolbar, type ViewToolbarControls } from "../../list/views/ViewToolbar";
import { useListState, type ListQueryState, type UseListStateOptions } from "../../list/useListState";
import type { FilterQuery } from "../../list/model/filters";
import { useLocale } from "../../theme/ThemeProvider";
import { FrappeProvider, useFrappeClient } from "../FrappeProvider";
import type { FrappeClient } from "../client";
import type { FrappeFilter } from "../query";
import { useFrappeMeta } from "../useFrappeList";
import { calendarFieldMapFromMeta, type CalendarFieldMap } from "./availableViews";
import { useFrappeViewList, type ViewRequest } from "./useFrappeViewList";

type Row = Record<string, unknown>;

export interface FrappeCalendarViewProps {
  doctype: string;
  client?: FrappeClient;
  /** Desk's field map. Default: guessed from the meta. */
  fieldMap?: CalendarFieldMap;
  /** Where events come from (see the header). Default "reportview". */
  source?: "reportview" | { method?: string };
  baseFilters?: FrappeFilter[];
  /** Controlled month (any day of it, "YYYY-MM-DD"). */
  month?: string;
  /** Uncontrolled start month. Default: today. */
  initialMonth?: string;
  onMonthChange?: (month: string) => void;
  onEventClick?: (row: Row, event: CalendarEvent) => void;
  /** 0 = Sunday … 6 = Saturday. Default 1. */
  weekStartsOn?: number;
  /** Today's date (tests). */
  today?: string;
  controls?: ViewToolbarControls;
  toolbarLeading?: React.ReactNode;
  storage?: UseListStateOptions<Row>["storage"];
  initialQuery?: FilterQuery;
  onQueryStateChange?: (state: ListQueryState) => void;
  className?: string;
}

export const CALENDAR_EVENTS_METHOD = "frappe.desk.calendar.get_events";

export function FrappeCalendarView(props: FrappeCalendarViewProps) {
  const hasQueryClient = React.useContext(QueryClientContext);
  return hasQueryClient ? <Inner {...props} /> : <FrappeProvider client={props.client}><Inner {...props} /></FrappeProvider>;
}

/** Row → event, as Desk's `prepare_events` (calendar.js:372-415): a missing start takes the end, a missing end the start. */
export function rowToEvent(row: Row, map: CalendarFieldMap): CalendarEvent | null {
  const s = dayOf(String(row[map.start] ?? "")) ? String(row[map.start]) : "";
  const e = map.end && dayOf(String(row[map.end] ?? "")) ? String(row[map.end]) : "";
  const start = s || e;
  if (!start) return null;
  const color = map.color ? row[map.color] : null;
  return { id: String(row.name), title: String(row[map.title ?? "name"] ?? row.name ?? ""), start, end: e || start, color: typeof color === "string" && color ? color : null, allDay: map.allDay === true || (typeof map.allDay === "string" && !!row[map.allDay]), data: row };
}

function Inner(p: FrappeCalendarViewProps) {
  const { t } = useLocale();
  const fallback = useFrappeClient();
  const client = p.client ?? fallback;
  const m = useFrappeMeta(p.doctype, { client });
  const map = React.useMemo(() => p.fieldMap ?? (m.doc ? calendarFieldMapFromMeta(m.doc as never) : null), [p.fieldMap, m.doc]);
  const [own, setOwn] = React.useState(() => monthStart(p.initialMonth ?? p.today ?? ymd(new Date())));
  const month = monthStart(p.month ?? own);
  const setMonth = (next: string) => { setOwn(monthStart(next)); p.onMonthChange?.(monthStart(next)); };
  if (m.doc && !map) return <p className="text-sm text-muted-foreground" role="status">{t("viewReasonNoDateField")}</p>;
  return <Body {...p} client={client} map={map} month={month} setMonth={setMonth} />;
}

function Body(p: FrappeCalendarViewProps & { client: FrappeClient; map: CalendarFieldMap | null; month: string; setMonth: (m: string) => void }) {
  const map = p.map;
  const grid = monthGrid(p.month, p.weekStartsOn ?? 1);
  const m = useFrappeMeta(p.doctype, { client: p.client });
  const typeOf = (f?: string) => (m.doc?.fields ?? []).find((x) => x.fieldname === f)?.fieldtype;
  const bound = (day: string, f: string | undefined, endOfDay: boolean) => (typeOf(f) === "Datetime" && endOfDay ? `${day} 23:59:59` : day);
  const viaMethod = typeof p.source === "object";
  const range = React.useMemo<FrappeFilter[]>(() => {
    if (!map || viaMethod) return [];
    const endField = map.end && map.end !== map.start ? map.end : map.start;
    return [[map.start, "<=", bound(grid.end, map.start, true)], [endField, ">=", grid.start]];
  }, [map, viaMethod, grid.start, grid.end, m.doc]); // eslint-disable-line react-hooks/exhaustive-deps
  const baseFilters = React.useMemo(() => [...(p.baseFilters ?? []), ...range], [p.baseFilters, range]);
  const method = typeof p.source === "object" ? p.source.method ?? CALENDAR_EVENTS_METHOD : undefined;
  const fetchRows = React.useMemo(() => (method && map ? async (client: FrappeClient, req: ViewRequest) => {
    // Desk's get_args (calendar.js:358-367): the visible range, the filter area's filters, the field map
    const res = await client.call(method, {
      doctype: p.doctype, start: grid.start, end: bound(grid.end, map.start, true),
      field_map: JSON.stringify({ id: "name", start: map.start, end: map.end ?? map.start, title: map.title ?? "name", ...(map.color ? { color: map.color } : {}), allDay: map.allDay === true ? 1 : map.allDay || 0 }),
      filters: JSON.stringify(req.filters),
    });
    return Array.isArray(res.message) ? (res.message as Row[]) : [];
  } : undefined), [method, map, p.doctype, grid.start, grid.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const extra = map ? [map.start, map.end, map.title, map.color, typeof map.allDay === "string" ? map.allDay : undefined].filter((f): f is string => !!f) : [];
  const v = useFrappeViewList({ doctype: p.doctype, client: p.client, baseFilters, pageSize: 0, count: false, scope: `calendar:${method ?? "reportview"}:${grid.start}`, extraFields: extra, fetchRows, enabled: !!map });
  return v.ready && map
    ? <Calendar {...p} map={map} v={v} />
    : <CalendarMonth month={p.month} onMonthChange={p.setMonth} events={[]} loading today={p.today} weekStartsOn={p.weekStartsOn} />;
}

function Calendar({ v, map, ...p }: FrappeCalendarViewProps & { client: FrappeClient; map: CalendarFieldMap; month: string; setMonth: (m: string) => void; v: ReturnType<typeof useFrappeViewList> }) {
  const onState = v.listProps.onStateChange;
  const onStateChange = React.useCallback((s: ListQueryState) => { onState(s); p.onQueryStateChange?.(s); }, [onState, p.onQueryStateChange]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = useListState<Row>({ ...v.listProps, onStateChange, viewKey: `${p.doctype}:calendar`, storage: p.storage, initialQuery: p.initialQuery });
  const events = React.useMemo(() => v.rows.map((r) => rowToEvent(r, map)).filter((e): e is CalendarEvent => !!e), [v.rows, map]);
  return (
    <div className={p.className ? `space-y-3 ${p.className}` : "space-y-3"}>
      <ViewToolbar state={s} controls={{ sort: false, ...p.controls }} loadOptions={v.listProps.loadOptions} leading={p.toolbarLeading} />
      <CalendarMonth month={p.month} onMonthChange={p.setMonth} events={events} weekStartsOn={p.weekStartsOn} today={p.today}
        onEventClick={(e) => p.onEventClick?.(e.data as Row, e)} loading={v.listProps.loading} error={v.listProps.error} onRetry={v.refetch} />
    </div>
  );
}
