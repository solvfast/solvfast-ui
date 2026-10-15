import { Layers, Check } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { GroupByKey } from "@/lib/list-view";

/** A group-by option: a stable key + i18n label + a mapper from a row to its group {key,label}. */
export interface GroupByOption<T> {
  key: GroupByKey;
  label: string;
  /** Map a row to its group bucket. Only needed for real group keys (not "none"). */
  groupOf?: (row: T) => { key: string; label: string };
}

/**
 * Generic "Group by" control. Pick a field to bucket the list by (status/assignee/priority/epic/type…),
 * or "None" for a flat list. Options are supplied by the page so the same control works for any doctype.
 */
export function GroupByControl<T>({
  options,
  value,
  onChange,
}: {
  options: GroupByOption<T>[];
  value: GroupByKey;
  onChange: (v: GroupByKey) => void;
}) {
  const { t } = useApp();
  const active = options.find((o) => o.key === value);
  const activeLabel = active && active.key !== "none" ? active.label : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Layers className="h-4 w-4" />
          {activeLabel ? <span className="max-w-[10rem] truncate">{activeLabel}</span> : t("group_by")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("group_by")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.key}
            onSelect={(e) => { e.preventDefault(); onChange(opt.key); }}
            className="justify-between"
          >
            <span className="truncate">{opt.label}</span>
            <Check className={cn("h-4 w-4", value === opt.key ? "opacity-100" : "opacity-0")} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
