/**
 * FrappeGlobalSearch — the Frappe adapter of the Core `GlobalSearchBar` (P36b): Desk's awesome bar rows from the boot
 * lists (./awesomebar.ts) and the Global Search dialog over `frappe.utils.global_search.search` (./globalSearch.ts).
 * Navigation is injected (`onNavigate`) — no router dependency.
 *
 * Requests (SU:472-489, SD:52-65, 164-186): on opening / typing in the dialog
 *   `{ text, start: 0, limit: 100, doctype: "" }`; on "More" in a DocType's list `{ text, start: <rows shown>, limit: 20,
 *   doctype: <DocType> }`. Permissions are the SERVER's: it returns rows only from DocTypes in Global Search Settings
 *   that the user can read (GS:482) — nothing is filtered here. The awesome bar rows are permission-filtered by the boot
 *   lists the app passes (`can_read`, `can_create`, …), as in Desk.
 */
import * as React from "react";
import { GlobalSearchBar, type GlobalSearchBarProps } from "../../shell/search/GlobalSearchBar";
import type { GlobalSearchSource, SearchItem, SearchResultGroup } from "../../shell/search/types";
import type { FrappeTransport } from "../client";
import { useFrappeClient, useFrappeSettings } from "../FrappeProvider";
import { awesomeBarItems, awesomeBarRecent, deskSearchBootFrom, navGroups, type AwesomeBarContext, type DeskRoute, type DeskSearchBoot, type DeskSearchTarget } from "./awesomebar";
import { fetchGlobalSearch, groupGlobalRows, type GlobalResultOptions } from "./globalSearch";

/** This tab's route history (Desk: `frappe.route_history`, in memory, router.js:11, 303-305). */
const HISTORY: DeskRoute[] = [];
const MAX_HISTORY = 100;
/** Record a visited Desk route (call it from the app's router so "Recents" also lists pages not opened by search). */
export function recordDeskRoute(route: DeskRoute): void {
  if (!route.length) return;
  HISTORY.push([...route]);
  if (HISTORY.length > MAX_HISTORY) HISTORY.splice(0, HISTORY.length - MAX_HISTORY);
}
/** The recorded routes, oldest first. */
export const deskRouteHistory = (): readonly DeskRoute[] => HISTORY;
/** Tests. */
export function clearDeskRouteHistory(): void { HISTORY.length = 0; }

export interface FrappeSearchSourceOptions {
  /** `frappe.utils.global_search.search` caller (default: the FrappeProvider client's `call`). */
  call: FrappeTransport;
  /** The boot lists (Desk `frappe.boot`). Default: `window.frappe.boot` when the page has one, else none. */
  boot?: DeskSearchBoot;
  /** Desk's `__` (default: the provider's translation dictionary). */
  translate?: (text: string) => string;
  /** The route history to use for "Recents" (default: the routes recorded by `recordDeskRoute`). */
  history?: () => readonly DeskRoute[];
  routeTitles?: Record<string, string>;
  currentList?: AwesomeBarContext["currentList"];
  /** The URL of a Desk route in this app (default: Desk's `/app/…`). Return undefined to keep Desk's. */
  resolveUrl?: (route: DeskRoute) => string | undefined;
  /** First fetch limit. Default 100 (SD:54). */
  limit?: number;
}

const windowBoot = (): DeskSearchBoot => deskSearchBootFrom((globalThis as { frappe?: { boot?: unknown } }).frappe?.boot);

/** The source the Core bar reads, built from the options (framework-free apart from the call). */
export function createFrappeSearchSource(o: FrappeSearchSourceOptions): GlobalSearchSource {
  const ctx = (): AwesomeBarContext => ({
    boot: o.boot ?? windowBoot(), translate: o.translate, history: [...(o.history?.() ?? HISTORY)], routeTitles: o.routeTitles, currentList: o.currentList,
  });
  const fix = (items: SearchItem[]): SearchItem[] => (o.resolveUrl
    ? items.map((it) => {
      const t = it.data as DeskSearchTarget;
      const url = o.resolveUrl!(t.route);
      return url ? { ...it, href: url, data: { ...t, url } } : it;
    })
    : items);
  const result: GlobalResultOptions = { translate: o.translate, resolveUrl: o.resolveUrl };
  return {
    suggest: (q) => fix(awesomeBarItems(q, ctx())),
    recent: (q) => fix(awesomeBarRecent(q, ctx())),
    async search(q, { signal }) {
      const nav: SearchResultGroup[] = navGroups(q, ctx()).map((g) => ({ ...g, items: fix(g.items) }));
      const rows = await fetchGlobalSearch(o.call, { text: q, start: 0, limit: o.limit ?? 100, doctype: "" });
      if (signal.aborted) return [];
      return [...nav, ...groupGlobalRows(rows, q, result)];
    },
    async more(q, group, start, limit) {
      const rows = await fetchGlobalSearch(o.call, { text: q, start, limit, doctype: group.id });
      return groupGlobalRows(rows, q, result).flatMap((g) => g.items);
    },
  };
}

export interface FrappeGlobalSearchProps extends Omit<FrappeSearchSourceOptions, "call">, Pick<GlobalSearchBarProps, "placeholder" | "className" | "inputClassName" | "shortcut"> {
  /**
   * Open a result. `url` is the target's URL (`resolveUrl` applied); `newTab` = Ctrl/⌘-click (AB:118-123). The route
   * is recorded in the tab's history before this is called.
   */
  onNavigate: (url: string, info: DeskSearchTarget & { newTab: boolean }) => void;
  /** Default: the FrappeProvider client's `call`. */
  call?: FrappeTransport;
}

/** The header search on Frappe data: `<FrappeGlobalSearch onNavigate={(url) => navigate(url)} boot={…} />`. */
export function FrappeGlobalSearch({ onNavigate, call, boot, translate, history, routeTitles, currentList, resolveUrl, limit, ...bar }: FrappeGlobalSearchProps) {
  const client = useFrappeClient();
  const { translations } = useFrappeSettings();
  const __ = React.useMemo(() => translate ?? (translations ? (s: string) => translations[s] || s : undefined), [translate, translations]);
  const source = React.useMemo(
    () => createFrappeSearchSource({ call: call ?? client.call, boot, translate: __, history, routeTitles, currentList, resolveUrl, limit }),
    [call, client, boot, __, history, routeTitles, currentList, resolveUrl, limit],
  );
  const onSelect = React.useCallback((it: SearchItem, opts: { newTab: boolean }) => {
    const t = it.data as DeskSearchTarget | undefined;
    if (!t) return;
    if (!history) recordDeskRoute(t.route);
    onNavigate(t.url, { ...t, newTab: opts.newTab });
  }, [history, onNavigate]);
  return <GlobalSearchBar source={source} onSelect={onSelect} {...bar} />;
}
