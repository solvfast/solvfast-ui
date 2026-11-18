/**
 * Phase 27.5 — Assign To dialog (AssignPicker withDetails, used by the list's bulk Assign To and FrappeAssignTo).
 * DS controls (Input, Checkbox, Textarea, DateField, Select), visible labels with the field's purpose, and the request
 * payload unchanged: an empty date / priority is omitted (the server then uses today and Medium,
 * desk/form/assign_to.py:73-90). SIMULATED: no site involved.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { defaultMessages } from "../src/theme/messages";
import { AssignPicker } from "../src/record/AssigneeGroup";
import { AssignDialog } from "../src/record/AssignDialog";
import type { AssignDetails, UserOption } from "../src/record/types";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false; proto.releasePointerCapture ??= () => {}; proto.scrollIntoView ??= () => {};
});
afterEach(() => cleanup());

const USERS: UserOption[] = [{ id: "ann@x.com", label: "Ann Xu" }, { id: "bob@x.com", label: "Bob Yo" }];
function mount(lang: "en" | "ar" = "en") {
  const sent: { users: string[]; details: AssignDetails }[] = [];
  render(
    <ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>
      <AssignPicker withDetails me={{ id: "me@x.com", label: "Me" }} searchUsers={async () => USERS}
        onAssign={async (users, details) => { sent.push({ users: users.map((u) => u.id), details }); }}
        trigger={<button type="button">open</button>} />
    </ThemeProvider>,
  );
  fireEvent.click(screen.getByText("open"));
  return { sent, m: defaultMessages[lang] };
}
const pickAnn = async () => fireEvent.click(await screen.findByRole("option", { name: /Ann Xu/ }));
const confirm = (m: typeof defaultMessages.en) => fireEvent.click(screen.getByRole("button", { name: m.recAssignConfirm }));

describe("Assign To dialog (SIMULATED)", () => {
  it("no native date / select / checkbox / textarea; every detail has a visible label and the date and priority explain their purpose", async () => {
    const { m } = mount();
    await pickAnn();
    const panel = screen.getByRole("dialog");
    expect(panel.querySelector('input[type="date"], select, input[type="checkbox"]')).toBeNull();
    expect(within(panel).getByText(m.recAssignDue)).toBeTruthy();          // "Complete by" — Desk's label (assign_to.js:53)
    expect(within(panel).getByText(m.recAssignDueHint)).toBeTruthy();
    expect(within(panel).getByText(m.recAssignPriority)).toBeTruthy();
    expect(within(panel).getByText(m.recAssignPriorityHint)).toBeTruthy();
    expect(within(panel).getByLabelText(m.recAssignDescription).tagName).toBe("TEXTAREA");
    expect(within(panel).getByRole("checkbox", { name: m.recAssignToMe })).toBeTruthy(); // DS Checkbox (button role=checkbox)
    expect(within(panel).getByRole("combobox", { name: m.recAssignPriority })).toBeTruthy(); // DS Select trigger
  });

  it("left empty: date and priority are not sent (server defaults: today, Medium) — payload unchanged", async () => {
    const { sent, m } = mount();
    await pickAnn();
    confirm(m);
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ users: ["ann@x.com"], details: {} });
  });

  it("a picked date (DS calendar) and priority (DS select) are sent as before: date YYYY-MM-DD, priority Low/Medium/High", async () => {
    const { sent, m } = mount();
    await pickAnn();
    fireEvent.click(screen.getByLabelText(m.recAssignDue));
    const day = (await screen.findAllByRole("gridcell")).find((c) => c.textContent === "15")!;
    fireEvent.click(within(day).queryByRole("button") ?? day);
    fireEvent.keyDown(screen.getByRole("combobox", { name: m.recAssignPriority }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: m.recPriorityHigh }));
    await act(() => Promise.resolve());
    confirm(m);
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].details.priority).toBe("High");
    expect(sent[0].details.date).toMatch(/^\d{4}-\d{2}-15$/);
  });

  it("the date can be cleared again; 'Default (Medium)' returns to sending no priority", async () => {
    const { sent, m } = mount();
    await pickAnn();
    fireEvent.click(screen.getByLabelText(m.recAssignDue));
    const day = (await screen.findAllByRole("gridcell")).find((c) => c.textContent === "15")!;
    fireEvent.click(within(day).queryByRole("button") ?? day);
    fireEvent.click(await screen.findByRole("button", { name: m.recAssignClearDate }));
    const trigger = screen.getByRole("combobox", { name: m.recAssignPriority });
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: m.recPriorityLow }));
    fireEvent.keyDown(screen.getByRole("combobox", { name: m.recAssignPriority }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: m.recAssignPriorityDefault }));
    confirm(m);
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].details).toEqual({});
  });

  it("Arabic: labels and hints from the catalogue, the panel follows the page direction", async () => {
    const { m } = mount("ar");
    await pickAnn();
    const panel = screen.getByRole("dialog");
    expect(within(panel).getByText(m.recAssignDue)).toBeTruthy();
    expect(within(panel).getByText(m.recAssignDueHint)).toBeTruthy();
    expect(within(panel).getByRole("combobox", { name: m.recAssignPriority }).textContent).toContain(m.recAssignPriorityDefault);
    expect(panel.closest("[dir]")?.getAttribute("dir") ?? document.documentElement.dir).toBe("rtl");
  });
});

describe("Assign To dialog — a long user name or e-mail never widens it (Sada, 0.10.0)", () => {
  // jsdom has no layout: the classes that let the row shrink (and the dialog body) are asserted; the effect was measured in
  // a real browser on Sada's live build (49 px / 171 px past the dialog edge before, 0 px after, en/ar, 1440/390).
  const LONG: UserOption[] = [
    { id: "acme-sana-voice-agent@ai-agents.internal.solvfaster.com", label: "acme-sana-voice-agent@ai-agents.internal.solvfaster.com", description: "Sana Voice Agent" },
    { id: "ann@x.com", label: "Ann Xu" },
  ];
  it("rows, labels, picked chips and the dialog body can shrink; Latin e-mails keep their own direction", async () => {
    render(
      <ThemeProvider defaultTheme="light" defaultLanguage="ar" storageKeys={null}>
        <AssignDialog open onOpenChange={() => {}} details me={{ id: "me@x.com", label: "Me" }} searchUsers={async () => LONG} onAssign={async () => {}} />
      </ThemeProvider>,
    );
    const opt = await screen.findByRole("option", { name: /acme-sana-voice-agent/ });
    const dialog = screen.getByTestId("sf-assign-dialog");
    expect(dialog.querySelector("[data-assign-body]")?.className).toContain("min-w-0");
    const label = opt.querySelector("[data-assign-option-label]") as HTMLElement;
    expect(label.className).toMatch(/\bmin-w-0\b/); expect(label.className).toMatch(/\btruncate\b/);
    expect(label.className).toContain("[unicode-bidi:plaintext]");
    const desc = within(opt).getByText("Sana Voice Agent");
    expect(desc.className).toMatch(/\bmin-w-0\b/); expect(desc.className).toMatch(/\btruncate\b/);
    fireEvent.click(opt);
    const chipLabel = within(dialog).getAllByText("acme-sana-voice-agent@ai-agents.internal.solvfaster.com").find((e) => e !== label) as HTMLElement;
    expect(chipLabel.className).toMatch(/\btruncate\b/);
    expect(chipLabel.parentElement?.className).toContain("max-w-full");
  });
});
