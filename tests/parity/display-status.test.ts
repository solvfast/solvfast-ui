/**
 * Display-status ladder — `frappe.perm.get_field_display_status` (apps/frappe/frappe/public/js/frappe/model/perm.js:191-265)
 * plus the control-level rule base_control.js:123-131 ("Read + empty value is hidden").
 * Contract: `usePermissions().fieldStatus(df, doc, parent?)` returns `FieldDisplayStatus` ("Write" | "Read" | "None").
 *
 * PENDING: A1 `usePermissions`. Skipped until the Lead wires `createPermissions` in ./seam.ts and flips describe.skip.
 * Cypress sources: depends_on.js (read-only / display), grid.js (toggle_display, toggle_enable), permissions.js.
 * Python: test_permissions.py::test_set_only_once (259).
 */
import { describe, expect, it } from "vitest";
import type { DocPerm, FrappeDoc, FrappeDocField } from "../../src/frappe/contract";
import { createPermissions, fieldOf, loadBundle, synthetic } from "./seam";

const ROLE = "SFUI Tester";
const perms = (...rows: Array<Partial<DocPerm> & { permlevel: number }>): DocPerm[] =>
  rows.map((r) => ({ role: ROLE, read: 1, ...r }));

/** Build a one-field DocType and ask for that field's status. */
function status(
  df: Partial<FrappeDocField>,
  doc: Partial<FrappeDoc> = {},
  rows: DocPerm[] = perms({ permlevel: 0, write: 1 }),
  docinfoPerms: Record<string, 0 | 1> = { read: 1, write: 1 },
) {
  const field: FrappeDocField = { fieldname: "f", fieldtype: "Data", ...df };
  const bundle = synthetic("SFUI Ladder", [field]);
  bundle.meta.permissions = rows;
  const fullDoc: FrappeDoc = { doctype: "SFUI Ladder", name: "L-1", docstatus: 0, ...doc };
  const api = createPermissions({
    bundle,
    doc: fullDoc,
    docinfo: { permissions: docinfoPerms },
    roles: [ROLE],
  });
  return api.fieldStatus(field, fullDoc);
}

describe.skip("display-status ladder (perm.js:191-265)", () => {
  describe("1. permission at the field's permlevel", () => {
    it("write + not disabled + not virtual -> Write", () => expect(status({})).toBe("Write"));
    it("write but df.disabled -> Read (the permlevel read right remains)", () => expect(status({ disabled: 1 })).toBe("Read"));
    it("write but is_virtual -> Read", () => expect(status({ is_virtual: 1 })).toBe("Read"));
    it("read only -> Read", () => expect(status({}, {}, perms({ permlevel: 0 }), { read: 1 })).toBe("Read"));
    it("no right at that permlevel -> None", () => {
      // field at permlevel 1, user only has level-0 rights
      expect(status({ permlevel: 1 }, {}, perms({ permlevel: 0, write: 1 }))).toBe("None");
    });
    it("permlevel 1 write granted by a permlevel-1 DocPerm row -> Write", () => {
      expect(status({ permlevel: 1 }, {}, perms({ permlevel: 0, write: 1 }, { permlevel: 1, write: 1 }))).toBe("Write");
    });
  });

  describe("2-3. hidden and hidden_due_to_dependency force None", () => {
    it("hidden", () => expect(status({ hidden: 1 })).toBe("None"));
    it("hidden_due_to_dependency", () => expect(status({ hidden_due_to_dependency: 1 })).toBe("None"));
    it("hidden beats read-only", () => expect(status({ hidden: 1, read_only: 1 })).toBe("None"));
  });

  describe("4. submitted / cancelled documents demote Write to Read", () => {
    it("docstatus 1", () => expect(status({}, { docstatus: 1 })).toBe("Read"));
    it("docstatus 2", () => expect(status({}, { docstatus: 2 })).toBe("Read"));
  });

  describe("5. allow_on_submit re-promotes only on docstatus 1 with permlevel write", () => {
    it("docstatus 1 + allow_on_submit + write -> Write", () => expect(status({ allow_on_submit: 1 }, { docstatus: 1 })).toBe("Write"));
    it("docstatus 2 + allow_on_submit stays Read (cancelled docs never re-open)", () =>
      expect(status({ allow_on_submit: 1 }, { docstatus: 2 })).toBe("Read"));
    it("docstatus 1 + allow_on_submit but only read at that permlevel -> Read", () =>
      expect(status({ allow_on_submit: 1 }, { docstatus: 1 }, perms({ permlevel: 0 }), { read: 1 })).toBe("Read"));
    it("a read_only allow_on_submit field is demoted again (rung 7 runs after rung 5)", () =>
      expect(status({ allow_on_submit: 1, read_only: 1 }, { docstatus: 1 })).toBe("Read"));
  });

  describe("6. workflow rung cannot raise Read", () => {
    // perm.js:239-250 reads the cur_frm global (state_fieldname, states.update_fields, read_only): it exists only inside an
    // open Desk form. The adapter needs a workflow context parameter before this can be written as an assertion.
    it.todo("a Read field that is the workflow state field, or in the current state's update_field, stays Read (never Write)");
    it.todo("form.read_only (workflow read-only for this user) keeps Read fields Read; it never downgrades Write on its own");
  });

  describe("7. read_only / Read Only fieldtype demote Write", () => {
    it("df.read_only", () => expect(status({ read_only: 1 })).toBe("Read"));
    it("fieldtype Read Only", () => expect(status({ fieldtype: "Read Only" })).toBe("Read"));
  });

  describe("8. set_only_once after the first save", () => {
    it("new (__islocal) doc stays Write", () => expect(status({ set_only_once: 1 }, { __islocal: 1 })).toBe("Write"));
    it("saved doc -> Read", () => expect(status({ set_only_once: 1 })).toBe("Read"));
  });

  describe("no perm object (dialogs / FieldGroup branch, perm.js:196-203)", () => {
    it.todo("hidden -> None, read_only/is_virtual -> Read, else Write — needs a perm-less call path in the adapter");
  });
});

describe.skip("real metadata: ToDo (tests/fixtures/real-15.110/todo.en.json)", () => {
  const todo = loadBundle("todo.en.json");
  const doc: FrappeDoc = { doctype: "ToDo", name: "abc", docstatus: 0, description: "x" };
  const writer = () =>
    createPermissions({ bundle: todo, doc, docinfo: { permissions: { read: 1, write: 1 } }, roles: ["System Manager"] });

  it("description (reqd Text Editor) is writable", () => expect(writer().fieldStatus(fieldOf(todo, "description"), doc)).toBe("Write"));
  it("assignment_rule is read_only=1 in the real meta -> Read", () =>
    expect(writer().fieldStatus(fieldOf(todo, "assignment_rule"), doc)).toBe("Read"));
  it("sender is hidden=1 in the real meta -> None", () => expect(writer().fieldStatus(fieldOf(todo, "sender"), doc)).toBe("None"));
  it("a reader (read only) gets Read on every visible field", () => {
    const reader = createPermissions({ bundle: todo, doc, docinfo: { permissions: { read: 1 } }, roles: ["Guest-like reader"] });
    expect(reader.fieldStatus(fieldOf(todo, "status"), doc)).toBe("Read");
    expect(reader.can("write")).toBe(false);
  });
});

describe.skip("control-level rule (base_control.js:123-131): Read + empty value is hidden", () => {
  // The contract's fieldStatus() is the ladder only. This rule belongs to the control; the controls' tests in A3's
  // tests/fields*.test.tsx own it. Recorded here so the review checks one of them covers it.
  it.todo("Read + null / undefined / '' / '   ' -> not rendered");
  it.todo("Read + 0 -> rendered (0 is a value)");
  it.todo("Read + empty is still rendered for HTML, Image, Button, Geolocation");
});
