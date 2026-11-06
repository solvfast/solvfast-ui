/**
 * The column mapper — Desk's "Map Columns" dialog (`import_preview.js:239-325`): one row per file column with its
 * header and a searchable field picker pre-set to what the SERVER matched (`:246-255`); the options are "Don't Import",
 * then `get_columns_for_picker` (`data_exporter.js:311-357`) as `get_fields_as_options` labels them (`:334-358`). Saving
 * hands the CHANGED columns to `onSubmit`, keyed by FILE column index (`changed_map[i - 1]`, `:310-318`); the caller
 * saves them into `template_options` and asks the server for the preview again (`remapImportColumns`). Nothing is
 * re-mapped here: what a column becomes is the server's answer to that save.
 *
 * Package differences: rendered as a step of the import panel (not a third dialog); a column counts as changed only
 * when its value differs from the pre-set one (Desk records every `change` event, even back to the same value).
 */
import * as React from "react";
import { ColumnMappingForm } from "../../list/io/ImportParts";
import type { MetaBundle } from "../contract";
import type { ImportPreview } from "./import";
import { changedColumnMap, columnMappingValue, fmt, importPickerOptions, type DataImportLabels } from "./importMapping";
import { useDataImportLabels } from "./ImportPreview";

export interface FrappeColumnMappingProps {
  preview: ImportPreview;
  /** The reference DocType's bundle (its child tables give the `<table>.<field>` options). */
  bundle: MetaBundle;
  /** Shown in the heading (Desk: the import file's name). */
  fileName?: string;
  /** Called with the changed entries only, `{ "<file column index>": "<field>" | "Don't Import" }`; not called when nothing changed. */
  onSubmit: (changed: Record<string, string>) => void;
  onCancel: () => void;
  /** The save is in flight (disables the form). */
  busy?: boolean;
  labels?: Partial<DataImportLabels>;
  className?: string;
}

/** Desk's mapper through the Core form: options from the DocType bundle, pre-set to what the server matched. */
export function FrappeColumnMapping({ preview, bundle, fileName, onSubmit, onCancel, busy, labels, className }: FrappeColumnMappingProps) {
  const L = useDataImportLabels(labels);
  const options = React.useMemo(() => importPickerOptions(bundle), [bundle]);
  const initial = React.useMemo(() => {
    const out: Record<number, string> = {};
    (preview.columns ?? []).forEach((col, i) => { if (i > 0) out[i] = columnMappingValue(col); });
    return out;
  }, [preview]);
  const columns = React.useMemo(() => (preview.columns ?? []).map((col, i) => ({ index: i, header: col.header_title || "" })).filter((c) => c.index > 0), [preview]);
  return (
    <ColumnMappingForm
      columns={columns}
      options={options}
      initial={initial}
      heading={fmt(L.mapHeading, fileName || "", bundle.meta.name)}
      onSubmit={(changes) => onSubmit(changedColumnMap(changes))}
      onCancel={onCancel}
      busy={busy}
      labels={labels}
      className={className}
    />
  );
}
