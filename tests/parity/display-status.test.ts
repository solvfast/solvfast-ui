/**
 * Display-status ladder — `frappe.perm.get_field_display_status` (apps/frappe/frappe/public/js/frappe/model/perm.js:191-265)
 * plus the control-level rule base_control.js:123-131 ("Read + empty value is hidden").
 * Implementation under test (A1): src/frappe/services/permissions.ts `fieldDisplayStatus`, `controlDisplayStatus`,
 * `buildDocPermissions`, and the `usePermissions` hook.
 * Cypress sources: depends_on.js, grid.js (toggle_display, toggle_enable), permissions.js.
 * Python: test_permissions.py::test_set_only_once (259).
 */
import { describe, expect, it } from "vitest";
import type { DocPermissions, FrappeDoc, FrappeDocField } from "../../src/frappe/contract";
import { buildDocPermissions, controlDisplayStatus, fieldDisplayStatus, isFetchLocked } from "../../src/frappe/services/permissions";
import { fieldOf, loadBundle } from "./seam";

const W: DocPermissions = [{ read: true, write: true }];
const R: DocPermissions = [{ read: true }];
const status = (df: Partial<FrappeDocField>, doc: Partial<FrappeDoc> = {}, perm: DocPermissions | undefined = W) =>
  fieldDisplayStatus({ fieldname: "f", fieldtype: "Data", ...df }, { doctype: "X", name: "x", docstatus: 0, ...doc }, perm);

describe("display-status ladder (perm.js:191-265)", () => {
  describe("1. permission at the field's permlevel", () => {
    it("write + not disabled + not virtual -> Write", () => expect(status({})).toBe("Write"));
    it("write but df.disabled -> Read", () => expect(status({ disabled: 1 })).toBe("Read"));
    it("write but is_virtual -> Read", () => expect(status({ is_virtual: 1 })).toBe("Read"));
    it("read only -> Read", () => expect(status({}, {}, R)).toBe("Read"));
    it("no right at that permlevel -> None", () => expect(status({ permlevel: 1 })).toBe("None"));
    it("permlevel 1 write -> Write", () => expect(status({ permlevel: 1 }, {}, [{ read: true, write: true }, { read: true, write: true }])).toBe("Write"));
    it("permlevel 1 read only -> Read", () => expect(status({ permlevel: 1 }, {}, [{ read: true, write: true }, { read: true }])).toBe("Read"));
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
    it("docstatus 2 + allow_on_submit stays Read", () => expect(status({ allow_on_submit: 1 }, { docstatus: 2 })).toBe("Read"));
    it("docstatus 1 + allow_on_submit but read only -> Read", () => expect(status({ allow_on_submit: 1 }, { docstatus: 1 }, R)).toBe("Read"));
    it("a read_only allow_on_submit field is demoted again (rung 7 runs after rung 5)", () =>
      expect(status({ allow_on_submit: 1, read_only: 1 }, { docstatus: 1 })).toBe("Read"));
  });
  describe("6. workflow rung (perm.js:239-250) can only re-assert Read", () => {
    it("is a no-op: a Read workflow-state field stays Read, a Write one is not changed by this rung", () => {
      expect(status({ fieldname: "workflow_state" }, { docstatus: 1 })).toBe("Read");
      expect(status({ fieldname: "workflow_state" }, { docstatus: 0 })).toBe("Write");
    });
  });
  describe("7. read_only / Read Only fieldtype demote Write", () => {
    it("df.read_only", () => expect(status({ read_only: 1 })).toBe("Read"));
    it("fieldtype Read Only", () => expect(status({ fieldtype: "Read Only" })).toBe("Read"));
  });
  describe("8. set_only_once after the first save", () => {
    it("new (__islocal) doc stays Write", () => expect(status({ set_only_once: 1 }, { __islocal: 1 })).toBe("Write"));
    it("saved doc -> Read", () => expect(status({ set_only_once: 1 })).toBe("Read"));
  });
  describe("no perm object (dialogs, perm.js:196-203)", () => {
    it("hidden -> None", () => expect(status({ hidden: 1 }, {}, undefined)).toBe("None"));
    it("hidden_due_to_dependency -> None", () => expect(status({ hidden_due_to_dependency: 1 }, {}, undefined)).toBe("None"));
    it("read_only / is_virtual -> Read", () => {
      expect(status({ read_only: 1 }, {}, undefined)).toBe("Read");
      expect(status({ is_virtual: 1 }, {}, undefined)).toBe("Read");
    });
    it("else Write", () => expect(status({}, {}, undefined)).toBe("Write"));
  });
});

describe("control-level rule (base_control.js:123-131): Read + empty value is hidden", () => {
  const df = (fieldtype = "Data"): FrappeDocField => ({ fieldname: "f", fieldtype });
  it("Read + null / undefined / '' / '   ' -> None", () => {
    for (const v of [null, undefined, "", "   "]) expect(controlDisplayStatus("Read", df(), v), String(v)).toBe("None");
  });
  it("Read + 0 -> Read (0 is a value)", () => expect(controlDisplayStatus("Read", df("Int"), 0)).toBe("Read"));
  it("HTML, Image, Button, Geolocation stay Read when empty", () => {
    for (const t of ["HTML", "Image", "Button", "Geolocation"]) expect(controlDisplayStatus("Read", df(t), null), t).toBe("Read");
  });
  it("Write is never hidden for being empty", () => expect(controlDisplayStatus("Write", df(), "")).toBe("Write"));
  it("a Write cell of a Read grid becomes Read (base_control.js:105-115)", () => expect(controlDisplayStatus("Write", df(), "x", { gridStatus: "Read", gridCell: true })).toBe("Read"));
});

describe("fetch_from lock (base_input.js:56-62)", () => {
  const df: FrappeDocField = { fieldname: "contact_email", fieldtype: "Data", fetch_from: "contact.email_id" };
  it("locked while the source link has a value", () => expect(isFetchLocked(df, { doctype: "X", name: "x", contact: "C-1" })).toBe(true));
  it("not locked when the link is empty", () => expect(isFetchLocked(df, { doctype: "X", name: "x" })).toBe(false));
  it("not locked with fetch_if_empty", () => expect(isFetchLocked({ ...df, fetch_if_empty: 1 }, { doctype: "X", name: "x", contact: "C-1" })).toBe(false));
});

describe("real metadata: ToDo (tests/fixtures/real-15.110/todo.en.json)", () => {
  const todo = loadBundle("todo.en.json");
  const doc: FrappeDoc = { doctype: "ToDo", name: "abc", docstatus: 0, description: "x", owner: "a@example.com" };
  const levels = buildDocPermissions({ meta: todo.meta, children: todo.children, doc, docinfo: { permissions: { read: 1, write: 1 } } as never, session: { user: "a@example.com", roles: ["System Manager"] } });
  it("description (reqd Text Editor) is writable", () => expect(fieldDisplayStatus(fieldOf(todo, "description"), doc, levels)).toBe("Write"));
  it("assignment_rule is read_only=1 in the real meta -> Read", () => expect(fieldDisplayStatus(fieldOf(todo, "assignment_rule"), doc, levels)).toBe("Read"));
  it("sender is hidden=1 in the real meta -> None", () => expect(fieldDisplayStatus(fieldOf(todo, "sender"), doc, levels)).toBe("None"));
  it("a read-only user gets Read on visible fields and cannot write", () => {
    const ro = buildDocPermissions({ meta: todo.meta, children: todo.children, doc, docinfo: { permissions: { read: 1 } } as never, session: { user: "b@example.com", roles: ["ToDo-less role"] } });
    expect(fieldDisplayStatus(fieldOf(todo, "status"), doc, ro)).toBe("None");
  });
  it("owner-less approximation without roles: docinfo.permissions alone decides (docs 10 C6 §3)", () => {
    const l = buildDocPermissions({ meta: todo.meta, children: todo.children, doc, docinfo: { permissions: { read: 1 } } as never });
    expect(l[0].write).toBeFalsy();
    expect(fieldDisplayStatus(fieldOf(todo, "status"), doc, l)).toBe("Read");
  });
});
