/**
 * P36b search — the header's global search: Core `GlobalSearchBar` / `GlobalSearchDialog` and the Frappe adapter
 * (`FrappeGlobalSearch`, Desk's awesome bar + Global Search dialog) over the SIMULATED
 * `frappe.utils.global_search.search` handler. Simulated & tested (jsdom) — never verified against a site.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { Navbar } from "../src/shell/Navbar";
import { GlobalSearchBar, type GlobalSearchSource, type SearchItem } from "../src";
import { createFrappeClient } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import {
  useFrappeGlobalSearch, fuzzyMatch, fuzzySearch, GLOBAL_SEARCH_METHOD, type FrappeGlobalSearchOptions, awesomeBarItems, clearDeskRouteHistory, deskRouteUrl, deskSearchBootFrom, makeDescription,
  type DeskSearchBoot, type DeskSearchTarget,
} from "../src/frappe/search";
import type { DocPerm, DocTypeMeta, FrappeDoc } from "../src/frappe/contract";
import { createFixtureTransport, type FixtureTransport } from "../src/frappe/testing";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
beforeEach(() => { clearDeskRouteHistory(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const SM: DocPerm = { role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, report: 1 };
const CONTACT: DocTypeMeta = {
  name: "Contact", image_field: "image", permissions: [SM, { role: "Sales User", permlevel: 0, read: 1, report: 1 }],
  fields: [
    { fieldname: "first_name", fieldtype: "Data", label: "First Name", in_global_search: 1 },
    { fieldname: "company_name", fieldtype: "Data", label: "Company Name", in_global_search: 1 },
    { fieldname: "image", fieldtype: "Attach Image", label: "Image" },
  ],
};
const NOTE: DocTypeMeta = { name: "Note", permissions: [SM], fields: [{ fieldname: "title", fieldtype: "Data", label: "Title", in_global_search: 1 }] };
const TODO: DocTypeMeta = { name: "ToDo", permissions: [SM], fields: [{ fieldname: "description", fieldtype: "Text Editor", label: "Description", in_global_search: 1 }] };

function backend(contacts = 30) {
  const docs: Record<string, FrappeDoc[]> = {
    Contact: Array.from({ length: contacts }, (_, i) => ({ doctype: "Contact", name: `Acme Person ${String(i + 1).padStart(2, "0")}`, first_name: `Person ${i + 1}`, company_name: "Acme Ltd", image: i === 0 ? "/files/p1.png" : "" })),
    Note: [{ doctype: "Note", name: "N-1", title: "Acme memo" }, { doctype: "Note", name: "N-2", title: "Other" }],
    ToDo: [{ doctype: "ToDo", name: "T-1", description: "<p>Call <b>Acme</b> back</p>" }],
  };
  return { meta: { Contact: [CONTACT], Note: [NOTE], ToDo: [TODO] }, docs };
}

const BOOT: DeskSearchBoot = {
  can_read: ["Customer", "Contact", "Note", "System Settings"], can_create: ["Customer", "Contact"], can_search: ["Customer", "Contact", "Note"],
  can_get_report: ["Customer"], single_types: ["System Settings"],
  all_reports: { "Customer Ledger": { report_type: "Script Report" } }, page_info: { "user-profile": { title: "User Profile" } },
  allowed_workspaces: [{ name: "Selling" }],
};

function FrappeSearch(props: FrappeGlobalSearchOptions) {
  return <GlobalSearchBar {...useFrappeGlobalSearch(props)} />;
}

function renderFrappe(t: FixtureTransport, extra: Partial<FrappeGlobalSearchOptions> = {}, language: "en" | "ar" = "en") {
  const onNavigate = vi.fn();
  const client = createFrappeClient({ transport: t });
  render(
    <ThemeProvider storageKeys={null} language={language}>
      <FrappeProvider client={client}>
        <FrappeSearch boot={BOOT} onNavigate={onNavigate} {...extra} />
      </FrappeProvider>
    </ThemeProvider>,
  );
  return { onNavigate, input: screen.getAllByRole("combobox")[0] as HTMLInputElement };
}
const searchCalls = (t: FixtureTransport) => t.store.calls.filter((c) => c.method === GLOBAL_SEARCH_METHOD).map((c) => ({ ...c.args }));
const typeIn = (input: HTMLInputElement, text: string) => { fireEvent.focus(input); fireEvent.change(input, { target: { value: text } }); };
const options = () => screen.queryAllByRole("option");

describe("P36B.search — fuzzy matching and the awesome bar rows (search_utils.js / fuzzy_match.js)", () => {
  it("P36B.search.1 fuzzy score is Desk's: \"cust\" vs \"Customer\" = 186 (FM:125-164), marks the run, empty pattern = no match", () => {
    expect(fuzzyMatch("cust", "Customer")).toEqual([true, 186, [0, 1, 2, 3]]);
    expect(fuzzySearch("cust", "Customer")).toEqual({ score: 186, marks: [0, 1, 2, 3] });
    expect(fuzzySearch("", "Customer").score).toBe(0);
    expect(fuzzySearch("xyz", "Customer").score).toBe(0);
  });

  it("P36B.search.2 rows and order (SU:181-235): List > Report > New for a DocType; singles / reports / pages / workspaces; permission lists gate them", () => {
    const rows = awesomeBarItems("cust", { boot: BOOT });
    const labels = rows.map((r) => r.label);
    expect(labels.slice(0, 3)).toEqual(["Customer List", "Customer Report", "New Customer"]);
    const t = (l: string) => rows.find((r) => r.label === l)!.data as DeskSearchTarget;
    expect(t("Customer List").url).toBe("/app/customer");
    expect(t("Customer Report").url).toBe("/app/customer/view/report");
    expect(t("New Customer").url).toBe("/app/customer/new");
    expect(rows.find((r) => r.label === "Customer Ledger")).toBeUndefined();
    expect(awesomeBarItems("ledger", { boot: BOOT }).map((r) => r.label)).toContain("Report Customer Ledger");
    expect((awesomeBarItems("ledger", { boot: BOOT })[0].data as DeskSearchTarget).url).toBe("/app/query-report/Customer%20Ledger");
    expect(awesomeBarItems("profile", { boot: BOOT })[0].label).toBe("Open User Profile");
    expect(awesomeBarItems("sell", { boot: BOOT })[0].data).toMatchObject({ url: "/app/selling" });
    expect(awesomeBarItems("system", { boot: BOOT })[0]).toMatchObject({ label: "System Settings ", type: "" });
    // negative control: a DocType not in can_read never appears; no New without can_create (Note)
    expect(awesomeBarItems("supplier", { boot: BOOT })).toEqual([]);
    expect(awesomeBarItems("note", { boot: BOOT }).map((r) => r.label)).toEqual(["Note List"]);
    // "new cust" (SU:156-179) and "acme in contact" (SU:129-154)
    expect(awesomeBarItems("new cust", { boot: BOOT })[0]).toMatchObject({ label: "New Customer", type: "New" });
    const inList = awesomeBarItems("acme in cont", { boot: BOOT }).find((r) => r.type === "In List")!;
    expect(inList.label).toBe("Find acme in Contact");
    expect((inList.data as DeskSearchTarget).url).toBe(`/app/contact?name=${encodeURIComponent('["like","%acme%"]')}`);
    // translated names are matched (SU:579-582)
    const ar = awesomeBarItems("عمي", { boot: BOOT, translate: (s) => ({ Customer: "عميل", "{0} List": "قائمة {0}" } as Record<string, string>)[s] ?? s });
    expect(ar.map((r) => r.label)).toContain("قائمة عميل");
  });

  it("P36B.search.3 Desk URLs (router.js:423-478) and the boot mapper", () => {
    expect(deskRouteUrl(["Form", "Sales Order", "SO-0001"])).toBe("/app/sales-order/SO-0001");
    expect(deskRouteUrl(["List", "Sales Order", "Report"])).toBe("/app/sales-order/view/report");
    expect(deskRouteUrl(["dashboard-view", "Sales"])).toBe("/app/dashboard-view/Sales");
    expect(deskSearchBootFrom({ user: { can_read: ["A"], can_create: ["A"] }, single_types: ["S"], allowed_workspaces: [{ name: "W", x: 1 }] }))
      .toMatchObject({ can_read: ["A"], can_create: ["A"], single_types: ["S"], allowed_workspaces: [{ name: "W" }] });
  });

  it("P36B.search.4 make_description (SU:371-445): matching fields only, value = docname skipped, long values cut around the keyword", () => {
    const d = makeDescription("First Name : Acme Person ||| City : Pune ||| Company Name : Acme Ltd", "Acme Person", "acme");
    expect(d.map((x) => `${x.label}: ${x.value}`)).toEqual(["Company Name: Acme Ltd"]);
    const long = makeDescription(`Notes : ${"x".repeat(100)} Acme ${"y".repeat(100)}`, "N", "Acme");
    expect(long[0].value.startsWith("...")).toBe(true);
    expect(long[0].value.endsWith("...")).toBe(true);
    expect(long[0].value).toContain("Acme");
  });
});

describe("P36B.search — the simulated server method (frappe/utils/global_search.py:465-526)", () => {
  it("P36B.search.5 response shape, & split, image only with image_field, doctype filter, start offset", async () => {
    const t = createFixtureTransport(backend());
    const res = (await t(GLOBAL_SEARCH_METHOD, { text: "acme", start: 0, limit: 100, doctype: "" })).message as Record<string, unknown>[];
    expect(new Set(res.map((r) => r.doctype))).toEqual(new Set(["Contact", "Note", "ToDo"]));
    const c = res.find((r) => r.name === "Acme Person 01")!;
    expect(Object.keys(c).sort()).toEqual(["content", "doctype", "image", "name", "rank"]);
    expect(c.content).toBe("First Name : Person 1 ||| Company Name : Acme Ltd");
    expect(c.image).toBe("/files/p1.png");
    expect(res.find((r) => r.name === "Acme Person 02")!.image).toBeNull();
    expect(Object.keys(res.find((r) => r.doctype === "Note")!)).not.toContain("image");
    expect(res.find((r) => r.doctype === "ToDo")!.content).toBe("Description : Call Acme back");
    const only = (await t(GLOBAL_SEARCH_METHOD, { text: "acme", start: 20, limit: 20, doctype: "Contact" })).message as unknown[];
    expect(only).toHaveLength(10);
    expect((await t(GLOBAL_SEARCH_METHOD, { text: "acme", doctype: "User" })).message).toEqual([]);
    const both = (await t(GLOBAL_SEARCH_METHOD, { text: "memo & back", start: 0, limit: 20, doctype: "" })).message as Record<string, unknown>[];
    expect(both.map((r) => r.name).sort()).toEqual(["N-1", "T-1"]);
  });

  it("P36B.search.6 permission: a restricted user gets rows only from DocTypes it can read (GS:482 — DocType level), Administrator gets all", async () => {
    const admin = createFixtureTransport(backend(), { permissions: { user: "Administrator" } });
    const sales = createFixtureTransport(backend(), { permissions: { user: "sales@example.com", roles: ["Sales User"] } });
    const nobody = createFixtureTransport(backend(), { permissions: { user: "x@example.com", roles: [] } });
    const dts = async (t: FixtureTransport) => new Set(((await t(GLOBAL_SEARCH_METHOD, { text: "acme", start: 0, limit: 100, doctype: "" })).message as { doctype: string }[]).map((r) => r.doctype));
    expect(await dts(admin)).toEqual(new Set(["Contact", "Note", "ToDo"]));
    expect(await dts(sales)).toEqual(new Set(["Contact"]));
    expect(await dts(nobody)).toEqual(new Set());
    expect((await sales(GLOBAL_SEARCH_METHOD, { text: "acme", doctype: "Note" })).message).toEqual([]);
  });

  it("P36B.search.7 Global Search Settings decide the searchable DocTypes in idx order (global_search_settings.py:46-51)", async () => {
    const b = backend();
    const t = createFixtureTransport({
      meta: { ...b.meta, "Global Search Settings": [{ name: "Global Search Settings", issingle: 1, fields: [] }] },
      docs: { ...b.docs, "Global Search Settings": [{ doctype: "Global Search Settings", name: "Global Search Settings", allowed_in_global_search: [{ document_type: "ToDo", idx: 1 }, { document_type: "Note", idx: 2 }] }] },
    });
    const res = (await t(GLOBAL_SEARCH_METHOD, { text: "acme", start: 0, limit: 100, doctype: "" })).message as { doctype: string }[];
    expect(res.map((r) => r.doctype)).toEqual(["ToDo", "Note"]);
  });
});

describe("P36B.search — useFrappeGlobalSearch + GlobalSearchBar in the header (awesome bar + Global Search dialog)", () => {
  it("P36B.search.8 debounce 100 ms; from 2 characters; \"Search for\" (index 100) ranks below a DocType match; Enter opens the first row", async () => {
    const t = createFixtureTransport(backend());
    const { input, onNavigate } = renderFrappe(t);
    typeIn(input, "c");
    await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
    expect(options().map((o) => o.textContent)).toEqual([]); // 1 char: recents only (none yet)
    typeIn(input, "cust");
    expect(options()).toHaveLength(0); // not before the debounce
    await waitFor(() => expect(options().length).toBeGreaterThan(0));
    const labels = options().map((o) => o.textContent);
    expect(labels[0]).toBe("Customer List");
    expect(labels).toContain("Search for cust↵");
    expect(labels.indexOf("Search for cust↵")).toBeGreaterThan(labels.indexOf("New Customer"));
    expect(options()[0].getAttribute("aria-selected")).toBe("true"); // autoFirst
    expect(searchCalls(t)).toHaveLength(0); // the awesome bar makes no server call (AB:71, 263-265)
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onNavigate).toHaveBeenCalledWith("/app/customer", expect.objectContaining({ route: ["List", "Customer"], newTab: false }));
    expect(input.value).toBe(""); // cleared (AB:131-136)
  });

  it("P36B.search.9 keyboard: ↓/↑ wrap, Esc closes; Ctrl+G focuses the bar but not while another input has focus", async () => {
    const t = createFixtureTransport(backend());
    const { input } = renderFrappe(t);
    typeIn(input, "cust");
    await waitFor(() => expect(options().length).toBeGreaterThan(2));
    const n = options().length;
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(options()[n - 1].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options()[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options()[1].getAttribute("aria-selected")).toBe("true");
    expect(input.getAttribute("aria-activedescendant")).toBe(options()[1].id);
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(options()).toHaveLength(0));
    input.blur();
    const other = document.createElement("input");
    document.body.appendChild(other);
    other.focus();
    fireEvent.keyDown(other, { key: "g", ctrlKey: true });
    expect(document.activeElement).toBe(other);
    other.blur();
    fireEvent.keyDown(document.body, { key: "g", ctrlKey: true });
    expect(document.activeElement).toBe(input);
    other.remove();
  });

  it("P36B.search.10 \"Search for\" opens the dialog: request {text, start:0, limit:100, doctype:\"\"}; groups by DocType; All Results = 4 + More", async () => {
    const t = createFixtureTransport(backend());
    const { input } = renderFrappe(t);
    typeIn(input, "acme");
    await waitFor(() => expect(options().length).toBeGreaterThan(0));
    fireEvent.click(screen.getByText("Search for acme"));
    const dialog = await screen.findByTestId("global-search-dialog");
    await waitFor(() => expect(within(dialog).queryByTestId("search-loading")).toBeNull());
    expect(searchCalls(t)).toEqual([{ text: "acme", start: 0, limit: 100, doctype: "" }]);
    const nav = within(dialog).getByRole("navigation");
    expect(within(nav).getAllByRole("button").map((b) => b.textContent)).toEqual(["All Results", "Contact", "Note", "ToDo"]);
    expect(within(nav).getByText("All Results").closest("button")!.getAttribute("aria-current")).toBe("true");
    const contact = dialog.querySelector('section[data-group="Contact"]')!;
    expect(within(contact as HTMLElement).getAllByRole("option")).toHaveLength(4);
    expect(within(contact as HTMLElement).getByText("Acme Person 01").closest("a")!.getAttribute("href")).toBe("/app/contact/Acme%20Person%2001");
    expect(within(contact as HTMLElement).getAllByTestId("search-item-details")[0].textContent).toBe("Company Name: Acme Ltd");
    expect((contact as HTMLElement).querySelector("img")!.getAttribute("src")).toBe("/files/p1.png");
    fireEvent.click(within(contact as HTMLElement).getByText("More"));
    // the full list: 20 of the 30 loaded rows, then "More" = the server's next 20 from start 20 for this DocType
    const full = () => dialog.querySelector('section[data-group="Contact"]') as HTMLElement;
    expect(within(full()).getAllByRole("option")).toHaveLength(20);
    fireEvent.click(within(full()).getByText("More"));
    await waitFor(() => expect(within(full()).getByText("30 results found")).toBeTruthy());
    expect(searchCalls(t)[1]).toEqual({ text: "acme", start: 20, limit: 20, doctype: "Contact" });
    expect(within(full()).getAllByRole("option")).toHaveLength(30);
    expect(within(full()).queryByText("More")).toBeNull();
  });

  it("P36B.search.11 click / Ctrl-click / Enter in the dialog navigate to the document and close it; the route becomes a recent", async () => {
    const t = createFixtureTransport(backend());
    const { input, onNavigate } = renderFrappe(t);
    typeIn(input, "memo");
    await waitFor(() => expect(options().length).toBeGreaterThan(0));
    fireEvent.keyDown(input, { key: "Enter" }); // "Search for memo" is the only row → first
    const dialog = await screen.findByTestId("global-search-dialog");
    await waitFor(() => expect(within(dialog).getByText("N-1")).toBeTruthy());
    fireEvent.click(within(dialog).getByText("N-1"), { ctrlKey: true });
    expect(onNavigate).toHaveBeenLastCalledWith("/app/note/N-1", expect.objectContaining({ route: ["Form", "Note", "N-1"], newTab: true, doctype: "Note", name: "N-1" }));
    await waitFor(() => expect(screen.queryByTestId("global-search-dialog")).toBeNull());
    // recents: below 2 characters (AB:82-87), "Note N-1" at index 80 (SU:62-70, 105)
    fireEvent.focus(input);
    await waitFor(() => expect(options().map((o) => o.textContent)).toEqual(["Note N-1"]));
    // keyboard in the dialog (addition): ↓ + Enter
    typeIn(input, "acme");
    await waitFor(() => expect(screen.getByText("Search for acme")).toBeTruthy());
    fireEvent.click(screen.getByText("Search for acme"));
    const d2 = await screen.findByTestId("global-search-dialog");
    await waitFor(() => expect(within(d2).getAllByRole("option").length).toBeGreaterThan(0));
    const box = within(d2).getByRole("combobox");
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onNavigate).toHaveBeenLastCalledWith("/app/contact/Acme%20Person%2001", expect.objectContaining({ newTab: false }));
  });

  it("P36B.search.12 the dialog debounces 300 ms and ignores 1 character; a restricted user sees fewer groups", async () => {
    const t = createFixtureTransport(backend(), { permissions: { user: "sales@example.com", roles: ["Sales User"] } });
    const { input } = renderFrappe(t);
    typeIn(input, "zz");
    await waitFor(() => expect(screen.getByText("Search for zz")).toBeTruthy());
    fireEvent.click(screen.getByText("Search for zz"));
    const dialog = await screen.findByTestId("global-search-dialog");
    await waitFor(() => expect(within(dialog).getByTestId("search-empty").textContent).toContain("No Results found"));
    const box = within(dialog).getByRole("combobox");
    fireEvent.change(box, { target: { value: "acme" } });
    await act(async () => { await new Promise((r) => setTimeout(r, 200)); });
    expect(searchCalls(t)).toHaveLength(1);
    await waitFor(() => expect(searchCalls(t)).toHaveLength(2));
    await waitFor(() => expect(within(dialog).getAllByRole("option").length).toBeGreaterThan(0));
    expect(within(dialog).queryByRole("navigation")).toBeNull(); // one group only (Contact) → no sidebar
    expect(dialog.querySelector('section[data-group="Note"]')).toBeNull();
    fireEvent.change(box, { target: { value: "a" } });
    await waitFor(() => expect(within(dialog).getByTestId("search-idle").textContent).toContain("Search for anything"));
    expect(searchCalls(t)).toHaveLength(2);
  });

  it("P36B.search.13 loading, then error with Retry (re-issues the call)", async () => {
    let fail = true;
    let release: () => void = () => {};
    const t = createFixtureTransport(backend(), {
      handlers: {
        [GLOBAL_SEARCH_METHOD]: () => new Promise((resolve, reject) => {
          release = () => (fail ? reject(new Error("boom")) : resolve({ message: [{ doctype: "Note", name: "N-9", content: "Title : Acme", rank: 1 }] }));
        }),
      },
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { input } = renderFrappe(t);
    typeIn(input, "acme");
    await waitFor(() => expect(screen.getByText("Search for acme")).toBeTruthy());
    fireEvent.click(screen.getByText("Search for acme"));
    const dialog = await screen.findByTestId("global-search-dialog");
    expect(within(dialog).getByTestId("search-loading").textContent).toContain("Searching ...");
    await act(async () => { release(); });
    await waitFor(() => expect(within(dialog).getByRole("alert").textContent).toContain("The search failed."));
    fail = false;
    fireEvent.click(within(dialog).getByText("Retry"));
    await act(async () => { release(); });
    await waitFor(() => expect(within(dialog).getByText("N-9")).toBeTruthy());
    errSpy.mockRestore();
  });

  it("P36B.search.14 RTL / Arabic: chrome strings from messages-ws/search.ts, the bar mirrors with the document direction", async () => {
    const t = createFixtureTransport(backend());
    const { input } = renderFrappe(t, {}, "ar");
    expect(input.placeholder).toMatch(/^ابحث أو اكتب أمراً \((Ctrl \+ G|⌘ \+ G)\)$/);
    expect(document.documentElement.dir).toBe("rtl");
    typeIn(input, "acme");
    await waitFor(() => expect(screen.getByText("ابحث عن acme")).toBeTruthy());
    fireEvent.click(screen.getByText("ابحث عن acme"));
    const dialog = await screen.findByTestId("global-search-dialog");
    await waitFor(() => expect(within(dialog).getByText("كل النتائج")).toBeTruthy());
    expect(within(dialog).getAllByText("المزيد").length).toBeGreaterThan(0);
  });
});

describe("P36B.search — Core bar with an app source, and the Navbar slot", () => {
  it("P36B.search.15 a generic source: async suggestions show loading; onSelect gets the item; mobile icon opens the dialog; Navbar slot renders at every width", async () => {
    let resolve: (v: SearchItem[]) => void = () => {};
    const source: GlobalSearchSource = {
      suggest: () => new Promise((r) => { resolve = r; }),
      search: async () => [{ id: "Deals", title: "Deals", kind: "remote", items: [{ id: "d1", label: "Big deal", href: "/deals/1" }] }],
    };
    const onSelect = vi.fn();
    render(
      <ThemeProvider storageKeys={null}>
        <Navbar title="T" search={{ slot: <GlobalSearchBar source={source} onSelect={onSelect} /> }} />
      </ThemeProvider>,
    );
    const bar = screen.getByTestId("global-search-bar");
    expect(bar.parentElement?.className ?? "").not.toMatch(/hidden md:block/);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    typeIn(input, "big");
    await waitFor(() => expect(screen.getByText("Loading…")).toBeTruthy());
    await act(async () => { resolve([{ id: "x", label: "Big list", index: 150, href: "/x" }]); });
    await waitFor(() => expect(options().map((o) => o.textContent)).toEqual(["Big list", "Search for big↵"]));
    fireEvent.click(screen.getByText("Big list"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "x" }), { newTab: false });
    fireEvent.click(screen.getByTestId("global-search-mobile"));
    const dialog = await screen.findByTestId("global-search-dialog");
    expect(within(dialog).getByTestId("search-idle").textContent).toContain("Search for anything");
    // default Navbar search is unchanged (negative control)
    cleanup();
    render(<ThemeProvider storageKeys={null}><Navbar title="T" /></ThemeProvider>);
    expect(screen.getByRole("searchbox").parentElement?.className).toMatch(/hidden md:block/);
  });
});
