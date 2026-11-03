/**
 * Review R1 (0.4.0-dev.10): the forms layer against docs/qa/parity-checklists.md. See docs/qa/review-r1.md.
 * Passing tests are regression pins of native behaviour the implementation already honours.
 * `it.fails` tests state the NATIVE expectation for a confirmed gap; flip to `it` when the gap is fixed.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FrappeDoc } from "../../src/frappe/contract";
import { compileExpression, DEFAULT_HELPERS } from "../../src/frappe/form/model/expression";
import { formActions, type ActionInput } from "../../src/frappe/form/model/actions";
import { createDocStore } from "../../src/frappe/form/model/docStore";
import { buildFetchMap, fetchUpdates } from "../../src/frappe/form/model/fetch";
import { checkMandatory } from "../../src/frappe/form/model/mandatory";
import { buildLayout } from "../../src/frappe/form/model/layout";
import { newDoc } from "../../src/frappe/form/model/defaults";
import { synthetic } from "./seam";

const here = dirname(fileURLToPath(import.meta.url));

// ---- evidence: the interpreter vs Desk's `new Function` on every eval: expression of Frappe core ----------------------
describe("D-23 interpreter vs Desk (layout.js:751-791 / utils.js:1076) on Frappe core's real expressions", () => {
  const exprs = JSON.parse(readFileSync(join(here, "frappe-core-eval-expressions.json"), "utf8")) as string[];
  const VALS: unknown[] = [0, 1, "", "Yes", "Customer", null, undefined, "a", 2, true, false, [], [1], "Company", "Draft"];
  const mk = (seed: number, e: string) => {
    const o: Record<string, unknown> = { __islocal: seed % 2, docstatus: seed % 3 };
    for (const m of e.matchAll(/(?:doc|parent)\??\.([A-Za-z_]\w*)/g)) { let h = seed; for (const c of m[1]) h = (h * 31 + c.charCodeAt(0)) >>> 0; o[m[1]] = VALS[h % VALS.length]; }
    return o;
  };

  it("has 270 expressions to compare", () => expect(exprs.length).toBeGreaterThan(250));

  it("every expression the interpreter accepts returns what `new Function` returns (6 seeded documents each)", () => {
    const bad: string[] = [];
    for (const e of exprs) {
      const c = compileExpression(e, "interpreter");
      if (!c.ok) continue;
      const fn = new Function("doc", "parent", "in_list", "cint", "flt", "cstr", "is_null", `let out = ${e}; return out`);
      for (let seed = 0; seed < 6; seed++) {
        const d = mk(seed, e), p = mk(seed + 7, e);
        let a: unknown, b: unknown, ea = false, eb = false;
        try { a = c.run({ ...DEFAULT_HELPERS, doc: d, parent: p }); } catch { ea = true; }
        try { b = fn(d, p, DEFAULT_HELPERS.in_list, DEFAULT_HELPERS.cint, DEFAULT_HELPERS.flt, DEFAULT_HELPERS.cstr, DEFAULT_HELPERS.is_null); } catch { eb = true; }
        if (ea !== eb || (!ea && JSON.stringify(a) !== JSON.stringify(b))) { bad.push(e); break; }
      }
    }
    expect(bad).toEqual([]);
  });

  // R1-F6: Desk compiles `let out = <code>; return out`, so a trailing ";" is valid. 37 of the 947 eval: expressions in the
  // installed apps end with one (e.g. "eval: !doc.percentage_based && doc.auto_rate;"); the interpreter reports them unsupported.
  it("accepts a trailing semicolon like `let out = <code>; return out`", () => {
    const c = compileExpression(" !doc.percentage_based && doc.auto_rate;", "interpreter");
    expect(c.ok).toBe(true);
  });
});

// ---- primary actions (toolbar.js:593,668-699; docs 11 §7) ------------------------------------------------------------------
describe("F-09/W-04 action matrix (formActions)", () => {
  const base: ActionInput = { docstatus: 0, isNew: false, dirty: false, isSubmittable: true, perms: { write: true, create: true, submit: true, cancel: true, amend: true } };
  const run = (o: Partial<ActionInput>) => formActions({ ...base, ...o });
  it("new document: Save", () => expect(run({ isNew: true, dirty: true }).primary).toBe("Save"));
  it("saved clean submittable draft with submit right: Submit", () => expect(run({}).primary).toBe("Submit"));
  it("saved dirty submittable draft: Save", () => expect(run({ dirty: true }).primary).toBe("Save"));
  it("non-submittable draft: Save even when clean", () => expect(run({ isSubmittable: false }).primary).toBe("Save"));
  it("no submit right: clean draft keeps Save", () => expect(run({ perms: { write: true } }).primary).toBe("Save"));
  it("no write right: nothing to press", () => expect(run({ perms: {}, dirty: true }).primary).toBeNull());
  it("submitted: Cancel is SECONDARY; Update only when dirty and submit right", () => {
    expect(run({ docstatus: 1 })).toMatchObject({ primary: null, secondary: "Cancel" });
    expect(run({ docstatus: 1, dirty: true })).toMatchObject({ primary: "Update", secondary: "Cancel" });
    expect(run({ docstatus: 1, dirty: true, perms: { cancel: true } }).primary).toBeNull();
  });
  it("cancelled: Amend, disabled when already amended", () => {
    expect(run({ docstatus: 2 })).toMatchObject({ primary: "Amend", primaryDisabled: false });
    expect(run({ docstatus: 2, alreadyAmended: true }).primaryDisabled).toBe(true);
  });
  it("workflow: no Submit; Save only when dirty; Cancel only if can_cancel_document", () => {
    expect(run({ hasWorkflow: true }).primary).toBeNull();
    expect(run({ hasWorkflow: true, dirty: true }).primary).toBe("Save");
    expect(run({ docstatus: 1, hasWorkflow: true, canCancelWithWorkflow: false }).secondary).toBeNull();
  });
  it("workflow actions shown and clean: both buttons are replaced", () => expect(run({ hasWorkflow: true, workflowActionsShown: true })).toMatchObject({ primary: null, secondary: null }));
});

// ---- rows (docs 12 §5.3, §5.6, §5.9; base_document.py:618-620) ---------------------------------------------------------
describe("C-06 child rows in the docStore", () => {
  const bundle = synthetic("SFUI P", [{ fieldname: "title", fieldtype: "Data" }, { fieldname: "items", fieldtype: "Table", options: "SFUI C" }], {
    "SFUI C": [{ fieldname: "item_code", fieldtype: "Data", reqd: 1 }, { fieldname: "qty", fieldtype: "Int", default: "1" }],
  });
  const store = () => createDocStore(bundle, { doctype: "SFUI P", name: "P-1", items: [] });
  it("a new row is local (never an invented name without __islocal) with parent links and defaults", () => {
    const s = store();
    const r = s.addRow("items");
    expect(r).toMatchObject({ __islocal: 1, parent: "P-1", parenttype: "SFUI P", parentfield: "items", doctype: "SFUI C", idx: 1, qty: 1 });
    expect(r.name).toMatch(/^new-sfui-c-[a-z0-9]{10}$/);
  });
  it("idx stays 1..n after insert, delete and move", () => {
    const s = store();
    for (let i = 0; i < 4; i++) s.addRow("items", { values: { item_code: `I${i}` } });
    s.addRow("items", { index: 0, values: { item_code: "first" } });
    s.deleteRows("items", [2]);
    s.moveRow("items", 0, 3);
    expect(s.getRows("items").map((r) => r.idx)).toEqual([1, 2, 3, 4]);
    expect(s.getRows("items").map((r) => r.item_code)).toEqual(["I0", "I2", "I3", "first"]);
  });
  it("duplicate copies values but not name/idx/owner/creation (grid.js:957-977)", () => {
    const s = store();
    s.addRow("items", { values: { item_code: "A", qty: 5 } });
    const d = s.duplicateRow("items", 0);
    expect(d).toMatchObject({ item_code: "A", qty: 5, idx: 2, __islocal: 1 });
    expect(d.name).not.toBe(s.getRows("items")[0].name);
  });
  it("setting an equal value is a no-op and does not dirty the form (model.js:558)", () => {
    const s = createDocStore(bundle, { doctype: "SFUI P", name: "P-1", title: "x", items: [] });
    expect(s.setValue("title", "x")).toBe(false);
    expect(s.isDirty()).toBe(false);
    expect(s.setValue("title", "y")).toBe(true);
    expect(s.getDoc().__unsaved).toBe(1);
  });
  it("replace() with the server document drops __unsaved/__islocal and gives rows their real names", () => {
    const s = store();
    s.addRow("items", { values: { item_code: "A" } });
    s.replace({ doctype: "SFUI P", name: "P-1", items: [{ doctype: "SFUI C", name: "abc123", idx: 1, item_code: "A" }] } as FrappeDoc);
    expect(s.isDirty()).toBe(false);
    expect(s.getRows("items")[0].name).toBe("abc123");
  });
});

describe("F-01/F-11 layout and new documents", () => {
  it("a Tab Break meta gets an inserted Details tab when its first field is not a Tab Break", () => {
    const b = synthetic("SFUI L", [{ fieldname: "a", fieldtype: "Data" }, { fieldname: "t2", fieldtype: "Tab Break", label: "Two" }, { fieldname: "b", fieldtype: "Data" }]);
    const l = buildLayout(b.meta);
    expect(l.tabs.map((t) => t.details ?? false)).toEqual([true, false]);
  });
  it("newDoc: __islocal, docstatus 0, Select first option, Check default cint", () => {
    const b = synthetic("SFUI N", [{ fieldname: "s", fieldtype: "Select", options: "A\nB" }, { fieldname: "c", fieldtype: "Check", default: "1" }]);
    expect(newDoc(b, { user: "u@example.com" })).toMatchObject({ __islocal: 1, docstatus: 0, s: "A", c: 1, owner: "u@example.com" });
  });
});

// ---- confirmed gaps -------------------------------------------------------------------------------------------------------

describe("R1 gaps (native expectation, currently failing)", () => {
  // R1-F2, F-06: save.js `if (rows.length === te.total_rows)` is tested BEFORE the single-row case, so a one-row table with
  // the column missing reads "in every row". model/mandatory.ts:126 requires rows.length > 1.
  it.fails("F-06: one row, column missing -> 'in every row' (save.js, rows.length === total_rows first)", () => {
    const b = synthetic("SFUI O", [{ fieldname: "items", fieldtype: "Table", label: "Items", options: "SFUI OI" }], { "SFUI OI": [{ fieldname: "code", fieldtype: "Data", label: "Code", reqd: 1 }] });
    const r = checkMandatory(b, { doctype: "SFUI O", name: "o", items: [{ doctype: "SFUI OI", name: "r1", idx: 1 }] } as FrappeDoc);
    expect(r.lines[0]).toMatchObject({ kind: "every" });
  });

  // R1-F3, C-02/F-10: link.js:709-765. A typed value that does not exist is cleared AND the empty link clears every fetch
  // target (link.js:761-764, the cleared value re-validates as empty). fetchUpdates() only returns {link: null}, and the form's
  // handler then deletes the link key (FrappeFormView.tsx:305), so stale fetched values stay.
  it("C-02: validate_link answering name:null leaves no stale fetch targets", () => {
    const b = synthetic("SFUI F", [
      { fieldname: "contact", fieldtype: "Link", options: "SFUI Contact" },
      { fieldname: "contact_email", fieldtype: "Data", fetch_from: "contact.email_id", read_only: 1 },
    ]);
    const entries = buildFetchMap(b.meta).get("contact")!;
    const updates = fetchUpdates(entries, "contact", { name: null, values: {} });
    delete updates.contact; // what FrappeFormView does with the result
    expect(updates).toEqual({ contact_email: "" });
  });
});
