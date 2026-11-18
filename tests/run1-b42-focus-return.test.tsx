/**
 * Run 1 · B-42 (P1, G28) — focus returns to the opener when a dialog closes. Core: `DialogContent`, `AlertDialogContent`
 * and `SheetContent` remember the element that opened them (a menu item → its menu's trigger) and focus it on close;
 * `returnFocus` overrides. Frappe: the list's ⋯ menu dialogs (Export, Export as report, List Settings) and the header
 * Actions menu's bulk dialogs give focus back to their trigger. jsdom + the playground's SIMULATED ToDo backend.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, Dialog, DialogContent, DialogDescription, DialogTitle,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, ThemeProvider,
} from "../src";
import { FrappeListView, FrappeProvider, createFrappeClient, type FrappeTransport } from "../src/frappe";
import { TODO_META, createMockFrappe } from "../playground/src/demo/mock-frappe";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(cleanup);

const escape = async () => { await act(async () => { fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" }); }); };
const openMenu = (el: HTMLElement) => fireEvent.keyDown(el, { key: "Enter" }); // Radix menus open from the keyboard in jsdom

describe("B-42 Core: dialogs give focus back to their opener", () => {
  function FromButton({ alert }: { alert?: boolean }) {
    const [open, setOpen] = React.useState(false);
    return (
      <ThemeProvider storageKeys={null}>
        <button type="button" onClick={() => setOpen(true)}>Open</button>
        {alert ? (
          <AlertDialog open={open} onOpenChange={setOpen}><AlertDialogContent><AlertDialogTitle>Sure?</AlertDialogTitle><AlertDialogDescription>d</AlertDialogDescription><AlertDialogCancel>No</AlertDialogCancel></AlertDialogContent></AlertDialog>
        ) : (
          <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogTitle>T</DialogTitle><DialogDescription>d</DialogDescription><input aria-label="inside" /></DialogContent></Dialog>
        )}
      </ThemeProvider>
    );
  }

  it("a dialog opened from a plain button (no DialogTrigger): Escape returns focus to the button, not <body>", async () => {
    render(<FromButton />);
    const btn = screen.getByRole("button", { name: "Open" });
    btn.focus(); fireEvent.click(btn);
    await screen.findByRole("dialog");
    expect(document.activeElement).not.toBe(btn); // focus moved into the dialog
    await escape();
    await waitFor(() => expect(document.activeElement).toBe(btn));
  });

  it("an AlertDialog too (its Cancel gets focus on open; the opener gets it back on close)", async () => {
    render(<FromButton alert />);
    const btn = screen.getByRole("button", { name: "Open" });
    btn.focus(); fireEvent.click(btn);
    await screen.findByRole("alertdialog");
    await escape();
    await waitFor(() => expect(document.activeElement).toBe(btn));
  });

  it("a dialog opened from a menu item gives focus to the menu's trigger", async () => {
    function FromMenu() {
      const [open, setOpen] = React.useState(false);
      return (
        <ThemeProvider storageKeys={null}>
          <DropdownMenu><DropdownMenuTrigger>More</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onSelect={() => setOpen(true)}>Export</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogTitle>Export</DialogTitle><DialogDescription>d</DialogDescription></DialogContent></Dialog>
        </ThemeProvider>
      );
    }
    render(<FromMenu />);
    const trigger = screen.getByRole("button", { name: "More" });
    trigger.focus(); openMenu(trigger);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Export" }));
    await screen.findByRole("dialog");
    await escape();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("returnFocus overrides the opener", async () => {
    function Override() {
      const [open, setOpen] = React.useState(false);
      const target = React.useRef<HTMLInputElement>(null);
      return (
        <ThemeProvider storageKeys={null}>
          <input ref={target} aria-label="target" />
          <button type="button" onClick={() => setOpen(true)}>Open</button>
          <Dialog open={open} onOpenChange={setOpen}><DialogContent returnFocus={target}><DialogTitle>T</DialogTitle><DialogDescription>d</DialogDescription></DialogContent></Dialog>
        </ThemeProvider>
      );
    }
    render(<Override />);
    const btn = screen.getByRole("button", { name: "Open" });
    btn.focus(); fireEvent.click(btn);
    await screen.findByRole("dialog");
    await escape();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "target" })));
  });
});

describe("B-42 Frappe list dialogs (SIMULATED)", () => {
  const PERMS = [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, import: 1, export: 1 }];
  function mountList(props: Partial<React.ComponentProps<typeof FrappeListView>> = {}) {
    const mock = createMockFrappe();
    const meta = { ...TODO_META, allow_import: 1, permissions: PERMS };
    const transport: FrappeTransport = async (m, a) => (m === "frappe.desk.form.load.getdoctype" ? { docs: [meta], user_settings: "{}" } : mock.transport(m, a)) as never;
    const client = createFrappeClient({ transport });
    return render(
      <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <FrappeProvider client={client} session={{ user: "u@x.com", roles: ["System Manager"] }}><FrappeListView doctype="ToDo" storage={null} {...props} /></FrappeProvider>
        </QueryClientProvider>
      </ThemeProvider>,
    );
  }
  const rows = () => [...document.querySelectorAll<HTMLElement>("tbody tr")].filter((tr) => tr.querySelectorAll("td").length > 1);

  for (const [entry, name] of [["Export", /^\s*Export\s*$/], ["Export as report", /Export as report/], ["List Settings", /List Settings/]] as const) {
    it(`⋯ → ${entry} → Escape: focus is back on the ⋯ trigger`, async () => {
      mountList({ menu: { reportExport: true } });
      await waitFor(() => expect(rows().length).toBeGreaterThan(0));
      const more = screen.getByRole("button", { name: "More actions" });
      more.focus(); openMenu(more);
      fireEvent.click(await screen.findByRole("menuitem", { name }));
      await screen.findByRole("dialog");
      await escape();
      await waitFor(() => expect(document.activeElement).toBe(more));
    });
  }

  it("header Actions menu (rows checked) → Export dialog → Escape: focus is back on the Actions trigger", async () => {
    mountList({ selectable: true });
    const box = await waitFor(() => within(rows()[0]!).getByRole("checkbox"));
    fireEvent.click(box);
    const actions = await screen.findByRole("button", { name: /Actions/ });
    actions.focus(); openMenu(actions);
    fireEvent.click(await screen.findByRole("menuitem", { name: /Export/ }));
    await screen.findByRole("dialog");
    await escape();
    await waitFor(() => expect(document.activeElement).toBe(actions));
  });
});
