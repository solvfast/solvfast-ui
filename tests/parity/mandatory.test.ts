/**
 * Client mandatory check — `frappe.ui.form.check_mandatory` (apps/frappe/frappe/public/js/frappe/form/save.js:120-298).
 * Cypress: depends_on.js "should set the field as mandatory depending on other fields value" (asserts the
 * "Missing Fields" dialog), form_tab_break.js (tab switch on validation error), control_attach.js.
 * Python (server side, static `reqd` only): test_document.py::test_mandatory (document.py:946-967).
 *
 * PENDING: A3 `checkMandatory` (./seam.ts). Skipped until wired.
 */
import { describe, expect, it } from "vitest";
import type { FrappeDoc, FrappeDocField } from "../../src/frappe/contract";
import { checkMandatory, fieldOf, loadBundle, synthetic } from "./seam";

const TITLE = "Missing Fields";

describe.skip("checkMandatory — parent fields", () => {
  const todo = loadBundle("todo.en.json"); // description: Text Editor, reqd=1 (real meta)
  const run = (o: Record<string, unknown>) => checkMandatory(todo, { doctype: "ToDo", name: "new-todo-1", __islocal: 1, docstatus: 0, ...o });

  it("real meta: ToDo.description is the only reqd field", () => {
    expect(todo.meta.fields.filter((f) => f.reqd).map((f) => f.fieldname)).toEqual(["description"]);
  });
  it("missing value -> not ok, title 'Missing Fields', one line", () => {
    const r = run({});
    expect(r.ok).toBe(false);
    expect(r.title).toBe(TITLE);
    expect(r.lines).toEqual(["Description is required."]);
    expect(r.firstFieldname).toBe("description");
  });
  it("null, undefined and blank-only strings are empty", () => {
    for (const v of [null, undefined, "", "   ", "\n\t"]) expect(run({ description: v }).ok).toBe(false);
  });
  it("a value passes", () => expect(run({ description: "<p>x</p>" }).ok).toBe(true));
  it("0 counts as a value (model.has_value)", () => {
    const b = synthetic("SFUI Num", [{ fieldname: "qty", fieldtype: "Int", label: "Qty", reqd: 1 }]);
    expect(checkMandatory(b, { doctype: "SFUI Num", name: "n", qty: 0 }).ok).toBe(true);
  });
  it("docstatus 2 skips the check entirely (cancelled docs, save.js:109)", () => {
    expect(run({ docstatus: 2 }).ok).toBe(true);
  });
  it("hidden fields with a static reqd ARE still checked (no display-status filter, save.js:118-160)", () => {
    const b = synthetic("SFUI Hidden", [{ fieldname: "secret", fieldtype: "Data", label: "Secret", reqd: 1, hidden: 1 }]);
    expect(checkMandatory(b, { doctype: "SFUI Hidden", name: "h" }).lines).toEqual(["Secret is required."]);
  });
  it("Prompt autoname on a new doc without __newname reports 'Name' first (save.js:132-135)", () => {
    const b = synthetic("SFUI Prompt", [{ fieldname: "title", fieldtype: "Data", label: "Title", reqd: 1 }]);
    b.meta.autoname = "Prompt";
    expect(checkMandatory(b, { doctype: "SFUI Prompt", name: "new-1", __islocal: 1 }).lines).toEqual(["Name is required.", "Title is required."]);
  });
  it("uses the translated label when a translation exists (__(df.label, null, df.parent))", () => {
    const b = synthetic("SFUI T", [{ fieldname: "f", fieldtype: "Data", label: "Subject", reqd: 1 }]);
    b.meta.__messages = { Subject: "الموضوع" };
    expect(checkMandatory(b, { doctype: "SFUI T", name: "t" }).lines[0]).toContain("الموضوع");
  });
});

describe.skip("checkMandatory — mandatory_depends_on (client only; the server ignores it)", () => {
  const dep = "eval:doc.test_field=='Some Value'";
  const b = synthetic("Test Depends On", [
    { fieldname: "test_field", fieldtype: "Data", label: "Test Field" },
    { fieldname: "dependant_field", fieldtype: "Data", label: "Dependant Field", mandatory_depends_on: dep },
  ]);
  const doc = (o: Record<string, unknown>): FrappeDoc => ({ doctype: "Test Depends On", name: "t", ...o });

  it("condition true and empty -> Missing Fields (depends_on.js)", () => {
    const r = checkMandatory(b, doc({ test_field: "Some Value" }));
    expect(r.ok).toBe(false);
    expect(r.lines).toEqual(["Dependant Field is required."]);
  });
  it("condition false -> passes (depends_on.js: 'Random value')", () => expect(checkMandatory(b, doc({ test_field: "Random value" })).ok).toBe(true));
  it("a static reqd field whose mandatory_depends_on is false is NOT checked (the dependency replaces reqd)", () => {
    const c = synthetic("SFUI Both", [
      { fieldname: "a", fieldtype: "Data" },
      { fieldname: "b", fieldtype: "Data", label: "B", reqd: 1, mandatory_depends_on: "eval:doc.a=='x'" },
    ]);
    expect(checkMandatory(c, { doctype: "SFUI Both", name: "b", a: "y" }).ok).toBe(true);
  });
  it("an invalid expression throws instead of silently passing (save.js:281-283)", () => {
    const c = synthetic("SFUI Bad", [{ fieldname: "b", fieldtype: "Data", mandatory_depends_on: "eval:doc.(" }]);
    expect(() => checkMandatory(c, { doctype: "SFUI Bad", name: "b" })).toThrow();
  });
});

describe.skip("checkMandatory — child tables (message grouping, save.js:160-246)", () => {
  const item: FrappeDocField[] = [
    { fieldname: "item_code", fieldtype: "Data", label: "Item Code", reqd: 1 },
    { fieldname: "qty", fieldtype: "Int", label: "Qty", reqd: 1 },
  ];
  const b = synthetic("SFUI Order", [{ fieldname: "items", fieldtype: "Table", label: "Items", options: "SFUI Order Item" }], {
    "SFUI Order Item": item,
  });
  const rows = (n: number, filled: (i: number) => Record<string, unknown>): FrappeDoc[] =>
    Array.from({ length: n }, (_, i) => ({ doctype: "SFUI Order Item", name: `r${i + 1}`, idx: i + 1, parent: "O-1", parentfield: "items", ...filled(i + 1) }));
  const order = (items: FrappeDoc[]): FrappeDoc => ({ doctype: "SFUI Order", name: "O-1", items });

  it("every row misses it -> 'In Items, Item Code is required in every row.'", () => {
    const r = checkMandatory(b, order(rows(3, () => ({ qty: 1 }))));
    expect(r.lines).toEqual(["In Items, Item Code is required in every row."]);
  });
  it("one row -> 'in row N.'", () => {
    const r = checkMandatory(b, order(rows(3, (i) => ({ item_code: i === 2 ? "" : "A", qty: 1 }))));
    expect(r.lines).toEqual(["In Items, Item Code is required in row 2."]);
  });
  it("several rows -> consecutive rows collapse to ranges, joined by comma_and: 'rows 1 and 3-4'", () => {
    const r = checkMandatory(b, order(rows(5, (i) => ({ item_code: [1, 3, 4].includes(i) ? "" : "A", qty: 1 }))));
    expect(r.lines).toEqual(["In Items, Item Code is required in rows 1 and 3-4."]);
  });
  it("three ranges -> 'rows 1, 3-4 and 6' (utils.js:408-419: commas, then ' and ' before the last)", () => {
    const r = checkMandatory(b, order(rows(7, (i) => ({ item_code: [1, 3, 4, 6].includes(i) ? "" : "A", qty: 1 }))));
    expect(r.lines).toEqual(["In Items, Item Code is required in rows 1, 3-4 and 6."]);
  });
  it("more than 10 ranges -> 'in N rows.'", () => {
    const r = checkMandatory(b, order(rows(30, (i) => ({ item_code: i % 2 ? "" : "A", qty: 1 }))));
    expect(r.lines).toEqual(["In Items, Item Code is required in 15 rows."]);
  });
  it("two columns -> one line per column; parent lines come first", () => {
    const p = synthetic(
      "SFUI Order2",
      [
        { fieldname: "customer", fieldtype: "Data", label: "Customer", reqd: 1 },
        { fieldname: "items", fieldtype: "Table", label: "Items", options: "SFUI Order Item" },
      ],
      { "SFUI Order Item": item },
    );
    const doc: FrappeDoc = { doctype: "SFUI Order2", name: "O", items: rows(2, () => ({})) };
    expect(checkMandatory(p, doc).lines).toEqual([
      "Customer is required.",
      "In Items, Item Code is required in every row.",
      "In Items, Qty is required in every row.",
    ]);
  });
  it("an EMPTY reqd Table is reported as missing (has_value counts rows)", () => {
    const t = synthetic("SFUI Req", [{ fieldname: "items", fieldtype: "Table", label: "Items", options: "SFUI Order Item", reqd: 1 }], { "SFUI Order Item": item });
    expect(checkMandatory(t, { doctype: "SFUI Req", name: "r", items: [] }).lines).toEqual(["Items is required."]);
  });
  it("empty rows are NOT dropped client-side (no remove_empty step in 15.110): they are checked like any row", () => {
    expect(checkMandatory(b, order(rows(1, () => ({})))).ok).toBe(false);
  });
  it("row-level mandatory_depends_on uses doc = row, parent = form", () => {
    const c = synthetic("SFUI Ord3", [{ fieldname: "kind", fieldtype: "Data" }, { fieldname: "items", fieldtype: "Table", label: "Items", options: "SFUI Order Item" }], {
      "SFUI Order Item": [{ fieldname: "note", fieldtype: "Data", label: "Note", mandatory_depends_on: "eval:parent.kind=='special' && doc.idx > 1" }],
    });
    const doc: FrappeDoc = { doctype: "SFUI Ord3", name: "x", kind: "special", items: rows(2, () => ({})) };
    expect(checkMandatory(c, doc).lines).toEqual(["In Items, Note is required in row 2."]);
  });
});

describe("sanity (runs now)", () => {
  it("the real ToDo meta has the field the tests above use", () => {
    expect(fieldOf(loadBundle("todo.en.json"), "description").reqd).toBe(1);
  });
});
