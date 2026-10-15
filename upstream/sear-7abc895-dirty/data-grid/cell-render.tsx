import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/contexts/AppContext";
import type { ColumnMeta } from "./frappe-meta";

const fmtDate = (v: any, lang: string, withTime = false) => {
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v ?? "");
  return d.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", {
    year: "numeric", month: "short", day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
};

const fmtNumber = (v: any, lang: string, currency = false) => {
  const n = Number(v);
  if (isNaN(n)) return String(v ?? "");
  return n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US", currency ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {});
};

/** Render one cell value formatted by its Frappe fieldtype (Currency, Date, Check, Select, Link, …). */
export function Cell({ value, col }: { value: any; col: ColumnMeta }) {
  const { language } = useApp();
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;

  switch (col.fieldtype) {
    case "Check":
      return value ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-muted-foreground" />;
    case "Date":
      return <span dir="ltr">{fmtDate(value, language)}</span>;
    case "Datetime":
      return <span dir="ltr">{fmtDate(value, language, true)}</span>;
    case "Currency":
      return <span dir="ltr" className="font-medium tabular-nums">{fmtNumber(value, language, true)}</span>;
    case "Int":
    case "Float":
    case "Percent":
      return <span dir="ltr" className="tabular-nums">{fmtNumber(value, language)}{col.fieldtype === "Percent" ? "%" : ""}</span>;
    case "Select":
      return <Badge variant="secondary" className="font-normal">{String(value)}</Badge>;
    case "Link":
    case "Dynamic Link":
      return <span className="font-medium text-foreground">{String(value)}</span>;
    default:
      return <span className="truncate">{String(value)}</span>;
  }
}
