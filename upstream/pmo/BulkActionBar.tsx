import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WORKFLOW_KEY, WORKFLOW_ORDER, PRIORITY_KEY, ALL_PRIORITY } from "@/lib/tasks-labels";
import { personName } from "@/lib/people";
import type { Priority, WorkflowState } from "@/lib/types";

type BulkAction = "status" | "assign" | "priority";

/**
 * Floating bar shown when one or more tasks are selected (PM / SM only). Bulk-applies a status, priority
 * or single assignee via `bulk_update_tasks`. Pick a value then Apply.
 */
export function BulkActionBar({
  count,
  people,
  onClear,
  onApply,
  applying,
}: {
  count: number;
  people: { id: string }[];
  onClear: () => void;
  onApply: (action: BulkAction, value: unknown) => void;
  applying: boolean;
}) {
  const { language, t } = useApp();
  const [action, setAction] = useState<BulkAction>("status");
  const [value, setValue] = useState<string>("");

  const apply = () => {
    if (!value) return;
    onApply(action, action === "assign" ? [value] : value);
    setValue("");
  };

  return (
    <Card className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 border-primary/30 bg-card/95 p-3 shadow-lg backdrop-blur">
      <span className="text-sm font-medium">{t("selected_count").replace("{n}", String(count))}</span>
      <div className="h-5 w-px bg-border" />

      <Select value={action} onValueChange={(v) => { setAction(v as BulkAction); setValue(""); }}>
        <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="status">{t("set_status")}</SelectItem>
          <SelectItem value="priority">{t("set_priority")}</SelectItem>
          <SelectItem value="assign">{t("set_assignee")}</SelectItem>
        </SelectContent>
      </Select>

      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="h-9 w-48"><SelectValue placeholder={t("select_option")} /></SelectTrigger>
        <SelectContent>
          {action === "status" && WORKFLOW_ORDER.map((s) => (
            <SelectItem key={s} value={s}>{t(WORKFLOW_KEY[s as WorkflowState])}</SelectItem>
          ))}
          {action === "priority" && ALL_PRIORITY.map((p) => (
            <SelectItem key={p} value={p}>{t(PRIORITY_KEY[p as Priority])}</SelectItem>
          ))}
          {action === "assign" && people.map((p) => (
            <SelectItem key={p.id} value={p.id}>{personName(p.id, language)}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button size="sm" className="gap-1.5" disabled={!value || applying} onClick={apply}>
        {applying && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("apply")}
      </Button>

      <Button variant="ghost" size="sm" className="ms-auto gap-1.5" onClick={onClear}>
        <X className="h-4 w-4" /> {t("clear_selection")}
      </Button>
    </Card>
  );
}
