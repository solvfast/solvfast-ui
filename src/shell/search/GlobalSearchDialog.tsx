/**
 * GlobalSearchDialog — Desk's Global Search dialog (`frappe.search.SearchDialog`, frappe/public/js/frappe/ui/toolbar/
 * search.js, v15.110) as a Core component (P36b). Generic: the results come from a `GlobalSearchSource`.
 *
 * Reproduced: input with a 300 ms debounce, searching from 2 characters (SD:115-133); "Search for anything" when idle
 * (SD:49); "Searching ..." while loading (SD:210); "No Results found" (SD:50); a sidebar of groups with "All Results"
 * first when there is more than one group, the first link selected (SD:238-263; hidden below `md`, as `.hidden-xs`
 * hides it, search.html:3); "All Results" = the first 4 rows of each group + "More" opening that group (SD:294-315,
 * 146-154); a group's full list = the first 20 + "More" (SD:266-292), which for a remote group fetches the next 20 from
 * `start` = rows shown and, when fewer than 20 come back, hides "More" and shows "N results found" (SD:164-186,
 * 381-400); a result = optional avatar, the label as a link, the description (SD:327-360); choosing a result closes the
 * dialog (Desk: the router hides open dialogs, router.js:303-306).
 *
 * Additions (no Desk equivalent, documented in docs/components/search.md): an error state with Retry (Desk leaves
 * "Searching ..." up, SU:472-489); ↑/↓/Enter over the visible results (Desk has no keyboard handling, SD); a nav group's
 * "More" shows the NEXT rows (Desk re-shows the first 20, SD:181-185 — not reproduced); a stale response (an older
 * query answering last) is dropped.
 */
import * as React from "react";
import { AlertCircle, Search } from "lucide-react";
import { cn } from "../../lib/cn";
import { useLocale } from "../../theme/ThemeProvider";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../primitives/dialog";
import { Button } from "../../primitives/button";
import { Skeleton } from "../../primitives/skeleton";
import { ItemAvatar, ItemDescription, Marked, wantsNewTab } from "./parts";
import type { GlobalSearchSource, SearchItem, SearchResultGroup, SelectOptions } from "./types";

export interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: GlobalSearchSource;
  /** A result was chosen (the dialog closes itself). */
  onSelect: (item: SearchItem, opts: SelectOptions) => void;
  /** The text the dialog opens with; searched at once (`init_search`, SD:197-205). */
  initialQuery?: string;
  /** Default 300 (SD:115-133). */
  debounceMs?: number;
  /** Default 2 (`length > 1`, SD:124). */
  minChars?: number;
  /** Rows per group under "All Results". Default 4 (SD:295). */
  sectionSize?: number;
  /** Rows of a full list and of each "More". Default 20 (SD:38, 266). */
  pageSize?: number;
}

const ALL = "__all__";
type Status = "idle" | "loading" | "ready" | "error";

export function GlobalSearchDialog({
  open, onOpenChange, source, onSelect, initialQuery = "", debounceMs = 300, minChars = 2, sectionSize = 4, pageSize = 20,
}: GlobalSearchDialogProps) {
  const { t } = useLocale();
  const [query, setQuery] = React.useState(initialQuery);
  const [status, setStatus] = React.useState<Status>("idle");
  const [groups, setGroups] = React.useState<SearchResultGroup[]>([]);
  const [active, setActive] = React.useState<string>(ALL);
  /** Rows shown per group in its full list. */
  const [shown, setShown] = React.useState<Record<string, number>>({});
  /** Remote groups whose "More" came back short: the "N results found" cue. */
  const [done, setDone] = React.useState<Record<string, boolean>>({});
  const [moreBusy, setMoreBusy] = React.useState<string | null>(null);
  const [cursor, setCursor] = React.useState(-1);
  const searched = React.useRef("");
  const seq = React.useRef(0);
  const ctrl = React.useRef<AbortController | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = React.useId();

  const run = React.useCallback((text: string) => {
    if (!source.search) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    const mine = ++seq.current;
    searched.current = text;
    setStatus("loading");
    source.search(text, { signal: c.signal }).then(
      (res) => {
        if (mine !== seq.current) return; // a newer query was sent
        const nonEmpty = res.filter((g) => g.items.length); // parse_results drops empty sets (SD:224-233)
        setGroups(nonEmpty);
        setShown(Object.fromEntries(nonEmpty.map((g) => [g.id, Math.min(pageSize, g.items.length)])));
        setDone({});
        setActive(nonEmpty.length > 1 ? ALL : nonEmpty[0]?.id ?? ALL); // the first sidebar link is clicked (SD:263)
        setCursor(-1);
        setStatus("ready");
      },
      (err) => {
        if (mine !== seq.current || c.signal.aborted) return;
        if (typeof console !== "undefined") console.error(err);
        setStatus("error");
      },
    );
  }, [source, pageSize]);

  const reset = React.useCallback(() => {
    ctrl.current?.abort();
    seq.current++;
    searched.current = "";
    setGroups([]);
    setStatus("idle");
    setCursor(-1);
  }, []);

  // Opening = init_search(keywords): fill the input and search at once (SD:197-205).
  React.useEffect(() => {
    if (!open) { if (timer.current) clearTimeout(timer.current); ctrl.current?.abort(); return; }
    setQuery(initialQuery);
    if (initialQuery.trim().length >= minChars) run(initialQuery.trim());
    else reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuery]);

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); ctrl.current?.abort(); }, []);

  const onType = (value: string) => {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const text = value.trim();
      if (text === searched.current) return; // unchanged value ignored (SD:118-120)
      if (text.length >= minChars) run(text);
      else reset();
    }, debounceMs);
  };

  const choose = (item: SearchItem, opts: SelectOptions) => {
    onSelect(item, opts);
    onOpenChange(false);
  };

  const loadMore = async (g: SearchResultGroup) => {
    const count = shown[g.id] ?? 0;
    if (g.kind !== "remote" || !source.more) {
      setShown((s) => ({ ...s, [g.id]: Math.min(g.items.length, count + pageSize) }));
      return;
    }
    setMoreBusy(g.id);
    try {
      const rows = await source.more(searched.current, g, count, pageSize);
      const seen = new Set(g.items.slice(0, count).map((i) => i.id));
      const merged = [...g.items.slice(0, count), ...rows.filter((r) => !seen.has(r.id))];
      setGroups((gs) => gs.map((x) => (x.id === g.id ? { ...x, items: merged } : x)));
      setShown((s) => ({ ...s, [g.id]: merged.length }));
      if (rows.length < pageSize) setDone((d) => ({ ...d, [g.id]: true }));
    } catch (err) {
      if (typeof console !== "undefined") console.error(err); // Desk: console.error only (SD:177-179)
    } finally {
      setMoreBusy(null);
    }
  };

  // The rows visible in the current view (for ↑/↓/Enter).
  const recents = React.useMemo(() => (open && status === "idle" ? (source.recent?.("") ?? []).slice(0, 10) : []), [open, status, source]);
  const visible: SearchItem[] = React.useMemo(() => {
    if (status === "idle") return recents;
    if (status !== "ready") return [];
    if (active === ALL) return groups.flatMap((g) => g.items.slice(0, sectionSize));
    const g = groups.find((x) => x.id === active);
    return g ? g.items.slice(0, shown[g.id] ?? pageSize) : [];
  }, [status, recents, active, groups, shown, sectionSize, pageSize]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!visible.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => (c < visible.length - 1 ? c + 1 : 0)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => (c > 0 ? c - 1 : visible.length - 1)); }
    else if (e.key === "Enter" && cursor >= 0 && visible[cursor]) { e.preventDefault(); choose(visible[cursor], { newTab: wantsNewTab(e) }); }
  };

  React.useEffect(() => {
    if (cursor < 0) return;
    document.getElementById(`${listId}-row-${cursor}`)?.scrollIntoView?.({ block: "nearest" });
  }, [cursor, listId]);

  let flatIndex = 0;
  const row = (item: SearchItem) => {
    const i = flatIndex++;
    const selected = i === cursor;
    return (
      <div
        key={item.id}
        id={`${listId}-row-${i}`}
        role="option"
        aria-selected={selected}
        data-selected={selected || undefined}
        className={cn("flex items-center gap-3 rounded-lg px-2 py-2", selected && "bg-accent text-accent-foreground")}
        onMouseEnter={() => setCursor(i)}
      >
        <ItemAvatar item={item} />
        <span className="min-w-0 flex-1">
          <a
            href={item.href ?? "#"}
            className="font-semibold text-foreground hover:underline"
            onClick={(e) => { e.preventDefault(); choose(item, { newTab: wantsNewTab(e) }); }}
          >
            <Marked text={item.label} marks={item.labelMarks} />
          </a>
          <ItemDescription item={item} />
        </span>
      </div>
    );
  };

  const moreLink = (onClick: () => void, busy = false) => (
    <button type="button" className="mt-1 text-sm font-medium text-primary hover:underline disabled:opacity-50" onClick={onClick} disabled={busy}>
      {t("globalSearchMore")}
    </button>
  );

  let body: React.ReactNode;
  if (status === "idle") {
    body = (
      <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground" data-testid="search-idle">
        <Search className="h-8 w-8 opacity-40" aria-hidden />
        <p>{t("globalSearchAnything")}</p>
        {recents.length > 0 && (
          <div className="w-full text-start" role="listbox" id={listId} aria-label={t("globalSearchResults")}>
            {recents.map(row)}
          </div>
        )}
      </div>
    );
  } else if (status === "loading") {
    body = (
      <div className="space-y-3 py-4" aria-busy="true" data-testid="search-loading">
        <p className="text-sm text-muted-foreground">{t("globalSearchSearching")}</p>
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  } else if (status === "error") {
    body = (
      <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center text-sm" data-testid="search-error">
        <AlertCircle className="h-6 w-6 text-destructive" aria-hidden />
        <p>{t("globalSearchError")}</p>
        <Button size="sm" variant="outline" onClick={() => run(searched.current)}>{t("globalSearchRetry")}</Button>
      </div>
    );
  } else if (!groups.length) {
    body = (
      <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground" data-testid="search-empty">
        <Search className="h-8 w-8 opacity-40" aria-hidden />
        <p>{t("globalSearchNoResults")}</p>
      </div>
    );
  } else {
    const current = groups.find((g) => g.id === active);
    body = (
      <div className="flex min-h-[200px] gap-4">
        {groups.length > 1 && (
          <nav aria-label={t("globalSearchGroups")} className="hidden w-48 shrink-0 md:block">
            <ul className="sticky top-0 max-h-[min(80vh,650px)] space-y-0.5 overflow-y-auto">
              {[{ id: ALL, title: t("globalSearchAllResults") }, ...groups].map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    aria-current={active === g.id || undefined}
                    className={cn("w-full truncate rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted", active === g.id && "bg-muted font-medium")}
                    onClick={() => { setActive(g.id); setCursor(-1); }}
                  >
                    {g.title}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div role="listbox" id={listId} aria-label={t("globalSearchResults")} className="min-w-0 flex-1 space-y-4">
          {active === ALL || !current
            ? groups.map((g) => (
              <section key={g.id} data-group={g.id}>
                <h3 className="mb-1 text-base font-semibold">{g.title}</h3>
                {g.items.slice(0, sectionSize).map(row)}
                {g.items.length > sectionSize && moreLink(() => { setActive(g.id); setCursor(-1); })}
              </section>
            ))
            : (
              <section data-group={current.id}>
                <h3 className="mb-1 text-base font-semibold">{current.title}</h3>
                {current.items.slice(0, shown[current.id] ?? pageSize).map(row)}
                {!done[current.id] && (current.kind === "remote" ? current.items.length > pageSize && (shown[current.id] ?? 0) >= pageSize : current.items.length > (shown[current.id] ?? 0))
                  && moreLink(() => void loadMore(current), moreBusy === current.id)}
                {done[current.id] && (
                  <p className="mt-1 text-sm text-primary">{t("globalSearchResultsFound").replace("{n}", String(shown[current.id] ?? 0))}</p>
                )}
              </section>
            )}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[100dvh] max-h-[100dvh] max-w-none flex-col gap-0 p-0 sm:h-auto sm:max-h-[85vh] sm:max-w-3xl"
        onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); inputRef.current?.select(); }}
        data-testid="global-search-dialog"
      >
        <DialogTitle className="sr-only">{t("globalSearchOpen")}</DialogTitle>
        <DialogDescription className="sr-only">{t("globalSearchAnything")}</DialogDescription>
        <div className="flex items-center gap-2 border-b px-4 py-3 pe-12">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={status === "ready" && groups.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={cursor >= 0 ? `${listId}-row-${cursor}` : undefined}
            aria-label={t("globalSearchOpen")}
            placeholder={t("globalSearchOpen")}
            value={query}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={onKeyDown}
            className="h-9 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{body}</div>
      </DialogContent>
    </Dialog>
  );
}
