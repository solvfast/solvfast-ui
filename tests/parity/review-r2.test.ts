/**
 * Review R2 (0.4.0-dev.16): confirmation of the R1 closures and regressions found. See docs/qa/review-r2.md.
 * `it.fails` = native expectation for a gap that still exists; flip to `it` when fixed.
 */
import { describe, expect, it } from "vitest";
import type { FrappeDoc } from "../../src/frappe/contract";
import { amendDoc, copyDoc } from "../../src/frappe/form/model/copy";
import { compileExpression, DEFAULT_HELPERS } from "../../src/frappe/form/model/expression";
import { gridColumns } from "../../src/frappe/form/FrappeChildTable";
import { synthetic } from "./seam";

const bundle = synthetic(
  "SFUI Inv",
  [
    { fieldname: "title", fieldtype: "Data" },
    { fieldname: "secret", fieldtype: "Password" },
    { fieldname: "ref", fieldtype: "Data", no_copy: 1 },
    { fieldname: "amended_from", fieldtype: "Link", options: "SFUI Inv", no_copy: 1 },
    { fieldname: "amendment_date", fieldtype: "Date" },
    { fieldname: "items", fieldtype: "Table", options: "SFUI Inv Item" },
  ],
  { "SFUI Inv Item": [{ fieldname: "code", fieldtype: "Data" }, { fieldname: "lvl", fieldtype: "Data", permlevel: 1, in_list_view: 1 }, { fieldname: "qty", fieldtype: "Int", in_list_view: 1 }] },
);
const cancelled: FrappeDoc = {
  doctype: "SFUI Inv", name: "INV-1", docstatus: 2, title: "T", secret: "***", ref: "R", owner: "a@example.com", creation: "2026-01-01 10:00:00.000000",
  _assign: '["u@example.com"]', _comments: '[{"comment":"x"}]', _liked_by: '["u@example.com"]', _user_tags: ",x",
  items: [{ doctype: "SFUI Inv Item", name: "r1", idx: 1, parent: "INV-1", parenttype: "SFUI Inv", parentfield: "items", code: "A", qty: 2 }],
};

describe("R1-F5 closure: copy_doc / amend_doc (create_new.js:281-330, form.js:1011-1034)", () => {
  it("duplicate skips name, amended_from, Password and no_copy fields; rows become new local rows", () => {
    const c = copyDoc(bundle, cancelled, { user: "me@example.com" });
    expect(c).toMatchObject({ __islocal: 1, docstatus: 0, title: "T", owner: "me@example.com" });
    expect(c.name).toMatch(/^new-sfui-inv-/);
    expect(c.secret).toBeUndefined();
    expect(c.ref).toBeUndefined();
    const row = (c.items as FrappeDoc[])[0];
    expect(row).toMatchObject({ __islocal: 1, code: "A", qty: 2, parent: c.name, idx: 1 });
    expect(row.name).not.toBe("r1");
  });
  it("amend keeps no_copy fields (from_amend) and sets amended_from", () => {
    const a = amendDoc(bundle, cancelled, { user: "me@example.com" });
    expect(a).toMatchObject({ ref: "R", amended_from: "INV-1", docstatus: 0, __islocal: 1 });
  });

  // R2-F1. Native copies only keys that have a DocField (`df && ...`, create_new.js:303-308). `_assign`, `_comments`,
  // `_liked_by`, `_user_tags` are not DocFields, so the amended document must NOT inherit the old one's assignees / comment cache.
  it("amend does not copy _assign / _comments / _liked_by / _user_tags", () => {
    const a = amendDoc(bundle, cancelled);
    for (const k of ["_assign", "_comments", "_liked_by", "_user_tags"]) expect(a[k], k).toBeUndefined();
  });
  // R2-F2. form.js:1021-1023 sets amendment_date to today when the field exists.
  it("amend sets amendment_date to today when the DocType has the field", () => {
    const a = amendDoc(bundle, cancelled);
    expect(a.amendment_date).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe("R1-F6 closure: evaluator accepts `;`, Boolean(), `in`", () => {
  const run = (src: string, doc: Record<string, unknown>) => {
    const c = compileExpression(src, "interpreter");
    if (!c.ok) throw new Error(c.reason);
    return c.run({ ...DEFAULT_HELPERS, doc, parent: doc });
  };
  it("trailing semicolon", () => expect(run(" !doc.a && doc.b;", { a: 0, b: 5 })).toBe(5));
  it("Boolean(...)", () => expect(run("Boolean(doc.creation)", { creation: "x" })).toBe(true));
  it("`in` on an object", () => expect(run("'a' in doc", { a: 1 })).toBe(true));
  it("a semicolon inside a string is not stripped", () => expect(run("doc.a == 'x;'", { a: "x;" })).toBe(true));
  it("still unsupported (reported, not guessed): frappe.boot, arrow functions, bitwise &", () => {
    for (const s of ["!frappe.boot.developer_mode", "doc.items.every((i) => !i.x)", "doc.a == 1 & doc.b != 1"]) expect(compileExpression(s, "interpreter").ok, s).toBe(false);
  });
});

describe("R1-F8 closure: grid columns respect the permlevel read right (grid.js:1015-1021)", () => {
  const child = bundle.children["SFUI Inv Item"];
  it("without a form there is no filter (standalone grid)", () => expect(gridColumns(child).map((c) => c.df.fieldname)).toEqual(["lvl", "qty"]));
  it("in a form an unreadable permlevel column is dropped BEFORE the width budget is spent", () =>
    expect(gridColumns(child, (f) => (f.permlevel ?? 0) === 0).map((c) => c.df.fieldname)).toEqual(["qty"]));
});
