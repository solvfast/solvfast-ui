/**
 * Quick Entry (P35): `quickEntryFields` (a port of quick_entry.js:59-110, checked against the REAL 15.110 metas) and
 * `FrappeQuickEntry` / the Link "Create a new X" path over the SIMULATED backend. Nothing here ran against a site.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import todoEn from "./fixtures/real-15.110/todo.en.json";
import userEn from "./fixtures/real-15.110/user.en.json";
import contactEn from "./fixtures/real-15.110/contact.en.json";
import noteEn from "./fixtures/real-15.110/note.en.json";
import eventEn from "./fixtures/real-15.110/event.en.json";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import type { DocTypeMeta, FixtureBackend, FrappeDoc } from "../src/frappe/contract";
import { createFixtureTransport } from "../src/frappe/testing";
import type { FrappeSession } from "../src/frappe/services/permissions";
import { FrappeForm, FrappeQuickEntry, quickEntryFields, quickEntryFilter } from "../src/frappe/form";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const docsOf = (x: unknown) => (x as { docs: DocTypeMeta[] }).docs;
const metaOf = (x: unknown) => docsOf(x)[0];
const parsed = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v) as FrappeDoc;
const tick = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

const VISIT: DocTypeMeta = {
  name: "Visit", autoname: "hash", title_field: "subject",
  fields: [
    { fieldname: "subject", fieldtype: "Data", label: "Subject" },
    { fieldname: "note_ref", fieldtype: "Link", label: "Note", options: "Note" },
    { fieldname: "contact", fieldtype: "Link", label: "Contact", options: "Contact" },
  ],
};

function setup(ui: React.ReactElement, opts: { docs?: FixtureBackend["docs"]; session?: FrappeSession } = {}) {
  const transport = createFixtureTransport({
    meta: { ToDo: docsOf(todoEn), User: docsOf(userEn), Contact: docsOf(contactEn), Note: docsOf(noteEn), Event: docsOf(eventEn), Visit: [VISIT] },
    docs: { Visit: [{ doctype: "Visit", name: "V-1", subject: "Call", modified: "2026-11-01 10:00:00", owner: "Administrator" }], ...opts.docs },
  });
  const client = createFrappeClient({ transport });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
      <QueryClientProvider client={qc}>
        <FrappeProvider client={client} session={opts.session ?? { user: "Administrator" }}>{ui}</FrappeProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return { transport, calls: (m?: string) => transport.store.calls.filter((c) => !m || c.method === m) };
}

describe("F6 quickEntryFields — quick_entry.js:59-110", () => {
  it("FV.F6 real 15.110 metas: ToDo / Note / User eligible with Desk's fields; Contact (quick_entry 0) and Event are not", () => {
    expect(quickEntryFields(metaOf(todoEn))).toMatchObject({ eligible: true });
    expect(quickEntryFields(metaOf(todoEn)).fields.map((f) => f.fieldname)).toEqual(["date", "description"]);
    expect(quickEntryFields(metaOf(noteEn)).fields.map((f) => f.fieldname)).toEqual(["title"]);
    expect(quickEntryFields(metaOf(userEn)).fields.map((f) => f.fieldname)).toEqual(["email", "first_name", "role_profile_name"]);
    expect(quickEntryFields(metaOf(contactEn))).toMatchObject({ eligible: false, reason: "not-quick-entry" });
    expect(quickEntryFields(metaOf(eventEn))).toMatchObject({ eligible: false, reason: "not-quick-entry" });
  });
  it("FV.F6 the field rule: reqd or allow_in_quick_entry, not read_only / virtual / Tab Break; mandatory Table → not eligible", () => {
    const meta: DocTypeMeta = {
      name: "Q", quick_entry: 1, fields: [
        { fieldname: "a", fieldtype: "Data", reqd: 1 },
        { fieldname: "b", fieldtype: "Data", allow_in_quick_entry: 1 },
        { fieldname: "c", fieldtype: "Data", reqd: 1, read_only: 1 },
        { fieldname: "d", fieldtype: "Data", reqd: 1, is_virtual: 1 },
        { fieldname: "t", fieldtype: "Tab Break", allow_in_quick_entry: 1 },
        { fieldname: "e", fieldtype: "Data" },
        { fieldname: "m", fieldtype: "Table MultiSelect", options: "X", reqd: 1 },
      ],
    };
    expect(quickEntryFields(meta)).toEqual({ eligible: true, fields: [meta.fields[0], meta.fields[1], meta.fields[6]] });
    expect(quickEntryFields({ ...meta, fields: [...meta.fields, { fieldname: "rows", fieldtype: "Table", options: "Y", reqd: 1 }] })).toMatchObject({ eligible: false, reason: "mandatory-table" });
    expect(quickEntryFields({ name: "Q", quick_entry: 1, fields: [{ fieldname: "e", fieldtype: "Data" }] })).toMatchObject({ eligible: false, reason: "no-fields" });
    // Prompt naming prepends "{DocType} Name" (validate_for_prompt_autoname) — eligible even without other fields
    const prompt = quickEntryFields({ name: "Q", quick_entry: 1, autoname: "Prompt", fields: [] });
    expect(prompt).toMatchObject({ eligible: true, fields: [{ fieldname: "__newname", label: "Q Name", reqd: 1 }] });
    expect(quickEntryFilter(meta)(meta.fields[5])).toBe(false);
  });
});

describe("F6 FrappeQuickEntry — a Dialog over FrappeFormView (SIMULATED save)", () => {
  it("FV.F6 shows only the quick-entry fields, saves through savedocs, hands back the server doc and closes", async () => {
    const onCreated = vi.fn();
    const onOpenChange = vi.fn();
    const { calls } = setup(<FrappeQuickEntry doctype="Note" open onOpenChange={onOpenChange} onCreated={onCreated} />);
    const dialog = await screen.findByRole("dialog", { name: "New Note" });
    const title = await within(dialog).findByRole("textbox", { name: /Title/ });
    expect(within(dialog).queryByText("Public")).toBeNull(); // not a quick-entry field
    fireEvent.change(title, { target: { value: "Quick one" } });
    fireEvent.blur(title);
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    const sent = parsed(calls("frappe.desk.form.save.savedocs")[0].args.doc);
    expect(sent).toMatchObject({ doctype: "Note", title: "Quick one", __islocal: 1 });
    expect(onCreated.mock.calls[0][0].name).not.toMatch(/^new-/);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("FV.F6 the form's mandatory check runs: Save with an empty required field opens Missing Fields, nothing is sent", async () => {
    const { calls } = setup(<FrappeQuickEntry doctype="Note" open onOpenChange={() => {}} onCreated={() => {}} />);
    const dialog = await screen.findByRole("dialog", { name: "New Note" });
    await within(dialog).findByRole("textbox", { name: /Title/ });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("dialog", { name: "Missing Fields" })).toBeTruthy();
    expect(calls("frappe.desk.form.save.savedocs")).toHaveLength(0);
  });

  it("FV.F6 'Edit Full Form' hands over the document as typed; a not-eligible DocType goes straight to onOpenFullForm", async () => {
    const full = vi.fn();
    setup(<FrappeQuickEntry doctype="Note" open onOpenChange={() => {}} onCreated={() => {}} onOpenFullForm={full} />);
    const dialog = await screen.findByRole("dialog", { name: "New Note" });
    const title = await within(dialog).findByRole("textbox", { name: /Title/ });
    fireEvent.change(title, { target: { value: "Half typed" } });
    fireEvent.blur(title);
    fireEvent.click(within(dialog).getByRole("button", { name: "Edit Full Form" }));
    expect(full).toHaveBeenCalledWith(expect.objectContaining({ doctype: "Note", title: "Half typed", __islocal: 1 }));
    cleanup();
    const full2 = vi.fn();
    const close = vi.fn();
    setup(<FrappeQuickEntry doctype="Contact" open onOpenChange={close} onCreated={() => {}} onOpenFullForm={full2} />);
    await waitFor(() => expect(full2).toHaveBeenCalledWith(expect.objectContaining({ doctype: "Contact", __islocal: 1 })));
    expect(close).toHaveBeenCalledWith(false);
  });

  it("FV.F6 negative: without the create right Save is disabled (rule 9)", async () => {
    setup(<FrappeQuickEntry doctype="Note" open onOpenChange={() => {}} onCreated={() => {}} />, { session: { user: "u@x", roles: ["Guest"] } });
    const dialog = await screen.findByRole("dialog", { name: "New Note" });
    await tick(30);
    expect((within(dialog).getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("F6 Link 'Create a new X' opens Quick Entry and writes the new name back (Desk update_calling_link)", () => {
  it("FV.F6 FrappeForm: typing in a Link to a quick-entry DocType offers Create; saving it sets the Link", async () => {
    const { calls } = setup(<FrappeForm doctype="Visit" name="V-1" guardUnload={false} />);
    const box = await screen.findByRole("combobox", { name: /Note/ });
    act(() => (box as HTMLInputElement).focus());
    fireEvent.change(box, { target: { value: "Brand new" } });
    await tick(600);
    fireEvent.click(await screen.findByRole("option", { name: "Create a new Note" }));
    const dialog = await screen.findByRole("dialog", { name: "New Note" });
    // the typed text is the new doc's name field (Desk name_field → title_field)
    const title = await within(dialog).findByRole("textbox", { name: /Title/ });
    expect((title as HTMLInputElement).value).toBe("Brand new");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "New Note" })).toBeNull());
    const created = parsed(calls("frappe.desk.form.save.savedocs")[0].args.doc);
    expect(created.doctype).toBe("Note");
    await waitFor(() => expect(calls("frappe.client.validate_link").some((c) => c.args.doctype === "Note")).toBe(true));
    expect(await screen.findByText("Not Saved")).toBeTruthy(); // the Visit now holds the new Note
  });

  it("FV.F6 negative: a target that is not quick-entry eligible (Contact, quick_entry 0) offers no Create without the app's onCreateNew", async () => {
    setup(<FrappeForm doctype="Visit" name="V-1" guardUnload={false} />);
    const box = await screen.findByRole("combobox", { name: /Contact/ });
    act(() => (box as HTMLInputElement).focus());
    fireEvent.change(box, { target: { value: "Ann" } });
    await tick(600);
    expect(screen.queryByRole("option", { name: "Create a new Contact" })).toBeNull();
  });

  it("FV.F6 a DocType that is not quick-entry eligible and no onOpenFullForm: the dialog shows the whole form", async () => {
    setup(<FrappeQuickEntry doctype="Visit" open onOpenChange={() => {}} onCreated={() => {}} />);
    const dialog = await screen.findByRole("dialog", { name: "New Visit" });
    expect(await within(dialog).findByRole("textbox", { name: /Subject/ })).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: "Edit Full Form" })).toBeNull();
  });
});
