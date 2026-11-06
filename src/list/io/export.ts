/**
 * Core Export — the data side of the Design System's "Export Data" dialog (`ExportDialog`), with no backend: field
 * groups in, a selection out. Where the file comes from is the host's business — `FrappeExportDialog` asks the Frappe
 * server (`download_template`); an app without a server builds it from its own rows (`buildCsv` here; XLSX needs a
 * spreadsheet library, which the package does not ship).
 */

export type ExportFileType = "CSV" | "Excel";
/** What to export (Desk's `export_records`): every record, the filtered (or selected) ones, the first five, or headers only. */
export type ExportRecords = "all" | "by_filter" | "5_records" | "blank_template";

export interface ExportField {
  /** The stable key sent back in the selection (Frappe: the fieldname). */
  fieldname: string;
  label: string;
  fieldtype?: string;
  /** Required by the data model (shown as "(Mandatory)"). */
  reqd: boolean;
  /** Pre-selected by "Select Mandatory" and, with `lockMandatory`, always exported. */
  mandatory: boolean;
  /** Shown after the key (e.g. a conditional or update-only requirement: "mandatory when Type is X"). */
  note?: string;
}
export interface ExportGroup {
  /** The key of this group in the selection (Frappe: the DocType name, or a table fieldname). */
  key: string;
  label: string;
  /** A group whose mandatory fields "Select Mandatory" pre-selects (the main group; a required child table). */
  reqd: boolean;
  fields: ExportField[];
}

export interface ExportRequest {
  fileType: ExportFileType;
  records: ExportRecords;
  /** Chosen field keys per group key, in the groups' field order. */
  fields: Record<string, string[]>;
}

/** "Select Mandatory": the mandatory fields of every `reqd` group. */
export function mandatorySelection(groups: ExportGroup[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const g of groups) if (g.reqd) out[g.key] = g.fields.filter((f) => f.mandatory).map((f) => f.fieldname);
  return out;
}

/** The selection in the groups' field order (what a host writes as columns). */
export function orderedSelection(groups: ExportGroup[], checked: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(groups.map((g) => [g.key, g.fields.filter((f) => (checked[g.key] ?? []).includes(f.fieldname)).map((f) => f.fieldname)]));
}

const csvCell = (v: unknown): string => {
  const s = v == null ? "" : v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * RFC 4180 CSV text: one header row, then the rows; CRLF line ends; fields with a comma, quote, line break or edge
 * whitespace are quoted. `bom` (default true) prefixes U+FEFF so spreadsheet apps read UTF-8 (Arabic) correctly.
 */
export function buildCsv(headers: string[], rows: unknown[][], o: { bom?: boolean } = {}): string {
  const text = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  return (o.bom === false ? "" : "﻿") + text;
}

/**
 * Parse CSV text (RFC 4180: quoted fields, doubled quotes, CR / LF / CRLF line ends; a leading BOM is dropped) into
 * rows of strings. Blank lines are skipped. No type conversion: every cell is the file's text.
 */
export function parseCsv(text: string, o: { delimiter?: string } = {}): string[][] {
  const d = o.delimiter ?? ",";
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let i = 0;
  const endRow = () => { row.push(cell); cell = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = []; };
  while (i < src.length) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i += 2; continue; } quoted = false; i++; continue; }
      cell += c; i++; continue;
    }
    if (c === '"' && cell === "") { quoted = true; i++; continue; }
    if (c === d) { row.push(cell); cell = ""; i++; continue; }
    if (c === "\r") { endRow(); i += src[i + 1] === "\n" ? 2 : 1; continue; }
    if (c === "\n") { endRow(); i++; continue; }
    cell += c; i++;
  }
  if (cell !== "" || row.length) endRow();
  return rows;
}

/**
 * Hand a blob to the browser as a download (object URL + a click). Returns false where that is impossible (no DOM,
 * no `URL.createObjectURL`, e.g. jsdom); the caller keeps the blob then.
 */
export function saveBlob(blob: Blob, filename: string, doc: Document | undefined = typeof document === "undefined" ? undefined : document): boolean {
  const u = (globalThis as { URL?: { createObjectURL?: (b: Blob) => string; revokeObjectURL?: (u: string) => void } }).URL;
  if (!doc || !u?.createObjectURL) return false;
  const url = u.createObjectURL(blob);
  const a = doc.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  doc.body.appendChild(a);
  a.click();
  doc.body.removeChild(a);
  setTimeout(() => u.revokeObjectURL?.(url), 0);
  return true;
}
