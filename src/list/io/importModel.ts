/**
 * The client-side half of a Data Import, without a backend: match a file's headers to fields, validate every row
 * (mandatory values, per-field checks), flag duplicates (against existing records and within the file), and lay the
 * result out the way the Data Import tool shows it (preview grid, warnings by row / column, counts). No React, no I/O:
 * reading the file and running the import belong to the adapter (`DataImportAdapter`).
 */
import type { GroupedImportWarnings, ImportColumnView } from "./ImportParts";
import { fmt, type ImportDialogLabels } from "./importLabels";

export type ImportType = "Insert New Records" | "Update Existing Records";

export interface ImportField {
  /** Stable key (what the mapping stores and what the run receives). */
  key: string;
  label: string;
  /** Must be mapped to a column and filled in every row (for the import types in `requiredOn`). */
  mandatory?: boolean;
  /** The import types `mandatory` applies to (e.g. a value required when creating but not when updating). Default: both. */
  requiredOn?: ImportType[];
  /**
   * A conditional requirement: the value must be filled in the rows where `test(row)` holds (`label` names the condition,
   * e.g. "Lead Type is Inbound"); `on` limits it to some import types (default: both). An unmapped field counts as empty.
   */
  requiredWhen?: { test: (row: Record<string, string>) => boolean; label: string; on?: ImportType[] };
  /** Other header texts that match this field (another language's label, a legacy name …). */
  aliases?: string[];
  /** Second line in the column picker. Default: the key. */
  description?: string;
  /** A non-empty cell's check: return a message when the value is invalid. */
  validate?: (value: string, row: Record<string, string>) => string | null | undefined;
}

/** A read file: its header row and the rows under it (cells as text). */
export interface ParsedImportFile {
  headers: string[];
  rows: string[][];
}

/** Per FILE column: the field key it maps to, or null (not imported). */
export type ColumnMap = (string | null)[];

export interface ImportDuplicateCheck {
  /** A row's identity (e.g. a normalised e-mail); null / "" = no identity, never a duplicate. */
  identity: (row: Record<string, string>) => string | null | undefined;
  /** The existing record an identity belongs to (its display name), or null when there is none. */
  existing?: (identity: string) => string | null | undefined;
}

export interface ImportRowCheck {
  /** The row's number in the file (the header is row 1). */
  rowNumber: number;
  /** Mapped values by field key. */
  values: Record<string, string>;
  errors: { field: string | null; message: string }[];
  duplicate: null | { message: string; existing: boolean };
}

export interface ImportValidation {
  rows: ImportRowCheck[];
  /** Mandatory fields without a column (the import cannot run). */
  missingMandatory: string[];
  warnings: GroupedImportWarnings;
  counts: { total: number; errors: number; duplicates: number; ready: number };
}

export const normalizeHeader = (s: string): string => s.normalize("NFKC").toLowerCase().replace(/[\s_\-.:*()]+/g, " ").trim();

/** Match headers to fields (label, key or alias, case- and spacing-insensitive); a field takes the FIRST matching column only. */
export function autoMapColumns(headers: string[], fields: ImportField[]): ColumnMap {
  const used = new Set<string>();
  return headers.map((h) => {
    const n = normalizeHeader(h ?? "");
    if (!n) return null;
    const f = fields.find((x) => !used.has(x.key) && [x.label, x.key, ...(x.aliases ?? [])].some((c) => normalizeHeader(c) === n));
    if (!f) return null;
    used.add(f.key);
    return f.key;
  });
}

/** Per-row values by field key (a field mapped twice takes its first column). */
export function mapRow(cells: string[], map: ColumnMap): Record<string, string> {
  const out: Record<string, string> = {};
  map.forEach((key, j) => { if (key && !(key in out)) out[key] = (cells[j] ?? "").toString().trim(); });
  return out;
}

/**
 * Validate a mapped file: column problems (unmatched, mapped twice, mandatory field missing), then per row the
 * mandatory values and each field's `validate`, then duplicates — of an existing record (`existing`) or of an earlier
 * row of the file (same identity). Rows with errors are not ready; duplicates are counted separately (the host decides
 * whether they are skipped).
 */
/** Whether `f` is unconditionally mandatory for this import type. */
export const isMandatoryFor = (f: ImportField, importType: ImportType): boolean => !!f.mandatory && (!f.requiredOn || f.requiredOn.includes(importType));

export function validateImport(
  file: ParsedImportFile, map: ColumnMap, fields: ImportField[], L: ImportDialogLabels, duplicates?: ImportDuplicateCheck,
  importType: ImportType = "Insert New Records",
): ImportValidation {
  const insert = importType === "Insert New Records";
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const other: GroupedImportWarnings["other"] = [];
  file.headers.forEach((h, j) => {
    if (!map[j]) other.push({ col: j + 1, header: h || null, message: fmt(L.notMapped, h || L.untitledColumn), type: "info" });
  });
  const seenKeys = new Map<string, number>();
  map.forEach((k, j) => {
    if (!k) return;
    if (seenKeys.has(k)) other.push({ col: j + 1, header: file.headers[j] || null, message: fmt(L.mappedTwice, byKey.get(k)?.label ?? k), type: "warning" });
    else seenKeys.set(k, j);
  });
  const mapped = new Set(map.filter(Boolean) as string[]);
  const missingMandatory = fields.filter((f) => isMandatoryFor(f, importType) && !mapped.has(f.key)).map((f) => f.key);
  for (const k of missingMandatory) other.push({ col: null, header: null, message: fmt(L.mandatoryNotMapped, byKey.get(k)!.label), type: "error" });

  const firstRowOf = new Map<string, number>();
  const rows: ImportRowCheck[] = file.rows.map((cells, i) => {
    const rowNumber = i + 2;
    const values = mapRow(cells, map);
    const errors: ImportRowCheck["errors"] = [];
    for (const f of fields) {
      const v = mapped.has(f.key) ? values[f.key] ?? "" : "";
      const when = f.requiredWhen && (!f.requiredWhen.on || f.requiredWhen.on.includes(importType)) && f.requiredWhen.test(values);
      if (!v) {
        if (mapped.has(f.key) && isMandatoryFor(f, importType)) errors.push({ field: f.label, message: fmt(L.valueMissing, f.label) });
        else if (when && !isMandatoryFor(f, importType)) errors.push({ field: f.label, message: fmt(L.valueMissingWhen, f.label, f.requiredWhen!.label) });
        continue;
      }
      const problem = f.validate?.(v, values);
      if (problem) errors.push({ field: f.label, message: problem });
    }
    let duplicate: ImportRowCheck["duplicate"] = null;
    const id = duplicates?.identity(values);
    if (id) {
      const existing = duplicates?.existing?.(id);
      // Insert: a row matching an existing record is a duplicate. Update: it is the record to update; no match is an error.
      if (insert && existing) duplicate = { message: fmt(L.duplicateOfExisting, existing), existing: true };
      else if (!insert && duplicates?.existing && !existing) errors.push({ field: null, message: fmt(L.notFoundForUpdate, id) });
      else if (firstRowOf.has(id)) duplicate = { message: fmt(L.duplicateInFile, firstRowOf.get(id)!), existing: false };
      if (!firstRowOf.has(id)) firstRowOf.set(id, rowNumber);
    } else if (!insert && duplicates?.existing) errors.push({ field: null, message: L.noIdentityForUpdate });
    return { rowNumber, values, errors, duplicate };
  });

  const rowWarnings: GroupedImportWarnings["rows"] = rows
    .filter((r) => r.errors.length || r.duplicate)
    .map((r) => ({
      row: r.rowNumber,
      items: [
        ...r.errors.map((e) => ({ field: e.field, message: e.message, type: "error" })),
        ...(r.duplicate ? [{ field: null, message: r.duplicate.message, type: "duplicate" }] : []),
      ],
    }));
  const errors = rows.filter((r) => r.errors.length).length;
  const dups = rows.filter((r) => !r.errors.length && r.duplicate).length;
  const ready = missingMandatory.length ? 0 : rows.filter((r) => !r.errors.length && !r.duplicate).length;
  return {
    rows,
    missingMandatory,
    warnings: { rows: rowWarnings, other, total: rowWarnings.reduce((n, r) => n + r.items.length, 0) + other.length },
    counts: { total: rows.length, errors, duplicates: dups, ready },
  };
}

/** The rows an import would send: no errors; duplicates only when `importDuplicates`. None while a mandatory field is unmapped. */
export function importableRows(v: ImportValidation, importDuplicates: boolean): ImportRowCheck[] {
  if (v.missingMandatory.length) return [];
  return v.rows.filter((r) => !r.errors.length && (importDuplicates || !r.duplicate));
}

/** The preview grid's columns: Sr. No, then each file column with the field it maps to. */
export function importPreviewColumns(file: ParsedImportFile, map: ColumnMap, fields: ImportField[]): ImportColumnView[] {
  const label = new Map(fields.map((f) => [f.key, f.label]));
  return [
    { index: 0, srNo: true, title: "Sr. No", skipped: true, field: null, dateFormat: null },
    ...file.headers.map((h, j) => ({ index: j + 1, srNo: false, title: h || null, skipped: !map[j], field: map[j] ? label.get(map[j]!) ?? map[j] : null, dateFormat: null })),
  ];
}
