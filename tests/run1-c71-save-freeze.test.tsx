/**
 * Run 1 · C-71 (data loss) — the form is frozen while it saves (Desk save.js:4-111 freezes the page): the fields are
 * inert and aria-busy during the request, and a value still written during it (a host's / an event's setValue, a late
 * Link fetch) is re-applied over the server's answer — the form stays Not Saved — instead of being silently discarded
 * by `store.replace(saved)`. jsdom (inert is an attribute here; jsdom does not block input) + a deferred onSave.
 */
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import { FrappeFormView } from "../src/frappe/form";
import type { FormController } from "../src/frappe/form/events";
import type { DocTypeMeta, FrappeDoc } from "../src/frappe/contract";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(cleanup);

const ALL = { read: true, write: true, create: true, submit: true, cancel: true, amend: true, delete: true };
const rights = { levels: [ALL], can: (p: string) => !!(ALL as Record<string, boolean>)[p], known: true };
const MEMO: DocTypeMeta = {
  name: "Memo", autoname: "hash", title_field: "title",
  fields: [{ fieldname: "title", fieldtype: "Data", label: "Title", reqd: 1 }, { fieldname: "note", fieldtype: "Data", label: "Note" }],
  permissions: [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1 }],
};
const DOC: FrappeDoc = { doctype: "Memo", name: "MEMO-1", title: "Hello", note: "n", docstatus: 0, modified: "2026-11-01 10:00:00" };

function mount() {
  let resolve!: (d: FrappeDoc) => void;
  const sent: FrappeDoc[] = [];
  const onSave = (d: FrappeDoc) => { sent.push(d); return new Promise<FrappeDoc>((r) => { resolve = r; }); };
  const ctl: React.MutableRefObject<FormController | null> = { current: null };
  const client = createFrappeClient({ transport: async () => ({}) });
  render(
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
      <QueryClientProvider client={new QueryClient()}>
        <FrappeProvider client={client} session={{ user: "Administrator" }}>
          <FrappeFormView guardUnload={false} permissions={rights} bundle={{ doctype: "Memo", meta: MEMO, children: {} }} doc={DOC} onSave={onSave} controllerRef={ctl} />
        </FrappeProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return { sent, ctl, answer: (d: FrappeDoc) => act(async () => { resolve(d); await Promise.resolve(); }) };
}
const panel = () => screen.getByRole("textbox", { name: "Title" }).closest("[data-form-fields]") as HTMLElement;

describe("C-71 save freeze", () => {
  it("while the request runs the fields are inert and aria-busy; afterwards they are live again", async () => {
    const m = mount();
    fireEvent.change(screen.getByRole("textbox", { name: "Note" }), { target: { value: "n2" } });
    fireEvent.blur(screen.getByRole("textbox", { name: "Note" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.sent).toHaveLength(1));
    expect(panel().getAttribute("aria-busy")).toBe("true");
    expect(panel().hasAttribute("inert")).toBe(true);
    await m.answer({ ...DOC, note: "n2", modified: "2026-11-01 10:05:00" });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Saved"));
    expect(panel().hasAttribute("inert")).toBe(false);
    expect(panel().getAttribute("aria-busy")).toBeNull();
  });

  it("a value written during the request survives the server's answer, and the form stays Not Saved", async () => {
    const m = mount();
    fireEvent.change(screen.getByRole("textbox", { name: "Note" }), { target: { value: "first" } });
    fireEvent.blur(screen.getByRole("textbox", { name: "Note" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.sent).toHaveLength(1));
    expect(m.sent[0]!.note).toBe("first");
    act(() => m.ctl.current!.setValue("title", "Typed during save"));
    await m.answer({ ...DOC, note: "first", modified: "2026-11-01 10:05:00" });
    await waitFor(() => expect((screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement).value).toBe("Typed during save"));
    expect((screen.getByRole("textbox", { name: "Note" }) as HTMLInputElement).value).toBe("first");
    expect(m.ctl.current!.isDirty).toBe(true);
    expect(screen.getByText("Not Saved")).toBeTruthy();
  });

  it("NEGATIVE: without a write during the request the server's document replaces the local one and the form is clean", async () => {
    const m = mount();
    fireEvent.change(screen.getByRole("textbox", { name: "Note" }), { target: { value: "x" } });
    fireEvent.blur(screen.getByRole("textbox", { name: "Note" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.sent).toHaveLength(1));
    await m.answer({ ...DOC, note: "x (server)", modified: "2026-11-01 10:05:00" });
    await waitFor(() => expect((screen.getByRole("textbox", { name: "Note" }) as HTMLInputElement).value).toBe("x (server)"));
    expect(m.ctl.current!.isDirty).toBe(false);
  });
});
