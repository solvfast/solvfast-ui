/**
 * Families — FamilyTabs (Core) and the Frappe family screens (FrappeNewFamilyRecord, FrappeFamilyRecord, FrappeTypeForm,
 * fetchFamilyTypes / fetchFamilyRecord) on the in-package SIMULATOR (`createFixtureTransport`): a parent "Ticket", a
 * registry "Ticket Type" laid out as a Sayr registry, and two type DocTypes. SIMULATED, never a real site.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import type { DocPerm, DocTypeMeta, FrappeDoc } from "../src/frappe/contract";
import { createFixtureTransport } from "../src/frappe/testing";
import * as core from "../src";
import { FamilyTabs } from "../src/record";
import {
  FrappeFamilyRecord, FrappeNewFamilyRecord, FrappeTypeForm, fetchFamilyRecord, fetchFamilyTypes, type FamilyDescriptor,
} from "../src/frappe";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => cleanup());

const T = "2026-11-10 09:00:00.000000";
const ALL: DocPerm[] = [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1 }];
const REGISTRY: DocTypeMeta = {
  name: "Ticket Type", autoname: "field:type_name", title_field: "type_name", permissions: ALL,
  fields: [
    { fieldname: "type_name", fieldtype: "Data", label: "Name", reqd: 1 },
    { fieldname: "type_name_ar", fieldtype: "Data", label: "Arabic Name" },
    { fieldname: "description", fieldtype: "Small Text", label: "Description" },
    { fieldname: "type_doctype", fieldtype: "Link", label: "Records DocType", options: "DocType", read_only: 1 },
    { fieldname: "enabled", fieldtype: "Check", label: "Enabled", default: "1" },
    { fieldname: "configuration_section", fieldtype: "Section Break", label: "Configuration" },
    { fieldname: "lifecycle", fieldtype: "Link", label: "Linked Lifecycle", options: "Sear Lifecycle" },
    { fieldname: "sla_policy", fieldtype: "Link", label: "SLA Policy", options: "Sear SLA Policy" },
    { fieldname: "configuration_column", fieldtype: "Column Break" },
    { fieldname: "assignment_profile", fieldtype: "Link", label: "Assignment Profile", options: "Sear Assignment Profile" },
    { fieldname: "wizard_mode", fieldtype: "Check", label: "Wizard Mode" },
  ],
};
const PARENT: DocTypeMeta = {
  name: "Ticket", autoname: "TKT-.#####", permissions: ALL,
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title" },
    { fieldname: "inheritance_type", fieldtype: "Link", label: "Type", options: "Ticket Type", read_only: 1 },
    { fieldname: "inheritance_doctype", fieldtype: "Link", label: "Record Type", options: "DocType", read_only: 1 },
    { fieldname: "inheritance_record", fieldtype: "Dynamic Link", label: "Record", options: "inheritance_doctype", read_only: 1 },
  ],
};
const typeDoctype = (name: string): DocTypeMeta => ({
  name, autoname: "hash", permissions: ALL,
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title" },
    { fieldname: "own_tab", fieldtype: "Tab Break", label: "Refund Details" },
    { fieldname: "booking", fieldtype: "Data", label: "Booking Reference" },
  ],
});
const row = (doctype: string, name: string, extra: Record<string, unknown>) => ({ doctype, name, owner: "Administrator", creation: T, modified: T, docstatus: 0, ...extra }) as FrappeDoc;
const FAMILY: FamilyDescriptor = { parent: "Ticket", registry: "Ticket Type", labelField: "type_name", labelArField: "type_name_ar" };

function site(registry: DocTypeMeta = REGISTRY) {
  const t = createFixtureTransport({
    meta: { "Ticket Type": [registry], Ticket: [PARENT], "Ticket Refund Request": [typeDoctype("Ticket Refund Request")], "Ticket Complaint": [typeDoctype("Ticket Complaint")] },
    docs: {
      "Ticket Type": [
        row("Ticket Type", "Refund Request", { type_name: "Refund Request", type_name_ar: "طلب استرداد", type_doctype: "Ticket Refund Request", enabled: 1, description: "Money back" }),
        row("Ticket Type", "Complaint", { type_name: "Complaint", type_doctype: "Ticket Complaint", enabled: 1, wizard_mode: 1 }),
        row("Ticket Type", "Retired", { type_name: "Retired", type_doctype: "Ticket Complaint", enabled: 0 }),
        row("Ticket Type", "Unmade", { type_name: "Unmade", enabled: 1 }),
      ],
      Ticket: [row("Ticket", "TKT-00042", { title: "Refund for 5521", inheritance_type: "Refund Request", inheritance_doctype: "Ticket Refund Request", inheritance_record: "TKT-00042" })],
      "Ticket Refund Request": [row("Ticket Refund Request", "TKT-00042", { title: "Refund for 5521", booking: "BK-5521" })],
    },
  });
  return { t, client: createFrappeClient({ transport: t }) };
}
type Site = ReturnType<typeof site>;
function mount(s: Site, ui: React.ReactElement, language: "en" | "ar" = "en") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FrappeProvider client={s.client} queryClient={qc} session={{ user: "Administrator", roles: ["System Manager"] }}>
        <ThemeProvider defaultLanguage={language} storageKeys={null}>{ui}</ThemeProvider>
      </FrappeProvider>
    </QueryClientProvider>,
  );
}

describe("FAM.tabs — FamilyTabs (Core)", () => {
  it("FAM.tabs.1 is the core entry's export and shows Records | Types; a click asks the app to route", () => {
    expect(core.FamilyTabs).toBe(FamilyTabs);
    const onChange = vi.fn();
    render(<ThemeProvider storageKeys={null}><FamilyTabs active="records" onChange={onChange} types={{ label: { en: "Ticket Types", ar: "أنواع التذاكر" } }} /></ThemeProvider>);
    expect(screen.getByRole("tab", { name: "Records" })).toBeTruthy();
    const types = screen.getByRole("tab", { name: "Ticket Types" });
    fireEvent.mouseDown(types);
    expect(onChange).toHaveBeenCalledWith("types");
  });

  it("FAM.tabs.2 records={false} leaves Types alone; Arabic labels", () => {
    render(<ThemeProvider defaultLanguage="ar" storageKeys={null}><FamilyTabs active="types" onChange={() => {}} records={false} /></ThemeProvider>);
    expect(screen.queryByRole("tab", { name: "السجلات" })).toBeNull();
    expect(screen.getByRole("tab", { name: "الأنواع" })).toBeTruthy();
  });
});

describe("FAM.data — fetchFamilyTypes / fetchFamilyRecord (SIMULATED)", () => {
  it("FAM.data.1 offers only enabled types that have a DocType, with both names; a field the registry lacks is not asked for", async () => {
    const s = site();
    const types = await fetchFamilyTypes(s.client as never, FAMILY);
    expect(types.map((x) => x.name)).toEqual(["Complaint", "Refund Request"]);
    expect(types[1]).toMatchObject({ doctype: "Ticket Refund Request", label: { en: "Refund Request", ar: "طلب استرداد" }, description: "Money back" });
    expect(types[0].label).toEqual({ en: "Complaint", ar: "Complaint" });
    expect(types.map((x) => x.wizard)).toEqual([true, false]);
    const asked = s.t.store.calls.find((c) => c.method === "frappe.client.get_list")!.args.fields as string;
    expect(asked).not.toContain("color");
  });

  it("FAM.data.2 a parent row names its record; a missing row is not-found", async () => {
    const s = site();
    expect(await fetchFamilyRecord(s.client as never, FAMILY, "TKT-00042")).toEqual({ doctype: "Ticket Refund Request", name: "TKT-00042", type: "Refund Request" });
    await expect(fetchFamilyRecord(s.client as never, FAMILY, "TKT-99999")).rejects.toThrow("not-found");
  });
});

describe("FAM.screens — the Frappe family screens (SIMULATED)", () => {
  it("FAM.screens.1 FrappeFamilyRecord opens the record in its type's DocType", async () => {
    mount(site(), <FrappeFamilyRecord family={FAMILY} name="TKT-00042" />);
    expect(await screen.findByDisplayValue("Refund for 5521", {}, { timeout: 3000 })).toBeTruthy();
  });

  it("FAM.screens.2 FrappeFamilyRecord says when the parent row is missing (Arabic)", async () => {
    mount(site(), <FrappeFamilyRecord family={FAMILY} name="TKT-99999" />, "ar");
    expect(await screen.findByText("لم يُعثر على هذا السجل.")).toBeTruthy();
  });

  it("FAM.screens.3 FrappeNewFamilyRecord shows the chosen type's fields in one list and creates the record there", async () => {
    const s = site();
    const onCreated = vi.fn();
    mount(s, <FrappeNewFamilyRecord family={FAMILY} defaultType="Refund Request" onCreated={onCreated} />);
    const booking = await screen.findByRole("textbox", { name: /Booking Reference/ }, { timeout: 3000 });
    expect(screen.queryByRole("tab", { name: "Refund Details" })).toBeNull();
    // The form commits a typed value on blur, as Desk does.
    fireEvent.focus(booking);
    fireEvent.change(booking, { target: { value: "BK-7000" } });
    fireEvent.blur(booking);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const [doc, type] = onCreated.mock.calls[0];
    expect(doc).toMatchObject({ doctype: "Ticket Refund Request", booking: "BK-7000" });
    expect(type.name).toBe("Refund Request");
  });

  it("FAM.screens.4 FrappeNewFamilyRecord without a type asks for one; Create waits", async () => {
    mount(site(), <FrappeNewFamilyRecord family={FAMILY} onCreated={() => {}} onCancel={() => {}} />);
    expect(await screen.findByText("Choose a type to see its fields")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Create" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("FAM.screens.7 a wizard type walks its tabs as steps: Next, Back, and Create on the last step", async () => {
    const s = site();
    const onCreated = vi.fn();
    mount(s, <FrappeNewFamilyRecord family={FAMILY} defaultType="Complaint" onCreated={onCreated} />);
    const title = await screen.findByRole("textbox", { name: /Title/ }, { timeout: 3000 });
    await waitFor(() => expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole("textbox", { name: /Booking Reference/ })).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByRole("button", { name: "Create" })).toBeNull();
    fireEvent.focus(title); fireEvent.change(title, { target: { value: "Late reply" } }); fireEvent.blur(title);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const booking = await screen.findByRole("textbox", { name: /Booking Reference/ });
    fireEvent.focus(booking); fireEvent.change(booking, { target: { value: "BK-1" } }); fireEvent.blur(booking);
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(onCreated.mock.calls[0][0]).toMatchObject({ doctype: "Ticket Complaint", title: "Late reply", booking: "BK-1" });
  });

  it("FAM.screens.8 the Wizard mode field is the designer's switch, saved on its own; a new type starts with the defaults", async () => {
    const s = site();
    let ctx: { wizard?: { on: boolean; onChange: (on: boolean) => Promise<void> } } = {};
    const first = mount(s, <FrappeTypeForm family={FAMILY} name="Refund Request" designer={(_dt, c) => { ctx = c; return <p>designer</p>; }} />);
    await screen.findByText("designer");
    expect(screen.queryByText("Wizard Mode")).toBeNull();
    expect(ctx.wizard?.on).toBe(false);
    await ctx.wizard!.onChange(true);
    const sent = s.t.store.calls.find((c) => c.method === "frappe.client.set_value")!.args;
    expect(sent).toMatchObject({ doctype: "Ticket Type", name: "Refund Request", fieldname: "wizard_mode", value: 1 });
    first.unmount();
    mount(site(), <FrappeTypeForm family={FAMILY} defaults={{ description: "Starts here" }} />);
    expect(await screen.findByDisplayValue("Starts here", {}, { timeout: 3000 })).toBeTruthy();
  });

  it("FAM.screens.9 the Appearance section is one icon + colour picker; picking an icon also picks the first colour", async () => {
    const withLook: DocTypeMeta = { ...REGISTRY, fields: [
      { fieldname: "appearance_section", fieldtype: "Section Break", label: "Appearance" },
      { fieldname: "icon", fieldtype: "Data", label: "Icon" },
      { fieldname: "appearance_column", fieldtype: "Column Break" },
      { fieldname: "color", fieldtype: "Color", label: "Color" },
      ...REGISTRY.fields,
    ] };
    const s = site(withLook);
    const onSaved = vi.fn();
    mount(s, <FrappeTypeForm family={FAMILY} onSaved={onSaved} />);
    fireEvent.click(await screen.findByRole("radio", { name: "Users" }, { timeout: 3000 }));
    expect(screen.getByText("Icon & color preview")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "#F26B1D" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "#22c55e" }));
    const name = screen.getByRole("textbox", { name: /^Name/ });
    fireEvent.focus(name); fireEvent.change(name, { target: { value: "Looks" } }); fireEvent.blur(name);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onSaved.mock.calls[0][0]).toMatchObject({ icon: "Users", color: "#22c55e" });
  });

  it("FAM.screens.5 FrappeTypeForm shows Configuration by default and hides it with configuration={false}", async () => {
    const first = mount(site(), <FrappeTypeForm family={FAMILY} name="Refund Request" />);
    expect(await screen.findByText("Linked Lifecycle")).toBeTruthy();
    first.unmount();
    mount(site(), <FrappeTypeForm family={FAMILY} name="Refund Request" configuration={false} />);
    expect(await screen.findByText("Records DocType")).toBeTruthy();
    expect(screen.queryByText("Linked Lifecycle")).toBeNull();
    expect(screen.queryByText("Assignment Profile")).toBeNull();
  });

  it("FAM.screens.6 FrappeTypeForm hands a saved type's DocType to `designer`; a new type gets none", async () => {
    const designer = vi.fn((doctype: string) => <p>designer for {doctype}</p>);
    const saved = mount(site(), <FrappeTypeForm family={FAMILY} name="Refund Request" designer={designer} />);
    expect(await screen.findByText("designer for Ticket Refund Request")).toBeTruthy();
    saved.unmount();
    designer.mockClear();
    mount(site(), <FrappeTypeForm family={FAMILY} designer={designer} />);
    await screen.findByText("Arabic Name", {}, { timeout: 3000 });
    expect(designer).not.toHaveBeenCalled();
  });
});
