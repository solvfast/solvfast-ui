/**
 * ViewSwitcher — Desk's view menu (list_view_select.js `add_view_to_menu`) as a compact dropdown. Presentational: the
 * host says which views exist (`views`, e.g. Frappe's `availableViews(meta)`), which one is shown (`value`) and what to
 * do on a choice (`onChange`). Only `available` views can be chosen; unavailable ones are hidden, or listed disabled
 * with their reason when `showUnavailable` is set. A view the package does not implement is never offered as available
 * (`switcherOptions`), whatever the host passes.
 */
import * as React from "react";
import { CalendarDays, Check, ChevronDown, GanttChart, Image, Inbox, LayoutDashboard, List, Map as MapIcon, Network, SquareKanban, Table2 } from "lucide-react";
import { Button } from "../../primitives/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../primitives/dropdown-menu";
import { cn } from "../../lib/cn";
import { loc } from "../../lib/localized";
import { useLocale } from "../../theme/ThemeProvider";
import type { Messages } from "../../theme/messages";
import { switcherOptions, type ListViewType, type ViewOption, type ViewUnavailableReason } from "./types";

export const VIEW_ICONS: Record<ListViewType, React.ComponentType<{ className?: string }>> = {
  list: List, report: Table2, image: Image, kanban: SquareKanban, calendar: CalendarDays, gantt: GanttChart,
  dashboard: LayoutDashboard, map: MapIcon, tree: Network, inbox: Inbox,
};
const VIEW_LABEL: Record<ListViewType, keyof Messages> = {
  list: "viewList", report: "viewReport", image: "viewImage", kanban: "viewKanban", calendar: "viewCalendar", gantt: "viewGantt",
  dashboard: "viewDashboard", map: "viewMap", tree: "viewTree", inbox: "viewInbox",
};
const REASON: Record<ViewUnavailableReason, keyof Messages> = {
  not_implemented: "viewReasonNotImplemented", no_image_field: "viewReasonNoImageField", no_kanban_source: "viewReasonNoKanbanSource",
  no_date_field: "viewReasonNoDateField", not_tree: "viewReasonNotTree", no_geolocation: "viewReasonNoGeolocation",
  not_communication: "viewReasonNotCommunication", needs_server_config: "viewReasonNeedsServerConfig",
};

/** The label of a view in the UI language. */
export function useViewLabel() {
  const { t, language } = useLocale();
  return React.useCallback((o: Pick<ViewOption, "view" | "label">) => (o.label ? loc(o.label, language) : t(VIEW_LABEL[o.view])), [t, language]);
}
/** The text of an unavailability reason (a free string is shown as given). */
export function useViewReason() {
  const { t } = useLocale();
  return React.useCallback((r?: string) => (!r ? "" : r in REASON ? t(REASON[r as ViewUnavailableReason]) : r), [t]);
}

export interface ViewSwitcherProps {
  views: readonly ViewOption[];
  value: ListViewType;
  onChange: (view: ListViewType) => void;
  /** List unavailable views too, disabled, each with its reason. Default false (hidden). */
  showUnavailable?: boolean;
  className?: string;
}

export function ViewSwitcher({ views, value, onChange, showUnavailable = false, className }: ViewSwitcherProps) {
  const { t } = useLocale();
  const label = useViewLabel();
  const reason = useViewReason();
  const options = switcherOptions(views, showUnavailable);
  const current = views.find((v) => v.view === value) ?? { view: value };
  const Icon = VIEW_ICONS[value];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-1.5", className)} aria-label={`${t("viewSwitcher")}: ${label(current)}`} data-testid="sf-view-switcher">
          <Icon className="h-4 w-4" />
          <span>{t("viewCurrent").replace("{view}", label(current))}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[12rem]">
        {options.map((o) => {
          const I = VIEW_ICONS[o.view];
          const why = !o.available ? reason(o.reason ?? "not_implemented") : "";
          return (
            <DropdownMenuItem key={o.view} disabled={!o.available} data-view={o.view} aria-current={o.view === value ? "true" : undefined}
              onSelect={() => { if (o.available && o.view !== value) onChange(o.view); }}>
              <I className="h-4 w-4" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span>{label(o)}</span>
                {why && <span className="text-xs text-muted-foreground" data-testid="sf-view-reason">{why}</span>}
              </span>
              {o.view === value && <Check className="ms-auto h-4 w-4" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
