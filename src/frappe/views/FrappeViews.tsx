/**
 * FrappeViews — one DocType in the view the user picks: the `ViewSwitcher` (only views this package implements AND the
 * DocType allows, `availableViews`) and the matching view — FrappeListView, FrappeReportView, FrappeImageView,
 * FrappeKanbanView or FrappeCalendarView. The filters and sort of the view being left are carried into the next one
 * (`initialQuery` / `defaultSort`), as Desk keeps the filter area when switching (list_view_select.js:40-49).
 *
 * Carried from every view: Report, Image, Kanban, Calendar and (P35 integration) the List view, through
 * `FrappeListView`'s `onQueryStateChange`.
 *
 * P36b bulk — `bulk`: Desk's Actions on the checked rows in the two TABLE views that have them in Desk, List and Report
 * (ReportView extends ListView, report_view.js:9). Kanban has no row checkboxes in Desk (kanban_board.js); Image and
 * Calendar get nothing here (see docs/components/views.md).
 */
import * as React from "react";
import { QueryClientContext, useQuery } from "@tanstack/react-query";
import { ViewSwitcher } from "../../list/views/ViewSwitcher";
import type { ListViewType, ViewOption } from "../../list/views/types";
import type { ListQueryState } from "../../list/useListState";
import { FrappeListView, type FrappeListViewProps } from "../FrappeListView";
import { FrappeProvider, useFrappeClient } from "../FrappeProvider";
import type { FrappeBulkOptions } from "../list/FrappeBulkActions";
import type { FrappeClient } from "../client";
import type { DocTypeMeta } from "../contract";
import { useFrappeMeta } from "../useFrappeList";
import { availableViews, type CalendarFieldMap } from "./availableViews";
import { getKanbanBoards } from "./kanban";
import { FrappeReportView, type FrappeReportViewProps } from "./FrappeReportView";
import { FrappeImageView, type FrappeImageViewProps } from "./FrappeImageView";
import { FrappeKanbanView, type FrappeKanbanViewProps } from "./FrappeKanbanView";
import { FrappeCalendarView, type FrappeCalendarViewProps } from "./FrappeCalendarView";

type Row = Record<string, unknown>;

/** The views a DocType offers here: its meta + its Kanban Boards (`get_kanban_boards`), through `availableViews`. */
export function useFrappeAvailableViews(doctype: string, opts: { client?: FrappeClient; calendar?: CalendarFieldMap | false } = {}): { views: ViewOption[]; loading: boolean } {
  const fallback = useFrappeClient();
  const client = opts.client ?? fallback;
  const m = useFrappeMeta(doctype, { client });
  const boards = useQuery({ queryKey: ["sf-frappe", "kanban-boards", doctype], queryFn: () => getKanbanBoards(client, doctype).catch(() => []), staleTime: 60_000 });
  const views = React.useMemo(() => (m.doc ? availableViews(m.doc as unknown as DocTypeMeta, { kanbanBoards: boards.data, calendar: opts.calendar }) : [{ view: "list" as const, available: true }]), [m.doc, boards.data, opts.calendar]);
  return { views, loading: m.loading || boards.isPending };
}

export interface FrappeViewsProps {
  doctype: string;
  client?: FrappeClient;
  /** Controlled view. */
  view?: ListViewType;
  /** Uncontrolled first view. Default "list". */
  defaultView?: ListViewType;
  onViewChange?: (view: ListViewType) => void;
  /** List the views that are not available, disabled, with their reason. */
  showUnavailable?: boolean;
  /** Calendar field map (Desk's `<doctype>_calendar.js`); default: guessed from the meta; `false`: no calendar. */
  calendar?: CalendarFieldMap | false;
  /** P36b — Desk's Actions (incl. Submit / Cancel) on the checked rows of the List AND Report views; `list.bulk` /
   *  `report.bulk` override per view. */
  bulk?: FrappeBulkOptions;
  /** Extra props per view. */
  list?: Partial<FrappeListViewProps<Row>>;
  report?: Partial<FrappeReportViewProps>;
  image?: Partial<FrappeImageViewProps>;
  kanban?: Partial<FrappeKanbanViewProps>;
  calendarView?: Partial<FrappeCalendarViewProps>;
}

export function FrappeViews(props: FrappeViewsProps) {
  const hasQueryClient = React.useContext(QueryClientContext);
  return hasQueryClient ? <Inner {...props} /> : <FrappeProvider client={props.client}><Inner {...props} /></FrappeProvider>;
}

function Inner({ doctype, client, view: controlled, defaultView = "list", onViewChange, showUnavailable, calendar, bulk, list, report, image, kanban, calendarView }: FrappeViewsProps) {
  const { views } = useFrappeAvailableViews(doctype, { client, calendar });
  const [own, setOwn] = React.useState<ListViewType>(defaultView);
  const wanted = controlled ?? own;
  // never render a view that is not available (e.g. a stored choice the DocType no longer allows)
  const current: ListViewType = views.find((v) => v.view === wanted)?.available ? wanted : "list";
  const carried = React.useRef<ListQueryState | null>(null);
  const remember = (s: ListQueryState) => { carried.current = s; };
  const change = (v: ListViewType) => { setOwn(v); onViewChange?.(v); };
  const switcher = <ViewSwitcher views={views} value={current} onChange={change} showUnavailable={showUnavailable} />;
  const shared = { initialQuery: carried.current?.query, onQueryStateChange: remember };
  const sort = carried.current?.sort;
  switch (current) {
    case "report":
      return <FrappeReportView key="report" doctype={doctype} client={client} defaultSort={sort} bulk={bulk} {...shared} {...report} toolbarActions={<>{switcher}{report?.toolbarActions}</>} />;
    case "image":
      return <FrappeImageView key="image" doctype={doctype} client={client} defaultSort={sort} {...shared} {...image} toolbarLeading={<>{switcher}{image?.toolbarLeading}</>} />;
    case "kanban":
      return <FrappeKanbanView key="kanban" doctype={doctype} client={client} defaultSort={sort} {...shared} {...kanban} toolbarLeading={<>{switcher}{kanban?.toolbarLeading}</>} />;
    case "calendar":
      return <FrappeCalendarView key="calendar" doctype={doctype} client={client} fieldMap={calendar || undefined} {...shared} {...calendarView} toolbarLeading={<>{switcher}{calendarView?.toolbarLeading}</>} />;
    default:
      return <FrappeListView<Row> key="list" doctype={doctype} client={client} initialQuery={carried.current?.query} defaultSort={sort} bulk={bulk} {...list} onQueryStateChange={(st) => { remember(st); list?.onQueryStateChange?.(st); }} toolbarActions={<>{switcher}{list?.toolbarActions}</>} />;
  }
}
