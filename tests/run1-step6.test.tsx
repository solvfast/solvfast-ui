/**
 * Run 1 step 6 — tests-only closures (the behaviour exists; these assert what was unasserted): C-69 the beforeunload
 * guard, D-08 a refused "Done" (assign_to.close) shown inline, D-13 the share dialog in Arabic / RTL, E-01 the view
 * switcher by keyboard (en / ar). (A-05 / A-06 in global-search-p36b, E-59 in frappe-views-kanban.) jsdom.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AssigneeGroup, ShareDialog, ThemeProvider } from "../src";
import { ViewSwitcher, type ViewOption } from "../src/list/views";
import { FrappeProvider, createFrappeClient } from "../src/frappe";
import { FrappeFormView } from "../src/frappe/form";
import type { DocTypeMeta, FrappeDoc } from "../src/frappe/contract";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const wrap = (ui: React.ReactNode, lang: "en" | "ar" = "en") => render(<ThemeProvider defaultLanguage={lang} storageKeys={null}>{ui}</ThemeProvider>);

describe("C-69 leaving the page with unsaved changes (beforeunload)", () => {
  const ALL = { read: true, write: true, create: true };
  const rights = { levels: [ALL], can: (p: string) => !!(ALL as Record<string, boolean>)[p], known: true };
  const META: DocTypeMeta = { name: "Memo", autoname: "hash", fields: [{ fieldname: "note", fieldtype: "Data", label: "Note" }], permissions: [] };
  const DOC: FrappeDoc = { doctype: "Memo", name: "M1", note: "a", docstatus: 0, modified: "2026-11-01 10:00:00" };
  const view = (guardUnload?: boolean) => (
    <ThemeProvider storageKeys={null}><QueryClientProvider client={new QueryClient()}><FrappeProvider client={createFrappeClient({ transport: async () => ({}) })}>
      <FrappeFormView permissions={rights} bundle={{ doctype: "Memo", meta: META, children: {} }} doc={DOC} onSave={async (d) => d} guardUnload={guardUnload} />
    </FrappeProvider></QueryClientProvider></ThemeProvider>
  );
  const unload = () => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; };
  const edit = () => { const box = screen.getByRole("textbox", { name: "Note" }); fireEvent.change(box, { target: { value: "b" } }); fireEvent.blur(box); };
  it("clean → no prompt; dirty → the browser asks (default prevented)", () => {
    render(view());
    expect(unload()).toBe(false);
    edit();
    expect(unload()).toBe(true);
  });
  it("NEGATIVE: guardUnload={false} never asks", () => {
    render(view(false));
    edit();
    expect(unload()).toBe(false);
  });
});

describe("D-08 a refused Done (assign_to.close)", () => {
  it("the server's message is shown inline, the row stays and its button is usable again", async () => {
    const people = [{ id: "me@x", name: "Me" }, { id: "bob@x", name: "Bob" }];
    const onComplete = vi.fn(() => Promise.reject(new Error("Only the assignee can close it")));
    wrap(<AssigneeGroup variant="list" assignees={people} onComplete={onComplete} canComplete={(a) => a.id === "me@x"} searchUsers={async () => []} />);
    const done = screen.getByRole("button", { name: "Done: Me" });
    expect(screen.queryByRole("button", { name: "Done: Bob" })).toBeNull(); // assignee only
    await act(async () => { fireEvent.click(done); });
    expect(screen.getByRole("alert").textContent).toBe("Only the assignee can close it");
    expect(screen.getByText("Me")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Done: Me" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("D-13 the share dialog in Arabic", () => {
  it("title, rights columns and Everyone in Arabic; the dialog follows the page direction", () => {
    wrap(<ShareDialog open onOpenChange={() => {}} docName="D-1" canShare canGrant={{ write: true, submit: true }}
      entries={[{ id: "e", user: null, everyone: true, read: true }, { id: "u", user: "bob@x", read: true, write: true }]} searchUsers={async () => []} onAdd={async () => {}} onSetRight={async () => {}} />, "ar");
    const dlg = screen.getByRole("dialog");
    expect(dlg.textContent).toContain("مشاركة D-1 مع");
    for (const w of ["يمكنه القراءة", "يمكنه الكتابة", "يمكنه المشاركة", "الجميع"]) expect(dlg.textContent, w).toContain(w);
    expect(document.documentElement.getAttribute("dir")).toBe("rtl");
    expect(dlg.textContent).not.toMatch(/Can Read|Everyone/);
  });
});

describe("E-01 the view switcher by keyboard", () => {
  const views: ViewOption[] = [{ view: "list", available: true }, { view: "report", available: true }, { view: "kanban", available: true }];
  for (const lang of ["en", "ar"] as const) {
    it(`${lang}: Enter opens the menu, ↓ moves, Enter chooses (onChange gets the view)`, async () => {
      const onChange = vi.fn();
      wrap(<ViewSwitcher views={views} value="list" onChange={onChange} />, lang);
      const trigger = screen.getByTestId("sf-view-switcher");
      trigger.focus();
      fireEvent.keyDown(trigger, { key: "Enter" });
      const items = await screen.findAllByRole("menuitem");
      expect(items).toHaveLength(3);
      await waitFor(() => expect(document.activeElement).toBe(items[0]));
      fireEvent.keyDown(items[0]!, { key: "ArrowDown" });
      await waitFor(() => expect(document.activeElement).toBe(items[1]));
      fireEvent.keyDown(items[1]!, { key: "Enter" });
      await waitFor(() => expect(onChange).toHaveBeenCalledWith("report"));
    });
  }
});
