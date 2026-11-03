/**
 * REAL Frappe 15.110 responses (not the simulator) replayed through the package.
 *
 * Source: tests/fixtures/real-15.110-sada/
 *  - sada-real-responses.json — captured in-process on internal.solvfaster.com as Administrator, inside ONE READ ONLY
 *    database transaction (scripts/capture-real-sada.py). E-mails and names pseudonymised.
 *  - guest-http.json — real HTTP responses to anonymous requests made through the package's own built client
 *    (scripts/real-guest-http.mjs).
 * The replay transport answers ONLY recorded calls and throws on anything else, so no simulated data can leak in.
 */
import * as React from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import real from "../fixtures/real-15.110-sada/sada-real-responses.json";
import guest from "../fixtures/real-15.110-sada/guest-http.json";
import { createFrappeClient, toFrappeError, toMetaBundle, normalizeDocInfo } from "../../src/frappe/client";
import { decodeReportview } from "../../src/frappe/list/reportview";
import { FrappeProvider } from "../../src/frappe/FrappeProvider";
import { usePermissions } from "../../src/frappe/hooks";
import type { FrappeResponse, FrappeTransport } from "../../src/frappe/client";

type Rec = Record<string, unknown>;
const R = real as unknown as Record<string, FrappeResponse & Rec>;
const calls: string[] = [];

/** Answers only what was recorded on the real site. */
const recorded: FrappeTransport = async (method, args) => {
  const a = args as Rec;
  calls.push(method);
  const pick = (key: string) => {
    if (!(key in R)) throw new Error(`not recorded: ${key}`);
    return structuredClone(R[key]) as FrappeResponse;
  };
  switch (method) {
    case "frappe.desk.form.load.getdoctype": return pick(`getdoctype::${a.doctype}`);
    case "frappe.desk.form.load.getdoc": return pick(`getdoc::${a.doctype}::${a.name}`);
    case "frappe.desk.reportview.get": {
      const filters = String(a.filters ?? "[]");
      return pick(filters.includes("__no_such_value__") ? `reportview.get::${a.doctype}::filtered-empty` : `reportview.get::${a.doctype}`);
    }
    case "frappe.desk.reportview.get_count": return pick(`reportview.get_count::${a.doctype}`);
    case "frappe.desk.listview.get_list_settings": return pick(`get_list_settings::${a.doctype}`);
    case "frappe.desk.search.search_link": return pick(`search_link::${a.doctype}::${a.txt ?? ""}`);
    case "frappe.client.validate_link": return pick(`validate_link::${a.doctype}::${a.docname === "lc-post-default" ? "lc-post-default" : "missing"}`);
    default: throw new Error(`not recorded: ${method}`);
  }
};
const api = createFrappeClient({ transport: recorded });

describe("REAL Frappe 15.110 responses (Sada, read-only capture)", () => {
  it("was captured inside a READ ONLY transaction", () => {
    expect((R._meta as Rec).read_only_transaction).toBe(true);
    expect(String((R._meta as Rec).frappe)).toBe("15.110.0");
  });

  it("getdoctype → MetaBundle: parent + child-table metas (Sada Lifecycle has two child tables)", async () => {
    const bundle = await api.getMetaBundle("Sada Lifecycle");
    expect(bundle.meta.name).toBe("Sada Lifecycle");
    expect(Object.keys(bundle.children).sort()).toEqual(["Sada Lifecycle Status", "Sada Lifecycle Transition"]);
    expect(bundle.meta.fields.find((f) => f.fieldname === "statuses")?.fieldtype).toBe("Table");
    const single = toMetaBundle("Sada Content Configuration", R["getdoctype::Sada Content Configuration"]);
    expect(single.meta.issingle).toBe(1);
  });

  it("reportview.get → compressed keys/values decoded into rows; _comment_count appended by the server", () => {
    const decoded = decodeReportview(R["reportview.get::Sada Post Type"]);
    expect(decoded.rows).toHaveLength(2);
    expect(Object.keys(decoded.rows[0])).toEqual(expect.arrayContaining(["name", "type_name", "is_active", "lifecycle", "_comment_count"]));
    expect(decoded.rows.map((r) => r.name).sort()).toEqual(["f43f27e600", "post Type1"]);
  });

  it("reportview.get with no matching rows answers [] (not {keys, values}) and decodes to no rows", () => {
    expect(R["reportview.get::Sada Post Type::filtered-empty"].message).toEqual([]);
    expect(decodeReportview(R["reportview.get::Sada Post Type::filtered-empty"]).rows).toEqual([]);
  });

  it("reportview.get_count → a number", async () => {
    expect(await api.getCount("Sada Post Type", {})).toBe(2);
  });

  it("search_link → value/description results", async () => {
    const res = await api.searchLink("Sada Lifecycle", "lc");
    expect(res.map((r) => r.value)).toContain("lc-post-default");
  });

  it("validate_link → canonical name + fetch values; a missing record → name null", async () => {
    const ok = await api.validateLink("Sada Lifecycle", "lc-post-default", ["lifecycle_name", "entity"]);
    expect(ok.name).toBe("lc-post-default");
    expect(Object.keys(ok.values)).toEqual(expect.arrayContaining(["lifecycle_name", "entity"]));
    const missing = await api.validateLink("Sada Lifecycle", "no-such-lifecycle", ["lifecycle_name"]);
    expect(missing.name).toBeNull();
  });

  it("getdoc → LoadedDoc with child rows (parent/parentfield/idx) and a normalised docinfo", async () => {
    const loaded = await api.getDoc("Sada Lifecycle", "lc-post-default");
    expect(loaded.doc.name).toBe("lc-post-default");
    const statuses = loaded.doc.statuses as Rec[];
    expect(Array.isArray(statuses) && statuses.length).toBeGreaterThan(0);
    expect(statuses[0]).toMatchObject({ parent: "lc-post-default", parentfield: "statuses", parenttype: "Sada Lifecycle" });
    const info = normalizeDocInfo(R["getdoc::Sada Lifecycle::lc-post-default"].docinfo);
    for (const k of ["attachments", "comments", "versions", "assignments", "shared", "views"] as const) expect(Array.isArray(info[k])).toBe(true);
    expect(info.permissions.read).toBeTruthy();
  });

  it("usePermissions with the role-holder's real roles agrees with the server's get_doc_permissions", async () => {
    const holders = R["permissions::sada-role-holders"] as unknown as { user: string; roles: string[]; doc_permissions: Record<string, Rec> }[];
    const bundle = await api.getMetaBundle("Sada Post Type");
    const loaded = await api.getDoc("Sada Post Type", "post Type1");
    for (const h of holders) {
      let seen: ReturnType<typeof usePermissions> | undefined;
      const Probe = () => { seen = usePermissions(bundle, loaded.doc, loaded.docinfo); return null; };
      render(<FrappeProvider client={api} session={{ user: h.user, roles: h.roles }}><Probe /></FrappeProvider>);
      const server = h.doc_permissions["Sada Post Type"];
      for (const p of ["read", "write", "create", "delete"] as const) expect(seen!.can(p), `${h.user} ${p}`).toBe(!!server[p]);
    }
  });

  it("only recorded real calls were made", () => {
    expect(calls.every((m) => m.startsWith("frappe."))).toBe(true);
  });
});

describe("REAL Frappe 15.110 over HTTP as Guest, through the package client (guest-http.json)", () => {
  const G = guest as unknown as { raw: { request: { path: string; csrfHeader: string | null }; status: number; body: Rec }[] };
  it("protected methods answer 403 PermissionError, and the package classifies them as permission", () => {
    const protectedCalls = G.raw.filter((r) => r.request.path.includes("frappe.desk") || r.request.path.includes("frappe.client"));
    expect(protectedCalls.length).toBeGreaterThan(4);
    for (const r of protectedCalls) {
      expect(r.status).toBe(403);
      const err = toFrappeError(r.status, r.body);
      expect(err.kind).toBe("permission");
      expect(err.excType).toBe("PermissionError");
      expect(err.messages.length).toBeGreaterThan(0);
    }
  });
  it("an unknown method answers 417 ValidationError (not 404) and is classified as validation", () => {
    const r = G.raw.find((x) => x.request.path.endsWith("frappe.no_such_module.no_such_method"))!;
    expect(r.status).toBe(417);
    expect(toFrappeError(r.status, r.body).kind).toBe("validation");
  });
  it("a Guest request with a bogus CSRF header is NOT rejected as CSRF (Guest sessions hold no token)", () => {
    const r = G.raw.find((x) => x.request.csrfHeader === "bogus-token")!;
    expect(r.status).toBe(403);
    expect(toFrappeError(r.status, r.body).kind).toBe("permission");
  });
});

// ---- components rendering REAL responses ------------------------------------------------------------------------------
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FrappeListView } from "../../src/frappe/FrappeListView";
import { FrappeForm } from "../../src/frappe/form/FrappeForm";

const unrecorded: string[] = [];
const strictRecorded: FrappeTransport = async (method, args) => {
  try { return await recorded(method, args); } catch (e) { unrecorded.push(method); throw e; }
};
const wrap = (ui: React.ReactNode, transport: FrappeTransport = strictRecorded) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const client = createFrappeClient({ transport });
  return render(<QueryClientProvider client={qc}><FrappeProvider client={client} session={{ user: "Administrator", roles: ["Administrator", "System Manager"] }}>{ui}</FrappeProvider></QueryClientProvider>);
};

describe("package components on REAL Frappe responses", () => {
  beforeEach(() => { unrecorded.length = 0; });
  it("FrappeListView renders the real Sada Post Type metadata and rows", async () => {
    wrap(<FrappeListView doctype="Sada Post Type" />);
    // the list shows each row's Type Name (title column first, R2-V2), taken here from the real reportview rows
    const typeNames = decodeReportview(R["reportview.get::Sada Post Type"]).rows.map((r) => String(r.type_name));
    await waitFor(() => { for (const t of typeNames) expect(screen.getAllByText(t).length).toBeGreaterThan(0); }, { timeout: 4000 });
    expect(document.body.textContent).toMatch(/Total:\s*2/);
    expect(unrecorded, `unrecorded calls: ${unrecorded.join(", ")}`).toEqual([]);
  });

  it("FrappeForm renders the real Sada Lifecycle document with its child-table rows", async () => {
    wrap(<FrappeForm doctype="Sada Lifecycle" name="lc-post-default" />);
    const doc = (R["getdoc::Sada Lifecycle::lc-post-default"].docs as Rec[])[0];
    const statusNames = (doc.statuses as Rec[]).map((r) => String(r.status_name));
    const actions = (doc.transitions as Rec[]).map((r) => String(r.action));
    await waitFor(() => { for (const t of [...statusNames, ...actions]) expect(document.body.textContent).toContain(t); }, { timeout: 4000 });
    const inputs = Array.from(document.querySelectorAll("input")).map((x) => (x as HTMLInputElement).value);
    expect(inputs.join(" ") + " " + document.body.textContent).toContain(String(doc.lifecycle_name));
    expect(unrecorded, `unrecorded calls: ${unrecorded.join(", ")}`).toEqual([]);
  });

  // The list renders failures with FrappeErrorState: a 403 has no Retry (R2-V6).
  it("the real Guest 403 renders as a permission error with no Retry action", async () => {
    const r403 = (guest as unknown as { raw: { request: { path: string }; status: number; body: Rec }[] }).raw.find((x) => x.request.path.endsWith("getdoctype"))!;
    const denied: FrappeTransport = async () => { throw toFrappeError(r403.status, r403.body); };
    wrap(<FrappeListView doctype="Sada Post Type" />, denied);
    await waitFor(() => expect(document.body.textContent).toMatch(/not permitted|permission/i), { timeout: 4000 });
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });
});
