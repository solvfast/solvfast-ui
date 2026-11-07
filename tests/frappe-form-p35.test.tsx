/**
 * P35 "form" workstream: native mismatches F1–F8 (docs/audit/p35/C-native.md), the FrappeFormView slots, server errors on
 * fields, undo / redo, custom buttons. Test names start with the Form audit row id (docs/audit/p35/A-form.md).
 * Server interaction runs on the SIMULATED backend (`createFixtureTransport`); nothing here ran against a Frappe site.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import todoEn from "./fixtures/real-15.110/todo.en.json";
import userEn from "./fixtures/real-15.110/user.en.json";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient, type FrappeApi, type FrappeTransport } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import type { DocTypeMeta, FixtureBackend, FrappeDoc, MetaBundle } from "../src/frappe/contract";
import { createFixtureTransport, type FixtureHandler } from "../src/frappe/testing";
import type { FrappeSession } from "../src/frappe/services/permissions";
import { FrappeForm, FrappeFormView, FrappeFormServices, useUnsavedChangesBlocker, type FormController, type FormServices, type FrappeFormViewProps } from "../src/frappe/form";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

export const docsOf = (x: unknown) => (x as { docs: DocTypeMeta[] }).docs;
const ALL = { read: true, write: true, create: true, submit: true, cancel: true, amend: true, delete: true };
export const allRights = { levels: [ALL], can: (p: string) => !!(ALL as Record<string, boolean>)[p], known: true };

export const MEMO: DocTypeMeta = {
  name: "Memo", autoname: "hash", title_field: "title", image_field: "image",
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title", reqd: 1 },
    { fieldname: "image", fieldtype: "Attach Image", label: "Image", hidden: 1 },
    { fieldname: "kind", fieldtype: "Select", label: "Kind", options: "A\nB" },
    { fieldname: "sec2", fieldtype: "Section Break", label: "More" },
    { fieldname: "note", fieldtype: "Data", label: "Note" },
  ],
  permissions: [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1 }],
};
export const SUBM: DocTypeMeta = {
  name: "Sales Memo", is_submittable: 1, autoname: "hash", title_field: "title",
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title", reqd: 1 },
    { fieldname: "remark", fieldtype: "Data", label: "Remark", allow_on_submit: 1 },
    { fieldname: "amended_from", fieldtype: "Link", label: "Amended From", options: "Sales Memo", read_only: 1, no_copy: 1 },
  ],
  permissions: [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, submit: 1, cancel: 1, amend: 1 }],
};
export const bundleOf = (meta: DocTypeMeta, children: Record<string, DocTypeMeta> = {}): MetaBundle => ({ doctype: meta.name, meta, children });

export interface SetupOpts {
  meta?: Record<string, DocTypeMeta[]>;
  docs?: FixtureBackend["docs"];
  workflows?: FixtureBackend["workflows"];
  services?: Partial<FormServices>;
  handlers?: Record<string, FixtureHandler>;
  wrap?: (t: FrappeTransport) => FrappeTransport;
  session?: FrappeSession;
  lang?: "en" | "ar";
  strict?: boolean;
}

type Ui = React.ReactElement | ((client: FrappeApi) => React.ReactElement);
const MEMO_DOCS = [{ doctype: "Memo", name: "MEMO-1", title: "Hello", kind: "A", note: "n", docstatus: 0, modified: "2026-11-01 10:00:00" }];

export function setup(ui: Ui, opts: SetupOpts = {}) {
  const transport = createFixtureTransport({
    meta: { ToDo: docsOf(todoEn), User: docsOf(userEn), Memo: [MEMO], "Sales Memo": [SUBM], ...opts.meta },
    workflows: opts.workflows,
    docs: {
      User: [
        { doctype: "User", name: "ann@x.com", full_name: "Ann Xu", first_name: "Ann", email: "ann@x.com", enabled: 1 },
      ],
      ToDo: [{ doctype: "ToDo", name: "TD-1", description: "Call Ann", status: "Open", priority: "High", modified: "2026-11-01 10:00:00.000000", owner: "Administrator" }],
      Memo: MEMO_DOCS,
      ...opts.docs,
    },
  }, { handlers: opts.handlers, strict: opts.strict });
  const client = createFrappeClient({ transport: opts.wrap ? opts.wrap(transport) : transport });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (node: React.ReactElement) => (
    <ThemeProvider defaultTheme="light" defaultLanguage={opts.lang ?? "en"} storageKeys={null}>
      <QueryClientProvider client={qc}>
        <FrappeProvider client={client} session={opts.session ?? { user: "Administrator" }}>
          {opts.services ? <FrappeFormServices value={opts.services}>{node}</FrappeFormServices> : node}
        </FrappeProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
  const node = typeof ui === "function" ? ui(client) : ui;
  const utils = render(wrap(node));
  const calls = (method?: string) => transport.store.calls.filter((c) => !method || c.method === method);
  return { transport, client, calls, rerender: (n: React.ReactElement) => utils.rerender(wrap(n)) };
}

/** A standalone FrappeFormView with every right, saving through the SIMULATED backend (savedocs). */
export function view(props: Partial<FrappeFormViewProps> & { doc: FrappeDoc; bundle?: MetaBundle }) {
  let api: FrappeApi | null = null;
  const onSave = vi.fn((d: FrappeDoc, action: "Save" | "Submit" | "Update") => (props.onSave ? props.onSave(d, action) : api!.saveDoc(d, action)));
  const el = (client: FrappeApi) => {
    api = client;
    return <FrappeFormView guardUnload={false} permissions={allRights} bundle={props.bundle ?? bundleOf(MEMO)} {...props} onSave={onSave} />;
  };
  return { el, onSave };
}
export const parsed = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v) as FrappeDoc;
export const typeInto = (el: HTMLElement, value: string) => { fireEvent.focus(el); fireEvent.change(el, { target: { value } }); fireEvent.blur(el); };
const saved: FrappeDoc = { doctype: "Memo", name: "MEMO-1", title: "Hello", kind: "A", note: "n", docstatus: 0, modified: "2026-11-01 10:00:00" };

describe("P35 FrappeFormView slots (menu, extraTabs, fieldFilter, header image, See on Website)", () => {
  it("K3/K16 menu slot renders after the primary action", () => {
    const { el } = view({ doc: { ...saved, __unsaved: 1 }, menu: <button type="button">More</button> });
    setup(el);
    const buttons = screen.getAllByRole("button").map((b) => b.textContent);
    expect(buttons.indexOf("More")).toBe(buttons.indexOf("Save") + 1);
  });

  it("M1 extraTabs: a form without Tab Breaks gets a Details tab plus the extra tabs; render runs only when active", () => {
    const render1 = vi.fn(() => <p>Connections body</p>);
    const { el } = view({ doc: saved, extraTabs: [{ key: "connections", label: "Connections", render: render1 }] });
    setup(el);
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs).toEqual(["Details", "Connections"]);
    expect(render1).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: /Title/ })).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Connections" }), { button: 0 });
    fireEvent.click(screen.getByRole("tab", { name: "Connections" }));
    expect(screen.getByText("Connections body")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: /Title/ })).toBeNull();
    expect(render1).toHaveBeenCalled();
  });

  it("M1 extraTabs are appended after the form's own tabs (keys cannot collide with Tab Break fieldnames)", () => {
    const meta: DocTypeMeta = { ...MEMO, fields: [...MEMO.fields, { fieldname: "connections", fieldtype: "Tab Break", label: "Other" }, { fieldname: "x", fieldtype: "Data", label: "X" }] };
    const { el } = view({ bundle: bundleOf(meta), doc: { ...saved, x: "1" }, extraTabs: [{ key: "connections", label: "Connections", render: () => <p>C</p> }] });
    setup(el);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Details", "Other", "Connections"]);
  });

  it("B6 fieldFilter: only accepted fields (and breaks) are laid out; hidden fields stay hidden", () => {
    const { el } = view({ doc: saved, fieldFilter: (df) => df.fieldname === "title" || df.fieldname === "note" || df.fieldname === "image" });
    setup(el);
    expect(screen.getByRole("textbox", { name: /Title/ })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /Note/ })).toBeTruthy();
    expect(screen.queryByText("Kind")).toBeNull();
    expect(screen.queryByText("More")).toBeNull(); // the Section Break was filtered: Note joins the first section
    expect(screen.queryByText("Image")).toBeNull(); // accepted but hidden: still hidden
  });

  it("J9 header image from meta.image_field (initials fallback when empty)", () => {
    const { el } = view({ doc: { ...saved, image: "/files/a.png" } });
    setup(el);
    const img = document.querySelector("[data-form-image]");
    expect(img?.getAttribute("data-form-image")).toBe("/files/a.png");
    cleanup();
    setup(view({ doc: { ...saved, image: "" } }).el);
    expect(document.querySelector("[data-form-image]")).toBeNull();
    expect(screen.getByText("H")).toBeTruthy(); // initials of "Hello"
  });

  it("J9 negative: a DocType without image_field shows no avatar", () => {
    setup(view({ bundle: bundleOf({ ...MEMO, image_field: undefined }), doc: saved }).el);
    expect(screen.queryByText("H")).toBeNull();
  });

  it("P1-P4 See on Website: a published website generator (__onload, form.js:1149-1158) links /route in a new tab", () => {
    setup(view({ doc: { ...saved, route: "memos/hello", __onload: { is_website_generator: true, published: true } } }).el);
    const a = screen.getByRole("link", { name: /See on Website/ });
    expect(a.getAttribute("href")).toBe("/memos/hello");
    expect(a.getAttribute("target")).toBe("_blank");
  });

  it("P2 See on Website is not shown when unpublished, without a route, or for a new document", () => {
    setup(view({ doc: { ...saved, route: "memos/hello", __onload: { is_website_generator: true, published: false } } }).el);
    expect(screen.queryByRole("link", { name: /See on Website/ })).toBeNull();
    cleanup();
    setup(view({ doc: { ...saved, __onload: { is_website_generator: true, published: true } } }).el);
    expect(screen.queryByRole("link", { name: /See on Website/ })).toBeNull();
    cleanup();
    setup(view({ doc: { ...saved, name: "new-memo-1", __islocal: 1, route: "x", __onload: { is_website_generator: true, published: true } } }).el);
    expect(screen.queryByRole("link", { name: /See on Website/ })).toBeNull();
  });

  it("P2 See on Website without __onload: has_web_view + is_published_field + route", () => {
    const meta = { ...MEMO, has_web_view: 1, is_published_field: "published", fields: [...MEMO.fields, { fieldname: "published", fieldtype: "Check", label: "Published" }, { fieldname: "route", fieldtype: "Data", label: "Route" }] };
    setup(view({ bundle: bundleOf(meta), doc: { ...saved, published: 1, route: "m/1" } }).el);
    expect(screen.getByRole("link", { name: /See on Website/ }).getAttribute("href")).toBe("/m/1");
    cleanup();
    setup(view({ bundle: bundleOf(meta), doc: { ...saved, published: 0, route: "m/1" } }).el);
    expect(screen.queryByRole("link", { name: /See on Website/ })).toBeNull();
  });
});


const tick = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const ctrlS = (target: Element | Document = document.body) => fireEvent.keyDown(target, { key: "s", ctrlKey: true });
const subDoc = (over: Partial<FrappeDoc> = {}): FrappeDoc => ({ doctype: "Sales Memo", name: "SM-1", title: "Plan", remark: "", docstatus: 0, modified: "2026-11-01 10:00:00", owner: "Administrator", ...over });
const subDocs = (over: Partial<FrappeDoc> = {}) => ({ "Sales Memo": [subDoc(over)] });

describe("F1 / H13 Ctrl+S = Desk's trigger_primary_action (desk.js:389-403)", () => {
  it("H13 Ctrl+S with focus outside the form saves a dirty saved document through savedocs", async () => {
    const { el, onSave } = view({ doc: { ...MEMO_DOCS[0], note: "changed", __unsaved: 1 } });
    const { calls } = setup(el);
    expect(document.activeElement).toBe(document.body);
    ctrlS();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][1]).toBe("Save");
    await waitFor(() => expect(calls("frappe.desk.form.save.savedocs")).toHaveLength(1));
    expect(parsed(calls("frappe.desk.form.save.savedocs")[0].args.doc)).toMatchObject({ name: "MEMO-1", note: "changed" });
  });

  it("H13 Ctrl+S inside a text box blurs it first: the pending edit is saved (not lost to the 500 ms debounce)", async () => {
    const { el, onSave } = view({ doc: MEMO_DOCS[0] });
    const { calls } = setup(el);
    const note = screen.getByRole("textbox", { name: /Note/ }) as HTMLInputElement;
    act(() => note.focus());
    fireEvent.change(note, { target: { value: "typed" } });
    expect(document.activeElement).toBe(note);
    ctrlS(note);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(calls("frappe.desk.form.save.savedocs")).toHaveLength(1));
    expect(parsed(calls("frappe.desk.form.save.savedocs")[0].args.doc).note).toBe("typed");
  });

  it("H13 a clean saved submittable draft: Ctrl+S runs the visible primary (Submit → its confirmation)", async () => {
    const { el, onSave } = view({ bundle: bundleOf(SUBM), doc: subDoc() });
    setup(el, { docs: subDocs() });
    expect(screen.getByRole("button", { name: "Submit" })).toBeTruthy();
    ctrlS();
    expect(await screen.findByText("Permanently Submit SM-1?")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("H13 a cancelled document: Ctrl+S runs Amend (the local amendment replaces the form)", async () => {
    const onAmended = vi.fn();
    const { el } = view({ bundle: bundleOf(SUBM), doc: subDoc({ docstatus: 2 }), onAmended });
    setup(el, { docs: subDocs({ docstatus: 2 }) });
    ctrlS();
    await waitFor(() => expect(onAmended).toHaveBeenCalledTimes(1));
    expect(onAmended.mock.calls[0][0]).toMatchObject({ amended_from: "SM-1", __islocal: 1 });
  });

  it("H13 negative: saveDisabled, hotkeys={false} and a form without permissions do nothing", async () => {
    for (const extra of [{ saveDisabled: true }, { hotkeys: false }, { permissions: undefined }] as Partial<FrappeFormViewProps>[]) {
      const { el, onSave } = view({ doc: { ...MEMO_DOCS[0], note: "x", __unsaved: 1 }, ...extra });
      const { calls } = setup(el);
      ctrlS();
      await tick(10);
      expect(onSave, JSON.stringify(Object.keys(extra))).not.toHaveBeenCalled();
      expect(calls("frappe.desk.form.save.savedocs")).toHaveLength(0);
      cleanup();
    }
  });

  it("H13 only the topmost mounted form answers (a later form — e.g. a dialog — wins)", async () => {
    const a = view({ doc: { ...MEMO_DOCS[0], note: "a", __unsaved: 1 } });
    const b = view({ doc: { ...MEMO_DOCS[0], note: "b", __unsaved: 1 } });
    setup((c) => <>{a.el(c)}{b.el(c)}</>);
    ctrlS();
    await waitFor(() => expect(b.onSave).toHaveBeenCalledTimes(1));
    expect(a.onSave).not.toHaveBeenCalled();
  });
});

describe("F5 / H4 submitted + dirty → Update only (toolbar.js:668-689)", () => {
  it("H4 editing an allow_on_submit field shows Update and no Cancel; Update sends savedocs action Update", async () => {
    const { el, onSave } = view({ bundle: bundleOf(SUBM), doc: subDoc({ docstatus: 1 }), onCancelDoc: async (d) => d });
    const { calls } = setup(el, { docs: subDocs({ docstatus: 1 }) });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy(); // clean: Cancel
    typeInto(screen.getByRole("textbox", { name: /Remark/ }), "late note");
    expect(await screen.findByRole("button", { name: "Update" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(calls("frappe.desk.form.save.savedocs")).toHaveLength(1));
    expect(calls("frappe.desk.form.save.savedocs")[0].args.action).toBe("Update");
    expect(parsed(calls("frappe.desk.form.save.savedocs")[0].args.doc).remark).toBe("late note");
    expect(onSave.mock.calls[0][1]).toBe("Update");
  });
});

describe("F8 / H6 Amend needs create + amend; copies start from new-doc defaults", () => {
  it("H6 no Amend without the create right (form.js:1297-1298 validate_form_action('Create'))", () => {
    const noCreate = { levels: [{ ...ALL, create: false }], can: (p: string) => p !== "create" && !!(ALL as Record<string, boolean>)[p], known: true };
    setup(view({ bundle: bundleOf(SUBM), doc: subDoc({ docstatus: 2 }), permissions: noCreate }).el, { docs: subDocs({ docstatus: 2 }) });
    expect(screen.queryByRole("button", { name: "Amend" })).toBeNull();
    cleanup();
    setup(view({ bundle: bundleOf(SUBM), doc: subDoc({ docstatus: 2 }) }).el, { docs: subDocs({ docstatus: 2 }) });
    expect(screen.getByRole("button", { name: "Amend" })).toBeTruthy();
  });
});

describe("F6 / H14 dirty state for in-app navigation", () => {
  it("H14 onDirtyChange reports true on the first edit and false after the save", async () => {
    const onDirtyChange = vi.fn();
    const { el } = view({ doc: MEMO_DOCS[0], onDirtyChange });
    setup(el);
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    typeInto(screen.getByRole("textbox", { name: /Note/ }), "edited");
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });

  it("H14 useUnsavedChangesBlocker: clean → leave; dirty → asks (the router gets the answer)", async () => {
    const asked: string[] = [];
    let guard: ReturnType<typeof useUnsavedChangesBlocker> | null = null;
    function Host() {
      const [dirty, setDirty] = React.useState(false);
      guard = useUnsavedChangesBlocker(dirty, { confirm: (m) => { asked.push(m); return false; } });
      return view({ doc: MEMO_DOCS[0], onDirtyChange: setDirty }).el(hostClient!);
    }
    let hostClient: FrappeApi | null = null;
    setup((c) => { hostClient = c; return <Host />; });
    expect(guard!.confirmLeave()).toBe(true);
    expect(asked).toEqual([]);
    typeInto(screen.getByRole("textbox", { name: /Note/ }), "edited");
    await waitFor(() => expect(guard!.dirty).toBe(true));
    expect(guard!.confirmLeave()).toBe(false);
    expect(asked).toEqual(["You have unsaved changes. Leave this page and lose them?"]);
  });
});

describe("K14 undo / redo (undo_manager.js)", () => {
  it("K14 Ctrl+Z outside inputs undoes the user's last change, Ctrl+Shift+Z / Ctrl+Y redo it; the controller exposes them", async () => {
    const ref = { current: null as FormController | null };
    const note = vi.fn();
    setup(view({ doc: MEMO_DOCS[0], controllerRef: ref, events: { note } }).el);
    expect(ref.current!.canUndo).toBe(false);
    typeInto(screen.getByRole("textbox", { name: /Note/ }), "one");
    typeInto(screen.getByRole("textbox", { name: /Note/ }), "two");
    expect(ref.current!.canUndo).toBe(true);
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    expect((screen.getByRole("textbox", { name: /Note/ }) as HTMLInputElement).value).toBe("one");
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    expect((screen.getByRole("textbox", { name: /Note/ }) as HTMLInputElement).value).toBe("n");
    expect(ref.current!.canUndo).toBe(false);
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true, shiftKey: true });
    expect((screen.getByRole("textbox", { name: /Note/ }) as HTMLInputElement).value).toBe("one");
    fireEvent.keyDown(document.body, { key: "y", ctrlKey: true });
    expect((screen.getByRole("textbox", { name: /Note/ }) as HTMLInputElement).value).toBe("two");
    expect(ref.current!.canRedo).toBe(false);
    await waitFor(() => expect(note.mock.calls.length).toBeGreaterThanOrEqual(6)); // field events ran for every set (frm.set_value)
  });

  it("K14 negative: Ctrl+Z inside a text input is the browser's; script writes are not recorded; empty → 'Nothing left to undo'", async () => {
    const ref = { current: null as FormController | null };
    setup(view({ doc: MEMO_DOCS[0], controllerRef: ref }).el);
    act(() => ref.current!.setValue("note", "by script"));
    expect(ref.current!.canUndo).toBe(false);
    typeInto(screen.getByRole("textbox", { name: /Note/ }), "typed");
    fireEvent.keyDown(screen.getByRole("textbox", { name: /Note/ }), { key: "z", ctrlKey: true });
    expect((screen.getByRole("textbox", { name: /Note/ }) as HTMLInputElement).value).toBe("typed");
    act(() => ref.current!.undo());
    act(() => ref.current!.undo());
    expect(await screen.findByText("Nothing left to undo")).toBeTruthy();
  });
});

describe("K1 / K2 custom buttons and the Create dropdown (frm.add_custom_button)", () => {
  it("K1 buttons added in refresh render in the header and run their handler; K2 grouped ones form a dropdown", async () => {
    const run = vi.fn();
    const make = vi.fn();
    const events = { refresh: (frm: FormController) => { frm.addCustomButton("Notify", run); frm.addCustomButton("Task", make, "Create"); frm.addCustomButton("Event", make, "Create"); } };
    setup(view({ doc: MEMO_DOCS[0], events }).el);
    fireEvent.click(await screen.findByRole("button", { name: "Notify" }));
    expect(run).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole("button", { name: "Create" }), { key: "Enter" });
    expect((await screen.findAllByRole("menuitem")).map((m) => m.textContent)).toEqual(["Task", "Event"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Event" }));
    expect(make).toHaveBeenCalledTimes(1);
  });

  it("K1 buttons are cleared before every refresh (form.js:724): a button not re-added after a save is gone", async () => {
    let first = true;
    const events = { refresh: (frm: FormController) => { if (first) frm.addCustomButton("Once", () => {}); first = false; } };
    setup(view({ doc: { ...MEMO_DOCS[0], note: "x", __unsaved: 1 }, events }).el);
    expect(await screen.findByRole("button", { name: "Once" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Once" })).toBeNull());
  });
});
