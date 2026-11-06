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
import { ImportPreviewTable, ImportWarningsPanel, useDataImportLabels } from "../../list/io/ImportParts";
import { ServerHtml } from "../feedback/ServerHtml";
import type { ImportPreview, ImportWarning } from "./import";
import { groupImportWarnings, importedRowNumbers, previewColumns, type DataImportLabels } from "./importMapping";

/** The labels for the current language (English, or Arabic when the ThemeProvider's language is `ar`), overridden by `labels` (Core). */
export { useDataImportLabels };

export interface FrappeImportPreviewProps {
  preview: ImportPreview;
  /** Buttons above the grid (Desk's `.table-actions`: Map Columns, Export Errored Rows). */
  actions?: React.ReactNode;
  labels?: Partial<DataImportLabels>;
  className?: string;
}

/** The server's preview through the Core grid: its columns, rows, max-rows notice and imported rows. */
export function FrappeImportPreview({ preview, actions, labels, className }: FrappeImportPreviewProps) {
  const columns = React.useMemo(() => previewColumns(preview), [preview]);
  const imported = React.useMemo(() => importedRowNumbers(preview), [preview]);
  const rows = preview.data ?? [];
  return (
    <ImportPreviewTable
      columns={columns}
      rows={rows}
      imported={imported}
      actions={actions}
      labels={labels}
      className={className}
      shownOf={preview.max_rows_exceeded ? { shown: preview.max_rows_in_preview ?? rows.length, total: preview.total_number_of_rows ?? "" } : null}
    />
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

/** The server's warnings, grouped as Desk does, through the Core panel; messages are server HTML (allow-list). */
export function FrappeImportWarnings({ warnings, columns, referenceDoctype, labels, className }: FrappeImportWarningsProps) {
  const g = React.useMemo(() => groupImportWarnings(warnings, columns, referenceDoctype), [warnings, columns, referenceDoctype]);
  return <ImportWarningsPanel warnings={g} labels={labels} className={className} renderMessage={(m, inline) => <ServerHtml html={m} className={inline ? "inline" : undefined} />} />;
}
