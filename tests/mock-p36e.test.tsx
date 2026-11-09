/**
 * P36e mock — FrappeField without a Frappe server (src/frappe/form/localServices.tsx). jsdom only: no site, no simulator
 * for the local paths (the simulator appears only as a reference for the server shapes). References are Frappe 15.110:
 * frappe/desk/search.py, frappe/client.py, frappe/public/js/frappe/form/controls/link.js.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import type { FrappeDoc, FrappeDocField } from "../src/frappe/contract";
import {
  FrappeField, FrappeLocalForm, LOCAL_CAPABILITIES, SERVER_CAPABILITIES, createLocalFormServices, localLinkTitle, localSearchLink,
  localValidateLink, noServerClient, useFormCapabilities, type LocalLinkSource, type LocalLinkTarget,
} from "../src/frappe/form";
import * as Frappe from "../src/frappe";
import { createFixtureTransport } from "../src/frappe/testing";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const df = (d: Partial<FrappeDocField> & { fieldtype: string }) => ({ fieldname: d.fieldname ?? "f", label: d.label ?? "Field", ...d }) as FrappeDocField;
const tick = (ms = 0) => act(() => new Promise((r) => setTimeout(r, ms)));

// Host data: organizations that show titles in links, CRM types with a kind and a disabled flag, users.
const ORGS: LocalLinkTarget = {
  meta: { title_field: "company_name", show_title_field_in_link: 1, search_fields: "company_name,industry", fields: [] },
  rows: () => [
    { name: "2", company_name: "Aramco Travel Desk", industry: "Travel" },
    { name: "5", company_name: "Rotana Hotels", industry: "Hospitality" },
    { name: "ABC", company_name: "Abc Co" },
  ],
};
const TYPES: LocalLinkTarget = {
  meta: { title_field: "type_name", show_title_field_in_link: 1, fields: [{ fieldname: "disabled", fieldtype: "Check" }] },
  rows: () => [
    { name: "leadtype_1", type_name: "Inbound", kind: "lead", disabled: 0 },
    { name: "leadtype_2", type_name: "Outbound", kind: "lead", disabled: 0 },
    { name: "leadtype_9", type_name: "Retired", kind: "lead", disabled: 1 },
    { name: "dealtype_1", type_name: "New Business", kind: "deal", disabled: 0 },
  ],
};
const USERS: LocalLinkTarget = {
  meta: { title_field: "full_name", search_fields: "full_name", fields: [{ fieldname: "enabled", fieldtype: "Check" }] },
  rows: () => [{ name: "omar@x.sa", full_name: "Omar", enabled: 1 }, { name: "old@x.sa", full_name: "Old", enabled: 0 }],
};
const SOURCE: LocalLinkSource = (dt) => ({ Org: ORGS, "CRM Type": TYPES, User: USERS } as Record<string, LocalLinkTarget>)[dt];

function local(node: React.ReactElement, props: Partial<React.ComponentProps<typeof FrappeLocalForm>> = {}) {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => { throw new Error("network used"); });
  const utils = render(
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
      <FrappeLocalForm source={SOURCE} {...props}>{node}</FrappeLocalForm>
    </ThemeProvider>,
  );
  return { fetchSpy, ...utils };
}

function Controlled({ field, initial = null, doc, onValue }: { field: FrappeDocField; initial?: string | null; doc?: FrappeDoc; onValue?: (v: unknown) => void }) {
  const [v, setV] = React.useState<unknown>(initial);
  return <FrappeField df={field} value={v} doc={doc} onChange={(n) => { setV(n); onValue?.(n); }} />;
}

describe("P36E.mock local services adapter", () => {
  it("P36E.mock.1 without a provider FrappeField's Link is NOT safe: no QueryClient → it throws; with only a QueryClient the search goes to the same-origin /api/method (negative control for the adapter)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const field = df({ fieldtype: "Link", options: "Org", label: "Organization" });
    expect(() => render(
      <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><FrappeField df={field} value={null} onChange={() => {}} /></ThemeProvider>,
    )).toThrow(/QueryClient/);
    cleanup();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ message: [] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    render(
      <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
        <QueryClientProvider client={new QueryClient()}><FrappeField df={field} value={null} onChange={() => {}} /></QueryClientProvider>
      </ThemeProvider>,
    );
    const box = screen.getByRole("combobox", { name: "Organization" });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "Rot" } });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled(), { timeout: 2000 });
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/api/method/frappe.desk.search.search_link");
  });

  it("P36E.mock.2 Link search over host rows with no network: typing lists titles (label) with the name in the description, a pick writes the NAME and shows the TITLE (search.py build_for_autosuggest, link.js:117-132)", async () => {
    const onValue = vi.fn();
    const transport = vi.spyOn(noServerClient(), "call");
    const { fetchSpy } = local(<Controlled field={df({ fieldname: "organization", fieldtype: "Link", options: "Org", label: "Organization" })} onValue={onValue} />);
    const box = screen.getByRole("combobox", { name: "Organization" }) as HTMLInputElement;
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "rot" } });
    const opt = await screen.findByRole("option", { name: /Rotana Hotels/ }, { timeout: 2000 });
    expect(opt.textContent).toContain("5");
    fireEvent.click(opt);
    await waitFor(() => expect(onValue).toHaveBeenLastCalledWith("5"));
    await waitFor(() => expect(box.value).toBe("Rotana Hotels"));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });

  it("P36E.mock.3 typed text is validated like validate_link: an unknown value is CLEARED, a name in another case is canonicalised, fetch columns come back (client.py:436-483, link.js:713-760)", async () => {
    const onValue = vi.fn();
    const { fetchSpy } = local(<Controlled field={df({ fieldname: "organization", fieldtype: "Link", options: "Org", label: "Organization" })} onValue={onValue} />);
    const box = screen.getByRole("combobox", { name: "Organization" }) as HTMLInputElement;
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "zzz-no-such" } });
    fireEvent.blur(box);
    await waitFor(() => expect(onValue).toHaveBeenLastCalledWith(null));
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "abc" } });
    fireEvent.blur(box);
    await waitFor(() => expect(onValue).toHaveBeenLastCalledWith("ABC"));
    // a title typed by hand is not a name: Desk's validate_link refuses it too
    expect(localValidateLink(ORGS, "Rotana Hotels")).toEqual({ name: null, values: {} });
    expect(localValidateLink(ORGS, "5", ["company_name", "missing"])).toEqual({ name: "5", values: { company_name: "Rotana Hotels", missing: null } });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("P36E.mock.4 a value set from data shows its title through the local get_link_title (search.py:327-334); a target without titles shows the name", async () => {
    local(
      <div>
        <FrappeField df={df({ fieldname: "o", fieldtype: "Link", options: "Org", label: "Org" })} value="2" onChange={() => {}} />
        <FrappeField df={df({ fieldname: "u", fieldtype: "Link", options: "User", label: "Owner" })} value="omar@x.sa" onChange={() => {}} />
        <FrappeField df={df({ fieldname: "m", fieldtype: "Link", options: "Org", label: "Missing" })} value="404" onChange={() => {}} />
      </div>,
    );
    await waitFor(() => expect((screen.getByRole("combobox", { name: "Org" }) as HTMLInputElement).value).toBe("Aramco Travel Desk"));
    expect((screen.getByRole("combobox", { name: "Owner" }) as HTMLInputElement).value).toBe("omar@x.sa");
    expect((screen.getByRole("combobox", { name: "Missing" }) as HTMLInputElement).value).toBe("404");
    expect(localLinkTitle(USERS, "omar@x.sa")).toBe("omar@x.sa");
    expect(localLinkTitle(ORGS, "404")).toBeNull();
  });

  it("P36E.mock.5 Dynamic Link: the target DocType comes from the sibling field of the doc; with no type nothing is searched and typed text is cleared", async () => {
    const field = df({ fieldname: "ref_name", fieldtype: "Dynamic Link", options: "ref_type", label: "Reference" });
    const onValue = vi.fn();
    local(<Controlled field={field} doc={{ doctype: "X", name: "x1", ref_type: "CRM Type" } as FrappeDoc} onValue={onValue} />);
    const box = screen.getByRole("combobox", { name: "Reference" });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "out" } });
    const opt = await screen.findByRole("option", { name: /Outbound/ }, { timeout: 2000 });
    fireEvent.click(opt);
    await waitFor(() => expect(onValue).toHaveBeenLastCalledWith("leadtype_2"));
    cleanup();
    const none = vi.fn();
    local(<Controlled field={field} doc={{ doctype: "X", name: "x1" } as FrappeDoc} onValue={none} />);
    const box2 = screen.getByRole("combobox", { name: "Reference" });
    fireEvent.focus(box2);
    fireEvent.change(box2, { target: { value: "leadtype_2" } });
    fireEvent.blur(box2);
    await waitFor(() => expect(none).toHaveBeenLastCalledWith(null));
  });

  it("P36E.mock.6 search_widget rules: link_filters (dict and tuples), the disabled / enabled Check rule, relevance, page_length (search.py:62-232)", () => {
    const kinds = (f: Parameters<typeof localSearchLink>[2]) => localSearchLink(TYPES, "", f).map((r) => r.value);
    expect(kinds({ filters: { kind: ["=", "lead"] } })).toEqual(["leadtype_1", "leadtype_2"]); // leadtype_9 disabled
    expect(kinds({ filters: [["CRM Type", "kind", "=", "deal"]] })).toEqual(["dealtype_1"]);
    expect(kinds({ filters: { kind: ["in", ["lead", "deal"]] }, pageLength: 2 })).toHaveLength(2);
    expect(localSearchLink(USERS, "", {}).map((r) => r.value)).toEqual(["omar@x.sa"]); // enabled = 1
    expect(localSearchLink(USERS, "", {})[0]).toEqual({ value: "omar@x.sa", description: "Omar" }); // no titles in links
    expect(localSearchLink(ORGS, "hosp", {})).toEqual([{ value: "5", label: "Rotana Hotels", description: "5, Hospitality" }]);
    expect(localSearchLink(ORGS, "a", {}).map((r) => r.value)).toEqual(["ABC", "2", "5"]); // names starting with "a" first
    expect(() => localSearchLink(TYPES, "", { filters: { kind: ["~~", 1] } })).toThrow(/Unsupported operator/);
  });

  it("P36E.mock.7 'no server' is reported and enforced: capabilities inside / outside, the no-server client refuses every method, an unknown DocType and a custom query are refused", async () => {
    let inside: unknown;
    let outside: unknown;
    const Probe = ({ out }: { out: (c: unknown) => void }) => { out(useFormCapabilities()); return null; };
    local(<Probe out={(c) => { inside = c; }} />);
    render(<Probe out={(c) => { outside = c; }} />);
    expect(inside).toEqual(LOCAL_CAPABILITIES);
    expect(inside).toMatchObject({ server: false, permissions: false, serverValidation: false, createNew: false, upload: false, linkSearch: true });
    expect(outside).toEqual(SERVER_CAPABILITIES);
    await expect(noServerClient().call("frappe.desk.form.save.savedocs", {})).rejects.toMatchObject({ excType: "LocalModeError", kind: "unavailable" });
    await expect(noServerClient().getMeta("Org")).rejects.toMatchObject({ excType: "LocalModeError" });
    // the refusal is final: React Query's frappeRetry does not retry it
    const err = await noServerClient().call("x.y", {}).catch((e) => e);
    expect(Frappe.frappeRetry(0, err)).toBe(false);
    const svc = createLocalFormServices(SOURCE);
    await expect(svc.searchLink!("Nope", "", { pageLength: 10 })).rejects.toMatchObject({ excType: "DoesNotExistError" });
    await expect(svc.validateLink!("Nope", "1")).rejects.toMatchObject({ excType: "DoesNotExistError" });
    await expect(svc.searchLink!("Org", "", { query: "app.queries.orgs" })).rejects.toMatchObject({ excType: "LocalModeError" });
    expect(svc.canCreate!("Org")).toBe(false);
    expect(svc.linkHref!("Org", "2")).toBeUndefined();
  });

  it("P36E.mock.8 the local answers have the server's shapes: search / validate / title agree with the SIMULATED search_link, validate_link and get_link_title over the same rows", async () => {
    const t = createFixtureTransport({
      meta: { Org: [{ name: "Org", title_field: "company_name", show_title_field_in_link: 1, search_fields: "company_name,industry", fields: [{ fieldname: "company_name", fieldtype: "Data" }, { fieldname: "industry", fieldtype: "Data" }] }] as never },
      docs: { Org: ORGS.rows().map((r) => ({ doctype: "Org", ...r })) as FrappeDoc[] },
    });
    const sim = (await t("frappe.desk.search.search_link", { doctype: "Org", txt: "hosp", page_length: 10 })).message;
    expect(localSearchLink(ORGS, "hosp", {})).toEqual(sim);
    const simV = (await t("frappe.client.validate_link", { doctype: "Org", docname: "abc", fields: JSON.stringify(["company_name"]) })).message as Record<string, unknown>;
    expect(localValidateLink(ORGS, "abc", ["company_name"])).toEqual({ name: simV.name, values: { company_name: simV.company_name } });
    expect(localLinkTitle(ORGS, "2")).toBe((await t("frappe.desk.search.get_link_title", { doctype: "Org", docname: "2" })).message);
  });

  it("P36E.mock.9 other controls keep their meta behaviour in local mode: Select options through the supplied translations, Data (Email) maxlength / soft check, Currency precision from the format context", async () => {
    local(
      <div>
        <FrappeField df={df({ fieldname: "src", fieldtype: "Select", options: "\nwebsite\ncold_call", label: "Lead Source" })} value="cold_call" onChange={() => {}} />
        <FrappeField df={df({ fieldname: "email", fieldtype: "Data", options: "Email", label: "Email" })} value="not-an-email" onChange={() => {}} />
        <FrappeField df={df({ fieldname: "rev", fieldtype: "Currency", label: "Revenue" })} value={32000000} onChange={() => {}} />
      </div>,
      { translations: { cold_call: "Cold Call", website: "Website" }, formatContext: { numberFormat: "#,###.##", currency: "USD" } },
    );
    expect(screen.getByRole("combobox", { name: "Lead Source" }).textContent).toContain("Cold Call");
    const email = screen.getByLabelText("Email") as HTMLInputElement;
    expect(email.getAttribute("maxlength")).toBe("140");
    expect(email.getAttribute("type")).toBe("text");
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect((screen.getByLabelText("Revenue") as HTMLInputElement).value).toBe("32,000,000.00");
    await tick(10);
  });

  it("P36E.mock.10 the adapter is exported from @solvfast/ui/frappe", () => {
    expect(typeof Frappe.FrappeLocalForm).toBe("function");
    expect(typeof Frappe.createLocalFormServices).toBe("function");
    expect(typeof Frappe.useFormCapabilities).toBe("function");
  });
});
