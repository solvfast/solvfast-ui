/**
 * Sear's Field Library list (sear_studio/pages/FieldLibrary/FieldLibraryListPage.tsx) rebuilt on @solvfast/ui's ListView
 * with the same data, columns, cells, delete action and "Create Field Preset" button. `variant="features"` turns on the
 * PMO features Sear doesn't have (selection + bulk actions, group-by, sort menu, quick-filter picker, confirm on delete);
 * `variant="error" | "loading"` show those states. Playground only.
 */
import * as React from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { Button, ListView, useLocale, type ColumnDef } from "@ui";
import { FIELD_PRESETS } from "../demo/field-library";

export function FieldLibraryDemo({ variant = "sear" }: { variant?: string }) {
  const { isRTL } = useLocale();
  const [presets, setPresets] = React.useState(FIELD_PRESETS);
  const now = React.useMemo(() => Date.now(), []);
  const fmtDate = (d: Date) => new Intl.DateTimeFormat(isRTL ? "ar-EG" : "en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
  const rows = React.useMemo(() => presets.map((p) => ({
    name: p.id,
    preset_name: isRTL ? (p.nameAr || p.name) : p.name,
    description: p.description,
    fields_count: p.fieldsCount,
    created_by: p.createdBy,
    modified_at: new Date(now - p.modifiedDaysAgo * 86_400_000).toISOString().slice(0, 10),
    _modifiedAt: new Date(now - p.modifiedDaysAgo * 86_400_000),
  })), [presets, isRTL, now]);
  type Row = (typeof rows)[number];

  const columns: ColumnDef<Row>[] = [
    {
      key: "preset_name", label: { en: "Name", ar: "الاسم" }, type: "text",
      render: (r) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{r.preset_name}</p>
            {r.description && <p className="text-[11px] text-muted-foreground truncate">{r.description}</p>}
          </div>
        </div>
      ),
    },
    { key: "fields_count", label: { en: "Fields", ar: "الحقول" }, type: "number", fieldtype: "Int", render: (r) => <span className="text-xs text-muted-foreground tabular-nums">{r.fields_count}</span> },
    { key: "created_by", label: { en: "Created By", ar: "أنشئت بواسطة" }, type: "text", hidden: true, render: (r) => <span className="text-xs text-foreground/80 truncate">{r.created_by ?? "—"}</span> },
    { key: "modified_at", label: { en: "Last Modified", ar: "آخر تعديل" }, type: "date", render: (r) => <span className="text-xs text-muted-foreground">{fmtDate(r._modifiedAt)}</span> },
  ];
  const remove = (r: Row) => setPresets((ps) => ps.filter((p) => p.id !== r.name));
  const features = variant === "features";

  return (
    <div className="flex flex-col">
      <div className="px-6 md:px-8 py-6">
        <ListView<Row>
          rows={variant === "loading" ? [] : rows}
          columns={columns}
          rowKey={(r) => r.name}
          viewKey="Field Preset"
          onRowClick={() => {}}
          rowActions={[{
            key: "delete", label: { en: "Delete", ar: "حذف" }, icon: Trash2, tone: "destructive", onSelect: remove,
            confirm: features ? { title: { en: "Delete this preset?", ar: "حذف هذه المجموعة؟" }, confirmLabel: { en: "Delete", ar: "حذف" } } : undefined,
          }]}
          toolbarActions={
            <Button onClick={() => {}} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              {isRTL ? "إنشاء مجموعة حقول" : "Create Field Preset"}
            </Button>
          }
          loading={variant === "loading"}
          error={variant === "error"}
          onRetry={() => {}}
          {...(features ? {
            selectable: true,
            bulkActions: [
              { key: "export", label: { en: "Export", ar: "تصدير" }, icon: Download, run: () => {} },
              { key: "delete", label: { en: "Delete", ar: "حذف" }, icon: Trash2, variant: "destructive" as const, run: (keys: string[]) => setPresets((ps) => ps.filter((p) => !keys.includes(p.id))) },
            ],
            groupByOptions: [{ key: "created_by", label: isRTL ? "أنشئت بواسطة" : "Created By", groupOf: (r: Row) => ({ key: r.created_by, label: r.created_by }) }],
            quickFilterFields: ["created_by"],
            controls: { sortMenu: true, quickFiltersCustomizable: true },
            rowClassName: (r: Row) => (r.fields_count >= 10 ? "bg-warning/5" : undefined),
          } : {})}
        />
      </div>
    </div>
  );
}
