/**
 * Global search — the data a source hands the Core UI (P36b). Framework-free: no Frappe, no router. An adapter (the
 * Frappe one in `@solvfast/ui/frappe`, or an app's own over its stores) builds these.
 */

/** One field of a result's description: "Label: value", each with the indices to mark (Desk's SU:414-421). */
export interface SearchItemDetail {
  label?: string;
  labelMarks?: number[];
  value: string;
  valueMarks?: number[];
}

export interface SearchItem {
  /** Unique within one list (a group or the awesome bar list). */
  id: string;
  /** Plain text (no HTML). */
  label: string;
  /** Indices of `label` to mark (fuzzy-match runs). */
  labelMarks?: number[];
  /** A plain second line. */
  description?: string;
  /** Structured second line (global-search snippets); wins over `description`. "…" entries are allowed. */
  details?: SearchItemDetail[];
  /** Ordering weight: the awesome bar sorts by it, descending (Awesomplete `sort`, AB:55-57). */
  index?: number;
  /** A short type tag ("List", "New", "Report", "Recent", "Doc"…) for the adapter / tests; not rendered (Desk's labels
   *  already say it: "Customer List", "New Customer"). */
  type?: string;
  /** The href of the row (an <a>, so Ctrl/⌘-click and middle-click open it in a new tab). */
  href?: string;
  /** Avatar image; `null` = an initials avatar (Desk shows one when the DocType has an image field, SD:333-341). */
  image?: string | null;
  /** Anything the adapter needs back in `onSelect` (a Desk route array, a record id…). */
  data?: unknown;
}

export interface SearchResultGroup {
  /** Unique id (Desk: the group title / DocType). */
  id: string;
  /** Heading (already translated). */
  title: string;
  items: SearchItem[];
  /** "nav": client-side lists (Recents, Lists, Reports…), paged locally. "remote": server rows, paged by `source.more`. */
  kind?: "nav" | "remote";
}

export interface SelectOptions {
  /** Ctrl / ⌘ held, or a middle click (AB:118-123: `frappe.open_in_new_tab`). */
  newTab: boolean;
}

/** What the search UI reads. Only `suggest` is required. */
export interface GlobalSearchSource {
  /** Awesome bar rows for a query of at least `minChars` characters (sync or async). The UI sorts by `index` desc. */
  suggest(query: string): SearchItem[] | Promise<SearchItem[]>;
  /** Rows for an empty / 1-character query (Desk: recent pages + frequently visited links, AB:82-87). */
  recent?(query: string): SearchItem[];
  /**
   * The full search (Desk's Global Search dialog, SD:46-86): groups in display order — client-side nav groups first,
   * then the server's groups. Without it the bar has no "Search for …" row and no dialog.
   */
  search?(query: string, opts: { signal: AbortSignal }): Promise<SearchResultGroup[]>;
  /** "More" in a remote group's full list: the rows after `start` (Desk SD:164-186: start = rows shown, limit 20). */
  more?(query: string, group: SearchResultGroup, start: number, limit: number): Promise<SearchItem[]>;
}
