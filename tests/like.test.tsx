/**
 * Desk's Like heart (the list view's favorite marker) — Core `LikeToggle`, `ListTable` `like`, `FrappeListView` wiring
 * (SIMULATED: stub transports over the playground's simulated ToDo rows, and the package simulator).
 * Native reference: Frappe 15.110 list/list_view.js:729-735, 985-991, 1049-1059, 1431-1455; ui/like.js:12-56; desk/like.py.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ListTable, LikeToggle, ThemeProvider } from "../src";
import { FrappeListView, FrappeProvider, createFrappeClient, type FrappeTransport } from "../src/frappe";
import { createFixtureTransport } from "../src/frappe/testing";
import { TODO_META, createMockFrappe } from "../playground/src/demo/mock-frappe";

beforeAll(() => configure({ asyncUtilTimeout: 4000 }));
afterEach(() => cleanup());

const wrap = (ui: React.ReactNode, language: "en" | "ar" = "en") => (
  <ThemeProvider defaultTheme="light" defaultLanguage={language} storageKeys={null}>{ui}</ThemeProvider>
);
const deferred = () => { let resolve!: () => void, reject!: (e: unknown) => void; const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };

describe("LikeToggle (Core)", () => {
  it("is a named toggle button: aria-pressed follows the state, one fixed name in each language, title passes through", () => {
    render(wrap(<LikeToggle liked title="Ann, Bob" />));
    const b = screen.getByRole("button", { name: "Like" });
    expect(b.getAttribute("aria-pressed")).toBe("true");
    expect(b.getAttribute("title")).toBe("Ann, Bob");
    cleanup();
    render(wrap(<LikeToggle liked={false} />, "ar"));
    expect(screen.getByRole("button", { name: "إعجاب" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("uncontrolled + synchronous handler: flips at once", () => {
    const onToggle = vi.fn();
    render(wrap(<LikeToggle onToggle={onToggle} />));
    const b = screen.getByRole("button", { name: "Like" });
    fireEvent.click(b);
    expect(onToggle).toHaveBeenCalledWith(true);
    expect(b.getAttribute("aria-pressed")).toBe("true");
  });

  it("not optimistic: pending while the promise runs (disabled, aria-busy), flips only after it resolves", async () => {
    const d = deferred();
    render(wrap(<LikeToggle onToggle={() => d.promise} />));
    const b = screen.getByRole("button", { name: "Like" });
    fireEvent.click(b);
    expect(b.getAttribute("aria-pressed")).toBe("false");
    expect(b.hasAttribute("disabled")).toBe(true);
    expect(b.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(b); // ignored while pending
    await act(async () => { d.resolve(); await d.promise; });
    expect(b.getAttribute("aria-pressed")).toBe("true");
    expect(b.hasAttribute("disabled")).toBe(false);
  });

  it("a rejected toggle keeps the state and reports the error (Desk is quiet: no message)", async () => {
    const d = deferred();
    const onError = vi.fn();
    render(wrap(<LikeToggle defaultLiked onToggle={() => d.promise} onError={onError} />));
    const b = screen.getByRole("button", { name: "Like" });
    fireEvent.click(b);
    await act(async () => { d.reject(new Error("boom")); await d.promise.catch(() => undefined); });
    expect(b.getAttribute("aria-pressed")).toBe("true");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("disabled: no toggle", () => {
    const onToggle = vi.fn();
    render(wrap(<LikeToggle disabled onToggle={onToggle} />));
    const b = screen.getByRole("button", { name: "Like" });
    expect(b.hasAttribute("disabled")).toBe(true);
    fireEvent.click(b);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("the click and Enter / Space never reach an enclosing row", () => {
    const onToggle = vi.fn(); const onRow = vi.fn(); const onRowKey = vi.fn();
    render(wrap(<div onClick={onRow} onKeyDown={onRowKey}><LikeToggle onToggle={onToggle} /></div>));
    const b = screen.getByRole("button", { name: "Like" });
    fireEvent.click(b);
    fireEvent.keyDown(b, { key: "Enter" });
    fireEvent.keyDown(b, { key: " " });
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onRow).not.toHaveBeenCalled();
    expect(onRowKey).not.toHaveBeenCalled();
  });
});

describe("ListTable like (Core)", () => {
  type R = { id: string; title: string; liked: boolean };
  const rows: R[] = [{ id: "a", title: "Alpha", liked: true }, { id: "b", title: "Beta", liked: false }];
  const base = { columns: [{ key: "title", label: "Title" }], rows, rowKey: (r: R) => r.id, sort: { key: "", dir: "asc" as const }, onSortToggle: () => {} };

  it("without `like`: no heart and no extra header cell", () => {
    render(wrap(<ListTable<R> {...base} />));
    expect(screen.queryByRole("button", { name: "Like" })).toBeNull();
    expect(document.querySelectorAll("thead th")).toHaveLength(1);
  });

  it("a heart per row in the last cell (hidden below md, as Desk's hidden-xs); its click does not open the row", () => {
    const onRowClick = vi.fn(); const onToggle = vi.fn();
    render(wrap(<ListTable<R> {...base} onRowClick={onRowClick} like={{ isLiked: (r) => r.liked, onToggle, likedByTitle: (r) => (r.liked ? "Ann" : undefined) }} />));
    const hearts = screen.getAllByRole("button", { name: "Like" });
    expect(hearts.map((h) => h.getAttribute("aria-pressed"))).toEqual(["true", "false"]);
    expect(hearts[0].getAttribute("title")).toBe("Ann");
    const cell = hearts[0].closest("td")!;
    expect(cell.className).toContain("hidden");
    expect(cell.className).toContain("md:table-cell");
    expect(cell.parentElement!.lastElementChild).toBe(cell);
    fireEvent.click(hearts[1]);
    expect(onToggle).toHaveBeenCalledWith(rows[1], true);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("the header 'Liked by me' toggle reports the requested state", () => {
    const onChange = vi.fn();
    render(wrap(<ListTable<R> {...base} like={{ isLiked: () => false, onToggle: () => {}, filter: { active: false, onChange } }} />));
    const t = screen.getByRole("button", { name: "Liked by me" });
    expect(t.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(t);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("FrappeListView like (SIMULATED)", () => {
  const PERMS = [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, print: 1, export: 1 }];
  type Extra = (m: string, a: Record<string, unknown>) => Promise<Record<string, unknown>> | undefined;
  function mount(props: Partial<React.ComponentProps<typeof FrappeListView>> = {}, extra?: Extra, session: { user: string; roles?: string[] } | undefined = { user: "u@x.com", roles: ["System Manager"] }) {
    const mock = createMockFrappe();
    const calls: { m: string; a: Record<string, unknown> }[] = [];
    const transport: FrappeTransport = async (m, a) => {
      calls.push({ m, a });
      const own = extra?.(m, a);
      if (own) return own as never;
      if (m === "frappe.desk.form.load.getdoctype") return { docs: [{ ...TODO_META, permissions: PERMS }], user_settings: "{}" } as never;
      return mock.transport(m, a);
    };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(wrap(
      <QueryClientProvider client={qc}><FrappeProvider client={createFrappeClient({ transport })} session={session}>
        <FrappeListView doctype="ToDo" storage={null} {...props} />
      </FrappeProvider></QueryClientProvider>,
    ));
    return { mock, calls };
  }
  const firstHeart = async () => (await screen.findAllByRole("button", { name: "Like" }))[0];

  it("a logged-in session gets a heart per row and the header toggle; `_liked_by` is requested with the list", async () => {
    const { calls } = mount();
    await firstHeart();
    expect(screen.getByRole("button", { name: "Liked by me" })).toBeTruthy();
    const get = calls.find((c) => c.m === "frappe.desk.reportview.get")!;
    expect(String(get.a.fields)).toContain("_liked_by");
  });

  it("like={false}, Guest, or no session: no heart", async () => {
    mount({ like: false });
    await screen.findAllByRole("checkbox").catch(() => undefined);
    await waitFor(() => expect(document.querySelectorAll("tbody tr td").length).toBeGreaterThan(1));
    expect(screen.queryByRole("button", { name: "Like" })).toBeNull();
    cleanup();
    mount({}, undefined, { user: "Guest" });
    await waitFor(() => expect(document.querySelectorAll("tbody tr td").length).toBeGreaterThan(1));
    expect(screen.queryByRole("button", { name: "Like" })).toBeNull();
  });

  it("toggle sends frappe.desk.like.toggle_like {doctype, name, add: Yes|No}; the row flips only after the server answers", async () => {
    let release!: () => void;
    const { calls } = mount({}, (m) => (m === "frappe.desk.like.toggle_like" ? new Promise((r) => { release = () => r({}); }) : undefined));
    const heart = await firstHeart();
    fireEvent.click(heart);
    await waitFor(() => expect(calls.some((c) => c.m === "frappe.desk.like.toggle_like")).toBe(true));
    const call = calls.find((c) => c.m === "frappe.desk.like.toggle_like")!;
    expect(call.a).toMatchObject({ doctype: "ToDo", add: "Yes" });
    expect(typeof call.a.name).toBe("string");
    expect(heart.getAttribute("aria-pressed")).toBe("false");
    await act(async () => { release(); });
    await waitFor(async () => expect((await firstHeart()).getAttribute("aria-pressed")).toBe("true"));
    // no list reload for a like (Desk updates in place)
    expect(calls.filter((c) => c.m === "frappe.desk.reportview.get")).toHaveLength(1);
    fireEvent.click(await firstHeart());
    await waitFor(() => expect(calls.filter((c) => c.m === "frappe.desk.like.toggle_like")[1]?.a.add).toBe("No"));
  });

  it("a refused toggle leaves the heart unchanged and reaches onLikeError", async () => {
    const onLikeError = vi.fn();
    mount({ onLikeError }, (m) => (m === "frappe.desk.like.toggle_like" ? Promise.reject(new Error("refused")) : undefined));
    const heart = await firstHeart();
    fireEvent.click(heart);
    await waitFor(() => expect(onLikeError).toHaveBeenCalledTimes(1));
    expect((await firstHeart()).getAttribute("aria-pressed")).toBe("false");
  });

  it("'Liked by me' adds `_liked_by like %user%` to the request (ANDed) and removes it again", async () => {
    const { calls } = mount();
    await firstHeart();
    fireEvent.click(screen.getByRole("button", { name: "Liked by me" }));
    const hasLikeFilter = (c: { a: Record<string, unknown> }) => String(c.a.filters).includes("_liked_by") && String(c.a.filters).includes("%u@x.com%");
    await waitFor(() => expect(calls.filter((c) => c.m === "frappe.desk.reportview.get").some(hasLikeFilter)).toBe(true));
    expect(screen.getByRole("button", { name: "Liked by me" }).getAttribute("aria-pressed")).toBe("true");
    const before = calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Liked by me" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Liked by me" }).getAttribute("aria-pressed")).toBe("false"));
    expect(calls.slice(before).filter((c) => c.m === "frappe.desk.reportview.get").every((c) => !hasLikeFilter(c))).toBe(true);
  });
});

describe("simulator: frappe.desk.like.toggle_like (desk/like.py)", () => {
  it("adds / removes the session user in _liked_by and the user's Like comment; Guest is refused", async () => {
    const t = createFixtureTransport({ user: "u@x.com", docs: { ToDo: [{ name: "T1", description: "x" }] } } as never);
    const doc = () => t.store.docs.get("ToDo")!.get("T1") as Record<string, unknown>;
    const likes = () => [...t.store.comments.values()].filter((c) => c.comment_type === "Like" && c.reference_name === "T1");
    const modified = doc().modified;
    await t("frappe.desk.like.toggle_like", { doctype: "ToDo", name: "T1", add: "Yes" });
    expect(JSON.parse(String(doc()._liked_by))).toEqual(["u@x.com"]);
    expect(likes()).toHaveLength(1);
    expect(doc().modified).toBe(modified); // update_modified=False
    await t("frappe.desk.like.toggle_like", { doctype: "ToDo", name: "T1", add: "Yes" }); // idempotent
    expect(likes()).toHaveLength(1);
    await t("frappe.desk.like.toggle_like", { doctype: "ToDo", name: "T1", add: "No" });
    expect(JSON.parse(String(doc()._liked_by))).toEqual([]);
    expect(likes()).toHaveLength(0);
    const guest = createFixtureTransport({ user: "Guest", docs: { ToDo: [{ name: "T1" }] } } as never);
    await expect(guest("frappe.desk.like.toggle_like", { doctype: "ToDo", name: "T1", add: "Yes" })).rejects.toBeTruthy();
  });
});
