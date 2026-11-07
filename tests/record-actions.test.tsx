/**
 * P35 record (Core, Frappe-free): RecordMenu, RenameDialog, PrintPreviewFrame, ConnectionsPanel, EmailComposer,
 * ReminderDialog. Behaviour through Testing Library; no server involved (the Frappe wiring is in
 * tests/frappe-record-actions.test.tsx, on the SIMULATED backend).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "../src";
import {
  ConnectionsPanel, EmailComposer, PrintPreviewFrame, RecordMenu, ReminderDialog, RenameDialog, groupMenuItems, isValidEmail, printSrcDoc, remindAtFor,
  toFrappeDatetime, type RecordMenuItem,
} from "../src/record";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(cleanup);

const mount = (ui: React.ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);
async function openMenu(name = "Menu") {
  const trigger = await screen.findByRole("button", { name });
  fireEvent.keyDown(trigger, { key: "Enter" });
  return screen.findByRole("menu");
}

describe("RecordMenu (Core)", () => {
  it("FV.K3 groups items with separators, shows shortcut hints, leaves hidden items out and keeps disabled items inert", async () => {
    const dup = vi.fn();
    const items: RecordMenuItem[] = [
      { id: "print", label: "Print", group: "a" },
      { id: "dup", label: "Duplicate", group: "b", shortcut: "Shift+D", onSelect: dup },
      { id: "secret", label: "Secret", group: "b", hidden: true },
      { id: "undo", label: "Undo", group: "c", disabled: true, disabledReason: "Nothing to undo" },
    ];
    expect(groupMenuItems(items).map((g) => g.map((i) => i.id))).toEqual([["print"], ["dup"], ["undo"]]);
    mount(<RecordMenu items={items} />);
    const menu = await openMenu();
    expect(within(menu).getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Print", "DuplicateShift+D", "Undo"]);
    expect(within(menu).queryByText("Secret")).toBeNull();
    expect(within(menu).getAllByRole("separator")).toHaveLength(2);
    const undo = within(menu).getByRole("menuitem", { name: "Undo" });
    expect(undo.getAttribute("aria-disabled")).toBe("true");
    expect(undo.getAttribute("title")).toBe("Nothing to undo");
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Duplicate/ }));
    expect(dup).toHaveBeenCalledTimes(1);
  });
  it("FV.K9 a destructive item asks first (AlertDialog); Cancel runs nothing, Confirm runs the action", async () => {
    const del = vi.fn(async () => {});
    mount(<RecordMenu items={[{ id: "delete", label: "Delete", destructive: true, confirm: { title: "Permanently delete X?", confirmLabel: "Delete" }, onSelect: del }]} />);
    fireEvent.click(within(await openMenu()).getByRole("menuitem", { name: "Delete" }));
    const dlg = await screen.findByRole("alertdialog");
    expect(within(dlg).getByText("Permanently delete X?")).toBeTruthy();
    fireEvent.click(within(dlg).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(within(await openMenu()).getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(del).toHaveBeenCalledTimes(1));
  });
  it("FV.K16 a rejected action is shown under the trigger (role=alert) — never reported as done; no items → nothing rendered", async () => {
    const onError = vi.fn();
    const { container, unmount } = mount(<RecordMenu items={[{ id: "x", label: "Reload", onSelect: () => Promise.reject(new Error("Server refused")) }]} onError={onError} />);
    fireEvent.click(within(await openMenu()).getByRole("menuitem", { name: "Reload" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Server refused");
    expect(onError).toHaveBeenCalled();
    void container; unmount();
    const r = mount(<RecordMenu items={[{ id: "h", label: "H", hidden: true }]} />);
    expect(r.container.querySelector("button")).toBeNull();
  });
});

describe("RenameDialog (Core)", () => {
  it("FV.K8 requires a name, says Unchanged for the same name, sends name + merge, keeps the dialog open on a refusal", async () => {
    const onRename = vi.fn(async ({ newName }: { newName: string }) => { if (newName === "Taken") throw new Error("Another Deal with name Taken exists"); });
    const onOpenChange = vi.fn();
    mount(<RenameDialog open name="D-1" onOpenChange={onOpenChange} onRename={onRename} />);
    const input = screen.getByLabelText("New Name") as HTMLInputElement;
    expect(input.value).toBe("D-1");
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    expect((await screen.findByRole("status")).textContent).toBe("Unchanged");
    expect(onRename).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Enter a new name.");
    fireEvent.change(input, { target: { value: "Taken" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Another Deal with name Taken exists");
    expect(onRename).toHaveBeenLastCalledWith({ newName: "Taken", merge: true });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    fireEvent.change(input, { target: { value: "D-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});

describe("PrintPreviewFrame (Core)", () => {
  it("FV.L2 renders server HTML in a sandboxed iframe (no scripts, no same-origin); loading, empty and error states", () => {
    const { rerender } = mount(<PrintPreviewFrame title="Print preview" html="<h1>Hi</h1>" style="h1{color:red}" />);
    const frame = screen.getByTitle("Print preview") as HTMLIFrameElement;
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(frame.getAttribute("srcdoc")).toContain("<h1>Hi</h1>");
    expect(frame.getAttribute("srcdoc")).toContain("h1{color:red}");
    expect(printSrcDoc("x", "a{}</style><script>alert(1)</script>")).not.toMatch(/<\/style><script>/);
    rerender(<ThemeProvider><PrintPreviewFrame title="p" loading /></ThemeProvider>);
    expect(screen.getByRole("status").textContent).toContain("Loading preview");
    rerender(<ThemeProvider><PrintPreviewFrame title="p" html={null} /></ThemeProvider>);
    expect(screen.getByText("No Preview Available")).toBeTruthy();
    const retry = vi.fn();
    rerender(<ThemeProvider><PrintPreviewFrame title="p" error="Not allowed to print draft documents" onRetry={retry} /></ThemeProvider>);
    expect(screen.getByRole("alert").textContent).toBe("Not allowed to print draft documents");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalled();
    expect(screen.queryByTitle("p")).toBeNull();
  });
});

describe("ConnectionsPanel (Core)", () => {
  const groups = [
    { label: "Activity", items: [{ id: "ToDo", label: "ToDo", count: 3, canCreate: true }, { id: "Communication", label: "Communication", count: 0 }] },
    { label: "Logs", items: [{ id: "Access Log", label: "Access Log", count: "?" as const }, { id: "Route History", label: "Route History", count: 2, openCount: 1 }] },
    { label: "Empty", items: [] },
  ];
  it("FV.M1 groups with count badges (only non-zero; '?' when the server could not count), open + new callbacks", () => {
    const onOpen = vi.fn(); const onNew = vi.fn();
    mount(<ConnectionsPanel groups={groups} onOpen={onOpen} onNew={onNew} />);
    expect(screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"))).toEqual(["Activity", "Logs"]);
    const todo = document.querySelector('[data-connection="ToDo"]') as HTMLElement;
    expect(todo.querySelector("[data-count]")!.textContent).toBe("3");
    expect(document.querySelector('[data-connection="Communication"] [data-count]')).toBeNull();
    expect(within(document.querySelector('[data-connection="Access Log"]') as HTMLElement).getByTitle("Count unavailable").textContent).toBe("?");
    expect(document.querySelector('[data-connection="Route History"] [data-open-count]')!.textContent).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Open the ToDo list" }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "ToDo" }));
    fireEvent.click(screen.getByRole("button", { name: "Create a new ToDo" }));
    expect(onNew).toHaveBeenCalledWith(expect.objectContaining({ id: "ToDo" }));
    expect(screen.queryByRole("button", { name: "Create a new Communication" })).toBeNull();
  });
  it("FV.M5 empty, notice, loading and error-with-retry states; href items render links", () => {
    const { rerender } = mount(<ConnectionsPanel groups={[]} />);
    expect(screen.getByRole("status").textContent).toBe("No connections.");
    rerender(<ThemeProvider><ConnectionsPanel groups={groups} notice="Save first" /></ThemeProvider>);
    expect(screen.getByRole("status").textContent).toBe("Save first");
    const retry = vi.fn();
    rerender(<ThemeProvider><ConnectionsPanel groups={[{ label: "A", items: [{ id: "ToDo", label: "ToDo", href: "/app/todo?x=1" }] }]} loading error="Counts failed" onRetry={retry} /></ThemeProvider>);
    expect(screen.getByRole("status").textContent).toContain("Loading connections");
    expect(screen.getByRole("alert").textContent).toBe("Counts failed");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Open the ToDo list" }).getAttribute("href")).toBe("/app/todo?x=1");
  });
});

describe("EmailComposer (Core)", () => {
  const type = (label: string, text: string) => {
    const input = screen.getByRole("combobox", { name: label });
    fireEvent.change(input, { target: { value: text } });
    fireEvent.keyDown(input, { key: "Enter" });
  };
  it("FV.O6 validates: an invalid address is named and not added; no recipient / no subject refuse to send", async () => {
    const onSend = vi.fn();
    mount(<EmailComposer onSend={onSend} />);
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("Ann <ann@x.org>")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    type("To", "not-an-email");
    expect((await screen.findByText("not-an-email is not a valid email address")).getAttribute("role")).toBe("alert");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Enter Email Recipient(s) in the To, CC, or BCC fields")).toBeTruthy();
    type("BCC", "boss@x.org");
    await screen.findByText("boss@x.org");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Enter a subject.")).toBeTruthy();
    expect(onSend).not.toHaveBeenCalled();
  });
  it("FV.O1 FV.O2 FV.O4 FV.O7 FV.O9 sends To / CC / BCC, subject, attachments, options; busy while sending; a refusal is shown and the draft kept", async () => {
    let reject: (e: Error) => void = () => {};
    const onSend = vi.fn(() => new Promise<void>((_, r) => { reject = r; }));
    mount(<EmailComposer onSend={onSend} initial={{ subject: "Deal: D-1", to: ["ann@x.org"] }}
      attachments={[{ id: "F-1", label: "quote.pdf" }, { id: "F-2", label: "terms.pdf" }]} printFormats={["Standard", "Deal Fancy"]} />);
    type("CC", "cc@x.org");
    await screen.findByText("cc@x.org");
    fireEvent.click(screen.getByLabelText("quote.pdf"));
    fireEvent.click(screen.getByLabelText("Send me a copy"));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend.mock.calls[0][0]).toMatchObject({ to: ["ann@x.org"], cc: ["cc@x.org"], bcc: [], subject: "Deal: D-1", attachments: ["F-1"], sendMeACopy: true, attachPrint: true, printFormat: "Standard" });
    expect(screen.getByRole("button", { name: /Sending/ }).hasAttribute("disabled")).toBe(true);
    reject(new Error("You are not allowed to send emails related to this document"));
    expect((await screen.findByText("You are not allowed to send emails related to this document")).getAttribute("role")).toBe("alert");
    expect((screen.getByLabelText("Subject") as HTMLInputElement).value).toBe("Deal: D-1");
    expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(false);
  });
  it("FV.O3 Add Template prepends the template and replaces the subject; Clear & Add replaces the message; a failure is shown", async () => {
    const loadTemplate = vi.fn(async (n: string) => { if (n === "Broken") throw new Error("Email Template Broken not found"); return { subject: "Hello D-1", message: "<p>Template body</p>" }; });
    mount(<EmailComposer onSend={vi.fn()} templates={["Welcome", "Broken"]} loadTemplate={loadTemplate} initial={{ message: "<p>Mine</p>", subject: "old" }} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Email Template" }));
    fireEvent.click(await screen.findByRole("option", { name: "Welcome" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Template" }));
    await waitFor(() => expect((screen.getByLabelText("Subject") as HTMLInputElement).value).toBe("Hello D-1"));
    const editor = screen.getByRole("textbox", { name: "Message" });
    await waitFor(() => expect(editor.innerHTML).toBe("<p>Template body</p><br><p>Mine</p>"));
    fireEvent.click(screen.getByRole("button", { name: "Clear & Add Template" }));
    await waitFor(() => expect(editor.innerHTML).toBe("<p>Template body</p>"));
    fireEvent.click(screen.getByRole("combobox", { name: "Email Template" }));
    fireEvent.click(await screen.findByRole("option", { name: "Broken" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Template" }));
    expect((await screen.findByText(/The template could not be loaded\. Email Template Broken not found/)).getAttribute("role")).toBe("alert");
    expect(loadTemplate).toHaveBeenCalledWith("Welcome");
  });
  it("FV.O6 without the e-mail right the reason is shown and Send is disabled", () => {
    mount(<EmailComposer onSend={vi.fn()} disabledReason="You are not allowed to send emails related to this document" initial={{ to: ["a@b.co"], subject: "s" }} />);
    expect(screen.getByRole("note").textContent).toBe("You are not allowed to send emails related to this document");
    expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
  });
});

describe("ReminderDialog (Core)", () => {
  const now = () => new Date(2026, 10, 7, 9, 0, 0);
  it("FV.K13 default 1 hour from now; description required; past custom time refused; create sends Frappe datetime text", async () => {
    expect(toFrappeDatetime(remindAtFor("30_minutes", now()))).toBe("2026-11-07 09:30:00");
    const onCreate = vi.fn(async () => ({ remindAt: "2026-11-07 10:00:00" }));
    const onCreated = vi.fn();
    const onOpenChange = vi.fn();
    mount(<ReminderDialog open onOpenChange={onOpenChange} onCreate={onCreate} onCreated={onCreated} now={now} />);
    expect((screen.getByLabelText("Remind At") as HTMLInputElement).value).toBe("2026-11-07 10:00:00");
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Enter a description.");
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Call back" } });
    fireEvent.click(screen.getByRole("combobox", { name: "Remind Me In" }));
    fireEvent.click(await screen.findByRole("option", { name: "Custom" }));
    fireEvent.change(screen.getByLabelText("Remind At"), { target: { value: "2026-11-06T08:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Reminder cannot be created in past.");
    expect(onCreate).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Remind At"), { target: { value: "2026-11-08T08:15" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ remindAt: "2026-11-08 08:15:00", description: "Call back" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ remindAt: "2026-11-07 10:00:00" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
