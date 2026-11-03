/** Generic record pieces (src/record): Timeline, CommentComposer, AssigneeGroup/AssignPicker, LifecycleBar/ActionBar/StatusBadge. Frappe-free. */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  ActionBar, AssigneeGroup, CommentComposer, LifecycleBar, StatusBadge, Timeline, draftToHtml, htmlToDraft, sanitizeCommentHtml, sortItems,
  type TimelineItem,
} from "../src/record";
import { ThemeProvider } from "../src";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const NOW = Date.UTC(2026, 10, 3, 12);
const items: TimelineItem[] = [
  { id: "c1", kind: "comment", at: NOW - 3_600_000, actor: "Ann", body: "<p>Hello <span class=\"mention\" data-id=\"bob@x.com\">@Bob</span><script>alert(1)</script></p>", canEdit: true, canDelete: true },
  { id: "v1", kind: "change", at: NOW - 7_200_000, actor: "Bob", summary: "Bob changed the value of a, b", changes: [{ label: "A", before: "1", after: "2" }, { label: "Items", before: "x", after: "y", row: 1 }] },
  { id: "s1", kind: "state", at: NOW - 9_000_000, actor: "Bob", summary: "Bob moved to Approved" },
];
const wrap = (ui: React.ReactElement, language: "en" | "ar" = "en") => render(<ThemeProvider language={language}>{ui}</ThemeProvider>);

describe("Timeline", () => {
  it("orders newest-first by default and oldest-first on request", () => {
    expect(sortItems(items, "newest-first").map((i) => i.id)).toEqual(["c1", "v1", "s1"]);
    expect(sortItems(items, "oldest-first").map((i) => i.id)).toEqual(["s1", "v1", "c1"]);
  });
  it("sanitises comment HTML and keeps the mention span", () => {
    const { container } = wrap(<Timeline items={items} now={NOW} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("span.mention")?.getAttribute("data-id")).toBe("bob@x.com");
  });
  it("sanitiser drops javascript: links and event handlers", () => {
    const out = sanitizeCommentHtml('<a href="javascript:alert(1)" onclick="x()">k</a><img src="x" onerror="y()">');
    expect(out).not.toMatch(/javascript:|onclick|onerror/);
  });
  it("expands multi-field changes, including child-table rows", () => {
    wrap(<Timeline items={items} now={NOW} />);
    expect(screen.queryByText("Items #2")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Bob changed the value/ }));
    expect(screen.getByText(/Items #2/)).toBeTruthy();
  });
  it("filters comments / changes and hides kinds", () => {
    const { container } = wrap(<Timeline items={items} showFilters hiddenKinds={["state"]} now={NOW} />);
    expect(container.querySelectorAll("[data-kind]").length).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Comments" }));
    expect(container.querySelectorAll("[data-kind='comment']").length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Changes" }));
    expect(container.querySelectorAll("[data-kind='change']").length).toBe(1);
  });
  it("shows loading, error, empty, and load more", () => {
    const more = vi.fn();
    const { rerender } = wrap(<Timeline items={[]} loading />);
    expect(screen.getByRole("status")).toBeTruthy();
    rerender(<ThemeProvider><Timeline items={[]} /></ThemeProvider>);
    expect(screen.getByText("No activity yet")).toBeTruthy();
    rerender(<ThemeProvider><Timeline items={items} error={<p>boom</p>} /></ThemeProvider>);
    expect(screen.getByText("boom")).toBeTruthy();
    rerender(<ThemeProvider><Timeline items={items} hasMore onLoadMore={more} now={NOW} /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(more).toHaveBeenCalled();
  });
  it("gates edit/delete by the item flags and confirms delete", async () => {
    const del = vi.fn().mockResolvedValue(undefined);
    const noRights = items.map((i) => ({ ...i, canEdit: false, canDelete: false }));
    const { rerender } = wrap(<Timeline items={noRights} onEditComment={vi.fn()} onDeleteComment={del} now={NOW} />);
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    rerender(<ThemeProvider><Timeline items={items} onEditComment={vi.fn()} onDeleteComment={del} now={NOW} /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(del).toHaveBeenCalled());
  });
  it("edits a comment inline", async () => {
    const edit = vi.fn().mockResolvedValue(undefined);
    wrap(<Timeline items={items} onEditComment={edit} now={NOW} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(ta.value).toContain("@Bob");
    fireEvent.change(ta, { target: { value: "Hi @Bob" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(edit).toHaveBeenCalled());
    expect(edit.mock.calls[0][1]).toContain('data-id="bob@x.com"');
  });
  it("renders in Arabic / RTL with Arabic chrome", () => {
    wrap(<Timeline items={[]} />, "ar");
    expect(screen.getByText("لا يوجد نشاط بعد")).toBeTruthy();
  });
});

describe("CommentComposer", () => {
  it("round-trips mention markup", () => {
    const html = draftToHtml({ text: "Hi @Ann Lee & <b>", mentions: [{ id: "a@x", label: "Ann Lee" }, { id: "g", label: "Team", isGroup: true }] });
    expect(html).toContain('<span class="mention" data-id="a@x">@Ann Lee</span>');
    expect(html).toContain("&amp; &lt;b&gt;");
    expect(htmlToDraft(html).mentions[0]).toEqual({ id: "a@x", label: "Ann Lee", isGroup: false });
  });
  it("searches mentions through the callback, picks with the keyboard, submits with Ctrl+Enter", async () => {
    const search = vi.fn().mockResolvedValue([{ id: "ann@x", label: "Ann" }, { id: "bob@x", label: "Bob" }]);
    const submit = vi.fn().mockResolvedValue(undefined);
    wrap(<CommentComposer onSubmit={submit} searchMentions={search} />);
    const ta = screen.getByRole("textbox");
    fireEvent.change(ta, { target: { value: "hey @A" } });
    await waitFor(() => expect(search).toHaveBeenCalledWith("A"), { timeout: 1500 });
    await screen.findByRole("option", { name: "@Ann" });
    fireEvent.keyDown(ta, { key: "ArrowDown" });
    fireEvent.keyDown(ta, { key: "Enter" });
    expect((ta as HTMLTextAreaElement).value).toBe("hey @Bob ");
    fireEvent.keyDown(ta, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0]).toContain('data-id="bob@x"');
  });
  it("hides Comment until there is text and keeps the text when submit fails", async () => {
    const submit = vi.fn().mockRejectedValue(new Error("nope"));
    wrap(<CommentComposer onSubmit={submit} />);
    expect(screen.queryByRole("button", { name: "Comment" })).toBeNull();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    expect((await screen.findByRole("alert")).textContent).toBe("nope");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("x");
  });
});

describe("AssigneeGroup", () => {
  const users = [{ id: "a@x", name: "Ann" }, { id: "b@x", name: "Bob" }];
  it("shows empty state, gates remove by predicate, calls onRemove", async () => {
    const rm = vi.fn().mockResolvedValue(undefined);
    const { rerender } = wrap(<AssigneeGroup assignees={[]} searchUsers={async () => []} />);
    expect(screen.getByText("No one assigned")).toBeTruthy();
    rerender(<ThemeProvider><AssigneeGroup assignees={users} variant="list" canRemove={(a) => a.id === "a@x"} onRemove={rm} searchUsers={async () => []} /></ThemeProvider>);
    expect(screen.getAllByRole("button", { name: /Remove/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Remove Ann" }));
    await waitFor(() => expect(rm).toHaveBeenCalledWith(users[0]));
  });
  it("picker searches, excludes assigned users and assigns", async () => {
    const assign = vi.fn().mockResolvedValue(undefined);
    const search = vi.fn().mockResolvedValue([{ id: "a@x", label: "Ann" }, { id: "c@x", label: "Cy" }]);
    wrap(<AssigneeGroup assignees={[users[0]]} searchUsers={search} onAssign={assign} />);
    fireEvent.click(screen.getByRole("button", { name: "Add assignment" }));
    const cy = await screen.findByRole("option", { name: "Cy" });
    expect(screen.getByRole("option", { name: "Ann" }).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(cy);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(assign.mock.calls[0][0].map((u: { id: string }) => u.id)).toEqual(["c@x"]);
  });
  it("collapses beyond maxVisible", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ id: `u${i}`, name: `User ${i}` }));
    wrap(<AssigneeGroup assignees={many} maxVisible={3} searchUsers={async () => []} />);
    expect(screen.getByText("+3")).toBeTruthy();
  });
});

describe("LifecycleBar / ActionBar / StatusBadge", () => {
  const states = [{ id: "d", label: "Draft" }, { id: "p", label: "Pending", tone: "warning" as const }, { id: "a", label: "Approved", tone: "success" as const }];
  it("marks past / current / future steps and the current badge", () => {
    const { container } = wrap(<LifecycleBar states={states} current="p" />);
    expect(Array.from(container.querySelectorAll("[data-step]")).map((e) => e.getAttribute("data-step"))).toEqual(["past", "current", "future"]);
    expect(container.querySelector("[data-tone='warning']")?.textContent).toBe("Pending");
  });
  it("shows who and when under past states only (current only on request)", () => {
    const st = [{ id: "d", label: "Draft", by: "Ann", at: NOW - 3_600_000 }, { id: "p", label: "Pending", by: "Bob", at: NOW - 60_000 }, { id: "a", label: "Approved" }];
    const { container, rerender } = wrap(<LifecycleBar states={st} current="p" now={NOW} />);
    expect(Array.from(container.querySelectorAll("[data-entry]")).map((e) => e.textContent)).toEqual(["Ann · 1h ago"]);
    rerender(<ThemeProvider><LifecycleBar states={st} current="p" now={NOW} showCurrentEntry /></ThemeProvider>);
    expect(container.querySelectorAll("[data-entry]")).toHaveLength(2);
  });
  it("falls back to currentLabel for an unknown state, compact variant has no steps", () => {
    const { container } = wrap(<LifecycleBar states={states} current="zzz" currentLabel="Legacy" variant="compact" />);
    expect(screen.getByText("Legacy")).toBeTruthy();
    expect(container.querySelector("ol")).toBeNull();
  });
  it("asks for confirmation, then runs; failure is shown and retryable", async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error("Self approval is not allowed")).mockResolvedValue(undefined);
    wrap(<ActionBar variant="buttons" actions={[{ id: "ap", label: "Approve", confirm: true }, { id: "rj", label: "Reject" }]} onAction={run} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(run).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Confirm" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Self approval is not allowed");
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
  it("disables the bar with a reason", () => {
    wrap(<ActionBar variant="buttons" disabled disabledReason="Save first" actions={[{ id: "x", label: "Go" }]} onAction={vi.fn()} />);
    const b = screen.getByRole("button", { name: "Go" }) as HTMLButtonElement;
    expect(b.disabled).toBe(true); expect(b.title).toBe("Save first");
  });
  it("StatusBadge carries the label, not just colour", () => {
    render(<StatusBadge label="Lost" tone="danger" />);
    expect(screen.getByText("Lost")).toBeTruthy();
  });
});
