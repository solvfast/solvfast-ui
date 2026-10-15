/**
 * Pager — Sear's DataGrid pager markup (total + prev · page · next), styled as the DS Pagination pill by the rules in
 * styles/src/sf-overrides.css (Sear's sear-studio.css:382-420). Must stay the LAST child of the `.sf-datagrid` root.
 * Bulk actions — PMO's floating bar (solvfast_pmo components/tasks/BulkActionBar.tsx) with app-supplied actions.
 */
import * as React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "../../primitives/button";
import { Card } from "../../primitives/card";
import { loc, type Localized } from "../../lib/localized";
import { useLocale } from "../../theme/ThemeProvider";

export function ListPagination({ total, page, hasPrev, hasNext, onPage }: { total: number; page: number; hasPrev: boolean; hasNext: boolean; onPage: (p: number) => void }) {
  const { t, direction } = useLocale();
  const Prev = direction === "rtl" ? ChevronRight : ChevronLeft;
  const Next = direction === "rtl" ? ChevronLeft : ChevronRight;
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>{t("total")}: {total}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={!hasPrev} onClick={() => onPage(page - 1)} aria-label={t("prevPage")}><Prev className="h-4 w-4" /></Button>
        <span className="px-2" aria-current="page">{page + 1}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={!hasNext} onClick={() => onPage(page + 1)} aria-label={t("nextPage")}><Next className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

export interface BulkAction<T> {
  key: string;
  label: Localized;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: "default" | "outline" | "destructive" | "secondary";
  run: (keys: string[], rows: T[]) => void | Promise<void>;
}

export function BulkActionBar<T>({ count, actions, render, onClear, keys, rows }: {
  count: number; actions?: BulkAction<T>[]; render?: (ctx: { keys: string[]; rows: T[]; clear: () => void }) => React.ReactNode;
  onClear: () => void; keys: string[]; rows: T[];
}) {
  const { language, t } = useLocale();
  const [busy, setBusy] = React.useState<string | null>(null);
  if (!count) return null;
  return (
    <Card className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 p-3" role="region" aria-label={t("selectedCount").replace("{n}", String(count))}>
      <span className="text-sm font-medium" aria-live="polite">{t("selectedCount").replace("{n}", String(count))}</span>
      <div className="h-5 w-px bg-border" />
      {render?.({ keys, rows, clear: onClear })}
      {actions?.map((a) => {
        const Icon = a.icon;
        return (
          <Button key={a.key} size="sm" variant={a.variant ?? "outline"} className="gap-1.5" loading={busy === a.key} disabled={!!busy}
            onClick={async () => { setBusy(a.key); try { await a.run(keys, rows); } finally { setBusy(null); } }}>
            {Icon && <Icon className="h-4 w-4" />} {loc(a.label, language)}
          </Button>
        );
      })}
      <Button variant="ghost" size="sm" className="ms-auto gap-1.5" onClick={onClear}>
        <X className="h-4 w-4" /> {t("clearSelection")}
      </Button>
    </Card>
  );
}
