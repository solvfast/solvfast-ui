/**
 * P35 views — Image view. Core `ImageGrid` / `ImageView` (Testing Library) and `FrappeImageView` over the SIMULATED
 * Frappe (`createFixtureTransport` + views demo backend): request shapes of `frappe.desk.reportview.get` asserted.
 * Simulated & tested — never run against a real site.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src";
import { ImageGrid, ImageView, initialsOf } from "../src/list/views";
import { FrappeProvider, createFrappeClient } from "../src/frappe";
import { FrappeImageView } from "../src/frappe/views";
import { createFixtureTransport } from "../src/frappe/testing";
import { viewsDemoBackend } from "../src/frappe/testing/handlers/views";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => cleanup());

type R = { id: string; name: string; img?: string; note?: string };
const ROWS: R[] = [{ id: "a", name: "Alpha Beta", img: "/a.png", note: "first" }, { id: "b", name: "gamma" }, { id: "c", name: "Delta" }];
const theme = (ui: React.ReactNode, lang: "en" | "ar" = "en") => <ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>{ui}</ThemeProvider>;

describe("LV.H5 image grid (Core)", () => {
  it("LV.H5 image or initials, title, detail; Enter/click opens; arrows move focus (RTL swaps); Space selects", () => {
    const onOpen = vi.fn();
    const sel = new Set<string>();
    const toggle = vi.fn((r: R) => (sel.has(r.id) ? sel.delete(r.id) : sel.add(r.id)));
    render(theme(<ImageGrid rows={ROWS} rowKey={(r) => r.id} image={(r) => r.img} title={(r) => r.name} detail={(r) => r.note} onOpen={onOpen} selection={{ isSelected: (r) => sel.has(r.id), toggleRow: toggle }} />));
    expect(screen.getByRole("img", { name: "Alpha Beta" }).getAttribute("src")).toBe("/a.png");
    const cards = screen.getAllByRole("button", { name: /^Open / });
    expect(cards.map((c) => c.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
    expect(within(cards[1]).getByText("G")).toBeTruthy(); // initials placeholder
    expect(within(cards[0]).getByText("first")).toBeTruthy();
    cards[0].focus();
    fireEvent.keyDown(cards[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(cards[1]);
    fireEvent.keyDown(cards[1], { key: "End" });
    expect(document.activeElement).toBe(cards[2]);
    fireEvent.keyDown(cards[2], { key: " " });
    expect(toggle).toHaveBeenCalledWith(ROWS[2]);
    fireEvent.click(cards[2]);
    expect(onOpen).toHaveBeenCalledWith(ROWS[2]);
    cleanup();
    render(theme(<ImageGrid rows={ROWS} rowKey={(r) => r.id} image={(r) => r.img} title={(r) => r.name} />, "ar"));
    const ar = screen.getAllByRole("button", { name: /^فتح / });
    ar[0].focus();
    fireEvent.keyDown(ar[0], { key: "ArrowLeft" }); // RTL: left = forward
    expect(document.activeElement).toBe(ar[1]);
  });
  it("LV.H5 loading skeleton, empty message, error with retry", () => {
    const retry = vi.fn();
    const { rerender } = render(theme(<ImageGrid rows={[]} rowKey={(r: R) => r.id} image={() => null} title={(r) => r.name} loading />));
    expect(screen.getByRole("list").getAttribute("aria-busy")).toBe("true");
    rerender(theme(<ImageGrid rows={[]} rowKey={(r: R) => r.id} image={() => null} title={(r) => r.name} empty="Nothing here" />));
    expect(screen.getByRole("status").textContent).toBe("Nothing here");
    rerender(theme(<ImageGrid rows={[]} rowKey={(r: R) => r.id} image={() => null} title={(r) => r.name} error onRetry={retry} />));
    fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalled();
  });
  it("LV.H5 ImageView (client mode) shares the list state: search filters cards, the pager pages", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: String(i), name: `Card ${i}` }));
    render(theme(<ImageView rows={many} rowKey={(r) => r.id} columns={[{ key: "name", label: "Name", type: "text" }]} image={() => null} title={(r) => r.name} storage={null} />));
    expect(screen.getAllByRole("button", { name: /^Open Card/ })).toHaveLength(20);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getAllByRole("button", { name: /^Open Card/ })).toHaveLength(5);
    fireEvent.change(screen.getByRole("textbox", { name: "Search…" }), { target: { value: "Card 7" } });
    expect(screen.getAllByRole("button", { name: /^Open Card/ }).map((b) => b.getAttribute("aria-label"))).toEqual(["Open Card 7"]);
    expect(initialsOf("  hello   world  again ")).toBe("HW");
  });
});

function mountImage(props: Partial<React.ComponentProps<typeof FrappeImageView>> = {}, handlers?: Parameters<typeof createFixtureTransport>[1]) {
  const transport = createFixtureTransport(viewsDemoBackend(), handlers);
  const client = createFrappeClient({ transport });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(theme(
    <QueryClientProvider client={qc}><FrappeProvider client={client} session={{ user: "Administrator", roles: ["System Manager"] }}>
      <FrappeImageView doctype="Product" storage={null} {...props} />
    </FrappeProvider></QueryClientProvider>,
  ));
  const gets = () => transport.store.calls.filter((c) => c.method === "frappe.desk.reportview.get");
  return { transport, gets };
}

describe("LV.H5 FrappeImageView (SIMULATED reportview)", () => {
  it("LV.H5 requests the image_field + title_field with the list fields; cards show images or initials", async () => {
    const { gets } = mountImage();
    await screen.findByRole("img", { name: "Desk Lamp" });
    const last = gets().at(-1)!.args;
    const fields = JSON.parse(String(last.fields));
    expect(fields).toEqual(expect.arrayContaining(["name", "product_name", "category", "price", "image", "docstatus"]));
    expect(last).toMatchObject({ doctype: "Product", start: 0, page_length: 20, order_by: "product_name asc, name asc" });
    expect(screen.getByRole("img", { name: "Laptop Pro" }).getAttribute("src")).toBe("/files/laptop.png");
    const office = screen.getByRole("button", { name: "Open Office Suite" });
    expect(within(office).getByText("OS")).toBeTruthy();
    expect(within(office).getByText("Software")).toBeTruthy(); // the first non-empty list field
  });
  it("LV.H5 filters shared with the list state: initialQuery → reportview filters; search → like on the search fields", async () => {
    const onQ = vi.fn();
    const { gets } = mountImage({ initialQuery: { conjunction: "and", conditions: [{ id: "c1", field: "category", operator: "equals", value: "Hardware" }] }, onQueryStateChange: onQ, imageUrl: (u) => `https://site.test${u}` });
    await screen.findByRole("img", { name: "Laptop Pro" });
    expect(JSON.parse(String(gets().at(-1)!.args.filters))).toEqual([["category", "=", "Hardware"]]);
    expect(screen.getAllByRole("button", { name: /^Open / }).map((b) => b.getAttribute("aria-label"))).toEqual(["Open Desk Lamp", "Open Laptop Pro"]);
    expect(screen.getByRole("img", { name: "Laptop Pro" }).getAttribute("src")).toBe("https://site.test/files/laptop.png");
    expect(onQ).toHaveBeenLastCalledWith(expect.objectContaining({ query: expect.objectContaining({ conditions: [expect.objectContaining({ field: "category" })] }) }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search…" }), { target: { value: "lamp" } });
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(1), { timeout: 3000 });
    const args = gets().at(-1)!.args;
    expect(JSON.parse(String(args.filters))).toEqual([["category", "=", "Hardware"]]);
    expect(JSON.parse(String(args.or_filters))).toEqual([["product_name", "like", "%lamp%"], ["name", "like", "%lamp%"]]);
  });
  it("LV.H5 paging through the existing pager: page 2 asks start = pageSize", async () => {
    const { gets } = mountImage({ pageSize: 3 });
    await screen.findByRole("img", { name: "Desk Lamp" });
    await waitFor(() => expect(screen.getByText(/Total: 4/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await screen.findByRole("button", { name: "Open Setup Service" });
    expect(gets().at(-1)!.args).toMatchObject({ start: 3, page_length: 3 });
  });
  it("LV.H5 a server error shows FrappeErrorState (no cards)", async () => {
    mountImage({}, { handlers: { "frappe.desk.reportview.get": () => { throw Object.assign(new Error("boom"), { status: 500 }); } } });
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: /^Open / })).toBeNull();
  });
});
