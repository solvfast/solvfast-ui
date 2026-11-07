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
import { createFrappeClient, type FrappeTransport } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import type { DocTypeMeta, FixtureBackend, FrappeDoc, MetaBundle } from "../src/frappe/contract";
import { createFixtureTransport, type FixtureHandler } from "../src/frappe/testing";
import type { FrappeSession } from "../src/frappe/services/permissions";
import { FrappeForm, FrappeFormView, FrappeFormServices, type FormController, type FormServices, type FrappeFormViewProps } from "../src/frappe/form";

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

export function setup(ui: React.ReactElement, opts: SetupOpts = {}) {
  const transport = createFixtureTransport({
    meta: { ToDo: docsOf(todoEn), User: docsOf(userEn), Memo: [MEMO], "Sales Memo": [SUBM], ...opts.meta },
    workflows: opts.workflows,
    docs: {
      User: [
        { doctype: "User", name: "ann@x.com", full_name: "Ann Xu", first_name: "Ann", email: "ann@x.com", enabled: 1 },
      ],
      ToDo: [{ doctype: "ToDo", name: "TD-1", description: "Call Ann", status: "Open", priority: "High", modified: "2026-11-01 10:00:00.000000", owner: "Administrator" }],
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
  const utils = render(wrap(ui));
  const calls = (method?: string) => transport.store.calls.filter((c) => !method || c.method === method);
  return { transport, client, calls, rerender: (n: React.ReactElement) => utils.rerender(wrap(n)) };
}

/** A standalone FrappeFormView with every right and a stub save (no server). */
export function view(props: Partial<FrappeFormViewProps> & { doc: FrappeDoc; bundle?: MetaBundle }) {
  const onSave = props.onSave ?? vi.fn(async (d: FrappeDoc) => ({ ...d, __unsaved: undefined, __islocal: undefined, name: d.__islocal ? "MEMO-1" : d.name, modified: "2026-11-07 10:00:00" }) as FrappeDoc);
  const el = <FrappeFormView guardUnload={false} permissions={allRights} bundle={props.bundle ?? bundleOf(MEMO)} {...props} onSave={onSave} />;
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

