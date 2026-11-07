/**
 * Which list views a DocType can be shown in — Desk's `ListViewSelect.setup_views` conditions
 * (frappe/public/js/frappe/list/list_view_select.js:52-133) intersected with what THIS package implements. Pure TS.
 *
 * | View      | Desk condition (list_view_select.js)                         | Here                                                     |
 * |-----------|---------------------------------------------------------------|----------------------------------------------------------|
 * | List      | always (:54-56)                                               | available                                                |
 * | Report    | always (:57-60)                                               | available                                                |
 * | Dashboard | always (:72-75)                                               | not implemented (needs Dashboard Chart / Number Card docs) |
 * | Calendar  | `frappe.views.calendar[doctype]` — `<doctype>_calendar.js` (:76-84) | available with a field map (`calendar`) or a Date / Datetime field in the meta |
 * | Gantt     | same JS config (:85-88)                                       | not implemented                                          |
 * | Inbox     | Communication + an Email Account (:89-102)                    | not implemented                                          |
 * | Image     | `meta.image_field` (:103-106)                                 | available when `image_field` names a field               |
 * | Tree      | `treeview_settings[doctype]` or `meta.is_tree` (:107-112)     | not implemented                                          |
 * | Kanban    | doctype != "File" (:113-120); boards are picked or created    | available with a Kanban Board (`kanbanBoards`) or a Select field to group by |
 * | Map       | `get_coords_method`, latitude + longitude, or a `location` Geolocation (:121-131) | not implemented                   |
 *
 * Desk's Calendar and Gantt read a JavaScript field map (`frappe.views.calendar[doctype]`, shipped in the app's
 * `<doctype>_calendar.js`): it is not in the DocType meta, so the host passes it or `calendarFieldMapFromMeta` guesses one.
 */
import type { ListViewType, ViewOption } from "../../list/views/types";
import { LIST_VIEW_TYPES } from "../../list/views/types";
import type { DocTypeMeta, FrappeDocField } from "../contract";

/** Desk's calendar `field_map` (calendar.js:118-125; `<doctype>_calendar.js`). */
export interface CalendarFieldMap {
  /** Start date / datetime field. */
  start: string;
  /** End date / datetime field (default: `start`). */
  end?: string;
  /** Title field (default: the DocType's title field, else `name`). */
  title?: string;
  /** A Color field (Desk's get_events adds the first Color field, calendar.py:37-39). */
  color?: string;
  /** All-day events (Desk: `allDay` maps to a Check field or a constant 1). */
  allDay?: string | boolean;
}

const DATE_TYPES = new Set(["Date", "Datetime"]);
const usable = (f: FrappeDocField) => !f.hidden;

/**
 * A calendar field map guessed from the meta: the first visible Date / Datetime field is the start, the next one whose
 * name says it ends a range (end / to / till / due / until) the end, the title field the title, the first Color field
 * the colour. `null` when the DocType has no date field. Desk never guesses: its map is app code; pass your own when
 * the guess is wrong.
 */
export function calendarFieldMapFromMeta(meta: Pick<DocTypeMeta, "fields" | "title_field">): CalendarFieldMap | null {
  const dates = (meta.fields ?? []).filter((f) => DATE_TYPES.has(f.fieldtype) && usable(f));
  if (!dates.length) return null;
  const start = dates.find((f) => /start|from|begin/.test(f.fieldname)) ?? dates[0];
  const end = dates.find((f) => f !== start && /end|to$|_to_|till|until|due/.test(f.fieldname));
  const color = (meta.fields ?? []).find((f) => f.fieldtype === "Color");
  const title = meta.title_field && (meta.fields ?? []).some((f) => f.fieldname === meta.title_field) ? meta.title_field : "name";
  return { start: start.fieldname, end: end?.fieldname, title, color: color?.fieldname, allDay: start.fieldtype === "Date" };
}

/** Select fields a Kanban can group by (no board): visible Select fields with options. */
export function kanbanGroupFields(meta: Pick<DocTypeMeta, "fields">): FrappeDocField[] {
  return (meta.fields ?? []).filter((f) => f.fieldtype === "Select" && usable(f) && !!(f.options ?? "").trim());
}

export interface AvailableViewsContext {
  /** Kanban Boards of the DocType (`get_kanban_boards`, kanban_board.py:68-75). */
  kanbanBoards?: readonly unknown[];
  /** The calendar field map (Desk's `<doctype>_calendar.js`); `false` turns the guess off. */
  calendar?: CalendarFieldMap | false;
}

/** Every view of Desk's menu, in Desk's order, with `available` and the reason when it is not. */
export function availableViews(meta: DocTypeMeta, ctx: AvailableViewsContext = {}): ViewOption[] {
  const fields = meta.fields ?? [];
  const has = (n?: string) => !!n && fields.some((f) => f.fieldname === n);
  const one = (view: ListViewType): ViewOption => {
    switch (view) {
      case "list": case "report": return { view, available: true };
      case "image": return has(meta.image_field) ? { view, available: true } : { view, available: false, reason: "no_image_field" };
      case "kanban":
        if (meta.name === "File") return { view, available: false, reason: "no_kanban_source" }; // list_view_select.js:114
        return ctx.kanbanBoards?.length || kanbanGroupFields(meta).length ? { view, available: true } : { view, available: false, reason: "no_kanban_source" };
      case "calendar": {
        const map = ctx.calendar === false ? null : ctx.calendar ?? calendarFieldMapFromMeta(meta);
        return map && has(map.start) ? { view, available: true } : { view, available: false, reason: "no_date_field" };
      }
      case "tree": return { view, available: false, reason: meta.is_tree ? "not_implemented" : "not_tree" };
      case "map": {
        const geo = (has("latitude") && has("longitude")) || fields.some((f) => f.fieldname === "location" && f.fieldtype === "Geolocation");
        return { view, available: false, reason: geo ? "not_implemented" : "no_geolocation" };
      }
      case "inbox": return { view, available: false, reason: meta.name === "Communication" ? "not_implemented" : "not_communication" };
      case "gantt": return { view, available: false, reason: "not_implemented" };
      case "dashboard": return { view, available: false, reason: "not_implemented" };
    }
  };
  return LIST_VIEW_TYPES.map(one);
}
