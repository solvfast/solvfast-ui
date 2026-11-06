/**
 * The Data Import tool's views, without a backend — shared by the Core `DataImportDialog` and the Frappe
 * `FrappeDataImport` (whose `FrappeImportPreview` / `FrappeImportWarnings` / `FrappeColumnMapping` lay the SERVER's
 * answer out through these):
 *  - `ImportPreviewTable` — Desk's preview grid (`import_preview.js:48-171`): "Sr. No", then one column per file column
 *    with the field it maps to (or "Not imported"), the first rows, "Showing only first {0} rows out of {1}", rows
 *    already imported greyed.
 *  - `ImportWarningsPanel` — `data_import.js:333-406`: warnings grouped by row, the others headed "Column N (header)".
 *  - `ColumnMappingForm` — Desk's "Map Columns" (`import_preview.js:239-325`): one searchable field picker per file
 *    column, "Don't Import" first; only CHANGED columns are handed back.
 * Messages are plain text unless the host passes `renderMessage` (Frappe: its server-HTML allow-list).
 */
import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../../primitives/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../primitives/command";
import { Popover, PopoverContent, PopoverTrigger } from "../../primitives/popover";
import { StatusDot } from "../../primitives/status-dot";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../primitives/table";
import { useLocale } from "../../theme/ThemeProvider";
import { DATA_IMPORT_LABELS_AR, DATA_IMPORT_LABELS_EN, IMPORT_DIALOG_LABELS_AR, IMPORT_DIALOG_LABELS_EN, fmt, type DataImportLabels, type ImportDialogLabels } from "./importLabels";

/** The mapper's "Don't Import" value (the literal Frappe's importer tests, `importer.py:884, 926`). */
export const DONT_IMPORT = "Don't Import";

/** The Data Import labels for the current language (English, or Arabic under `ar`), overridden by `labels`. */
export function useDataImportLabels(labels?: Partial<DataImportLabels>): DataImportLabels {
  const { language } = useLocale();
  return React.useMemo(() => ({ ...(language === "ar" ? DATA_IMPORT_LABELS_AR : DATA_IMPORT_LABELS_EN), ...labels }), [language, labels]);
}
/** The Core dialog's labels (the Data Import labels plus its own), for the current language, overridden by `labels`. */
export function useImportDialogLabels(labels?: Partial<ImportDialogLabels>): ImportDialogLabels {
  const { language } = useLocale();
  return React.useMemo(
    () => ({ ...(language === "ar" ? { ...DATA_IMPORT_LABELS_AR, ...IMPORT_DIALOG_LABELS_AR } : { ...DATA_IMPORT_LABELS_EN, ...IMPORT_DIALOG_LABELS_EN }), ...labels }),
    [language, labels],
  );
}

// ---- preview grid ------------------------------------------------------------------------------------------------

/** One preview column (index 0 is "Sr. No", the file's row number). */
export interface ImportColumnView {
  index: number;
  srNo: boolean;
  /** The file's header, or null for "Untitled Column". */
  title: string | null;
  skipped: boolean;
  /** The field the column is mapped to (label), null when skipped. */
  field: string | null;
  dateFormat: string | null;
}

export interface ImportPreviewTableProps {
  columns: ImportColumnView[];
  /** Rows as shown: cell 0 is the row number. */
  rows: unknown[][];
  /** Row numbers already imported (greyed). */
  imported?: Set<number>;
  /** Per row number: "error" / "duplicate" (marked with a dot and `data-row-status`). */
  rowStatus?: Map<number, "error" | "duplicate">;
  /** Buttons above the grid (Map Columns, Export Errored Rows). */
  actions?: React.ReactNode;
  /** "Showing only first {0} rows out of {1}" when the grid holds fewer rows than the file. */
  shownOf?: { shown: number; total: number | string } | null;
  labels?: Partial<DataImportLabels>;
  className?: string;
}

const cellText = (row: unknown[], index: number): string => {
  const v = row[index];
  return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
};

export function ImportPreviewTable({ columns, rows, imported, rowStatus, actions, shownOf, labels, className }: ImportPreviewTableProps) {
  const L = useDataImportLabels(labels);
  return (
    <section className={cn("space-y-2", className)} aria-label={L.preview} data-import-preview="">
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) =>
                c.srNo ? (
                  <TableHead key={c.index} className="w-14 whitespace-nowrap">{L.srNo}</TableHead>
                ) : (
                  <TableHead key={c.index} data-col={c.index} data-skipped={c.skipped ? "" : undefined} className="min-w-[8rem] align-top">
                    <StatusDot
                      tone={c.skipped ? "destructive" : "success"}
                      label={<span className={cn("font-medium", !c.title && "italic")}>{c.title ?? L.untitledColumn}{c.dateFormat ? ` (${c.dateFormat})` : ""}</span>}
                    />
                    <span className="block text-xs font-normal text-muted-foreground">{c.skipped ? L.skipped : c.field ? fmt(L.mappedTo, c.field) : null}</span>
                  </TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={Math.max(columns.length, 1)} className="text-center text-muted-foreground">{L.noData}</TableCell></TableRow>
            ) : rows.map((row, r) => {
              const rowNumber = Number(row[0]);
              const done = !!imported?.has(rowNumber);
              const status = rowStatus?.get(rowNumber);
              return (
                <TableRow key={r} data-row={String(row[0] ?? "")} data-imported={done ? "" : undefined} data-row-status={status} className={cn(done && "bg-muted/60 text-muted-foreground")} title={done ? L.imported : undefined}>
                  {columns.map((c) => (
                    <TableCell key={c.index} className={cn("whitespace-nowrap", (c.skipped || c.srNo) && "text-muted-foreground")}>
                      {c.srNo && status ? <StatusDot tone={status === "error" ? "destructive" : "warning"} label={cellText(row, c.index)} /> : cellText(row, c.index)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {shownOf ? <p className="text-sm text-muted-foreground" data-max-rows="">{fmt(L.showingFirst, shownOf.shown, shownOf.total)}</p> : null}
    </section>
  );
}

// ---- warnings ------------------------------------------------------------------------------------------------------

export interface GroupedImportWarnings {
  /** Row warnings, by row number ascending. */
  rows: { row: number; items: { field: string | null; message: string; type?: string }[] }[];
  /** The rest; `col` (1-based) gives the header `Column {col} (<header>)`. */
  other: { col: number | null; header: string | null; message: string; type?: string }[];
  total: number;
}

export interface ImportWarningsPanelProps {
  warnings: GroupedImportWarnings;
  /** How a message is rendered (Frappe: server HTML through the allow-list). Default: text. */
  renderMessage?: (message: string, inline: boolean) => React.ReactNode;
  labels?: Partial<DataImportLabels>;
  className?: string;
}

export function ImportWarningsPanel({ warnings: g, renderMessage, labels, className }: ImportWarningsPanelProps) {
  const L = useDataImportLabels(labels);
  if (!g.total) return null;
  const msg = (m: string, inline: boolean) => (renderMessage ? renderMessage(m, inline) : inline ? <span>{m}</span> : <p>{m}</p>);
  return (
    <section className={cn("space-y-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm", className)} aria-label={L.warnings} data-import-warnings="">
      <h4 className="font-semibold">{L.warnings}</h4>
      {g.rows.map((r) => (
        <div key={`r${r.row}`} data-row={r.row} className="space-y-1">
          <h5 className="text-xs font-semibold uppercase text-muted-foreground">{fmt(L.row, r.row)}</h5>
          <ul className="list-disc space-y-0.5 ps-5">
            {r.items.map((w, i) => (
              <li key={i} className={cn(w.type === "info" && "text-muted-foreground")} data-warning-type={w.type}>
                {w.field ? <span className="font-medium">{w.field}: </span> : null}
                {msg(w.message, true)}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {g.other.map((w, i) => (
        <div key={`o${i}`} data-col={w.col ?? undefined} data-warning-type={w.type} className={cn("space-y-0.5", w.type === "info" && "text-muted-foreground")}>
          {w.col ? <h5 className="text-xs font-semibold"><span className="uppercase">{fmt(L.column, w.col)}</span>{w.header !== null ? ` (${w.header})` : ""}</h5> : null}
          {msg(w.message, false)}
        </div>
      ))}
    </section>
  );
}

// ---- column mapper -------------------------------------------------------------------------------------------------

export interface ImportFieldOption {
  /** What the mapping stores (a field key; Frappe: `fieldname` or `<table>.<fieldname>`). */
  value: string;
  label: string;
  /** Second line in the picker (Frappe: the value). */
  description: string;
  /** Owner of the field (Frappe: the DocType). */
  doctype: string;
}

export interface ColumnMappingFormProps {
  /** The file's columns: preview index (1-based; 0 is Sr. No) and header. */
  columns: { index: number; header: string }[];
  /** The fields a column may map to ("Don't Import" is added first). */
  options: ImportFieldOption[];
  /** Pre-set value per preview index (a field value, or `DONT_IMPORT`). */
  initial: Record<number, string>;
  /** Shown above the rows (Desk: "Map columns from {file} to fields in {DocType}"). */
  heading?: React.ReactNode;
  /** Called with the CHANGED entries only, keyed by preview index; when nothing changed `onCancel` runs instead. */
  onSubmit: (changes: Record<number, string>) => void;
  onCancel: () => void;
  busy?: boolean;
  labels?: Partial<DataImportLabels>;
  className?: string;
}

export function ColumnMappingForm({ columns, options: fieldOptions, initial, heading, onSubmit, onCancel, busy, labels, className }: ColumnMappingFormProps) {
  const L = useDataImportLabels(labels);
  const options = React.useMemo<ImportFieldOption[]>(() => [{ value: DONT_IMPORT, label: L.dontImport, description: DONT_IMPORT, doctype: "" }, ...fieldOptions], [fieldOptions, L.dontImport]);
  const [values, setValues] = React.useState<Record<number, string>>(initial);
  React.useEffect(() => setValues(initial), [initial]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const changes: Record<number, string> = {};
    for (const [i, v] of Object.entries(values)) if (v !== initial[Number(i)]) changes[Number(i)] = v;
    if (!Object.keys(changes).length) { onCancel(); return; } // Desk: `if (changed.length > 0)` remap; the dialog closes either way
    onSubmit(changes);
  };

  return (
    <form onSubmit={submit} className={cn("space-y-3", className)} aria-label={L.mapColumns} data-column-mapping="">
      {heading ? <p className="text-sm text-muted-foreground">{heading}</p> : null}
      <div className="divide-y rounded-md border">
        {columns.map(({ index: i, header }) => (
          <div key={i} className="grid items-center gap-2 p-2 sm:grid-cols-2" data-map-col={i}>
            <span className={cn("truncate text-sm", !header && "italic text-muted-foreground")}>{header || L.untitledColumn}</span>
            <FieldPicker
              value={values[i] ?? DONT_IMPORT}
              options={options}
              onChange={(v) => setValues((s) => ({ ...s, [i]: v }))}
              ariaLabel={header || `${L.untitledColumn} ${i}`}
              labels={L}
              disabled={busy}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>{L.cancel}</Button>
        <Button type="submit" loading={busy}>{busy ? L.savingMapping : L.saveMapping}</Button>
      </div>
    </form>
  );
}

/** A searchable picker (Desk: an Autocomplete) — Popover + Command; the trigger shows the option's label. */
function FieldPicker({ value, options, onChange, ariaLabel, labels: L, disabled }: { value: string; options: ImportFieldOption[]; onChange: (v: string) => void; ariaLabel: string; labels: DataImportLabels; disabled?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label={ariaLabel} disabled={disabled} className="w-full justify-between font-normal" data-value={value}>
          <span className={cn("truncate", value === DONT_IMPORT && "text-muted-foreground")}>{current?.label ?? value}</span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0" align="start">
        <Command>
          <CommandInput placeholder={L.searchFields} />
          <CommandList>
            <CommandEmpty>{L.noFields}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.value} value={o.value} keywords={[o.label]} onSelect={() => { onChange(o.value); setOpen(false); }}>
                  <Check className={cn("me-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} aria-hidden />
                  <div className="min-w-0">
                    <div className="truncate">{o.label}</div>
                    {o.value !== DONT_IMPORT ? <div className="truncate text-xs text-muted-foreground">{o.description}</div> : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
