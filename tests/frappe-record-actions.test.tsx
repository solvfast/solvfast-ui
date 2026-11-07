/**
 * P35 record (Frappe layer) on the SIMULATED backend (`createFixtureTransport`, src/frappe/testing): the form menu,
 * form print, connections, e-mail composer and reminder. Every server answer comes from the in-memory simulator
 * (shapes reproduced from Frappe 15.110, cited in src/frappe/testing/handlers/record.ts); permission decisions are the
 * simulator's approximation. Request SHAPES are asserted from `store.calls`. Nothing here ran against a real site.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEn from "./fixtures/real-15.110/user.en.json";
import customerEn from "./fixtures/real-15.110/customer.en.json";
import todoEn from "./fixtures/real-15.110/todo.en.json";
import contactEn from "./fixtures/real-15.110/contact.en.json";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import type { DocPerm, DocTypeMeta, FrappeDoc, MetaBundle } from "../src/frappe/contract";
import { createFixtureTransport, type FixtureTransport, type SimulatedPermissions } from "../src/frappe/testing";
import {
  FrappeConnections, FrappeEmailComposer, FrappeFormPrint, FrappeRecordMenu, connectionFilters, connectionsFromMeta, customizeHref, downloadPdfUrl,
  emailMakeArgs, formMenuItems, parseOpenCount, printViewUrl,
} from "../src/frappe/record";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(cleanup);

const ALL = { read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1, amend: 1, select: 1, report: 1, export: 1, import: 1, print: 1, email: 1, share: 1 } as const;
const SM: DocPerm = { role: "System Manager", permlevel: 0, ...ALL };
const DEAL: DocTypeMeta = {
  name: "Deal", autoname: "hash", title_field: "title", allow_rename: 1, is_submittable: 1,
  permissions: [
    SM,
    { role: "Sales User", permlevel: 0, read: 1, write: 1, create: 1, print: 1, email: 1, select: 1 },
    { role: "Viewer", permlevel: 0, read: 1, select: 1 },
  ],
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title" },
    { fieldname: "email_id", fieldtype: "Data", options: "Email", label: "Email" },
    { fieldname: "notes_section", fieldtype: "Section Break", label: "Notes" },
    { fieldname: "secret", fieldtype: "Data", label: "Secret margin", print_hide: 1 },
  ],
  __print_formats: [{ name: "Deal Fancy", print_format_type: "Jinja" }, { name: "Deal JS", print_format_type: "JS" }],
  __dashboard: { fieldname: "deal", transactions: [{ label: "Activity", items: ["Deal Note"] }], non_standard_fieldnames: {}, internal_links: {} },
} as DocTypeMeta;
const DEAL_NOTE: DocTypeMeta = { name: "Deal Note", autoname: "hash", permissions: [SM], fields: [{ fieldname: "deal", fieldtype: "Link", options: "Deal", label: "Deal" }] };
const EMAIL_TEMPLATE: DocTypeMeta = {
  name: "Email Template", autoname: "Prompt", permissions: [SM, { role: "Desk User", permlevel: 0, read: 1 }],
  fields: [{ fieldname: "subject", fieldtype: "Data", label: "Subject" }, { fieldname: "response", fieldtype: "Text Editor", label: "Response" }],
};
const bundle: MetaBundle = { doctype: "Deal", meta: DEAL, children: {} };
const T = "2026-11-02 09:00:00.000000";
const docsOf = (x: unknown) => (x as { docs: DocTypeMeta[] }).docs;

function site(permissions?: SimulatedPermissions, extraDocs: Record<string, FrappeDoc[]> = {}) {
  return createFixtureTransport({
    meta: { Deal: [DEAL], "Deal Note": [DEAL_NOTE], "Email Template": [EMAIL_TEMPLATE] },
    docs: {
      Deal: [
        { doctype: "Deal", name: "D-1", title: "Big order", email_id: "client@x.org", docstatus: 0, owner: "Administrator", modified: T, creation: T },
        { doctype: "Deal", name: "D-2", title: "Signed", docstatus: 1, owner: "Administrator", modified: T, creation: T },
        { doctype: "Deal", name: "D-3", title: "Lost", docstatus: 2, owner: "Administrator", modified: T, creation: T },
      ] as FrappeDoc[],
      "Deal Note": [{ doctype: "Deal Note", name: "N-1", deal: "D-1" }, { doctype: "Deal Note", name: "N-2", deal: "D-1" }, { doctype: "Deal Note", name: "N-3", deal: "D-2" }] as FrappeDoc[],
      "Letter Head": [{ doctype: "Letter Head", name: "Acme", letter_head_name: "Acme", is_default: 1, disabled: 0 }] as FrappeDoc[],
      "Email Template": [{ doctype: "Email Template", name: "Welcome", subject: "About {{ title }}", response: "<p>Dear client of {{ doc.name }}</p>" }] as FrappeDoc[],
      ...extraDocs,
    },
  }, permissions ? { permissions } : {});
}
const stored = (t: FixtureTransport, doctype: string, name: string) => t.store.docs.get(doctype)?.get(name);
const calls = (t: FixtureTransport, method: string) => t.store.calls.filter((c) => c.method === method);

function mount(t: FixtureTransport, ui: React.ReactElement) {
  const client = createFrappeClient({ transport: t, files: t.files });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const s = t.store.session ?? { user: "Administrator", roles: ["System Manager"] };
  return render(
    <QueryClientProvider client={qc}>
      <FrappeProvider client={client} queryClient={qc} session={s} serverMessages={false}><ThemeProvider>{ui}</ThemeProvider></FrappeProvider>
    </QueryClientProvider>,
  );
}
async function openMenu() {
  fireEvent.keyDown(await screen.findByRole("button", { name: "Menu" }), { key: "Enter" });
  return screen.findByRole("menu");
}
const labels = (menu: HTMLElement) => within(menu).getAllByRole("menuitem").map((m) => m.querySelector("span")!.textContent);

// ---------------------------------------------------------------------------------------------------------------------
describe("formMenuItems — Desk toolbar.js make_menu_items rules (pure)", () => {
  const can = (rights: string[]) => (p: string) => rights.includes(p);
  const every = can(["read", "write", "create", "delete", "print", "email"]);
  const ids = (o: Partial<Parameters<typeof formMenuItems>[0]>) => formMenuItems({ meta: DEAL, doc: { doctype: "Deal", name: "D-1", docstatus: 0 }, can: every, ...o }).map((e) => e.id);
  it("FV.K16 every entry with every right and every host capability, in Desk order", () => {
    expect(ids({ roles: ["System Manager"], has: { links: true, duplicate: true, reload: true, new: true }, undo: { canUndo: true, canRedo: false } }))
      .toEqual(["print", "email", "links", "duplicate", "copy", "rename", "reload", "delete", "remind", "undo", "redo", "customize", "new"]);
  });
  it("FV.K4 FV.L1 Print follows Print Settings (draft default allowed, cancelled default refused) and the print right; never on a new doc", () => {
    expect(ids({ doc: { doctype: "Deal", name: "D-3", docstatus: 2 } })).not.toContain("print");
    expect(ids({ doc: { doctype: "Deal", name: "D-3", docstatus: 2 }, printSettings: { allow_print_for_cancelled: 1 } })).toContain("print");
    expect(ids({ printSettings: { allow_print_for_draft: 0 } })).not.toContain("print");
    expect(ids({ doc: { doctype: "Deal", name: "D-2", docstatus: 1 }, printSettings: { allow_print_for_draft: 0 } })).toContain("print");
    expect(ids({ can: can(["read"]) })).not.toContain("print");
    expect(ids({ doc: { doctype: "Deal", name: "new-deal-1", __islocal: 1 } })).not.toContain("print");
  });
  it("FV.K5 FV.K8 FV.K9 FV.K15 Email < cancelled; Rename = write + allow_rename + saved; Delete ≠ submitted + delete right; New = create, not in_create", () => {
    expect(ids({ doc: { doctype: "Deal", name: "D-3", docstatus: 2 } })).not.toContain("email");
    expect(ids({ can: can(["read", "print"]) })).not.toContain("email");
    expect(ids({ meta: { ...DEAL, allow_rename: 0 } })).not.toContain("rename");
    expect(ids({ can: can(["read", "delete"]) })).not.toContain("rename");
    expect(ids({ doc: { doctype: "Deal", name: "D-2", docstatus: 1 } })).not.toContain("delete");
    expect(ids({ can: can(["read", "write"]) })).not.toContain("delete");
    expect(ids({ doc: { doctype: "Deal", name: "new-deal-1", __islocal: 1 }, has: { new: true } })).toEqual(["copy"]);
    expect(ids({ has: { new: true }, meta: { ...DEAL, in_create: 1 } })).not.toContain("new");
    expect(ids({ has: { new: true }, can: can(["read"]) })).not.toContain("new");
  });
  it("FV.K6 FV.K11 FV.K14 Duplicate hidden by allow_copy ('Hide Copy'); Customize for System Manager only (custom DocType → its DocType form); Undo / Redo disabled from host state; exclude", () => {
    expect(ids({ has: { duplicate: true }, meta: { ...DEAL, allow_copy: 1 } })).not.toContain("duplicate");
    expect(ids({ roles: ["Sales User"] })).not.toContain("customize");
    expect(ids({ roles: undefined })).not.toContain("customize");
    expect(customizeHref(DEAL)).toBe("/app/customize-form?doc_type=Deal");
    expect(customizeHref({ ...DEAL, custom: 1 })).toBe("/app/doctype/Deal");
    const u = formMenuItems({ meta: DEAL, doc: { doctype: "Deal", name: "D-1" }, can: every, undo: { canUndo: false, canRedo: true } });
    expect(u.find((e) => e.id === "undo")?.disabled).toBe(true);
    expect(u.find((e) => e.id === "redo")?.disabled).toBe(false);
    expect(ids({ exclude: ["copy", "remind", "email"] })).toEqual(["print", "rename", "delete"]);
    expect(formMenuItems({ meta: DEAL, doc: { doctype: "Deal", name: "D-1" }, can: every, has: { reload: true }, dirty: true }).find((e) => e.id === "reload")?.confirm).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("FrappeRecordMenu on the SIMULATED backend", () => {
  it("FV.K3 FV.K16 a System Manager gets Desk's menu; Customize goes to Customize Form", async () => {
    const t = site({ user: "sara@x.org", roles: ["System Manager"] });
    const onCustomize = vi.fn();
    mount(t, <FrappeRecordMenu bundle={bundle} doc={stored(t, "Deal", "D-1")!} onShowConnections={() => {}} onDuplicate={() => {}} onReload={async () => undefined} onNew={() => {}} onCustomize={onCustomize} />);
    await waitFor(() => expect(calls(t, "frappe.desk.form.load.get_docinfo")).toHaveLength(1));
    const menu = await openMenu();
    expect(labels(menu)).toEqual(["Print", "Email", "Links", "Duplicate", "Copy to Clipboard", "Rename", "Reload", "Delete", "Remind Me", "Customize", "New Deal"]);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Customize" }));
    expect(onCustomize).toHaveBeenCalledWith("/app/customize-form?doc_type=Deal");
  });
  it("FV.K9 Delete asks 'Permanently delete {title} ({name})?', then frappe.client.delete removes it (SIMULATED store) and onDeleted runs", async () => {
    const t = site({ user: "sara@x.org", roles: ["System Manager"] });
    const onDeleted = vi.fn();
    mount(t, <FrappeRecordMenu bundle={bundle} doc={stored(t, "Deal", "D-1")!} onDeleted={onDeleted} />);
    fireEvent.click(within(await openMenu()).getByRole("menuitem", { name: /Delete/ }));
    const dlg = await screen.findByRole("alertdialog");
    expect(within(dlg).getByText("Permanently delete Big order (D-1)?")).toBeTruthy();
    fireEvent.click(within(dlg).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(calls(t, "frappe.client.delete").map((c) => c.args)).toEqual([{ doctype: "Deal", name: "D-1" }]);
    expect(stored(t, "Deal", "D-1")).toBeUndefined();
    expect(screen.getByRole("status").textContent).toBe("Deleted D-1");
  });
  it("FV.K9 permission negative: a Sales User (no delete right) sees no Delete and no Customize; a Viewer gets no Print / Email / Rename", async () => {
    const t = site({ user: "lina@x.org", roles: ["Sales User"] });
    mount(t, <FrappeRecordMenu bundle={bundle} doc={stored(t, "Deal", "D-1")!} />);
    await waitFor(() => expect(calls(t, "frappe.desk.form.load.get_docinfo")).toHaveLength(1));
    const menu = await openMenu();
    expect(labels(menu)).toEqual(["Print", "Email", "Copy to Clipboard", "Rename", "Remind Me"]);
    cleanup();
    const v = site({ user: "vic@x.org", roles: ["Viewer"] });
    mount(v, <FrappeRecordMenu bundle={bundle} doc={stored(v, "Deal", "D-1")!} />);
    await waitFor(() => expect(calls(v, "frappe.desk.form.load.get_docinfo")).toHaveLength(1));
    expect(labels(await openMenu())).toEqual(["Copy to Clipboard", "Remind Me"]);
  });
  it("FV.K9 a server refusal surfaces: the client believes it may delete, the SIMULATED server (Sales User) answers 403 — error shown, doc kept, onDeleted not called", async () => {
    const t = site({ user: "lina@x.org", roles: ["Sales User"] });
    const onDeleted = vi.fn();
    mount(t, <FrappeRecordMenu bundle={bundle} doc={stored(t, "Deal", "D-1")!} permissions={{ can: () => true }} onDeleted={onDeleted} />);
    fireEvent.click(within(await openMenu()).getByRole("menuitem", { name: /Delete/ }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/not allowed to delete Deal: D-1|Insufficient Permission|No permission/i);
    expect(calls(t, "frappe.client.delete")).toHaveLength(1);
    expect(stored(t, "Deal", "D-1")).toBeDefined();
    expect(onDeleted).not.toHaveBeenCalled();
  });
  it("FV.K8 Rename sends frappe.rename_doc {doctype, old, new, merge} and reports the server's name; a clash is shown in the dialog", async () => {
    const t = site({ user: "sara@x.org", roles: ["System Manager"] });
    const onRenamed = vi.fn();
    mount(t, <FrappeRecordMenu bundle={bundle} doc={stored(t, "Deal", "D-1")!} onRenamed={onRenamed} />);
    fireEvent.click(within(await openMenu()).getByRole("menuitem", { name: "Rename" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("New Name"), { target: { value: "D-2" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Rename" }));
    expect((await within(dlg).findByRole("alert")).textContent).toBe("Another Deal with name D-2 exists, select another name");
    fireEvent.change(within(dlg).getByLabelText("New Name"), { target: { value: "D-100" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Rename" }));
    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith("D-100"));
    expect(calls(t, "frappe.rename_doc").map((c) => c.args)).toEqual([
      { doctype: "Deal", old: "D-1", new: "D-2", merge: 0 }, { doctype: "Deal", old: "D-1", new: "D-100", merge: 0 },
    ].map((a) => expect.objectContaining({ doctype: a.doctype, old: a.old, new: a.new })));
    expect(stored(t, "Deal", "D-100")).toBeDefined();
    expect(stored(t, "Deal", "D-1")).toBeUndefined();
  });
  it("FV.K6 FV.K7 Duplicate hands a local copy (no request); Copy to Clipboard writes JSON.stringify(doc)", async () => {
    const t = site({ user: "sara@x.org", roles: ["System Manager"] });
    const onDuplicate = vi.fn(); const write = vi.fn(async () => {}); const onCopied = vi.fn();
    const doc = stored(t, "Deal", "D-1")!;
    mount(t, <FrappeRecordMenu bundle={bundle} doc={doc} onDuplicate={onDuplicate} writeClipboard={write} onCopied={onCopied} />);
    const before = t.store.calls.length;
    fireEvent.click(within(await openMenu()).getByRole("menuitem", { name: /Duplicate/ }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    const copy = onDuplicate.mock.calls[0][0];
    expect(copy).toMatchObject({ doctype: "Deal", title: "Big order", docstatus: 0, __islocal: 1 });
    expect(copy.name).toMatch(/^new-deal-/);
    expect(t.store.calls.slice(before).filter((c) => !c.method.startsWith("frappe.desk.form.load"))).toEqual([]);
    fireEvent.click(within(await openMenu()).getByRole("menuitem", { name: "Copy to Clipboard" }));
    await waitFor(() => expect(write).toHaveBeenCalledWith(JSON.stringify(doc)));
    expect(onCopied).toHaveBeenCalled();
    expect((await screen.findByRole("status")).textContent).toBe("Copied to clipboard");
  });
  it("FV.K10 FV.K15 FV.K14 Reload asks first when dirty; New calls onNew; Undo / Redo follow the host state", async () => {
    const t = site({ user: "sara@x.org", roles: ["System Manager"] });
    const onReload = vi.fn(async () => undefined); const onNew = vi.fn(); const onUndo = vi.fn();
    mount(t, <FrappeRecordMenu bundle={bundle} doc={stored(t, "Deal", "D-1")!} dirty onReload={onReload} onNew={onNew} undo={{ canUndo: true, canRedo: false, onUndo, onRedo: vi.fn() }} />);
    fireEvent.click(within(await openMenu()).getByRole("menuitem", { name: "Reload" }));
    const dlg = await screen.findByRole("alertdialog");
    expect(within(dlg).getByText("This document has unsaved changes. Reload it and discard them?")).toBeTruthy();
    expect(onReload).not.toHaveBeenCalled();
    fireEvent.click(within(dlg).getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(onReload).toHaveBeenCalled());
    let menu = await openMenu();
    expect(within(menu).getByRole("menuitem", { name: /Redo/ }).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Undo/ }));
    expect(onUndo).toHaveBeenCalled();
    menu = await openMenu();
    fireEvent.click(within(menu).getByRole("menuitem", { name: /New Deal/ }));
    expect(onNew).toHaveBeenCalled();
  });
  it("FV.K13 Remind Me → create_new_reminder {remind_at, description, reminder_doctype, reminder_docname}; the SIMULATED server stores it", async () => {
    const t = site({ user: "sara@x.org", roles: ["System Manager"] });
    const onReminderCreated = vi.fn();
    mount(t, <FrappeRecordMenu bundle={bundle} doc={stored(t, "Deal", "D-1")!} onReminderCreated={onReminderCreated} />);
    fireEvent.click(within(await openMenu()).getByRole("menuitem", { name: /Remind Me/ }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Description"), { target: { value: "Follow up" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Create" }));
    await waitFor(() => expect(onReminderCreated).toHaveBeenCalled());
    const [call] = calls(t, "frappe.automation.doctype.reminder.reminder.create_new_reminder");
    expect(call.args).toMatchObject({ description: "Follow up", reminder_doctype: "Deal", reminder_docname: "D-1" });
    expect(String(call.args.remind_at)).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
    const rem = [...t.store.docs.get("Reminder")!.values()][0];
    expect(rem).toMatchObject({ user: "sara@x.org", reminder_doctype: "Deal", reminder_docname: "D-1", description: "Follow up" });
    expect(screen.getByRole("status").textContent).toBe(`Reminder set at ${String(call.args.remind_at)}`);
    // the server refuses a past time (reminder.py validate) — straight through the transport
    await expect(t("frappe.automation.doctype.reminder.reminder.create_new_reminder", { remind_at: "2001-01-01 00:00:00", description: "x" })).rejects.toMatchObject({ status: 417 });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("FrappeFormPrint on the SIMULATED backend", () => {
  it("FV.L1 FV.L2 FV.L3 formats from the meta (no JS formats), the default letterhead, the preview request shape, a sandboxed frame, the PDF / Full Page URLs", async () => {
    const t = site({ user: "sara@x.org", roles: ["System Manager"] });
    const doc = stored(t, "Deal", "D-1")!;
    mount(t, <FrappeFormPrint doc={doc} meta={DEAL} open onOpenChange={() => {}} canPrint />);
    const frame = await screen.findByTitle("Print preview of Deal D-1");
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(frame.getAttribute("srcdoc")).toContain("SIMULATED preview");
    expect(frame.getAttribute("srcdoc")).not.toContain("Big order"); // simulated preview carries no values
    expect(frame.getAttribute("srcdoc")).not.toContain("Secret margin"); // print_hide
    await waitFor(() => expect((screen.getByRole("combobox", { name: "Letter Head" })).textContent).toBe("Acme"));
    const previews = calls(t, "frappe.www.printview.get_html_and_style");
    const last = previews[previews.length - 1].args;
    expect(JSON.parse(String(last.doc))).toMatchObject({ doctype: "Deal", name: "D-1" });
    expect(last).toMatchObject({ print_format: "Standard", letterhead: "Acme", no_letterhead: 0, settings: "{}" });
    fireEvent.click(screen.getByRole("combobox", { name: "Print Format" }));
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["Standard", "Deal Fancy"]);
    fireEvent.click(screen.getByRole("option", { name: "Deal Fancy" }));
    await waitFor(() => expect(calls(t, "frappe.www.printview.get_html_and_style").some((c) => c.args.print_format === "Deal Fancy")).toBe(true));
    const pdf = screen.getByRole("link", { name: /PDF/ });
    expect(pdf.getAttribute("href")).toBe(downloadPdfUrl("Deal", "D-1", { format: "Deal Fancy", letterhead: "Acme" }));
    expect(pdf.getAttribute("href")).toBe("/api/method/frappe.utils.print_format.download_pdf?doctype=Deal&name=D-1&format=Deal+Fancy&no_letterhead=0&letterhead=Acme&settings=%7B%7D");
    expect(screen.getByRole("link", { name: /Full Page/ }).getAttribute("href")).toBe(printViewUrl("Deal", "D-1", { format: "Deal Fancy", letterhead: "Acme" }));
    expect(screen.getByRole("link", { name: /^Print$/ }).getAttribute("href")).toContain("trigger_print=1");
  });
  it("FV.L5 refused before any request: cancelled (Print Settings default), new document, no print right; a dirty form shows Desk's warning", async () => {
    const t = site();
    mount(t, <FrappeFormPrint doc={stored(t, "Deal", "D-3")!} meta={DEAL} open onOpenChange={() => {}} />);
    expect((await screen.findByRole("alert")).textContent).toBe("Print Settings do not allow printing this document (draft or cancelled).");
    cleanup();
    mount(t, <FrappeFormPrint doc={{ doctype: "Deal", name: "new-deal-1", __islocal: 1 }} meta={DEAL} open onOpenChange={() => {}} />);
    expect((await screen.findByRole("alert")).textContent).toBe("Save the document before printing.");
    cleanup();
    mount(t, <FrappeFormPrint doc={stored(t, "Deal", "D-1")!} meta={DEAL} open onOpenChange={() => {}} canPrint={false} />);
    expect((await screen.findByRole("alert")).textContent).toBe("You are not allowed to print this document.");
    expect(calls(t, "frappe.www.printview.get_html_and_style")).toHaveLength(0);
    cleanup();
    mount(t, <FrappeFormPrint doc={stored(t, "Deal", "D-1")!} meta={DEAL} open onOpenChange={() => {}} dirty />);
    expect((await screen.findByRole("note")).textContent).toMatch(/unsaved changes which might not appear in the final PDF/);
  });
  it("FV.L5 FV.L6 the server's refusal is shown: stored Print Settings forbid drafts (printview.py:137-142) while the client's allow them", async () => {
    const t = site(undefined, { "Print Settings": [{ doctype: "Print Settings", name: "Print Settings", allow_print_for_draft: 0 }] as FrappeDoc[] });
    mount(t, <FrappeFormPrint doc={stored(t, "Deal", "D-1")!} meta={DEAL} open onOpenChange={() => {}} />);
    expect(await screen.findByText("Not allowed to print draft documents")).toBeTruthy();
    expect(screen.queryByTitle("Print preview of Deal D-1")).toBeNull();
  });
  it("FV.L3 pdf=\"download\" POSTs download_pdf through the file transport; the simulator does not simulate it and the refusal is shown (no file saved)", async () => {
    const t = site();
    mount(t, <FrappeFormPrint doc={stored(t, "Deal", "D-2")!} meta={DEAL} open onOpenChange={() => {}} pdf="download" />);
    await screen.findByTitle("Print preview of Deal D-2");
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Letter Head" }).textContent).toBe("Acme"));
    fireEvent.click(screen.getByRole("button", { name: /PDF/ }));
    expect(await screen.findByText(/does not simulate frappe\.utils\.print_format\.download_pdf/)).toBeTruthy();
    expect(calls(t, "frappe.utils.print_format.download_pdf")[0].args).toEqual({ doctype: "Deal", name: "D-2", format: "Standard", no_letterhead: 0, letterhead: "Acme" });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("Connections: meta.__dashboard + get_open_count", () => {
  it("FV.M2 connectionsFromMeta reads the recorded real 15.110 dashboards (User, Customer) and returns null for empty ones (ToDo, Contact)", () => {
    const user = connectionsFromMeta(docsOf(userEn)[0])!;
    expect(user.fieldname).toBe("user");
    expect(user.transactions.map((g) => g.label)).toEqual(["Profile", "Logs", "Settings", "Activity", "Integrations"]);
    expect(user.non_standard_fieldnames.ToDo).toBe("allocated_to");
    expect(connectionFilters(user, "ToDo", "ann@x.org")).toEqual({ allocated_to: "ann@x.org" });
    const customer = connectionsFromMeta(docsOf(customerEn)[0])!;
    expect(connectionFilters(customer, "Quotation", "CUST-1")).toEqual({ quotation_to: "Customer", party_name: "CUST-1" });
    expect(connectionFilters(customer, "Sales Order", "CUST-1")).toEqual({ customer: "CUST-1" });
    expect(connectionsFromMeta(docsOf(todoEn)[0])).toBeNull();
    expect(connectionsFromMeta(docsOf(contactEn)[0])).toBeNull();
    expect(parseOpenCount({ count: { external_links_found: [{ doctype: "ToDo", count: 2, open_count: 1 }, { doctype: "X", count: "?", open_count: 0 }], internal_links_found: [{ doctype: "Y", count: 1, open_count: 0, names: ["Y-1"] }] } }).get("Y"))
      .toEqual({ doctype: "Y", count: 1, openCount: 0, internal: true, names: ["Y-1"] });
  });
  it("FV.M3 FV.M4 FrappeConnections on the real User meta: get_open_count {doctype, name, items}, ToDo counted by allocated_to, open list / new with the link filter, canRead hides", async () => {
    const userMeta = docsOf(userEn)[0];
    const todoMeta = docsOf(todoEn)[0];
    const t = createFixtureTransport({
      meta: { User: docsOf(userEn), ToDo: docsOf(todoEn) },
      docs: {
        User: [{ doctype: "User", name: "ann@x.org", email: "ann@x.org", first_name: "Ann", enabled: 1 }] as FrappeDoc[],
        ToDo: [{ name: "TD-1", description: "a", allocated_to: "ann@x.org", status: "Open" }, { name: "TD-2", description: "b", allocated_to: "ann@x.org", status: "Closed" }, { name: "TD-3", description: "c", allocated_to: "bob@x.org", status: "Open" }] as FrappeDoc[],
      },
    });
    void todoMeta;
    const onOpenList = vi.fn(); const onNew = vi.fn();
    mount(t, <FrappeConnections meta={userMeta} doc={stored(t, "User", "ann@x.org")!} onOpenList={onOpenList} onNew={onNew} canRead={(d) => d !== "Token Cache"} canCreate={(d) => d === "ToDo"} />);
    await waitFor(() => expect(document.querySelector('[data-connection="ToDo"] [data-count]')?.textContent).toBe("2"));
    const [call] = calls(t, "frappe.desk.notifications.get_open_count");
    expect(call.args.doctype).toBe("User");
    expect(call.args.name).toBe("ann@x.org");
    expect(JSON.parse(String(call.args.items))).not.toContain("Token Cache");
    expect(JSON.parse(String(call.args.items))).toContain("ToDo");
    expect(screen.queryByRole("region", { name: "Integrations" })).toBeNull(); // its only item is unreadable
    fireEvent.click(screen.getByRole("button", { name: "Open the ToDo list" }));
    expect(onOpenList).toHaveBeenCalledWith("ToDo", { allocated_to: "ann@x.org" });
    fireEvent.click(screen.getByRole("button", { name: "Create a new ToDo" }));
    expect(onNew).toHaveBeenCalledWith("ToDo", { allocated_to: "ann@x.org" });
    expect(screen.queryByRole("button", { name: "Create a new Contact" })).toBeNull();
  });
  it("FV.M5 FV.M6 a new document asks to save first (no request); the server's READ check refuses an outsider → error with the server's reason", async () => {
    const t = site({ user: "out@x.org", roles: ["Outsider"] });
    mount(t, <FrappeConnections meta={DEAL} doc={{ doctype: "Deal", name: "new-deal-1", __islocal: 1 }} />);
    expect(screen.getByRole("status").textContent).toBe("Save the document to see its connections.");
    expect(calls(t, "frappe.desk.notifications.get_open_count")).toHaveLength(0);
    cleanup();
    mount(t, <FrappeConnections meta={DEAL} doc={stored(t, "Deal", "D-1")!} />);
    expect(await screen.findByText(/No permission for Deal D-1/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open the Deal Note list" })).toBeTruthy();
  });
  it("FV.M3 the Deal dashboard counts Deal Notes per deal (SIMULATED get_open_count) and opens the filtered list", async () => {
    const t = site();
    const onOpenList = vi.fn();
    mount(t, <FrappeConnections meta={DEAL} doc={stored(t, "Deal", "D-1")!} onOpenList={onOpenList} />);
    await waitFor(() => expect(document.querySelector('[data-connection="Deal Note"] [data-count]')?.textContent).toBe("2"));
    fireEvent.click(screen.getByRole("button", { name: "Open the Deal Note list" }));
    expect(onOpenList).toHaveBeenCalledWith("Deal Note", { deal: "D-1" });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("FrappeEmailComposer on the SIMULATED backend", () => {
  it("FV.O8 sends email.make with Desk's arguments, the server records a Communication, docinfo is re-read", async () => {
    const t = site({ user: "sara@x.org", roles: ["System Manager"] });
    const doc = stored(t, "Deal", "D-1")!;
    const onSent = vi.fn(); const onOpenChange = vi.fn();
    const info = { attachments: [{ name: "FILE-1", file_name: "quote.pdf", file_url: "/files/quote.pdf", is_private: 0 }] };
    mount(t, <FrappeEmailComposer doc={doc} meta={DEAL} open onOpenChange={onOpenChange} onSent={onSent} templates={[]} docinfo={info as never} />);
    expect((screen.getByLabelText("Subject") as HTMLInputElement).value).toBe("Deal: D-1");
    expect(screen.getByText("client@x.org")).toBeTruthy(); // To from doc.email_id (form.js:1291)
    fireEvent.click(screen.getByLabelText("quote.pdf"));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(onSent).toHaveBeenCalled());
    const [call] = calls(t, "frappe.core.doctype.communication.email.make");
    expect(call.args).toMatchObject({ recipients: "client@x.org", cc: "", bcc: "", subject: "Deal: D-1", doctype: "Deal", name: "D-1", send_email: 1, send_me_a_copy: 0, print_format: "Standard", attachments: '["FILE-1"]', read_receipt: 0, print_letterhead: 1 });
    const comm = [...t.store.docs.get("Communication")!.values()][0];
    expect(comm).toMatchObject({ reference_doctype: "Deal", reference_name: "D-1", recipients: "client@x.org", sent_or_received: "Sent", has_attachment: 1 });
    expect(onSent).toHaveBeenCalledWith({ name: comm.name, emailsNotSentTo: "" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(emailMakeArgs(doc, { to: ["a@b.co"], cc: [], bcc: [], subject: "s", message: "m", attachments: [], sendMeACopy: true, readReceipt: false, attachPrint: false }).print_format).toBeNull();
  });
  it("FV.O3 Email Templates are listed from the server and applied with get_email_template {template_name, doc}", async () => {
    const t = site({ user: "sara@x.org", roles: ["System Manager"] });
    mount(t, <FrappeEmailComposer doc={stored(t, "Deal", "D-1")!} open onOpenChange={() => {}} docinfo={{ attachments: [] } as never} />);
    fireEvent.click(await screen.findByRole("combobox", { name: "Email Template" }));
    fireEvent.click(await screen.findByRole("option", { name: "Welcome" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear & Add Template" }));
    await waitFor(() => expect((screen.getByLabelText("Subject") as HTMLInputElement).value).toBe("About Big order"));
    expect(screen.getByRole("textbox", { name: "Message" }).innerHTML).toBe("<p>Dear client of D-1</p>");
    const [call] = calls(t, "frappe.email.doctype.email_template.email_template.get_email_template");
    expect(call.args.template_name).toBe("Welcome");
    expect(JSON.parse(String(call.args.doc))).toMatchObject({ doctype: "Deal", name: "D-1" });
  });
  it("FV.O9 FV.O6 without the e-mail right sending is refused in the UI; when the client allows it the SIMULATED server's 403 is shown and nothing is recorded", async () => {
    const t = site({ user: "vic@x.org", roles: ["Viewer"] });
    mount(t, <FrappeEmailComposer doc={stored(t, "Deal", "D-1")!} open onOpenChange={() => {}} canEmail={false} templates={[]} docinfo={{ attachments: [] } as never} />);
    expect(screen.getByRole("note").textContent).toBe("You are not allowed to send emails related to this document");
    expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
    cleanup();
    mount(t, <FrappeEmailComposer doc={stored(t, "Deal", "D-1")!} open onOpenChange={() => {}} templates={[]} docinfo={{ attachments: [] } as never} />);
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText(/No permission for Deal D-1 \(email\)/)).toBeTruthy();
    expect(t.store.docs.get("Communication")?.size ?? 0).toBe(0);
  });
  it("FV.O8 after sending, the document's docinfo query is invalidated (get_docinfo requested again) so the timeline can refresh", async () => {
    const t = site({ user: "sara@x.org", roles: ["System Manager"] });
    mount(t, <FrappeEmailComposer doc={stored(t, "Deal", "D-1")!} open onOpenChange={() => {}} templates={[]} />);
    await waitFor(() => expect(calls(t, "frappe.desk.form.load.get_docinfo")).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(calls(t, "frappe.desk.form.load.get_docinfo").length).toBeGreaterThanOrEqual(2));
  });
});
