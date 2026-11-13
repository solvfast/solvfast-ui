/**
 * Run 1 acceptance gaps found in the ledger reconciliation: the audit's `tests_needed` items (P1-P2-ROWS.md) that the
 * step tests did not yet assert. Each describe names its row and evidence level: jsdom (Core in jsdom), SIMULATED (the
 * playground's ToDo backend / the in-package fixture transport / stub clients). Real site: not run for any of them (I5).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell, ListView, MobileNav, Sidebar, ThemeProvider, type ColumnDef, type NavItem } from "../src";
import { FrappeListView, FrappeProvider, createFrappeClient, type FrappeTransport } from "../src/frappe";
import { toFrappeError } from "../src/frappe/client";
import { FrappeAssignTo, FrappeStatusIndicator, FrappeTimeline, FrappeWorkflowActions } from "../src/frappe/record";
import { IndicatorCell } from "../src/frappe/list/cells";
import { FrappeField, FrappeForm, FrappeFormView, type FrappeFormProps } from "../src/frappe/form";
import type { FormatContext } from "../src/frappe/services/format";
import type { DocInfo, DocPerm, DocTypeMeta, FrappeDoc, FrappeDocField, RealtimeEvent, RealtimePort } from "../src/frappe/contract";
import { createFixtureTransport, type FixtureTransport, type SimulatedPermissions } from "../src/frappe/testing";
import { sortOptionsFromMeta } from "../src/frappe/meta";
import { WORKFLOW_BULK_METHODS } from "../src/frappe/list/workflowBulk";
import { defaultMessages } from "../src/theme/messages";
import { TODO_META, createMockFrappe } from "../playground/src/demo/mock-frappe";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.title = ""; });

const en = defaultMessages.en;
const wrap = (ui: React.ReactNode, lang: "en" | "ar" = "en") => render(<ThemeProvider defaultLanguage={lang} storageKeys={null}>{ui}</ThemeProvider>);
const escape = async () => { await act(async () => { fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" }); }); };
const openMenu = (el: HTMLElement) => fireEvent.keyDown(el, { key: "Enter" });

// ─── shell ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const ITEMS: NavItem[] = [
  { id: "home", href: "/app/home", label: { en: "Home", ar: "الرئيسية" } },
  { id: "sales", label: { en: "Sales", ar: "المبيعات" }, children: [{ id: "deals", href: "/app/deals", label: { en: "Deals", ar: "الصفقات" } }, { id: "leads", href: "/app/leads", label: { en: "Leads", ar: "العملاء المحتملون" } }] },
];

describe("A-25 the current navigation target is aria-current=page (jsdom)", () => {
  it("Sidebar: the current item's link carries aria-current=page; the others none", () => {
    wrap(<Sidebar brand={{ name: "Acme" }} items={ITEMS} currentPath="/app/deals" onNavigate={() => {}} collapsed={false} onCollapsedChange={() => {}} />);
    expect(screen.getByRole("link", { name: "Deals" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Leads" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBeNull();
  });
  it("MobileNav: the current item is a link with aria-current=page", () => {
    wrap(<MobileNav items={[{ id: "home", href: "/app/home", label: "Home" }, { id: "deals", href: "/app/deals", label: "Deals" }]} currentPath="/app/deals" onNavigate={() => {}} />);
    expect(screen.getByRole("link", { name: "Deals" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBeNull();
  });
});

describe("A-29 the tab title follows the language (jsdom)", () => {
  it("an { en, ar } nav label gives the Arabic tab title in Arabic", () => {
    wrap(<AppShell brand={{ name: "Acme" }} items={ITEMS} currentPath="/app/deals" onNavigate={() => {}} collapsedStorageKey={null}><p>x</p></AppShell>, "ar");
    expect(document.title).toBe("الصفقات · Acme");
    cleanup();
    wrap(<AppShell brand={{ name: "Acme" }} items={ITEMS} currentPath="/app/deals" onNavigate={() => {}} collapsedStorageKey={null}><p>x</p></AppShell>, "en");
    expect(document.title).toBe("Deals · Acme");
  });
});

// ─── list (SIMULATED: the playground's ToDo backend) ─────────────────────────────────────────────────────────────────

const AR: Record<string, string> = {
  ToDo: "مهمة", Status: "الحالة", Priority: "الأولوية", Open: "مفتوحة", Closed: "مغلقة", Approve: "اعتماد", Reject: "رفض",
  "Due Date": "تاريخ الاستحقاق", "Tasks assigned to people": "مهام مسندة إلى أشخاص",
};
const PERMS = [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, import: 1, export: 1 }];
const META = (over: Record<string, unknown> = {}) => ({ ...TODO_META, permissions: PERMS, ...over });
const WORKFLOW = {
  doctype: "Workflow", name: "ToDo Approval", document_type: "ToDo", workflow_state_field: "workflow_state", is_active: 1,
  states: [{ state: "Pending", doc_status: "0", allow_edit: "System Manager" }, { state: "Approved", doc_status: "0", allow_edit: "System Manager" }],
  transitions: [{ state: "Pending", action: "Approve", next_state: "Approved", allowed: "System Manager" }],
};

function mountList(o: {
  meta?: Record<string, unknown>; props?: Partial<React.ComponentProps<typeof FrappeListView>>; lang?: "en" | "ar";
  translations?: Record<string, string>; extra?: (m: string, a: Record<string, unknown>) => unknown; mutate?: (rows: Record<string, unknown>[]) => void;
} = {}) {
  const mock = createMockFrappe();
  o.mutate?.(mock.rows as Record<string, unknown>[]);
  const meta = o.meta ?? META();
  const transport: FrappeTransport = async (m, a) => {
    const own = o.extra?.(m, a);
    if (own !== undefined) return own as never;
    if (m === "frappe.desk.form.load.getdoctype") return { docs: [meta], user_settings: "{}" } as never;
    return mock.transport(m, a);
  };
  const utils = render(
    <ThemeProvider defaultTheme="light" defaultLanguage={o.lang ?? "en"} storageKeys={null}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <FrappeProvider client={createFrappeClient({ transport })} session={{ user: "u@x.com", roles: ["System Manager"] }} translations={o.translations}>
          <FrappeListView doctype="ToDo" storage={null} {...o.props} />
        </FrappeProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return { ...utils, mock };
}
const rows = () => [...document.querySelectorAll<HTMLElement>("tbody tr")].filter((tr) => tr.querySelectorAll("td").length > 1 && tr.getAttribute("aria-hidden") !== "true");

describe("B-02 the Subject cell links to the document (SIMULATED)", () => {
  it("the title cell is <a href=/app/todo/<name>>; an empty title shows the document's name, not a dash", async () => {
    let emptied = "";
    mountList({ mutate: (rs) => { // the newest row (first page under Desk's default order, modified desc)
      const top = rs.reduce((a, b) => (String(b.modified) > String(a.modified) ? b : a));
      emptied = String(top.name); top.description = "";
    } });
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const links = rows().map((r) => r.querySelector<HTMLAnchorElement>("td a[href]")).filter(Boolean) as HTMLAnchorElement[];
    expect(links.length).toBe(rows().length);
    for (const a of links) expect(a.getAttribute("href")).toMatch(/^\/app\/todo\/[^/]+$/);
    const empty = links.find((a) => a.getAttribute("href") === `/app/todo/${encodeURIComponent(emptied)}`)!;
    expect(empty).toBeTruthy();
    expect(empty.textContent).toBe(emptied);
    expect(empty.closest("td")?.getAttribute("title")).toBe(emptied);
  });
  it("Arabic: the same link (the URL is the DocType's slug, not its translated name)", async () => {
    mountList({ lang: "ar", translations: AR });
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(rows()[0]!.querySelector("td a[href]")?.getAttribute("href")).toMatch(/^\/app\/todo\//);
  });
});

describe("B-26 FrappeListView's Sort-by menu offers the DocType's options (SIMULATED)", () => {
  it("controls.sortMenu → Desk's options from the meta (sortOptionsFromMeta order), not the visible columns", async () => {
    mountList({ props: { controls: { sortMenu: true } } });
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    fireEvent.keyDown(screen.getByRole("button", { name: /Sort by/ }), { key: "Enter" });
    const items = (await screen.findAllByRole("menuitem")).map((m) => m.textContent?.trim());
    const t = (k: keyof typeof en) => en[k];
    const expected = sortOptionsFromMeta(META() as never, t).map((o) => o.label);
    expect(items.slice(0, expected.length)).toEqual(expected);
    expect(items).toContain(en.fieldCreated);
  });
});

describe("B-38 the header Actions menu's workflow actions in Arabic (SIMULATED)", () => {
  it("rows checked → Actions → the workflow's actions from the provider's dictionary", async () => {
    mountList({ lang: "ar", translations: AR, meta: META({ __workflow_docs: [WORKFLOW] }), props: { selectable: true, bulk: {} }, extra: (m) => (m === WORKFLOW_BULK_METHODS.commonActions ? Promise.resolve({ message: ["Approve"] }) : undefined) });
    const box = await waitFor(() => within(rows()[0]!).getByRole("checkbox"));
    fireEvent.click(box);
    const actions = await screen.findByRole("button", { name: new RegExp(defaultMessages.ar.listActions) });
    openMenu(actions);
    expect(await screen.findByRole("menuitem", { name: "اعتماد" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Approve" })).toBeNull();
  });
});

describe("B-42 focus returns after Add / Quick Entry and a bulk dialog (SIMULATED)", () => {
  it("Add → Quick Entry → Escape: focus is back on the Add button", async () => {
    mountList({ meta: META({ quick_entry: 1 }), props: { create: {} } });
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const add = await screen.findByTestId("sf-list-add");
    add.focus(); fireEvent.click(add);
    await screen.findByRole("dialog");
    await escape();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(add));
  });
  it("rows checked → Actions → Assign to → Escape: focus is back on the Actions trigger", async () => {
    mountList({ props: { selectable: true, bulk: {} } });
    const box = await waitFor(() => within(rows()[0]!).getByRole("checkbox"));
    fireEvent.click(box);
    const actions = await screen.findByRole("button", { name: /Actions/ });
    actions.focus(); openMenu(actions);
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Assign to$/ }));
    await screen.findByRole("dialog");
    await escape();
    await waitFor(() => expect(document.activeElement).toBe(actions));
  });
  it("rows checked → Actions → Edit → Escape: focus is back on the Actions trigger", async () => {
    mountList({ props: { selectable: true, bulk: {} } });
    const box = await waitFor(() => within(rows()[0]!).getByRole("checkbox"));
    fireEvent.click(box);
    const actions = await screen.findByRole("button", { name: /Actions/ });
    actions.focus(); openMenu(actions);
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Edit$/ }));
    await screen.findByRole("dialog");
    await escape();
    await waitFor(() => expect(document.activeElement).toBe(actions));
  });
});

describe("B-55 / B-61 empty states and quick filters in Arabic from the provider's dictionary (SIMULATED)", () => {
  it("filtered-empty: the message and 'Create a new …' carry the translated DocType", async () => {
    mountList({ lang: "ar", translations: AR, props: { create: { onCreate: () => {} } as never, initialQuery: { conjunction: "and", conditions: [{ id: "c1", field: "status", operator: "equals", value: "Nope" }] } } });
    const create = await screen.findByRole("button", { name: defaultMessages.ar.formCreateNew.replace("{doctype}", "مهمة") });
    expect(create).toBeTruthy();
    const msg = defaultMessages.ar.listEmptyFilteredDoctype.replace("{doctype}", "مهمة");
    expect(document.body.textContent).toContain(msg);
    expect(document.body.textContent).not.toMatch(/\bToDo\b/);
  });
  it("none yet: the message with the translated DocType and the DocType's description (translated)", async () => {
    mountList({ lang: "ar", translations: AR, meta: META({ description: "Tasks assigned to people" }), props: { create: { onCreate: () => {} } as never }, mutate: (rs) => { rs.length = 0; } });
    await waitFor(() => expect(document.querySelector("[data-empty-description]")).not.toBeNull());
    expect(document.querySelector("[data-empty-description]")!.textContent).toBe("مهام مسندة إلى أشخاص");
    expect(document.body.textContent).toContain(defaultMessages.ar.listEmptyNone.replace("{doctype}", "مهمة"));
    expect(screen.getByRole("button", { name: defaultMessages.ar.listCreateFirst.replace("{doctype}", "مهمة") })).toBeTruthy();
  });
  it("the quick filters (in_standard_filter fields) are labelled from the dictionary", async () => {
    mountList({ lang: "ar", translations: AR });
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const bar = document.body.textContent ?? "";
    for (const label of ["الحالة", "الأولوية", "تاريخ الاستحقاق"]) expect(bar).toContain(label);
    expect(bar).not.toContain("Due Date");
  });
});

describe("B-56 keyboard in the cards layout (jsdom)", () => {
  type Row = { id: string; title: string; status: string };
  const ROWS: Row[] = Array.from({ length: 5 }, (_, i) => ({ id: `R${i}`, title: `Row ${i}`, status: "Open" }));
  const COLS: ColumnDef<Row>[] = [{ key: "title", label: "Title" }, { key: "status", label: "Status" }];
  const cards = () => [...document.querySelectorAll<HTMLElement>("li[data-card]")];
  it("one Tab stop; ↓ / ↑ move between cards, Space ticks, Shift+↓ extends, Enter opens; keys inside the checkbox are ignored", () => {
    const open = vi.fn();
    wrap(<ListView<Row> rows={ROWS} columns={COLS} rowKey={(r) => r.id} storage={null} onRowClick={open} selectable layout="cards" />);
    expect(cards().map((c) => c.getAttribute("tabindex"))).toEqual(["0", "-1", "-1", "-1", "-1"]);
    cards()[0]!.focus();
    fireEvent.keyDown(cards()[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(cards()[1]);
    expect(cards()[1]!.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(cards()[1]!, { key: " " });
    expect(cards()[1]!.getAttribute("data-selected")).toBe("true");
    fireEvent.keyDown(cards()[1]!, { key: "ArrowDown", shiftKey: true });
    expect(document.activeElement).toBe(cards()[2]);
    expect(cards()[2]!.getAttribute("data-selected")).toBe("true");
    fireEvent.keyDown(cards()[2]!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(cards()[1]);
    fireEvent.keyDown(cards()[1]!, { key: "Enter" });
    expect(open).toHaveBeenCalledWith(ROWS[1]);
    const box = within(cards()[3]!).getByRole("checkbox");
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(document.activeElement).not.toBe(cards()[4]);
  });
});

describe("C-25 Datetime: 10:37 enterable; the read display and the editor show the same instant (jsdom; time zones SIMULATED)", () => {
  function Live({ df, initial, log, status }: { df: FrappeDocField; initial: unknown; log: unknown[]; status?: "Read" | "Write" }) {
    const [v, setV] = React.useState<unknown>(initial);
    return <FrappeField df={df} value={v} status={status} onChange={(x) => { log.push(x); setV(x); }} />;
  }
  const mount = (initial: unknown, ctx: FormatContext = {}, status?: "Read" | "Write") => {
    const log: unknown[] = [];
    render(
      <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
        <QueryClientProvider client={new QueryClient()}><FrappeProvider client={createFrappeClient({ transport: async () => ({}) })} formatContext={ctx}>
          <Live df={{ fieldname: "f", label: "When", fieldtype: "Datetime" } as FrappeDocField} initial={initial} log={log} status={status} />
        </FrappeProvider></QueryClientProvider>
      </ThemeProvider>,
    );
    return log;
  };
  it("10:00 → pick minute 37 in the popover → Apply stores 10:37:00", async () => {
    const log = mount("2026-11-20 10:00:00");
    fireEvent.click(screen.getByRole("button", { name: /When/ }));
    const dialog = screen.getByText("Select date & time").parentElement!;
    const minute = within(dialog).getAllByRole("combobox")[1]!;
    expect(minute.textContent).toBe("00");
    fireEvent.keyDown(minute, { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "37" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(log).toEqual(["2026-11-20 10:37:00"]);
  });
  it("system Asia/Riyadh, user Asia/Kolkata: the read-only display and the editor's time both show 13:07 for a stored 10:37:45", async () => {
    const ctx: FormatContext = { timeZone: { system: "Asia/Riyadh", user: "Asia/Kolkata" }, dateFormat: "yyyy-mm-dd", timeFormat: "HH:mm:ss" };
    mount("2026-11-20 10:37:45", ctx, "Read");
    expect(document.body.textContent).toContain("2026-11-20 13:07:45");
    cleanup();
    mount("2026-11-20 10:37:45", ctx);
    fireEvent.click(screen.getByRole("button", { name: /When/ }));
    const dialog = screen.getByText("Select date & time").parentElement!;
    const [h, m, ampm] = within(dialog).getAllByRole("combobox");
    expect([h!.textContent, m!.textContent, ampm!.textContent]).toEqual(["1", "07", "PM"]);
  });
});

// ─── form (SIMULATED: createFixtureTransport) ────────────────────────────────────────────────────────────────────────

const ALL = { read: 1, write: 1, create: 1, delete: 1, select: 1, report: 1, export: 1, import: 1, print: 1, email: 1, share: 1 } as const;
const SM: DocPerm = { role: "System Manager", permlevel: 0, ...ALL };
const T0 = "2026-11-02 09:00:00.000000";
const DEAL: DocTypeMeta = { name: "Deal", autoname: "hash", title_field: "title", permissions: [SM], fields: [{ fieldname: "title", fieldtype: "Data", label: "Title" }] } as DocTypeMeta;
const ORDER: DocTypeMeta = { name: "Order", autoname: "hash", title_field: "title", is_submittable: 1, permissions: [{ ...SM, submit: 1, cancel: 1 }], fields: [{ fieldname: "title", fieldtype: "Data", label: "Title" }] } as DocTypeMeta;
const NOCOPY: DocTypeMeta = { ...DEAL, name: "Memo", allow_copy: 1 } as DocTypeMeta;
function site(permissions: SimulatedPermissions = { user: "sara@x.org", roles: ["System Manager"] }) {
  const d = (doctype: string, name: string, over: Record<string, unknown> = {}) => ({ doctype, name, title: `${doctype} ${name}`, docstatus: 0, owner: "sara@x.org", modified: T0, creation: T0, ...over }) as FrappeDoc;
  return createFixtureTransport({
    meta: { Deal: [DEAL], Order: [ORDER], Memo: [NOCOPY] },
    docs: { Deal: [d("Deal", "D-1")], Order: [d("Order", "O-1", { docstatus: 1 }), d("Order", "O-2", { docstatus: 2 })], Memo: [d("Memo", "M-1")] },
  }, { permissions });
}
const callsOf = (t: FixtureTransport, method: string) => t.store.calls.filter((c) => c.method === method);
function mountForm(t: FixtureTransport, props: Partial<FrappeFormProps> & { doctype?: string; name?: string } = {}) {
  const client = createFrappeClient({ transport: t, files: t.files });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FrappeProvider client={client} queryClient={qc} session={t.store.session} serverMessages={false}>
        <ThemeProvider storageKeys={null}><FrappeForm doctype="Deal" name="D-1" {...props} /></ThemeProvider>
      </FrappeProvider>
    </QueryClientProvider>,
  );
}
const titleBox = () => screen.findByLabelText("Title") as Promise<HTMLInputElement>;
const key = (k: string, o: KeyboardEventInit = {}) => fireEvent.keyDown(document.body, { key: k, ...o });

describe("C-79 a realtime doc_update on the open form (SIMULATED: fake realtime port + fixture transport)", () => {
  function fakePort() {
    const subs: ((e: RealtimeEvent) => void)[] = [];
    const port: RealtimePort = { subscribeDoc: (_dt, _n, fn) => { subs.push(fn); return () => {}; }, subscribeDoctype: () => () => {} };
    return { port, emit: (e: RealtimeEvent) => act(async () => { for (const fn of subs) fn(e); }) };
  }
  const changeElsewhere = (t: FixtureTransport, title: string, modified: string) => {
    const doc = t.store.docs.get("Deal")!.get("D-1")!;
    t.store.docs.get("Deal")!.set("D-1", { ...doc, title, modified });
  };
  it("clean form: the newer copy is shown", async () => {
    const t = site(); const rt = fakePort();
    mountForm(t, { realtime: rt.port });
    expect((await titleBox()).value).toBe("Deal D-1");
    changeElsewhere(t, "Changed by Omar", "2026-11-02 10:00:00.000000");
    await rt.emit({ event: "doc_update", doctype: "Deal", name: "D-1", data: { modified: "2026-11-02 10:00:00.000000" } });
    await waitFor(async () => expect((await titleBox()).value).toBe("Changed by Omar"));
    expect(document.querySelector("[data-newer-on-server]")).toBeNull();
  });
  it("dirty form: the user's edit stays and the 'modified after you opened it' banner offers Reload", async () => {
    const t = site(); const rt = fakePort();
    mountForm(t, { realtime: rt.port });
    const box = await titleBox();
    fireEvent.change(box, { target: { value: "Mine" } }); fireEvent.blur(box);
    changeElsewhere(t, "Changed by Omar", "2026-11-02 10:00:00.000000");
    await rt.emit({ event: "doc_update", doctype: "Deal", name: "D-1", data: { modified: "2026-11-02 10:00:00.000000" } });
    await waitFor(() => expect(document.querySelector("[data-newer-on-server]")).not.toBeNull());
    expect((await titleBox()).value).toBe("Mine");
    fireEvent.click(within(document.querySelector<HTMLElement>("[data-newer-on-server]")!).getByRole("button", { name: "Reload" }));
    await waitFor(async () => expect((await titleBox()).value).toBe("Changed by Omar"));
  });
  it("after the user's own save, a newer server copy (someone else's later save) is displayed, not the save answer", async () => {
    const t = site(); const rt = fakePort();
    mountForm(t, { realtime: rt.port });
    const box = await titleBox();
    fireEvent.change(box, { target: { value: "Mine" } }); fireEvent.blur(box);
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    await waitFor(() => expect(callsOf(t, "frappe.desk.form.save.savedocs")).toHaveLength(1));
    await waitFor(async () => expect((await titleBox()).value).toBe("Mine"));
    const saved = String(t.store.docs.get("Deal")!.get("D-1")!.modified);
    const later = saved.replace(/^(\d{4})/, (y) => String(Number(y) + 1)); // strictly later, same format
    changeElsewhere(t, "Changed by Omar after you", later);
    await rt.emit({ event: "doc_update", doctype: "Deal", name: "D-1", data: { modified: later } });
    await waitFor(async () => expect((await titleBox()).value).toBe("Changed by Omar after you"));
  });
});

describe("C-81…C-84 form shortcuts are inert where Desk hides the entry (SIMULATED)", () => {
  it("a new unsaved document: Ctrl+P, Ctrl+E and Shift+Ctrl+D do nothing", async () => {
    const t = site();
    mountForm(t, { name: undefined });
    await titleBox();
    key("p", { ctrlKey: true }); key("e", { ctrlKey: true }); key("D", { shiftKey: true, ctrlKey: true });
    await act(async () => {});
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(callsOf(t, "frappe.www.printview.get_html_and_style")).toHaveLength(0);
  });
  it("Ctrl+E is inert on a cancelled document (docstatus 2); it opens the composer on a submitted one", async () => {
    const t = site();
    const a = mountForm(t, { doctype: "Order", name: "O-2" });
    await screen.findAllByText("Order O-2");
    key("e", { ctrlKey: true });
    await act(async () => {});
    expect(screen.queryByRole("dialog")).toBeNull();
    a.unmount();
    mountForm(t, { doctype: "Order", name: "O-1" });
    await screen.findAllByText("Order O-1");
    key("e", { ctrlKey: true });
    expect((await screen.findByRole("dialog")).textContent).toMatch(/O-1/);
  });
  it("Shift+Ctrl+D is inert on a submitted document (docstatus 1)", async () => {
    const t = site();
    mountForm(t, { doctype: "Order", name: "O-1" });
    await screen.findAllByText("Order O-1");
    key("D", { shiftKey: true, ctrlKey: true });
    await act(async () => {});
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
  it("Shift+D is inert when the DocType hides Copy (meta.allow_copy = 1)", async () => {
    const t = site();
    mountForm(t, { doctype: "Memo", name: "M-1" });
    await titleBox();
    key("D", { shiftKey: true });
    await act(async () => {});
    expect(screen.queryAllByText(/New Memo|Not Saved/)).toHaveLength(0);
    expect((await titleBox()).value).toBe("Memo M-1");
  });
});

describe("D-08 a refused Done on the fixture backend (SIMULATED)", () => {
  it("assign_to.close refused by the server: the message is shown inline, the row stays, nothing is closed", async () => {
    const t = site();
    await t("frappe.desk.form.assign_to.add", { doctype: "Deal", name: "D-1", assign_to: JSON.stringify(["sara@x.org"]) });
    let refused = 0;
    const transport: FrappeTransport = async (m, a) => {
      if (m === "frappe.desk.form.assign_to.close") { refused++; throw toFrappeError(417, { exc_type: "ValidationError", _server_messages: JSON.stringify([JSON.stringify({ message: "Close the linked tasks first" })]) }); }
      return t(m, a);
    };
    const client = createFrappeClient({ transport, files: t.files });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const doc = t.store.docs.get("Deal")!.get("D-1")!;
    render(
      <QueryClientProvider client={qc}><FrappeProvider client={client} queryClient={qc} session={t.store.session} serverMessages={false}>
        <ThemeProvider storageKeys={null}><FrappeAssignTo doc={doc} user="sara@x.org" layout="sidebar" /></ThemeProvider>
      </FrappeProvider></QueryClientProvider>,
    );
    const done = await screen.findByRole("button", { name: /^Done/ });
    await act(async () => { fireEvent.click(done); });
    await waitFor(() => expect(refused).toBe(1));
    expect((await screen.findByRole("alert")).textContent).toContain("Close the linked tasks first");
    expect((screen.getByRole("button", { name: /^Done/ }) as HTMLButtonElement).disabled).toBe(false);
    expect([...t.store.todos.values()].filter((x) => x.reference_name === "D-1" && x.status === "Open")).toHaveLength(1);
  });
});

describe("D-41 each communication medium has its own icon (jsdom; stub client)", () => {
  it("Email / Phone / Meeting / Other → mail / phone / calendar / dots, as form_timeline.js", async () => {
    const media = ["Email", "Phone", "Meeting", "Other"];
    const info = { communications: media.map((m, i) => ({ name: `C${i}`, sender: "b@x.org", subject: `${m} subject`, content: "<p>x</p>", communication_medium: m, communication_type: "Communication", communication_date: `2026-11-02 1${i}:00:00`, creation: `2026-11-02 1${i}:00:00` })), comments: [], versions: [] } as unknown as DocInfo;
    const api = { call: vi.fn(async () => ({ message: [] })), getDocInfo: vi.fn(async () => info), subscribeMessages: () => () => {}, addComment: vi.fn(), getMetaBundle: vi.fn(async () => ({ doctype: "Lead", meta: { name: "Lead", fields: [], permissions: [] }, children: {} })) };
    render(
      <QueryClientProvider client={new QueryClient()}><FrappeProvider client={api as never}>
        <ThemeProvider storageKeys={null}><FrappeTimeline doc={{ doctype: "Lead", name: "L1" } as FrappeDoc} user="me@x.org" docinfo={info} canComment={false} /></ThemeProvider>
      </FrappeProvider></QueryClientProvider>,
    );
    await waitFor(() => expect(document.querySelectorAll("svg[data-medium]").length).toBe(4));
    const icons = [...document.querySelectorAll<SVGElement>("svg[data-medium]")];
    expect(icons.map((i) => i.getAttribute("data-medium")).sort()).toEqual([...media].sort());
    const cls = (m: string) => icons.find((i) => i.getAttribute("data-medium") === m)!.getAttribute("class") ?? "";
    expect(cls("Email")).toMatch(/lucide-mail/);
    expect(cls("Phone")).toMatch(/lucide-phone/);
    expect(cls("Meeting")).toMatch(/lucide-calendar-days/);
    expect(cls("Other")).toMatch(/lucide-(more-horizontal|ellipsis)/);
    expect(new Set(media.map(cls)).size).toBe(4);
  });
});

describe("D-54 workflow actions and states in Arabic by default", () => {
  const FLOW: DocTypeMeta = {
    name: "Flow Memo", is_submittable: 1, autoname: "hash", title_field: "title",
    fields: [{ fieldname: "title", fieldtype: "Data", label: "Title" }, { fieldname: "workflow_state", fieldtype: "Link", label: "Workflow State", options: "Workflow State", hidden: 1 }],
    permissions: [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, submit: 1, cancel: 1 }],
  } as DocTypeMeta;
  const FLOW_WF = {
    name: "Flow", document_type: "Flow Memo", workflow_state_field: "workflow_state",
    states: [{ state: "Draft", doc_status: "0", allow_edit: "System Manager" }, { state: "Approved", doc_status: "1", allow_edit: "System Manager" }],
    transitions: [{ state: "Draft", action: "Approve", next_state: "Approved", allowed: "System Manager" }],
  };
  const WF_AR = { Approve: "اعتماد", Draft: "مسودة", Approved: "معتمد" };
  it("FrappeForm's toolbar (SIMULATED): the state badge and the Actions menu items come from the provider's translations", async () => {
    const t = createFixtureTransport({ meta: { "Flow Memo": [FLOW] }, workflows: { "Flow Memo": FLOW_WF as never },
      docs: { "Flow Memo": [{ doctype: "Flow Memo", name: "FM-1", title: "Plan", docstatus: 0, workflow_state: "Draft", modified: "2026-11-01 10:00:00", owner: "Administrator" }] } });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <ThemeProvider defaultTheme="light" defaultLanguage="ar" storageKeys={null}><QueryClientProvider client={qc}>
        <FrappeProvider client={createFrappeClient({ transport: t })} session={{ user: "Administrator" }} translations={WF_AR}>
          <FrappeForm doctype="Flow Memo" name="FM-1" guardUnload={false} />
        </FrappeProvider>
      </QueryClientProvider></ThemeProvider>,
    );
    expect((await screen.findAllByText("مسودة")).length).toBeGreaterThan(0);
    fireEvent.keyDown(await screen.findByRole("button", { name: new RegExp(defaultMessages.ar.recActions ?? "Actions") }), { key: "Enter" });
    expect(await screen.findByRole("menuitem", { name: "اعتماد" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Approve" })).toBeNull();
  });
  it("FrappeWorkflowActions variant=\"actions\" (stub client): the menu items in Arabic; the action sent is the stored one", async () => {
    const doc: FrappeDoc = { doctype: "Flow Memo", name: "FM-1", owner: "x@x", title: "Plan", workflow_state: "Draft", docstatus: 0, modified: "2026-11-01 10:00:00" };
    const applied: unknown[] = [];
    const c = {
      call: vi.fn(async () => ({ message: [] })), subscribeMessages: () => () => {}, addComment: vi.fn(),
      getMetaBundle: vi.fn(async () => ({ doctype: "Flow Memo", meta: { ...FLOW, __workflow_docs: [{ doctype: "Workflow", is_active: 1, ...FLOW_WF }] }, children: {} })),
      getWorkflowTransitions: vi.fn(async () => FLOW_WF.transitions),
      applyWorkflow: vi.fn(async (_d: FrappeDoc, action: string) => { applied.push(action); return { ...doc, workflow_state: "Approved" }; }),
    };
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FrappeProvider client={c as never} session={{ user: "u@x.com", roles: ["System Manager"] }} translations={WF_AR}>
        <ThemeProvider defaultLanguage="ar" storageKeys={null}><FrappeWorkflowActions doc={doc} user="u@x.com" roles={["System Manager"]} variant="actions" checkMandatory={false} /></ThemeProvider>
      </FrappeProvider>
    </QueryClientProvider>);
    const trigger = await screen.findByRole("button", { name: new RegExp(defaultMessages.ar.recActions ?? "Actions") });
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "اعتماد" }));
    await waitFor(() => expect(applied).toEqual(["Approve"]));
  });
});

describe("D-64 every Desk colour name paints a distinct themed colour on the form header, the record chip and the list cell (jsdom)", () => {
  // DocType State colours as Desk stores them ("Light Blue" — indicator.js scrubs it to light-blue) plus darkgrey (hooks)
  const COLOURS: [stored: string, token: string][] = [
    ["Green", "green"], ["Cyan", "cyan"], ["Blue", "blue"], ["Light Blue", "light-blue"], ["Orange", "orange"], ["Yellow", "yellow"],
    ["Red", "red"], ["Pink", "pink"], ["Purple", "purple"], ["Gray", "gray"], ["darkgrey", "darkgrey"],
  ];
  const states = COLOURS.map(([color], i) => ({ title: `S${i}`, color }));
  const META: DocTypeMeta = { name: "Ticket", autoname: "hash", states, fields: [{ fieldname: "status", fieldtype: "Data", label: "Status" }], permissions: [] } as unknown as DocTypeMeta;
  const ALLR = { read: true, write: true, create: true };
  const rights = { levels: [ALLR], can: (p: string) => !!(ALLR as Record<string, boolean>)[p], known: true };
  const doc = (i: number): FrappeDoc => ({ doctype: "Ticket", name: `T${i}`, status: `S${i}`, docstatus: 0, modified: "2026-11-01 10:00:00" });
  const styleOf = (el: Element | null | undefined) => el?.getAttribute("style") ?? "";
  const expectThemed = (styles: string[]) => {
    for (const [k, st] of styles.entries()) expect(st, COLOURS[k]![1]).toMatch(/hsl\(var\(--[a-z-]+\)\)/);
    expect(new Set(styles).size).toBe(COLOURS.length); // light-blue ≠ blue ≠ cyan, gray ≠ darkgrey …
  };
  const app = (ui: React.ReactNode) => (
    <ThemeProvider defaultLanguage="en" storageKeys={null}><QueryClientProvider client={new QueryClient()}>
      <FrappeProvider client={createFrappeClient({ transport: async () => ({}) })}>{ui}</FrappeProvider>
    </QueryClientProvider></ThemeProvider>
  );
  it("FrappeFormView's header pill", () => {
    const styles = COLOURS.map((_, i) => {
      const r = render(app(<FrappeFormView guardUnload={false} permissions={rights} bundle={{ doctype: "Ticket", meta: META, children: {} }} doc={doc(i)} onSave={async (d) => d} />));
      const pill = r.container.querySelector("[data-color]");
      expect(pill?.getAttribute("data-color")).toBe(COLOURS[i]![1]);
      const st = styleOf(pill); r.unmount(); return st;
    });
    expectThemed(styles);
  });
  it("the record chip (FrappeStatusIndicator)", () => {
    const styles = COLOURS.map((_, i) => {
      const r = render(app(<FrappeStatusIndicator doc={doc(i)} bundle={{ doctype: "Ticket", meta: META, children: {} }} workflow={null} />));
      const chip = r.container.querySelector("[data-color]");
      expect(chip, COLOURS[i]![1]).not.toBeNull();
      const st = styleOf(chip); r.unmount(); return st;
    });
    expectThemed(styles);
  });
  it("the Frappe list's indicator cell", () => {
    const config = { isSubmittable: false, states, hasField: (f: string) => f === "status", words: { draft: "Draft", cancelled: "Cancelled", submitted: "Submitted", enabled: "Enabled", disabled: "Disabled" } };
    const styles = COLOURS.map((_, i) => {
      const r = wrap(<IndicatorCell row={{ name: `T${i}`, status: `S${i}`, docstatus: 0 }} config={config} />);
      const cell = r.container.querySelector("[data-indicator]");
      expect(cell?.getAttribute("data-indicator")).toBe(COLOURS[i]![1]);
      const st = styleOf(cell); r.unmount(); return st;
    });
    expectThemed(styles);
  });
});

describe("E-14 the totals row in Arabic uses the package's Arabic digits (jsdom; ar-EG, as every list number)", () => {
  type Row = { id: string; title: string; amount: number; cur: string; qty: number };
  const ROWS: Row[] = [{ id: "a", title: "A", amount: 100, cur: "SAR", qty: 1 }, { id: "b", title: "B", amount: 50.5, cur: "SAR", qty: 2 }, { id: "c", title: "C", amount: 10, cur: "SAR", qty: 3 }];
  const COLS: ColumnDef<Row>[] = [{ key: "title", label: "Title" }, { key: "amount", label: "Amount", fieldtype: "Currency", currency: (r) => r.cur }, { key: "qty", label: "Qty", fieldtype: "Int" }];
  it("the sums are written with Arabic-Indic digits in Arabic, like the row cells; Western digits in English", () => {
    wrap(<ListView<Row> rows={ROWS} columns={COLS} rowKey={(r) => r.id} storage={null} totals />, "ar");
    const foot = document.querySelector("tfoot[data-totals-row]")!;
    expect(foot.querySelector('[data-total-for="qty"]')!.textContent).toBe((6).toLocaleString("ar-EG"));
    expect(foot.querySelector('[data-total-for="amount"]')!.textContent).toContain((160.5).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    const cellQty = [...document.querySelectorAll("tbody tr")][2]!.textContent ?? "";
    expect(cellQty).toContain((3).toLocaleString("ar-EG"));
    cleanup();
    wrap(<ListView<Row> rows={ROWS} columns={COLS} rowKey={(r) => r.id} storage={null} totals />, "en");
    expect(document.querySelector('tfoot [data-total-for="qty"]')!.textContent).toBe("6");
  });
  it.todo("E-14 export sends add_totals_row only when the totals row is shown — NOT MET: no Frappe list / report export passes addTotalsRow (reportExport.ts:86 supports it; no caller)");
});

describe("D-64 scope: only text on a tint changes (jsdom)", () => {
  it("statusColorStyles: the pill's text is mixed 45 % on its 15 % tint; plain text (no tint) keeps P35's 55 %", async () => {
    const { statusColorStyles: s } = await import("../src/primitives/status-dot");
    const st = s("green")!;
    expect(st.pill.color).toBe("color-mix(in oklab, hsl(var(--success)) 45%, hsl(var(--foreground)))");
    expect(st.pill.backgroundColor).toBe("color-mix(in srgb, hsl(var(--success)) 15%, transparent)");
    expect(st.text.color).toBe("color-mix(in oklab, hsl(var(--success)) 55%, hsl(var(--foreground)))");
  });
});
