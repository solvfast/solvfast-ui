/**
 * docStore — one document and its child rows, with Desk's value pipeline (docs `11` §1.4, §4.1; `12` §5.3, §5.6).
 * Pure TypeScript, immutable snapshots (every change produces a new document object, for React's
 * `useSyncExternalStore`).
 *
 *  - `setValue`: no-op when the new value is strictly equal, EXCEPT for Link / Dynamic Link, whose listeners run again
 *    (Desk re-runs Link triggers, and so fetches, for an unchanged value, model.js:566-571). Marks the document dirty
 *    (`__unsaved: 1`) unless `skipDirty`; clears `__unedited` on a row.
 *  - Rows: `add` / `insert at` / `duplicate` / `delete` / `move` keep `idx` contiguous 1…n after every operation. New
 *    rows carry `doctype`, `name: new-<slug>-<10 chars>`, `__islocal: 1`, `__unsaved: 1`, `parent`, `parenttype`,
 *    `parentfield`, `docstatus: 0` and the child DocType's defaults — a row with a client name but without
 *    `__islocal` would be UPDATEd on the server, match nothing and be silently lost. Duplicate copies every key except
 *    creation, modified, modified_by, idx, owner, parent, doctype, name, parentfield (grid.js:957-977).
 *  - `replace(doc)`: after load / save, the server's document replaces the local one entirely (Desk drops local keys
 *    absent from the response, so `__unsaved` / `__islocal` disappear and `new-*` names become the real names).
 *  - Undo / redo (P35, Desk `UndoManager`, form/undo_manager.js): a change made with `{ record: true }` (the form passes it
 *    for what the USER typed — base_control.js:220 records control input only, not script or fetch writes) is pushed on
 *    the undo stack; `undo()` sets the old value back through `setValue` (so field events run, as `frm.set_value`) and
 *    pushes the reverse on the redo stack; `redo()` the opposite. As in Desk a new change does not clear the redo stack.
 *    `replace()` erases both stacks (form.js:391 `erase_history`).
 */
import type { FrappeDoc, FrappeDocField, MetaBundle } from "../../contract";
import { newChildRow, type DefaultsContext } from "./defaults";
import { TABLE_TYPES } from "./fieldtypes";

export interface RowRef { parentfield: string; name: string }

export interface FieldChange {
  doctype: string;
  /** Name of the document or row that changed. */
  name: string;
  fieldname: string;
  value: unknown;
  previous: unknown;
  /** Set for a child row. */
  parentfield?: string;
  /** Re-trigger of an unchanged Link value. */
  unchanged?: boolean;
}

/** One recorded user change (undo_manager.js `record_change`). */
export interface HistoryEntry { fieldname: string; target?: RowRef; oldValue: unknown; newValue: unknown }

export type RowOperation =
  | { type: "add"; parentfield: string; row: FrappeDoc }
  | { type: "remove"; parentfield: string; rows: FrappeDoc[] }
  | { type: "move"; parentfield: string; row: FrappeDoc; from: number; to: number }
  | { type: "clear"; parentfield: string };

export interface DocStore {
  getDoc(): FrappeDoc;
  subscribe(listener: () => void): () => void;
  /** Field changes (after the snapshot is updated), in order. */
  onFieldChange(listener: (c: FieldChange) => void): () => void;
  onRowOperation(listener: (op: RowOperation) => void): () => void;
  /** `record`: push the change on the undo stack (user input). */
  setValue(fieldname: string, value: unknown, target?: RowRef, opts?: { skipDirty?: boolean; record?: boolean }): boolean;
  setValues(values: Record<string, unknown>, target?: RowRef, opts?: { skipDirty?: boolean }): void;
  getRows(parentfield: string): FrappeDoc[];
  getRow(target: RowRef): FrappeDoc | undefined;
  /** Append (no index) or insert at a 0-based position. `unedited` marks a grid-added row (Desk `__unedited`). */
  addRow(parentfield: string, opts?: { index?: number; values?: Record<string, unknown>; unedited?: boolean }): FrappeDoc;
  duplicateRow(parentfield: string, index: number): FrappeDoc;
  deleteRows(parentfield: string, indexes: number[]): FrappeDoc[];
  moveRow(parentfield: string, from: number, to: number): void;
  clearTable(parentfield: string): void;
  /** Replace all rows of a table (Desk `frm.set_value(table, [...])`). */
  setRows(parentfield: string, rows: Record<string, unknown>[]): void;
  replace(doc: FrappeDoc): void;
  markDirty(): void;
  isDirty(): boolean;
  isNew(): boolean;
  /** Undo the last recorded change; false when there is none ("Nothing left to undo"). */
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Drop the undo / redo stacks. */
  eraseHistory(): void;
}

const DUPLICATE_SKIP = new Set(["creation", "modified", "modified_by", "idx", "owner", "parent", "doctype", "name", "parentfield"]);
const renumber = (rows: FrappeDoc[]) => rows.map((r, i) => (r.idx === i + 1 ? r : { ...r, idx: i + 1 }));

export function createDocStore(bundle: MetaBundle, initial: FrappeDoc, ctx: DefaultsContext = {}): DocStore {
  let doc: FrappeDoc = { ...initial };
  const listeners = new Set<() => void>();
  const fieldListeners = new Set<(c: FieldChange) => void>();
  const rowListeners = new Set<(op: RowOperation) => void>();
  const fieldsOf = (doctype: string): Map<string, FrappeDocField> => {
    const meta = doctype === bundle.meta.name ? bundle.meta : bundle.children[doctype];
    return new Map((meta?.fields ?? []).map((f) => [f.fieldname, f]));
  };
  const parentFields = fieldsOf(bundle.meta.name);
  const childMetaOf = (parentfield: string) => {
    const df = parentFields.get(parentfield);
    const meta = df?.options ? bundle.children[df.options] : undefined;
    if (!df || !TABLE_TYPES.has(df.fieldtype) || !meta) throw new Error(`"${parentfield}" is not a table field of ${bundle.meta.name}`);
    return meta;
  };
  const emit = () => { for (const l of [...listeners]) l(); };
  const emitField = (c: FieldChange) => { for (const l of [...fieldListeners]) l(c); };
  const emitRow = (op: RowOperation) => { for (const l of [...rowListeners]) l(op); };
  let undoStack: HistoryEntry[] = [];
  let redoStack: HistoryEntry[] = [];
  const rowsOf = (pf: string) => (Array.isArray(doc[pf]) ? (doc[pf] as FrappeDoc[]) : []);
  const commitRows = (pf: string, rows: FrappeDoc[], dirty = true) => {
    doc = { ...doc, [pf]: renumber(rows), ...(dirty ? { __unsaved: 1 as const } : {}) };
  };

  const setOne = (fieldname: string, value: unknown, target: RowRef | undefined, skipDirty: boolean, changes: FieldChange[]) => {
    if (!target) {
      const prev = doc[fieldname];
      const ft = parentFields.get(fieldname)?.fieldtype;
      if (prev === value) {
        if (ft === "Link" || ft === "Dynamic Link") changes.push({ doctype: doc.doctype, name: doc.name, fieldname, value, previous: prev, unchanged: true });
        return false;
      }
      doc = { ...doc, [fieldname]: value, ...(skipDirty ? {} : { __unsaved: 1 as const }) };
      changes.push({ doctype: doc.doctype, name: doc.name, fieldname, value, previous: prev });
      return true;
    }
    const rows = rowsOf(target.parentfield);
    const i = rows.findIndex((r) => r.name === target.name);
    if (i < 0) return false;
    const row = rows[i];
    const prev = row[fieldname];
    const ft = fieldsOf(row.doctype).get(fieldname)?.fieldtype;
    if (prev === value) {
      if (ft === "Link" || ft === "Dynamic Link") changes.push({ doctype: row.doctype, name: row.name, fieldname, value, previous: prev, parentfield: target.parentfield, unchanged: true });
      return false;
    }
    const next: FrappeDoc = { ...row, [fieldname]: value };
    delete next.__unedited;
    const copy = [...rows];
    copy[i] = next;
    doc = { ...doc, [target.parentfield]: copy, ...(skipDirty ? {} : { __unsaved: 1 as const }) };
    changes.push({ doctype: row.doctype, name: row.name, fieldname, value, previous: prev, parentfield: target.parentfield });
    return true;
  };

  const store: DocStore = {
    getDoc: () => doc,
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l); }; },
    onFieldChange(l) { fieldListeners.add(l); return () => { fieldListeners.delete(l); }; },
    onRowOperation(l) { rowListeners.add(l); return () => { rowListeners.delete(l); }; },
    setValue(fieldname, value, target, opts = {}) {
      const changes: FieldChange[] = [];
      const changed = setOne(fieldname, value, target, !!opts.skipDirty, changes);
      // eslint-disable-next-line eqeqeq
      if (changed && opts.record && changes[0] && changes[0].previous != value) undoStack.push({ fieldname, target, oldValue: changes[0].previous, newValue: value });
      if (changed) emit();
      changes.forEach(emitField);
      return changed;
    },
    setValues(values, target, opts = {}) {
      const changes: FieldChange[] = [];
      let any = false;
      for (const [k, v] of Object.entries(values)) any = setOne(k, v, target, !!opts.skipDirty, changes) || any;
      if (any) emit();
      changes.forEach(emitField);
    },
    getRows: (pf) => rowsOf(pf),
    getRow: (t) => rowsOf(t.parentfield).find((r) => r.name === t.name),
    addRow(pf, opts = {}) {
      const meta = childMetaOf(pf);
      const row = newChildRow(meta, doc, pf, ctx, opts.values);
      if (opts.unedited) row.__unedited = true;
      const rows = [...rowsOf(pf)];
      const at = opts.index == null ? rows.length : Math.max(0, Math.min(rows.length, opts.index));
      rows.splice(at, 0, row);
      commitRows(pf, rows);
      const added = rowsOf(pf)[at];
      emit();
      emitRow({ type: "add", parentfield: pf, row: added });
      return added;
    },
    duplicateRow(pf, index) {
      const src = rowsOf(pf)[index];
      if (!src) throw new Error(`no row ${index} in ${pf}`);
      const values: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(src)) if (!DUPLICATE_SKIP.has(k) && !k.startsWith("__")) values[k] = Array.isArray(v) ? [...v] : v;
      return store.addRow(pf, { index: index + 1, values });
    },
    deleteRows(pf, indexes) {
      const set = new Set(indexes);
      const rows = rowsOf(pf);
      const removed = rows.filter((_, i) => set.has(i));
      if (!removed.length) return [];
      commitRows(pf, rows.filter((_, i) => !set.has(i)));
      emit();
      emitRow({ type: "remove", parentfield: pf, rows: removed });
      return removed;
    },
    moveRow(pf, from, to) {
      const rows = [...rowsOf(pf)];
      if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return;
      const [row] = rows.splice(from, 1);
      rows.splice(to, 0, row);
      commitRows(pf, rows);
      emit();
      emitRow({ type: "move", parentfield: pf, row: rowsOf(pf)[to], from, to });
    },
    clearTable(pf) {
      if (!rowsOf(pf).length) return;
      commitRows(pf, []);
      emit();
      emitRow({ type: "clear", parentfield: pf });
    },
    setRows(pf, values) {
      const meta = childMetaOf(pf);
      const rows = values.map((v) => newChildRow(meta, doc, pf, ctx, v));
      commitRows(pf, rows);
      emit();
    },
    replace(next) { doc = { ...next }; undoStack = []; redoStack = []; emit(); },
    markDirty() { if (!doc.__unsaved) { doc = { ...doc, __unsaved: 1 }; emit(); } },
    isDirty: () => !!doc.__unsaved,
    isNew: () => !!doc.__islocal,
    undo() { return step(undoStack, redoStack); },
    redo() { return step(redoStack, undoStack); },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    eraseHistory() { undoStack = []; redoStack = []; },
  };
  /** Apply the last entry of `from` (its old value) and push the reverse on `to` (undo_manager.js _apply_change). */
  function step(from: HistoryEntry[], to: HistoryEntry[]): boolean {
    const e = from.pop();
    if (!e) return false;
    if (e.target && !store.getRow(e.target)) return step(from, to); // the row is gone: skip it
    to.push({ ...e, oldValue: e.newValue, newValue: e.oldValue });
    store.setValue(e.fieldname, e.oldValue, e.target);
    return true;
  }
  return store;
}
