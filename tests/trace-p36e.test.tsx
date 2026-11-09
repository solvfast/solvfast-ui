/**
 * P36e trace (agent T) — FrappeField from a HAND-BUILT DocField, without a real Frappe site. The evidence for
 * docs/audit/p36d/FRAPPEFIELD-TRACE.md §C ("Can it work without a document / provider / server?").
 *
 * Three environments, the same six fieldtypes (Data, Link, Select, Date, Check, Attach):
 *  (a) FrappeProvider over the in-package SIMULATOR (`createFixtureTransport`) — what is demanded = `store.calls`;
 *  (b) FrappeProvider over a transport that REJECTS every call (an offline / unreachable server) — demanded = the
 *      methods the transport saw before it rejected;
 *  (c) NO FrappeProvider: (c1) nothing at all above the field; (c2) only a bare React Query `QueryClientProvider`.
 *      Demanded = the URLs the default same-origin client (FrappeProvider.tsx:26) tried to `fetch` (stubbed to reject).
 * For each: what renders, what throws, which server methods are demanded. jsdom only; nothing here is Frappe evidence.
 *
 * P36E.trace.20+ also pin the showcase inventory (showcase/src/pages/p36d-fieldtypes-data.ts) to the status table of
 * docs/audit/p36d/FIELD-TYPES.md §2, so the two cannot drift.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import * as fs from "node:fs";
import * as path from "node:path";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEn from "./fixtures/real-15.110/user.en.json";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient, FrappeError, type FrappeTransport } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import type { DocTypeMeta, FrappeDoc, FrappeDocField, MetaBundle } from "../src/frappe/contract";
import { createFixtureTransport } from "../src/frappe/testing";
import { FrappeField, FrappeFormView, resolveFields } from "../src/frappe/form";
import { FIELD_TYPES } from "../showcase/src/pages/p36d-fieldtypes-data";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const docsOf = (x: unknown) => (x as { docs: DocTypeMeta[] }).docs;

/** The hand-built DocFields: nothing comes from a server meta. */
const DF: Record<string, FrappeDocField> = {
  Data: { fieldname: "customer_name", fieldtype: "Data", label: "Customer" },
  Link: { fieldname: "owner_user", fieldtype: "Link", label: "Owner", options: "User" },
  Select: { fieldname: "status", fieldtype: "Select", label: "Status", options: "\nOpen\nClosed" },
  Date: { fieldname: "due", fieldtype: "Date", label: "Due" },
  Check: { fieldname: "active", fieldtype: "Check", label: "Active" },
  Attach: { fieldname: "contract", fieldtype: "Attach", label: "Contract" },
};

type Env = "a" | "b" | "c1" | "c2";

/** A FrappeField that keeps its value (as a form would) and logs every onChange. No `doc`, no `bundle`, no `status`. */
function Live({ df, initial, log }: { df: FrappeDocField; initial: unknown; log: unknown[] }) {
  const [value, setValue] = React.useState<unknown>(initial);
  return <FrappeField df={df} value={value} onChange={(v) => { log.push(v); setValue(v); }} />;
}

/** Render `node` in one of the environments; `demanded()` = the server methods asked for so far. */
function mountIn(env: Env, node: React.ReactElement) {
  let demanded: () => string[];
  let tree: React.ReactElement;
  if (env === "a") {
    const transport = createFixtureTransport({
      meta: { User: docsOf(userEn) },
      docs: { User: [{ doctype: "User", name: "ann@x.com", full_name: "Ann Xu", first_name: "Ann", email: "ann@x.com", enabled: 1 }] },
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    demanded = () => transport.store.calls.map((c) => c.method);
    tree = <QueryClientProvider client={qc}><FrappeProvider client={createFrappeClient({ transport })} session={{ user: "Administrator" }}>{node}</FrappeProvider></QueryClientProvider>;
  } else if (env === "b") {
    const seen: string[] = [];
    // an unreachable server: every call rejects as the HTTP transport's network failure does (client.ts:264-266)
    const transport: FrappeTransport = async (method) => { seen.push(method); throw new FrappeError("Server unreachable (P36E test)", 0); };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    demanded = () => [...seen];
    tree = <QueryClientProvider client={qc}><FrappeProvider client={createFrappeClient({ transport })} session={{ user: "Administrator" }}>{node}</FrappeProvider></QueryClientProvider>;
  } else {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { urls.push(String(url)); throw new TypeError("fetch refused (P36E test)"); }));
    demanded = () => urls.map((u) => u.replace(/^.*\/api\/method\//, ""));
    tree = env === "c2"
      ? <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{node}</QueryClientProvider>
      : node;
  }
  const utils = render(<ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>{tree}</ThemeProvider>);
  return { ...utils, demanded };
}

const field = (env: Env, type: keyof typeof DF, initial: unknown = null) => {
  const log: unknown[] = [];
  const m = mountIn(env, <Live df={DF[type]} initial={initial} log={log} />);
  return { log, ...m };
};
const typeAndBlur = (el: HTMLElement, value: string) => { fireEvent.focus(el); fireEvent.change(el, { target: { value } }); fireEvent.blur(el); };
const ALL_ENVS: Env[] = ["a", "b", "c1", "c2"];

describe("P36E trace — server-free field types render and write in every environment", () => {
  it("P36E.trace.1 Data / Select / Date / Check render from a hand-built DocField with NO doc, bundle or status, write their stored format, and demand no server method — in (a), (b), (c1) and (c2)", () => {
    for (const env of ALL_ENVS) {
      const d = field(env, "Data");
      typeAndBlur(screen.getByRole("textbox", { name: "Customer" }), "Acme Travel");
      expect(d.log, env).toEqual(["Acme Travel"]);
      expect(d.demanded(), env).toEqual([]);
      cleanup();

      const s = field(env, "Select", "Open");
      fireEvent.keyDown(screen.getByRole("combobox", { name: "Status" }), { key: "Enter" });
      fireEvent.click(screen.getByRole("option", { name: "Closed" }));
      expect(s.log, env).toEqual(["Closed"]);
      expect(s.demanded(), env).toEqual([]);
      cleanup();

      const dt = field(env, "Date", "2026-11-20");
      // no FormatContext anywhere → the package default (format.ts:76-77 defaultFormatContext, yyyy-mm-dd)
      expect(screen.getByRole("button", { name: /Due/ }).textContent, env).toContain("2026-11-20");
      expect(dt.demanded(), env).toEqual([]);
      cleanup();

      const c = field(env, "Check", 0);
      fireEvent.click(screen.getByRole("checkbox", { name: "Active" }));
      expect(c.log, env).toEqual([1]);
      expect(c.demanded(), env).toEqual([]);
      cleanup();
    }
  });
});

describe("P36E trace — Link", () => {
  it("P36E.trace.2 (a) simulator: typing demands search_link, a typed text demands validate_link (unknown name → cleared), a value demands get_link_title", async () => {
    const l = field("a", "Link");
    const box = screen.getByRole("combobox", { name: "Owner" });
    act(() => (box as HTMLInputElement).focus());
    fireEvent.change(box, { target: { value: "ann" } });
    await waitFor(() => expect(l.demanded()).toContain("frappe.desk.search.search_link"), { timeout: 2000 });
    expect(await screen.findByRole("option", { name: /ann@x\.com/ })).toBeTruthy();
    fireEvent.blur(box);
    await waitFor(() => expect(l.demanded()).toContain("frappe.client.validate_link"));
    // validate_link answers name: null for "ann" (no such User) → FrappeLinkField clears the field (FrappeLinkField.tsx:182)
    await waitFor(() => expect(l.log).toEqual(["ann", null]));
    cleanup();
    const v = field("a", "Link", "ann@x.com");
    await waitFor(() => expect(v.demanded()).toEqual(["frappe.desk.search.get_link_title"]));
  });

  it("P36E.trace.3 (b) rejecting server: the Link renders; search shows 'Search failed'; a typed value is KEPT and the error is shown; the title request fails silently", async () => {
    const l = field("b", "Link");
    const box = screen.getByRole("combobox", { name: "Owner" });
    act(() => (box as HTMLInputElement).focus());
    fireEvent.change(box, { target: { value: "ann" } });
    expect(await screen.findByText("Search failed", undefined, { timeout: 2000 })).toBeTruthy();
    fireEvent.blur(box);
    await waitFor(() => expect(l.demanded()).toContain("frappe.client.validate_link"));
    expect(await screen.findByText(/Server unreachable/)).toBeTruthy(); // the messages host (FrappeLinkField.tsx:185-188)
    expect(l.log).toEqual(["ann"]);
    cleanup();
    const v = field("b", "Link", "ann@x.com");
    await waitFor(() => expect(v.demanded()).toEqual(["frappe.desk.search.get_link_title"]));
    expect((screen.getByRole("combobox", { name: "Owner" }) as HTMLInputElement).value).toBe("ann@x.com");
  });

  it("P36E.trace.4 (c1) NO FrappeProvider and no QueryClientProvider: a Link THROWS 'No QueryClient set' (useMetaBundle → useQuery, FrappeLinkField.tsx:208) — the other five types do not", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => field("c1", "Link")).toThrow(/No QueryClient set/);
    cleanup();
    for (const t of ["Data", "Select", "Date", "Check", "Attach"] as const) {
      expect(() => { field("c1", t); cleanup(); }, t).not.toThrow();
    }
  });

  it("P36E.trace.5 (c2) no FrappeProvider, only a QueryClientProvider: the Link renders and talks to the SAME-ORIGIN /api/method/* (default client) — search fails, validation error kept", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const l = field("c2", "Link");
    const box = screen.getByRole("combobox", { name: "Owner" });
    act(() => (box as HTMLInputElement).focus());
    fireEvent.change(box, { target: { value: "ann" } });
    expect(await screen.findByText("Search failed", undefined, { timeout: 2000 })).toBeTruthy();
    fireEvent.blur(box);
    await waitFor(() => expect(l.demanded()).toContain("frappe.client.validate_link"));
    expect(l.demanded()).toContain("frappe.desk.search.search_link");
    expect(l.log).toEqual(["ann"]); // no messages host without a provider: the error is only console.warn-ed (messages.tsx:29-31)
  });
});

describe("P36E trace — Attach", () => {
  it("P36E.trace.6 Attach renders 'Attach' in every environment; opening the uploader demands get_max_file_size (a: answered; b, c1, c2: rejected, no limit, dialog still opens)", async () => {
    for (const env of ALL_ENVS) {
      const a = field(env, "Attach");
      fireEvent.click(screen.getByRole("button", { name: /Attach/ }));
      expect(await screen.findByRole("dialog"), env).toBeTruthy();
      await waitFor(() => expect(a.demanded(), env).toEqual(["frappe.core.api.file.get_max_file_size"]));
      expect(a.log, env).toEqual([]);
      cleanup();
    }
  });

  it("P36E.trace.7 uploads need a file transport: the base simulator refuses uploads (417), a transport-only client has none ('no file transport'); with no doc the upload is unattached (no doctype/docname)", async () => {
    const base = createFixtureTransport({ meta: {} });
    const onlyTransport = createFrappeClient({ transport: base });
    await expect(onlyTransport.uploadFile(new Blob(["x"]), "x.txt", {})).rejects.toThrow(/no file transport/);
    const withFiles = createFrappeClient({ transport: base, files: base.files });
    await expect(withFiles.uploadFile(new Blob(["x"]), "x.txt", {})).rejects.toBeInstanceOf(FrappeError);
    // FrappeField without `doc`: rowDoc.name is "" (FrappeField.tsx:193) → attachUploadOptions gives no target
    const { attachUploadOptions } = await import("../src/frappe/form");
    expect(attachUploadOptions(DF.Attach, undefined, "", "").target).toBeUndefined();
  });
});

describe("P36E trace — what FrappeField does NOT do for its caller", () => {
  it("P36E.trace.8 FrappeField never evaluates depends_on / mandatory_depends_on / read_only_depends_on: the caller runs resolveFields first (FrappeFormView.tsx:250, CRM CrmEntityFormFields.tsx:100)", () => {
    const df: FrappeDocField = { fieldname: "x", fieldtype: "Data", label: "Hidden by dependency", depends_on: "eval:doc.kind=='B'" };
    const doc = { doctype: "T", name: "T-1", kind: "A" } as FrappeDoc;
    mountIn("c2", <FrappeField df={df} value="v" onChange={() => {}} doc={doc} />);
    expect(screen.getByRole("textbox", { name: "Hidden by dependency" })).toBeTruthy(); // raw df: still shown
    cleanup();
    const eff = resolveFields([df], doc, doc).get("x")!;
    expect(eff.hidden_due_to_dependency).toBe(true);
    const { container } = mountIn("c2", <FrappeField df={eff} value="v" onChange={() => {}} doc={doc} />);
    expect(container.querySelector("input")).toBeNull();
  });

  it("P36E.trace.9 status without a `status` prop: a standalone FrappeField is WRITE (dialog ladder, status.ts:181-184) while FrappeFormView without `permissions` is READ (rule 9, FrappeFormView.tsx:262)", () => {
    const df: FrappeDocField = { fieldname: "customer_name", fieldtype: "Data", label: "Customer" };
    mountIn("c2", <FrappeField df={df} value="Acme" onChange={() => {}} />);
    expect(screen.getByRole("textbox", { name: "Customer" })).toBeTruthy();
    cleanup();
    const bundle: MetaBundle = { doctype: "T", meta: { name: "T", fields: [df] }, children: {} };
    mountIn("c2", <FrappeFormView bundle={bundle} doc={{ doctype: "T", name: "T-1", docstatus: 0, customer_name: "Acme" } as FrappeDoc} onSave={async (d) => d} />);
    expect(screen.queryByRole("textbox", { name: "Customer" })).toBeNull();
    expect(screen.getByText("Acme")).toBeTruthy();
  });

  it("P36E.trace.10 hidden → nothing; read_only → the formatted value (no input); reqd + empty → aria-invalid; defaults are NOT applied (an empty Data with `default` stays empty)", () => {
    const { container } = mountIn("c2", <FrappeField df={{ fieldname: "h", fieldtype: "Data", label: "H", hidden: 1 }} value="x" onChange={() => {}} />);
    expect(container.textContent).toBe("");
    cleanup();
    mountIn("c2", <FrappeField df={{ fieldname: "r", fieldtype: "Check", label: "R", read_only: 1 }} value={1} onChange={() => {}} />);
    expect((screen.getByRole("checkbox", { name: "R" }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    mountIn("c2", <FrappeField df={{ fieldname: "q", fieldtype: "Data", label: "Q", reqd: 1, default: "Fallback" }} value="" onChange={() => {}} />);
    const q = screen.getByRole("textbox", { name: /Q/ }) as HTMLInputElement;
    expect(q.getAttribute("aria-invalid")).toBe("true");
    expect(q.value).toBe("");
  });

  it("P36E.trace.11 Date (844cd2e) has no typed entry and no way to clear a value: a calendar button only, and clicking the selected day writes nothing (native date.js is a text input; '' clears)", async () => {
    const d = field("c2", "Date", "2026-11-20");
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Due/ }));
    const grid = await screen.findByRole("grid");
    const selected = within(grid).getAllByRole("gridcell").find((c) => c.getAttribute("aria-selected") === "true");
    expect(selected?.textContent).toBe("20");
    fireEvent.click(selected!.querySelector("button") ?? selected!);
    expect(d.log).toEqual([]);
    expect(screen.queryByRole("button", { name: /clear/i })).toBeNull();
  });

  it("P36E.trace.12 Table needs no server either: a hand-built bundle with the child meta renders the grid and Add Row writes a row (c1: no provider at all)", () => {
    const child: DocTypeMeta = { name: "T Item", istable: 1, fields: [{ fieldname: "item", fieldtype: "Data", label: "Item", in_list_view: 1 }] };
    const table: FrappeDocField = { fieldname: "items", fieldtype: "Table", label: "Items", options: "T Item" };
    const bundle: MetaBundle = { doctype: "T", meta: { name: "T", fields: [table] }, children: { "T Item": child } };
    const log: unknown[] = [];
    function Rows() {
      const [rows, setRows] = React.useState<unknown>([]);
      return <FrappeField df={table} value={rows} onChange={(v) => { log.push(v); setRows(v); }} bundle={bundle} doc={{ doctype: "T", name: "new-t-1", __islocal: 1 } as FrappeDoc} />;
    }
    const m = mountIn("c1", <Rows />);
    fireEvent.click(screen.getAllByRole("button", { name: /Add Row|Add row/i })[0]);
    expect(Array.isArray(log.at(-1)) && (log.at(-1) as FrappeDoc[]).length).toBe(1);
    expect((log.at(-1) as FrappeDoc[])[0]).toMatchObject({ doctype: "T Item", parentfield: "items", idx: 1, __islocal: 1 });
    expect(m.demanded()).toEqual([]);
  });
});

// ---- showcase honesty: the inventory data equals FIELD-TYPES.md -------------------------------------------------------

const FIELD_TYPES_MD = path.resolve(__dirname, "../docs/audit/p36d/FIELD-TYPES.md");

/** The §2 summary matrix of FIELD-TYPES.md: FT id → status (the cell's leading word). */
function mdStatuses(): Map<string, string> {
  const text = fs.readFileSync(FIELD_TYPES_MD, "utf8");
  const start = text.indexOf("## 2. Summary matrix");
  const end = text.indexOf("## 3.", start);
  const out = new Map<string, string>();
  for (const line of text.slice(start, end).split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (!/^FT-\d+[a-f]?$/.test(cells[1] ?? "")) continue;
    const header = text.slice(start, end).split("\n").find((l) => l.startsWith("| FT |"))!.split("|").map((c) => c.trim());
    const status = cells[header.indexOf("Status")];
    out.set(cells[1], (/^(COMPLETE|PARTIAL|MISSING|n\/a)/.exec(status) ?? [""])[0]);
  }
  return out;
}

describe("P36E trace — showcase data ⇔ FIELD-TYPES.md", () => {
  it("P36E.trace.20 every FT row of the showcase inventory has the status of the FIELD-TYPES.md §2 matrix, and the matrix has no other rows", () => {
    const md = mdStatuses();
    expect(md.size).toBe(FIELD_TYPES.length);
    for (const r of FIELD_TYPES) expect(md.get(r.id), `${r.id} ${r.fieldtype}${r.dataOption ? ` (${r.dataOption})` : ""}`).toBe(r.status);
  });

  it("P36E.trace.21 the totals line of FIELD-TYPES.md §1 equals the counts of the 43 DocField types and of the Data options in the showcase data", () => {
    const text = fs.readFileSync(FIELD_TYPES_MD, "utf8");
    const docfield = FIELD_TYPES.filter((r) => r.docfieldOption);
    const n = (s: string) => docfield.filter((r) => r.status === s).length;
    expect(docfield).toHaveLength(43);
    expect(/Status of the 43 DocField types: \*\*[^*]+\*\*\./.exec(text)?.[0]).toBe(`Status of the 43 DocField types: **${n("COMPLETE")} COMPLETE · ${n("PARTIAL")} PARTIAL · ${n("MISSING")} MISSING**.`);
    const opts = FIELD_TYPES.filter((r) => r.dataOption);
    const byStatus = (s: string) => opts.filter((r) => r.status === s).map((r) => r.dataOption);
    expect(/- Data options: [^\n]+/.exec(text)?.[0]).toBe(`- Data options: ${byStatus("COMPLETE").length} COMPLETE · ${byStatus("PARTIAL").length} PARTIAL (${byStatus("PARTIAL").join(", ")}).`);
  });
});
