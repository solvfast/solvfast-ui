/**
 * FrappeExportDialog — Desk's "Export Data" dialog (`data_exporter.js:12-102`): file type (Excel / CSV), export type
 * (All / Filtered / 5 records / Blank template), one field group per DocType and child table with Select All /
 * Select Mandatory / Unselect All, Export disabled without a parent field. The file comes from `download_template`
 * through `api.download` and is handed to the browser (`saveFile`). A refusal is shown as `FrappeErrorState`; there is
 * never a success toast and never a client-built file.
 *
 * Package differences (documented in docs/release/LISTVIEW-FRAPPE-PARITY.md): the field groups are restricted to the
 * permlevels the user may read when `levels` is given; "Filtered Records" uses the filters the host passes (the list's
 * current ones, or `[doctype, "name", "in", selected]` for a selection — `bulk_operations.js:463-474`) instead of an
 * in-dialog FilterGroup; no record-count message (`frappe.db.count`, data_exporter.js:209-238).
 */
import * as React from "react";
import type { DownloadedFile, FrappeApi } from "../client";
import type { DocPermissions, MetaBundle } from "../contract";
import { FrappeErrorState } from "../feedback/FrappeErrorState";
import type { FrappeFilter } from "../query";
import { ExportDialog, EXPORT_DIALOG_LABELS_EN, type ExportDialogLabels } from "../../list/io/ExportDialog";
import { downloadExportTemplate, exportPickerGroups, saveFile, selectedNamesFilter, type ImportType } from "./export";

/** The labels (Core `ExportDialogLabels`); defaults come from the message catalogue (en / ar). */
export { EXPORT_DIALOG_LABELS_EN };
export type { ExportDialogLabels };

export interface FrappeExportDialogProps {
  api: Pick<FrappeApi, "download">;
  bundle: MetaBundle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Checked rows: the dialog opens on "Selected Records" (= `by_filter` on their names). */
  selectedNames?: string[];
  /** The list's current filters, offered as "Filtered Records" when nothing is selected. */
  filters?: FrappeFilter[];
  /** The user's rights per permlevel (`usePermissions().levels`); restricts the fields offered. Unknown → all exportable fields. */
  levels?: DocPermissions;
  /** Desk's `exporting_for`: the list opens the exporter for "Insert New Records" (bulk_operations.js:465-468). */
  importType?: ImportType;
  /** After the server answered with a file (already handed to the browser when possible). */
  onDone?: (file: DownloadedFile) => void;
  labels?: Partial<ExportDialogLabels>;
  /** Pre-selected Export Type (e.g. "by_filter" for the list's "all matching records" selection). Default: Desk's. */
  defaultRecords?: "all" | "by_filter" | "5_records" | "blank_template";
}

export function FrappeExportDialog({ api, bundle, open, onOpenChange, selectedNames, filters, levels, importType = "Insert New Records", onDone, labels, defaultRecords: preset }: FrappeExportDialogProps) {
  const doctype = bundle.meta.name;
  const groups = React.useMemo(() => exportPickerGroups(bundle, { importType, levels }), [bundle, importType, levels]);
  const hasSelection = !!selectedNames?.length;
  // Desk: `blank_template` when exporting for an insert, else `all`; the list's Actions → Export presets `by_filter`
  const defaultRecords = preset ?? (hasSelection ? "by_filter" : importType === "Insert New Records" ? "blank_template" : "all");
  const unselectKeeps = React.useMemo(
    () => Object.fromEntries(groups.map((g) => [g.key, importType === "Update Existing Records" && g.fields.some((f) => f.fieldname === "name") ? ["name"] : []])),
    [groups, importType],
  );

  return (
    <ExportDialog
      open={open}
      onOpenChange={onOpenChange}
      groups={groups}
      description={doctype}
      selectedCount={hasSelection ? selectedNames!.length : undefined}
      defaultRecords={defaultRecords}
      showSelectMandatory={importType === "Insert New Records"}
      unselectKeeps={unselectKeeps}
      renderError={(e) => <FrappeErrorState error={e} compact />}
      labels={labels}
      onExport={async ({ fileType, records, fields }) => {
        const exportFilters = records === "by_filter" ? (hasSelection ? selectedNamesFilter(doctype, selectedNames!) : (filters ?? [])) : null;
        const file = await downloadExportTemplate(api, { doctype, fileType, exportRecords: records, exportFields: fields, exportFilters });
        saveFile(file);
        onDone?.(file);
      }}
    />
  );
}
