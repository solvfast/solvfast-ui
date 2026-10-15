/**
 * FrappeListView on Frappe's ToDo DocType, against a SIMULATED site (demo/mock-frappe.ts) — no network, no live site.
 * Shows what an app writes: a curated first column, Arabic labels for the DocType's fields, opt-in group-by, selection,
 * bulk actions, and a delete row action whose confirmation comes from the package while the deletion itself is the
 * app's (here: the simulated site's rows, then `invalidateFrappeList`). `?view=frappe&demo=error|loading|grouped`.
 * Playground only.
 */
import * as React from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, useLocale, type ColumnDef } from "@ui";
import { FrappeListView, FrappeProvider, createFrappeClient, invalidateFrappeList } from "@ui/frappe";
import { createMockFrappe } from "../demo/mock-frappe";

type ToDo = { name: string; description?: string; status?: string; priority?: string; date?: string | null };

const LABELS = {
  status: { en: "Status", ar: "الحالة" }, priority: { en: "Priority", ar: "الأولوية" }, date: { en: "Due Date", ar: "تاريخ الاستحقاق" },
  reference_type: { en: "Reference Type", ar: "نوع المرجع" }, reference_name: { en: "Reference Name", ar: "اسم المرجع" },
  allocated_to: { en: "Allocated To", ar: "مُسندة إلى" }, assigned_by: { en: "Assigned By", ar: "أسندها" }, role: { en: "Role", ar: "الدور" },
  assigned_by_full_name: { en: "Assigned By Full Name", ar: "اسم من أسندها" }, assignment_rule: { en: "Assignment Rule", ar: "قاعدة الإسناد" },
};

export function FrappeDemo({ variant = "default" }: { variant?: string }) {
  const [mock] = React.useState(() => {
    const m = createMockFrappe({ latencyMs: variant === "loading" ? 60_000 : 120 });
    if (variant === "error") m.failNext(1, { status: 403, exc_type: "PermissionError", message: "You don't have permission to read ToDo" }, "frappe.client.get_list");
    return m;
  });
  const [client] = React.useState(() => createFrappeClient({ transport: mock.transport }));
  return (
    <FrappeProvider client={client}>
      <ToDoList variant={variant} remove={(names) => { for (const n of names) mock.rows.splice(mock.rows.findIndex((r) => r.name === n), 1); }} />
    </FrappeProvider>
  );
}

function ToDoList({ variant, remove }: { variant: string; remove: (names: string[]) => void }) {
  const { isRTL } = useLocale();
  const qc = useQueryClient();
  const del = (names: string[]) => { remove(names); return invalidateFrappeList(qc, "ToDo"); };
  const columns: ColumnDef<ToDo>[] = [{ key: "description", label: { en: "Task", ar: "المهمة" }, type: "text", fieldtype: "Text Editor", className: "max-w-[26rem]" }];
  return (
    <div className="px-6 md:px-8 py-6">
      <FrappeListView<ToDo>
        doctype="ToDo"
        columns={columns}
        fieldLabels={LABELS}
        groupByFields={["status", "priority", "allocated_to"]}
        chunkSize={variant === "grouped" ? 20 : 200}
        storage={null}
        selectable
        bulkActions={[
          { key: "export", label: { en: "Export", ar: "تصدير" }, icon: Download, run: () => {} },
          { key: "delete", label: { en: "Delete", ar: "حذف" }, icon: Trash2, variant: "destructive", run: (keys) => del(keys) },
        ]}
        rowActions={[{
          key: "delete", label: { en: "Delete", ar: "حذف" }, icon: Trash2, tone: "destructive", onSelect: (r) => del([r.name]),
          confirm: { title: { en: "Delete this ToDo?", ar: "حذف هذه المهمة؟" }, confirmLabel: { en: "Delete", ar: "حذف" } },
        }]}
        controls={{ sortMenu: true }}
        toolbarActions={<Button className="gap-2 shrink-0"><Plus className="h-4 w-4" />{isRTL ? "مهمة جديدة" : "New ToDo"}</Button>}
      />
    </div>
  );
}
