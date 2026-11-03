/** R1 P2 fixes: F1 default link triggers, F6 expression gaps, F8 grid permlevel columns. (F3 is flipped in tests/parity/review-r1.test.ts.) Simulated backend only. */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEn from "./fixtures/real-15.110/user.en.json";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import type { DocPerm, DocTypeMeta } from "../src/frappe/contract";
import { createFixtureTransport } from "../src/frappe/testing";
import { FrappeForm, gridColumns } from "../src/frappe/form";
import { compileExpression, DEFAULT_HELPERS } from "../src/frappe/form/model/expression";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const docsOf = (x: unknown) => (x as { docs: DocTypeMeta[] }).docs;
const PERMS: DocPerm[] = [{ role: "Sales User", permlevel: 0, read: 1, write: 1, create: 1 }];
const MEMO: DocTypeMeta = {
  name: "Memo R1", autoname: "hash", permissions: PERMS,
  fields: [
    { fieldname: "assignee", fieldtype: "Link", label: "Assignee", options: "User", default: "ann@x.com" },
    { fieldname: "assignee_name", fieldtype: "Data", label: "Assignee Name", fetch_from: "assignee.full_name", read_only: 1 },
    { fieldname: "lines", fieldtype: "Table", label: "Lines", options: "Memo R1 Line" },
  ],
};
const LINE: DocTypeMeta = {
  name: "Memo R1 Line", istable: 1, editable_grid: 1,
  fields: [
    { fieldname: "item", fieldtype: "Data", label: "Item", in_list_view: 1 },
    { fieldname: "cost", fieldtype: "Currency", label: "Cost", in_list_view: 1, permlevel: 1 },
    { fieldname: "qty", fieldtype: "Float", label: "Qty", in_list_view: 1 },
  ],
};

function mount(ui: React.ReactElement, roles = ["Sales User"]) {
  const transport = createFixtureTransport({
    meta: { User: docsOf(userEn), "Memo R1": [MEMO, LINE] },
    docs: { User: [{ doctype: "User", name: "ann@x.com", full_name: "Ann Xu", first_name: "Ann", email: "ann@x.com", enabled: 1 }] },
  });
  const client = createFrappeClient({ transport });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><QueryClientProvider client={qc}>
      <FrappeProvider client={client} session={{ user: "me@x.com", roles }}>{ui}</FrappeProvider>
    </QueryClientProvider></ThemeProvider>,
  );
  return transport;
}

describe("R1-F1 default Link values of a new document run validate_link + fetch (form.js:569, 1103)", () => {
  it("fetches the target of a defaulted Link without the user re-selecting it, once", async () => {
    const transport = mount(<FrappeForm doctype="Memo R1" />);
    await waitFor(() => expect(transport.store.calls.filter((c) => c.method === "frappe.client.validate_link")).toHaveLength(1));
    const call = transport.store.calls.find((c) => c.method === "frappe.client.validate_link")!;
    expect(call.args).toMatchObject({ doctype: "User", docname: "ann@x.com" });
    expect(String(call.args.fields)).toContain("full_name");
    expect(await screen.findByText("Ann Xu")).toBeTruthy();
  });
});

describe("R1-F6 expression interpreter gaps", () => {
  const run = (src: string, doc: Record<string, unknown> = {}) => { const c = compileExpression(src, "interpreter"); if (!c.ok) throw new Error(c.reason); return c.run({ ...DEFAULT_HELPERS, doc, parent: doc }); };
  it("accepts trailing semicolons (also with spaces)", () => {
    expect(compileExpression("!doc.a && doc.b;", "interpreter").ok).toBe(true);
    expect(compileExpression("doc.a == 1 ; ", "function").ok).toBe(true);
  });
  it("supports Boolean(...) and the in operator (object keys, array indexes)", () => {
    expect(run("Boolean(doc.a)", { a: "x" })).toBe(true);
    expect(run("Boolean(doc.a)", { a: "" })).toBe(false);
    expect(run("'a' in doc", { a: 0 })).toBe(true);
    expect(run("'b' in doc", { a: 0 })).toBe(false);
    expect(run("1 in doc.l", { l: [1, 2] })).toBe(true);
    expect(run("2 in doc.l", { l: [1, 2] })).toBe(false);
    expect(run("'a' in doc && doc.a > 1", { a: 2 })).toBe(true);
    expect(() => run("'a' in doc.x", { x: null })).toThrow();
  });
  it("still reports arrow functions, bitwise operators, frappe.boot and cur_frm as unsupported", () => {
    for (const src of ["doc.l.every(x => x)", "doc.a & 1", "frappe.boot.sysdefaults.x", "cur_frm.doc.a"]) {
      const c = compileExpression(src, "interpreter");
      expect(c.ok, src).toBe(false);
    }
  });
});

describe("R1-F8 grid columns honour the permlevel read right (grid.js:1015-1021)", () => {
  it("gridColumns drops unreadable columns before the width budget is spent", () => {
    const cols = gridColumns(LINE, (f) => (f.permlevel ?? 0) === 0);
    expect(cols.map((c) => c.df.fieldname)).toEqual(["item", "qty"]);
  });
  it("a user without permlevel-1 read sees no Cost column; one with it does", async () => {
    mount(<FrappeForm doctype="Memo R1" />);
    await screen.findByText("Item");
    expect(screen.queryByText("Cost")).toBeNull();
    expect(screen.getByText("Qty")).toBeTruthy();
    cleanup();
    const withL1 = { ...MEMO, permissions: [...PERMS, { role: "Sales User", permlevel: 1, read: 1 as const }] };
    const transport = createFixtureTransport({ meta: { User: docsOf(userEn), "Memo R1": [withL1, LINE] }, docs: {} });
    render(
      <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><QueryClientProvider client={new QueryClient()}>
        <FrappeProvider client={createFrappeClient({ transport })} session={{ user: "me@x.com", roles: ["Sales User"] }}><FrappeForm doctype="Memo R1" /></FrappeProvider>
      </QueryClientProvider></ThemeProvider>,
    );
    await screen.findByText("Cost");
  });
});
