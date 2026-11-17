// The record page's side rail, shared by SayrRecordPage and SayrNewRecordPage: the card shell, "Customize sections" and
// the hidden cards kept per DocType in this browser.
import * as React from "react";
import { Settings2 } from "lucide-react";
import { Button } from "../primitives/button";
import { Card } from "../primitives/card";
import { Checkbox } from "../primitives/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";
import { fmt } from "../record/format";
import { useLocale } from "../theme/ThemeProvider";

/** The Sayr record page's own rail cards (ids). */
export type SayrRailCardId = "assignment" | "sla" | "playbook" | "tasks" | "notes" | "attachments";
/** @deprecated 0.8.0-dev.1 — use `SayrRailCardId`. The core `RecordRailCard` (from `@solvfast/ui`) is the CRM rail's card
 *  component; this Sayr-only type of card ids kept the same name until 0.8.0-dev.1. Kept as an alias for existing code. */
export type RecordRailCard = SayrRailCardId;
/** The rail's order (Lifecycle is always first and cannot be hidden). */
export const RECORD_RAIL_CARDS: readonly SayrRailCardId[] = ["assignment", "sla", "playbook", "tasks", "notes", "attachments"];

/** A card the app adds to the rail (e.g. the record's CRM contact): placed after Playbook, hidden and shown like the others.
 *  An `id` of a built-in card ("notes", "attachments", …) replaces that card in its place: the app's own notes, say. */
export interface RecordRailExtraCard {
  id: string;
  /** Its name in Customize sections, and its title unless `title` is given. */
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** The card's title (e.g. with a count). Default: `label`. */
  title?: React.ReactNode;
  /** Beside the title (e.g. an Add button). */
  action?: React.ReactNode;
  /** The card's body for the record as loaded (undefined until it is). */
  render: (doc: Record<string, unknown> | undefined) => React.ReactNode;
}

const isBuiltIn = (id: string) => (RECORD_RAIL_CARDS as readonly string[]).includes(id);

/** The rail's cards in order, the app's own after Playbook (as the reference: Playbook, Contacts, Organization, Tasks);
 *  an app card replacing a built-in one keeps that one's place. */
export function railOrder(extra: readonly RecordRailExtraCard[] = []): string[] {
  const at = RECORD_RAIL_CARDS.indexOf("playbook") + 1;
  const added = extra.filter((c) => !isBuiltIn(c.id)).map((c) => c.id);
  return [...RECORD_RAIL_CARDS.slice(0, at), ...added, ...RECORD_RAIL_CARDS.slice(at)];
}

export type T = ReturnType<typeof useLocale>["t"];

export const railStorageKeyOf = (doctype: string) => `sf-record-rail:${doctype}`;

function readHidden(key: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeHidden(key: string, hidden: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify([...hidden]));
  } catch {
    // Storage blocked (private window): the choice lasts for this visit only.
  }
}

export function useHiddenCards(storageKey: string) {
  const [hidden, setHidden] = React.useState<Set<string>>(() => readHidden(storageKey));
  React.useEffect(() => setHidden(readHidden(storageKey)), [storageKey]);
  const toggle = React.useCallback((card: string) => setHidden((prev) => {
    const next = new Set(prev);
    if (next.has(card)) next.delete(card); else next.add(card);
    writeHidden(storageKey, next);
    return next;
  }), [storageKey]);
  return { hidden, toggle };
}

export function railLabel(card: SayrRailCardId, t: T): string {
  return { assignment: t("rpAssignment"), sla: t("rpSla"), playbook: t("rpPlaybook"), tasks: t("rpTasks"), notes: t("rpNotes"), attachments: t("rpAttachments") }[card];
}

export function CustomizeSections({ hidden, onToggle, extra = [] }: {
  hidden: Set<string>; onToggle: (card: string) => void; extra?: readonly RecordRailExtraCard[];
}) {
  const { t } = useLocale();
  const label = (card: string) => extra.find((c) => c.id === card)?.label ?? railLabel(card as SayrRailCardId, t);
  return (
    <div className="flex justify-end">
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs"><Settings2 className="h-3.5 w-3.5" aria-hidden />{t("rpCustomize")}</Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-2">
          <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t("rpVisibleSections")}</p>
          <div role="group" aria-label={t("rpVisibleSections")} className="space-y-0.5">
            {railOrder(extra).map((card) => (
              <label key={card} className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <Checkbox checked={!hidden.has(card)} onCheckedChange={() => onToggle(card)} data-rail-toggle={card} />
                <span className="flex-1 truncate">{label(card)}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function RailCard({ id, icon: Icon, title, action, children }: {
  id: string; icon: React.ComponentType<{ className?: string }>; title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Card className="space-y-3 p-4" data-rail-card={id}>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate">{title}</span>
        </h3>
        {action}
      </div>
      {children}
    </Card>
  );
}

export const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-xs text-muted-foreground">{children}</p>;

export const dateTime = (at: number, language: string) =>
  new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(at));

export const duration = (seconds: number, t: T) =>
  seconds >= 3600 && seconds % 3600 === 0 ? fmt(t("rpHours"), seconds / 3600) : fmt(t("rpMinutes"), Math.round(seconds / 60));

export const PHASE_VARIANT = { open: "info", on_hold: "warning", closed: "success" } as const;
