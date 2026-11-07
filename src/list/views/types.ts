/**
 * The views a list can be shown in — Desk's `frappe.views.view_modes` (list_view_select.js) — and what a view switcher
 * is told about each one. Pure TS.
 *
 * A view is offered only when it is BOTH implemented by this package and possible for the data (`available`). Views the
 * package does not implement (Gantt, Dashboard, Map, Tree, Inbox) are never `available`; a switcher hides them unless it
 * is asked to show unavailable views, and then shows them disabled with their reason.
 */
import type { Localized } from "../../lib/localized";

export type ListViewType = "list" | "report" | "image" | "kanban" | "calendar" | "gantt" | "dashboard" | "map" | "tree" | "inbox";

/** Desk's order (`frappe.views.view_modes`, frappe/public/js/frappe/list/list_view.js). */
export const LIST_VIEW_TYPES: readonly ListViewType[] = ["list", "report", "dashboard", "gantt", "kanban", "calendar", "image", "inbox", "tree", "map"];

/** Views this package implements (Core component + Frappe adapter). */
export const IMPLEMENTED_VIEWS: readonly ListViewType[] = ["list", "report", "image", "kanban", "calendar"];

/** Why a view is not offered. Strings other than these are shown as given. */
export type ViewUnavailableReason =
  | "not_implemented" | "no_image_field" | "no_kanban_source" | "no_date_field" | "not_tree" | "no_geolocation"
  | "not_communication" | "needs_server_config";

export interface ViewOption {
  view: ListViewType;
  /** Implemented AND possible for this data. Only available views can be chosen. */
  available: boolean;
  /** Why it is not available (shown when the switcher lists unavailable views). */
  reason?: ViewUnavailableReason | string;
  /** Overrides the default label ("List", "Report", …). */
  label?: Localized;
}

/** A view is implemented by this package. */
export const isImplementedView = (v: ListViewType) => IMPLEMENTED_VIEWS.includes(v);

/** Keep only the views a switcher may offer: `available` ones (+ the unavailable ones, disabled, with `showUnavailable`). */
export function switcherOptions(views: readonly ViewOption[], showUnavailable = false): ViewOption[] {
  // never trust `available: true` for a view this package does not implement
  const safe = views.map((v) => (v.available && !isImplementedView(v.view) ? { ...v, available: false, reason: v.reason ?? "not_implemented" } : v));
  return showUnavailable ? safe : safe.filter((v) => v.available);
}
