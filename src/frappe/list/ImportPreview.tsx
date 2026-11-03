/**
 * The Data Import preview and warnings, as Desk renders the SERVER's `get_preview_from_template` answer:
 *  - `FrappeImportPreview` — `import_preview.js:48-171`: the server's columns (Sr. No, then each file column with the
 *    field the server matched or mapped it to, its date format; skipped columns marked and muted), the rows exactly as
 *    returned (the first `MAX_ROWS_IN_PREVIEW` = 10, `importer.py:22, 507-512`), "Showing only first {0} rows out of
 *    {1}" when `max_rows_exceeded`, and rows the import log marks as imported greyed (`:173-191, 326-331`).
 *  - `FrappeImportWarnings` — `data_import.js:333-406`: `template_warnings` + the preview's warnings, grouped by row,
 *    the others headed "Column N (header)". Messages are server HTML (`frappe.bold`), rendered through the allow-list.
 *
 * Nothing is computed about the file here: every column, cell, mapping and warning comes from the server.
 */
import * as React from "react";
import { cn } from "../../lib/cn";
import { useLocale } from "../../theme/ThemeProvider";
import { StatusDot } from "../../primitives/status-dot";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../primitives/table";
import { ServerHtml } from "../feedback/ServerHtml";
import type { ImportPreview, ImportWarning } from "./import";
import { DATA_IMPORT_LABELS_AR, DATA_IMPORT_LABELS_EN, fmt, groupImportWarnings, importedRowNumbers, previewCell, previewColumns, type DataImportLabels } from "./importMapping";

/** The labels for the current language (English, or Arabic when the ThemeProvider's language is `ar`), overridden by `labels`. */
export function useDataImportLabels(labels?: Partial<DataImportLabels>): DataImportLabels {
  const { language } = useLocale();
  return React.useMemo(() => ({ ...(language === "ar" ? DATA_IMPORT_LABELS_AR : DATA_IMPORT_LABELS_EN), ...labels }), [language, labels]);
}

export interface FrappeImportPreviewProps {
  preview: ImportPreview;
  /** Buttons above the grid (Desk's `.table-actions`: Map Columns, Export Errored Rows). */
  actions?: React.ReactNode;
  labels?: Partial<DataImportLabels>;
  className?: string;
}

export function FrappeImportPreview({ preview, actions, labels, className }: FrappeImportPreviewProps) {
  const L = useDataImportLabels(labels);
  const columns = React.useMemo(() => previewColumns(preview), [preview]);
  const imported = React.useMemo(() => importedRowNumbers(preview), [preview]);
  const rows = preview.data ?? [];
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
              const done = imported.has(rowNumber);
              return (
                <TableRow key={r} data-row={String(row[0] ?? "")} data-imported={done ? "" : undefined} className={cn(done && "bg-muted/60 text-muted-foreground")} title={done ? L.imported : undefined}>
                  {columns.map((c) => (
                    <TableCell key={c.index} className={cn("whitespace-nowrap", (c.skipped || c.srNo) && "text-muted-foreground")}>{previewCell(row, c.index)}</TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {preview.max_rows_exceeded ? (
        <p className="text-sm text-muted-foreground" data-max-rows="">{fmt(L.showingFirst, preview.max_rows_in_preview ?? rows.length, preview.total_number_of_rows ?? "")}</p>
      ) : null}
    </section>
  );
}

export interface FrappeImportWarningsProps {
  /** `template_warnings` (parsed) first, then the preview's `warnings` — Desk's order. */
  warnings: ImportWarning[];
  columns?: ImportPreview["columns"];
  referenceDoctype: string;
  labels?: Partial<DataImportLabels>;
  className?: string;
}

export function FrappeImportWarnings({ warnings, columns, referenceDoctype, labels, className }: FrappeImportWarningsProps) {
  const L = useDataImportLabels(labels);
  const g = React.useMemo(() => groupImportWarnings(warnings, columns, referenceDoctype), [warnings, columns, referenceDoctype]);
  if (!g.total) return null;
  return (
    <section className={cn("space-y-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm", className)} aria-label={L.warnings} data-import-warnings="">
      <h4 className="font-semibold">{L.warnings}</h4>
      {g.rows.map((r) => (
        <div key={`r${r.row}`} data-row={r.row} className="space-y-1">
          <h5 className="text-xs font-semibold uppercase text-muted-foreground">{fmt(L.row, r.row)}</h5>
          <ul className="list-disc space-y-0.5 ps-5">
            {r.items.map((w, i) => (
              <li key={i} className={cn(w.type === "info" && "text-muted-foreground")}>
                {w.field ? <span className="font-medium">{w.field}: </span> : null}
                <ServerHtml html={w.message} className="inline" />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {g.other.map((w, i) => (
        <div key={`o${i}`} data-col={w.col ?? undefined} className={cn("space-y-0.5", w.type === "info" && "text-muted-foreground")}>
          {w.col ? <h5 className="text-xs font-semibold"><span className="uppercase">{fmt(L.column, w.col)}</span>{w.header !== null ? ` (${w.header})` : ""}</h5> : null}
          <ServerHtml html={w.message} />
        </div>
      ))}
    </section>
  );
}
