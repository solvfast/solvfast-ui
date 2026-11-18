/**
 * BulkEditDialog — set field values on every selected record (0.8.0-dev.9, L-01), Frappe-free. The list's Actions → Edit:
 * rows of [Field ▾][Value][×] applied at once (`multiple`, the default), or Desk's single Field + Value
 * (`multiple={false}`, bulk_operations.js:343-417). Each field can be chosen once; Apply is disabled until a row has a
 * field. The Value control is the field type's own (the same controls `FrappeBulkActions`' `BulkEditValue` uses, without
 * a Frappe client): Select options, Yes / No for a check, a date / date-time / time picker, a number input, multi-line
 * text, a link search (`search`), plain text otherwise.
 *
 * `onApply` receives `{ [field key]: typed value }`: numbers for int / float / currency, booleans for check, `null` for
 * an empty value (clears the field — said under the value), strings otherwise. A returned promise keeps the dialog busy;
 * it closes on resolve and shows the error on reject (nothing is claimed that the host did not do).
 */
import * as React from "react";
import { Plus, X } from "lucide-react";
import { Alert, AlertDescription } from "../../primitives/alert";
import { Button } from "../../primitives/button";
import { DateField, DateTimeField } from "../../primitives/date-time-field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../primitives/dialog";
import { Input } from "../../primitives/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../primitives/select";
import { Textarea } from "../../primitives/textarea";
import { LinkInput } from "../../fields/LinkInput";
import { NumberInput } from "../../fields/NumberInput";
import { TimeInput } from "../../fields/TimeInput";
import { loc, type Localized } from "../../lib/localized";
import { useLocale } from "../../theme/ThemeProvider";

export type BulkEditFieldType = "select" | "date" | "datetime" | "time" | "int" | "float" | "currency" | "text" | "long-text" | "check" | "link";

export interface BulkEditField {
  /** The key in `onApply`'s values. */
  key: string;
  label: Localized;
  type: BulkEditFieldType;
  /** `select`: the choices (an empty choice "—" is always offered: it clears the field). */
  options?: { value: string; label: string }[];
  /** `link`: the search behind the value's picker (without it, a text box). */
  search?: (q: string) => Promise<{ value: string; label: string; description?: string }[]>;
}

export type BulkEditLabelKey = "title" | "description" | "field" | "value" | "addRow" | "apply" | "cancel";

export interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Selected records (fills `{n}` in the title and the Apply button). */
  count: number;
  /** The fields that may be set (leave out what must not be bulk-edited, e.g. lifecycle-driven fields). */
  fields: BulkEditField[];
  onApply: (values: Record<string, unknown>) => void | Promise<void>;
  /** Several field → value rows (default true); false = Desk's single Field + Value. */
  multiple?: boolean;
  /** `{n}` in a label is the count. */
  labels?: Partial<Record<BulkEditLabelKey, Localized>>;
}

interface Row { id: number; key: string; value: string }

/** The value `onApply` receives for a row's text (exported for hosts and tests): empty → null; int / float / currency →
 *  a number (text that is not a number is kept); check → boolean ("1" / "true" → true); everything else as typed. */
export function bulkEditTypedValue(value: string, type: BulkEditFieldType): unknown {
  if (value === "") return null;
  if (type === "check") return value === "1" || value.toLowerCase() === "true";
  if (type === "int" || type === "float" || type === "currency") { const n = Number(value); return Number.isNaN(n) ? value : type === "int" ? Math.trunc(n) : n; }
  return value;
}

const NONE = "__sf_none__";

/** The Value control for one field type (the value is kept as text; `bulkEditTypedValue` types it on Apply). */
export function BulkEditValueInput({ field, value, onChange, ariaLabel }: { field: BulkEditField; value: string; onChange: (v: string) => void; ariaLabel: string }) {
  const { t } = useLocale();
  switch (field.type) {
    case "select":
      return (
        <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
          <SelectTrigger aria-label={ariaLabel}><SelectValue placeholder={t("bkeChooseValue")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {(field.options ?? []).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case "check":
      return (
        <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
          <SelectTrigger aria-label={ariaLabel}><SelectValue placeholder={t("bkeChooseValue")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            <SelectItem value="1">{t("yes")}</SelectItem>
            <SelectItem value="0">{t("no")}</SelectItem>
          </SelectContent>
        </Select>
      );
    case "date": return <DateField aria-label={ariaLabel} value={value} onChange={onChange} />;
    case "datetime": return <DateTimeField aria-label={ariaLabel} value={value} onChange={onChange} />;
    case "time": return <TimeInput aria-label={ariaLabel} value={value || null} onChange={(v) => onChange(v ?? "")} />;
    case "int": case "float": case "currency":
      return <NumberInput aria-label={ariaLabel} kind={field.type} value={value === "" ? null : Number(value)} onChange={(n) => onChange(n === null ? "" : String(n))} />;
    case "long-text": return <Textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} rows={3} />;
    case "link":
      if (field.search) {
        const search = field.search;
        return <LinkInput aria-label={ariaLabel} value={value || null} onChange={(v) => onChange(v ?? "")} clearable search={async (q) => (await search(q)).map((r) => ({ value: r.value, label: r.label || r.value, description: r.description }))} />;
      }
      return <Input aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />;
    default:
      return <Input aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />;
  }
}

export function BulkEditDialog({ open, onOpenChange, count, fields, onApply, multiple = true, labels }: BulkEditDialogProps) {
  const { t, language } = useLocale();
  const n = String(count);
  const L = (k: BulkEditLabelKey, fallback: string) => (labels?.[k] != null ? loc(labels[k], language) : fallback).replace(/\{n\}/g, n);
  const title = L("title", t("bkeTitle"));
  const description = L("description", t("bkeDescription"));
  const fieldLabel = L("field", t("bkeField"));
  const valueLabel = L("value", t("bkeValue"));
  const nextId = React.useRef(1);
  const blank = (): Row => ({ id: nextId.current++, key: "", value: "" });
  const [rows, setRows] = React.useState<Row[]>(() => [blank()]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  // a fresh form each time the dialog opens
  React.useEffect(() => { if (open) { setRows([blank()]); setError(""); setBusy(false); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const filled = rows.filter((r) => r.key && fields.some((f) => f.key === r.key));
  const setRow = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const apply = async () => {
    if (!filled.length || busy) return;
    const values: Record<string, unknown> = {};
    for (const r of filled) values[r.key] = bulkEditTypedValue(r.value, fields.find((f) => f.key === r.key)!.type);
    setError("");
    let result: void | Promise<void>;
    try { result = onApply(values); } catch (e) { setError(e instanceof Error && e.message ? e.message : t("bkeFailed")); return; }
    if (result && typeof (result as Promise<void>).then === "function") {
      setBusy(true);
      try { await result; } catch (e) { setBusy(false); setError(e instanceof Error && e.message ? e.message : t("bkeFailed")); return; }
      setBusy(false);
    }
    onOpenChange(false);
  };

  const shown = multiple ? rows : rows.slice(0, 1);
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent data-bulk-edit-dialog="">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-3" aria-busy={busy || undefined}>
          {shown.map((row, i) => {
            const used = rows.filter((r) => r.id !== row.id).map((r) => r.key);
            const opts = fields.filter((f) => f.key === row.key || !used.includes(f.key));
            const field = fields.find((f) => f.key === row.key);
            const suffix = multiple && shown.length > 1 ? ` ${i + 1}` : "";
            return (
              <div key={row.id} className="space-y-1" data-bulk-edit-row={row.key || ""}>
                <div className="flex items-start gap-2">
                  <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                    <Select value={row.key} onValueChange={(v) => setRow(row.id, { key: v, value: "" })}>
                      <SelectTrigger aria-label={fieldLabel + suffix}><SelectValue placeholder={t("bkeChooseField")} /></SelectTrigger>
                      <SelectContent>{opts.map((f) => <SelectItem key={f.key} value={f.key}>{loc(f.label, language)}</SelectItem>)}</SelectContent>
                    </Select>
                    {field ? <BulkEditValueInput key={field.key} field={field} value={row.value} onChange={(v) => setRow(row.id, { value: v })} ariaLabel={valueLabel + suffix} />
                      : <div className="hidden h-10 sm:block" aria-hidden />}
                  </div>
                  {multiple && (
                    <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={t("bkeRemoveRow") + suffix} title={t("bkeRemoveRow")} disabled={rows.length <= 1}
                      onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== row.id) : rs))}>
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  )}
                </div>
                {field && row.value === "" && <p className="text-xs text-muted-foreground" role="status">{t("bkeEmptyClears")}</p>}
              </div>
            );
          })}
          {multiple && (
            <Button type="button" variant="ghost" size="sm" className="gap-1 text-primary" disabled={rows.length >= fields.length}
              onClick={() => setRows((rs) => [...rs, blank()])}>
              <Plus className="h-4 w-4" aria-hidden />{L("addRow", t("bkeAddRow"))}
            </Button>
          )}
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>{L("cancel", t("bkeCancel"))}</Button>
          <Button type="button" disabled={!filled.length} loading={busy} onClick={() => void apply()}>{L("apply", t("bkeApply"))}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
