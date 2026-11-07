/**
 * P35 "core" workstream — generic capabilities the CRM audit (docs/audit/p35/D-crm.md §3c) found missing.
 * Test names carry the gap id (CORE.G<n>; CORE.P34 = the AssigneeGroup role line lost in P34, D-crm row A18).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Users } from "lucide-react";
import {
  Stepper, type StepperStep, MonthInput, formatMonthValue, parseMonthValue, RichTextEditor, type RichTextEditorHandle, LinkInput, IconStatCard, EmptyState, Button, type Suggestion, Timeline, type TimelineItem, SearchCombobox, AssigneeGroup, FileDropzone, fileMatchesAccept, formatFileSize, validateFiles, LifecycleBar, StatusBadge, StatusDot, ThemeProvider, resolveStatusColor, statusColorStyles,
  type LifecycleStateItem,
} from "../src";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

const wrap = (ui: React.ReactElement, language: "en" | "ar" = "en") => render(<ThemeProvider language={language}>{ui}</ThemeProvider>);

describe("CORE.P34 AssigneeGroup list shows each assignee's description", () => {
  const people = [
    { id: "a", name: "Ann Lee", description: "Account Executive" },
    { id: "b", name: "Bob", description: "2026-11-09 · High · Call back" },
    { id: "c", name: "Cy" },
  ];
  it("CORE.P34 renders the description line under the name (list variant only)", () => {
    const { container } = wrap(<AssigneeGroup variant="list" assignees={people} searchUsers={async () => []} />);
    const rows = container.querySelectorAll("li");
    expect(within(rows[0] as HTMLElement).getByText("Account Executive")).toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByText("2026-11-09 · High · Call back")).toBeTruthy();
    // no description → no second line, the row is the 0.6.0 markup
    expect(rows[2].querySelector("[data-assignee-description]")).toBeNull();
    expect(rows[2].textContent).toBe("CY" + "Cy"); // initials fallback + the name, nothing else
  });
  it("CORE.P34 avatars variant is unchanged (description stays out of the stack)", () => {
    wrap(<AssigneeGroup assignees={people} searchUsers={async () => []} />);
    expect(screen.queryByText("Account Executive")).toBeNull();
  });
  it("CORE.P34 Arabic / RTL: the description renders under the name, remove stays keyboard reachable", () => {
    const rm = vi.fn();
    const { container } = wrap(<AssigneeGroup variant="list" assignees={people.slice(0, 1)} canRemove={() => true} onRemove={rm} searchUsers={async () => []} />, "ar");
    expect(document.documentElement.getAttribute("dir")).toBe("rtl");
    expect(container.textContent).toContain("Account Executive");
    expect(screen.getByText("Account Executive")).toBeTruthy();
    const btn = screen.getByRole("button", { name: /Ann Lee/ });
    btn.focus();
    expect(document.activeElement).toBe(btn);
    fireEvent.click(btn);
    expect(rm).toHaveBeenCalledWith(people[0]);
  });
});

describe("CORE.G17 StatusBadge / StatusDot custom colour", () => {
  it("CORE.G17 without color the markup is the 0.6.0 one (tone classes, no inline style)", () => {
    const { container } = render(<StatusBadge label="Won" tone="success" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("style")).toBeNull();
    expect(el.className).toContain("bg-success/15");
    expect(el.hasAttribute("data-color")).toBe(false);
  });
  it("CORE.G17 a hex colour paints the dot and tints the pill; text mixes with the foreground token (light & dark)", () => {
    const { container } = render(<StatusBadge label="Negotiation" tone="info" color="#f59e0b" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("data-color")).toBe("#f59e0b");
    expect(el.getAttribute("data-tone")).toBe("info");
    expect(el.className).not.toContain("bg-info/15");
    expect(el.style.backgroundColor).toContain("color-mix");
    expect(el.style.color).toBe("color-mix(in oklab, #f59e0b 55%, hsl(var(--foreground)))");
    const dot = el.querySelector("[aria-hidden]") as HTMLElement;
    expect(dot.className).not.toContain("bg-info");
    expect(dot.style.backgroundColor).toBe("rgb(245, 158, 11)");
    expect(screen.getByText("Negotiation")).toBeTruthy(); // the label always carries the meaning
  });
  it("CORE.G17 palette tokens resolve to theme variables; other strings pass through; empty is ignored", () => {
    expect(resolveStatusColor("violet")).toBe("hsl(var(--brand-violet))");
    expect(resolveStatusColor(" Teal ")).toBe("hsl(var(--brand-teal))");
    expect(resolveStatusColor("rgb(1, 2, 3)")).toBe("rgb(1, 2, 3)");
    expect(resolveStatusColor("")).toBeUndefined();
    expect(statusColorStyles(null)).toBeUndefined();
    const { container } = render(<StatusBadge label="x" color="" tone="danger" />);
    expect((container.firstElementChild as HTMLElement).className).toContain("bg-destructive/15");
  });
  it("CORE.G17 dot variant keeps the label in the foreground colour, only the dot is coloured", () => {
    const { container } = render(<StatusBadge label="Open" variant="dot" color="teal" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("style")).toBeNull();
    expect(el.className).toContain("text-foreground");
    expect((el.querySelector("[aria-hidden]") as HTMLElement).style.backgroundColor).toBe("hsl(var(--brand-teal))");
  });
  it("CORE.G17 StatusDot accepts color; without it the tone class is used", () => {
    const { container } = render(<StatusDot label="Lost" color="#ef4444" tone="success" />);
    const dot = container.querySelector("span > span") as HTMLElement;
    expect(dot.style.backgroundColor).toBe("rgb(239, 68, 68)");
    expect(dot.className).not.toContain("bg-success");
    cleanup();
    const plain = render(<StatusDot label="Lost" tone="success" />).container.querySelector("span > span") as HTMLElement;
    expect(plain.className).toContain("bg-success");
    expect(plain.getAttribute("style")).toBeNull();
  });
});

describe("CORE.G7 LifecycleBar per-step state", () => {
  const deal: LifecycleStateItem[] = [
    { id: "lead", label: "Lead", step: "past" },
    { id: "qual", label: "Qualified", step: "past" },
    { id: "won", label: "Won", step: "skipped" },
    { id: "lost", label: "Lost", step: "failed", by: "Ann", at: Date.UTC(2026, 10, 3, 11) },
  ];
  it("CORE.G7 a Lost deal does not show Won ticked: skipped and failed states", () => {
    const { container } = wrap(<LifecycleBar states={deal} current="lost" now={Date.UTC(2026, 10, 3, 12)} />);
    const items = Array.from(container.querySelectorAll("li[data-step]"));
    expect(items.map((e) => e.getAttribute("data-step"))).toEqual(["past", "past", "skipped", "failed"]);
    const won = items[2];
    expect(won.querySelector(".lucide-check")).toBeNull();
    expect(won.textContent).toContain("Skipped");
    const lost = items[3];
    expect(lost.getAttribute("aria-current")).toBe("step");
    expect(lost.querySelector(".lucide-x")).toBeTruthy();
    expect(lost.textContent).toContain("Failed");
    // the badge falls back to the danger tone for a failed current state without a tone
    expect(container.querySelector("[data-tone='danger']")?.textContent).toBe("Lost");
  });
  it("CORE.G7 without `step` the position decides (0.6.0 behaviour)", () => {
    const st = deal.map(({ step: _s, ...rest }) => rest);
    const { container } = wrap(<LifecycleBar states={st} current="won" />);
    expect(Array.from(container.querySelectorAll("li[data-step]")).map((e) => e.getAttribute("data-step"))).toEqual(["past", "past", "current", "future"]);
  });
  it("CORE.G7 explicit `step` mixes with positional ones (only some states set)", () => {
    const st: LifecycleStateItem[] = [{ id: "a", label: "A" }, { id: "b", label: "B", step: "skipped" }, { id: "c", label: "C" }, { id: "d", label: "D" }];
    const { container } = wrap(<LifecycleBar states={st} current="c" />);
    expect(Array.from(container.querySelectorAll("li[data-step]")).map((e) => e.getAttribute("data-step"))).toEqual(["past", "skipped", "current", "future"]);
  });
  it("CORE.G7 Arabic screen-reader text for skipped / failed", () => {
    const { container } = wrap(<LifecycleBar states={deal} current="lost" />, "ar");
    const items = container.querySelectorAll("li[data-step]");
    expect(items[2].textContent).toContain("تم تخطّيها");
    expect(items[3].textContent).toContain("فشلت");
  });
});

describe("CORE.G14 FileDropzone", () => {
  const mk = (name: string, size: number, type: string) => new File([new Uint8Array(size)], name, { type, lastModified: 1 });
  const pdf = mk("brief.pdf", 2_000, "application/pdf");
  const png = mk("logo.png", 500, "image/png");
  const big = mk("huge.pdf", 5 * 1024 * 1024, "application/pdf");
  const exe = mk("tool.exe", 10, "application/octet-stream");
  const input = (c: HTMLElement) => c.querySelector("input[type=file]") as HTMLInputElement;

  it("CORE.G14 accept matching: extensions, exact MIME and wildcards", () => {
    expect(fileMatchesAccept(pdf, ".pdf,image/*")).toBe(true);
    expect(fileMatchesAccept(png, ".pdf,image/*")).toBe(true);
    expect(fileMatchesAccept(exe, ".pdf,image/*")).toBe(false);
    expect(fileMatchesAccept(pdf, "application/pdf")).toBe(true);
    expect(fileMatchesAccept(exe, "")).toBe(true);
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5 MB");
    expect(validateFiles([pdf, pdf, png], [], { multiple: true, maxFiles: 1 }).rejected.map((r) => r.reason)).toEqual(["count"]);
  });
  it("CORE.G14 picks through the hidden input; validates type and size with messages; lists and removes", () => {
    const change = vi.fn(); const added = vi.fn(); const reject = vi.fn();
    const { container } = wrap(<FileDropzone multiple accept=".pdf,image/*" maxSize={1024 * 1024} onChange={change} onFilesAdded={added} onReject={reject} />);
    expect(input(container).accept).toBe(".pdf,image/*");
    expect(input(container).multiple).toBe(true);
    fireEvent.change(input(container), { target: { files: [pdf, big, exe, png] } });
    expect(added).toHaveBeenCalledWith([pdf, png]);
    expect(change).toHaveBeenLastCalledWith([pdf, png]);
    expect(reject.mock.calls[0][0].map((r: { reason: string }) => r.reason)).toEqual(["size", "type"]);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("“huge.pdf” is larger than 1 MB.");
    expect(alert.textContent).toContain("“tool.exe” is not an accepted file type.");
    const list = screen.getByRole("list", { name: "Chosen files" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(list.textContent).toContain("2 KB");
    fireEvent.click(screen.getByRole("button", { name: "Remove brief.pdf" }));
    expect(change).toHaveBeenLastCalledWith([png]);
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("CORE.G14 drag and drop: highlights while dragging, adds dropped files; single mode replaces and takes the first", () => {
    const change = vi.fn();
    wrap(<FileDropzone onChange={change} />);
    const zone = screen.getByRole("button", { name: "Drag a file here or click to browse" });
    fireEvent.dragEnter(zone, { dataTransfer: { files: [pdf], types: ["Files"] } });
    expect(zone.getAttribute("data-dragging")).toBe("true");
    expect(zone.textContent).toContain("Drop to add");
    fireEvent.drop(zone, { dataTransfer: { files: [pdf, png], types: ["Files"] } });
    expect(zone.hasAttribute("data-dragging")).toBe(false);
    expect(change).toHaveBeenLastCalledWith([pdf]);
    fireEvent.drop(zone, { dataTransfer: { files: [png], types: ["Files"] } });
    expect(change).toHaveBeenLastCalledWith([png]);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
  it("CORE.G14 keyboard: the zone is focusable and Enter / Space open the file dialog; disabled is not", () => {
    const { container, rerender } = wrap(<FileDropzone />);
    const click = vi.spyOn(input(container), "click").mockImplementation(() => {});
    const zone = screen.getByRole("button", { name: /Drag a file/ });
    expect(zone.tabIndex).toBe(0);
    zone.focus();
    expect(document.activeElement).toBe(zone);
    fireEvent.keyDown(zone, { key: "Enter" });
    fireEvent.keyDown(zone, { key: " " });
    expect(click).toHaveBeenCalledTimes(2);
    rerender(<ThemeProvider><FileDropzone disabled /></ThemeProvider>);
    const z2 = screen.getByRole("button", { name: /Drag a file/ });
    expect(z2.tabIndex).toBe(-1);
    expect(z2.getAttribute("aria-disabled")).toBe("true");
    fireEvent.keyDown(z2, { key: "Enter" });
    fireEvent.drop(z2, { dataTransfer: { files: [pdf], types: ["Files"] } });
    expect(click).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("list")).toBeNull();
  });
  it("CORE.G14 maxFiles caps a multiple zone; controlled value is respected", () => {
    const change = vi.fn();
    const { container } = wrap(<FileDropzone multiple maxFiles={2} value={[pdf]} onChange={change} />);
    fireEvent.change(input(container), { target: { files: [png, mk("c.txt", 3, "text/plain")] } });
    expect(change).toHaveBeenLastCalledWith([pdf, png]);
    expect(screen.getByRole("alert").textContent).toContain("“c.txt” was not added: at most 2 files.");
    // controlled: the parent did not update `value`, so the list still shows one file
    expect(screen.getAllByRole("listitem").filter((li) => li.hasAttribute("data-file-row"))).toHaveLength(1);
  });
  it("CORE.G14 Arabic / RTL chrome and messages", () => {
    const { container } = wrap(<FileDropzone multiple accept=".pdf" maxSize={1024} />, "ar");
    expect(screen.getByRole("button", { name: "اسحب الملفات إلى هنا أو انقر للاستعراض" })).toBeTruthy();
    fireEvent.change(input(container), { target: { files: [exe, pdf] } });
    const alert = screen.getByRole("alert").textContent ?? "";
    expect(alert).toContain("«tool.exe» ليس من أنواع الملفات المقبولة.");
    expect(alert).toContain("«brief.pdf» أكبر من ١ ك.ب.");
  });
});

describe("CORE.G16 SearchCombobox static options + multiple", () => {
  const opts = [
    { value: "lead", label: "Lead", description: "Prospect" },
    { value: "deal", label: "Deal" },
    { value: "org", label: "Organization" },
    { value: "contact", label: "Contact" },
  ];
  const base = { placeholder: "Pick types", searchPlaceholder: "Filter", emptyText: "Nothing" };

  it("CORE.G16 static options: no loading, filtered on label / description as you type, label on the trigger", async () => {
    const onSelect = vi.fn();
    const { rerender } = wrap(<SearchCombobox {...base} options={opts} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getAllByRole("option")).toHaveLength(4);
    fireEvent.change(screen.getByPlaceholderText("Filter"), { target: { value: "prosp" } });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["LeadProspect"]);
    fireEvent.change(screen.getByPlaceholderText("Filter"), { target: { value: "zzz" } });
    expect(screen.getByText("Nothing")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Filter"), { target: { value: "org" } });
    fireEvent.click(screen.getByRole("option", { name: "Organization" }));
    expect(onSelect).toHaveBeenCalledWith("org");
    rerender(<ThemeProvider><SearchCombobox {...base} options={opts} value="org" onSelect={onSelect} /></ThemeProvider>);
    expect(screen.getByRole("combobox").textContent).toContain("Organization");
  });
  it("CORE.G16 multiple: each pick toggles, the list stays open, aria-checked marks the chosen ones; trigger summarises", () => {
    const Harness = () => {
      const [v, setV] = React.useState<string[]>(["lead"]);
      return <SearchCombobox {...base} options={opts} multiple values={v} onValuesChange={setV} variant="field" />;
    };
    wrap(<Harness />);
    const trigger = screen.getByRole("combobox");
    expect(trigger.textContent).toContain("Lead");
    expect(trigger.className).toContain("sf-field-fill");
    fireEvent.click(trigger);
    expect(screen.getByRole("listbox").getAttribute("aria-multiselectable")).toBe("true");
    expect(screen.getByRole("option", { name: /Lead/ }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("option", { name: "Deal" }));
    expect(screen.getByRole("listbox")).toBeTruthy(); // still open
    expect(screen.getByRole("option", { name: "Deal" }).getAttribute("aria-checked")).toBe("true");
    expect(trigger.textContent).toContain("Lead, Deal");
    fireEvent.click(screen.getByRole("option", { name: "Contact" }));
    expect(trigger.textContent).toContain("3 selected");
    fireEvent.click(screen.getByRole("option", { name: /Lead/ }));
    expect(screen.getByRole("option", { name: /Lead/ }).getAttribute("aria-checked")).toBe("false");
    expect(trigger.textContent).toContain("Deal, Contact");
  });
  it("CORE.G16 keyboard: arrows move, Enter toggles in multiple mode", () => {
    const change = vi.fn();
    wrap(<SearchCombobox {...base} options={opts} multiple values={[]} onValuesChange={change} />);
    fireEvent.click(screen.getByRole("combobox"));
    const input = screen.getByPlaceholderText("Filter");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(change).toHaveBeenCalledTimes(1);
    expect(opts.map((o) => o.value)).toContain(change.mock.calls[0][0][0]);
  });
  it("CORE.G16 Arabic summary and disabled trigger", () => {
    const { rerender } = wrap(<SearchCombobox {...base} options={opts} multiple values={["lead", "deal", "org"]} />, "ar");
    expect(screen.getByRole("combobox").textContent).toContain("3 محدّدة");
    rerender(<ThemeProvider language="ar"><SearchCombobox {...base} options={opts} disabled onSelect={() => {}} /></ThemeProvider>);
    expect((screen.getByRole("combobox") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("CORE.G13 Timeline item icons, tone, actor and onItemSelect", () => {
  const NOW = Date.UTC(2026, 10, 3, 12);
  const feed: TimelineItem[] = [
    { id: "e1", kind: "communication", at: NOW - 60_000, actor: "Ann", summary: "sent an email", icon: <svg data-testid="mail-icon" />, tone: "info" },
    { id: "n1", kind: "custom", at: NOW - 120_000, actor: "Bob", summary: "logged a call" },
    { id: "a1", kind: "attachment", at: NOW - 180_000, summary: "added brief.pdf", href: "/files/brief.pdf" },
    { id: "c1", kind: "comment", at: NOW - 240_000, actor: "Cy", body: "<p>hi</p>", icon: <svg data-testid="note-icon" /> },
  ];
  it("CORE.G13 renders item.icon instead of the per-kind icon, tinted by tone; default icons otherwise", () => {
    const { container } = wrap(<Timeline items={feed} now={NOW} />);
    const email = container.querySelector("[data-kind='communication']")!;
    expect(within(email as HTMLElement).getByTestId("mail-icon")).toBeTruthy();
    expect(email.querySelector("[data-item-icon]")!.className).toContain("text-info");
    expect(email.querySelector(".lucide-message-square")).toBeNull();
    const call = container.querySelector("[data-kind='custom']")!;
    expect(call.querySelector("[data-item-icon]")).toBeNull();
    expect(call.querySelector("svg.lucide-activity")?.getAttribute("class")).toContain("text-muted-foreground");
    expect(within(container.querySelector("[data-kind='comment']") as HTMLElement).getByTestId("note-icon")).toBeTruthy();
    // without onItemSelect nothing new is interactive
    expect(container.querySelector("[data-item-select]")).toBeNull();
  });
  it("CORE.G13 onItemSelect: summaries become buttons (keyboard reachable); links call it first", () => {
    const select = vi.fn((_: TimelineItem, e: React.MouseEvent) => e.preventDefault());
    wrap(<Timeline items={feed} now={NOW} onItemSelect={select} />);
    const btn = screen.getByRole("button", { name: "sent an email" });
    btn.focus();
    expect(document.activeElement).toBe(btn);
    fireEvent.click(btn);
    expect(select.mock.calls[0][0].id).toBe("e1");
    fireEvent.click(screen.getByRole("link", { name: "added brief.pdf" }));
    expect(select.mock.calls[1][0].id).toBe("a1");
    expect(select.mock.calls[1][1].defaultPrevented).toBe(true);
    // comments keep their own controls, no select button
    expect(screen.queryByRole("button", { name: "hi" })).toBeNull();
  });
  it("CORE.G13 showActor prefixes non-comment summaries with the actor (isolated for RTL)", () => {
    const { container } = wrap(<Timeline items={feed} now={NOW} showActor />, "ar");
    const actors = Array.from(container.querySelectorAll("bdi[data-actor]")).map((e) => e.textContent);
    expect(actors).toEqual(["Ann", "Bob"]);
  });
});

describe("CORE.G11 LinkInput suggestion group + icon", () => {
  const results: Suggestion[] = [
    { value: "L-1", label: "Acme lead", group: "Leads", icon: <span data-testid="av-1">A</span> },
    { value: "L-2", label: "Beta lead", group: "Leads" },
    { value: "D-1", label: "Acme deal", group: "Deals" },
    { value: "X-1", label: "Loose" },
  ];
  it("CORE.G11 groups consecutive results under a heading (role=group), icons lead the option; keyboard order stays flat", async () => {
    const onChange = vi.fn();
    wrap(<LinkInput aria-label="record" value={null} onChange={onChange} search={async () => results} debounceMs={0} />);
    const box = screen.getByRole("combobox", { name: "record" });
    fireEvent.focus(box);
    await act(async () => {});
    const groups = screen.getAllByRole("group");
    expect(groups.map((g) => g.getAttribute("aria-labelledby") && document.getElementById(g.getAttribute("aria-labelledby")!)?.textContent)).toEqual(["Leads", "Deals"]);
    expect(within(groups[0]).getAllByRole("option")).toHaveLength(2);
    expect(within(groups[0]).getByTestId("av-1")).toBeTruthy();
    const opts = screen.getAllByRole("option");
    expect(opts.map((o) => o.textContent)).toEqual(["AAcme lead", "Beta lead", "Acme deal", "Loose"]);
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(box.getAttribute("aria-activedescendant")).toBe(opts[2].id);
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("D-1", results[2]);
  });
  it("CORE.G11 without group / icon the list is flat (0.6.0 markup)", async () => {
    wrap(<LinkInput aria-label="r" value={null} onChange={() => {}} search={async () => [{ value: "A" }, { value: "B" }]} debounceMs={0} />);
    fireEvent.focus(screen.getByRole("combobox", { name: "r" }));
    await act(async () => {});
    expect(screen.queryByRole("group")).toBeNull();
    expect(document.querySelector("[data-suggestion-icon]")).toBeNull();
  });
});

describe("CORE.G23 IconStatCard trend", () => {
  it("CORE.G23 renders StatCard's trend pill with a screen-reader direction; absent trend keeps the 0.6.0 markup", () => {
    const { container, rerender } = wrap(<IconStatCard label="Deals" value={1200} trend={{ value: "+12%", direction: "up" }} />);
    const pill = container.querySelector("[data-trend='up']")!;
    expect(pill.textContent).toBe("Up +12%");
    expect(pill.className).toContain("text-emerald-700");
    rerender(<ThemeProvider language="ar"><IconStatCard label="Deals" value={5} trend={{ value: 3, direction: "down" }} /></ThemeProvider>);
    expect(container.querySelector("[data-trend='down']")!.textContent).toBe("انخفاض ٣");
    cleanup();
    const plain = wrap(<IconStatCard label="Deals" value={5} />).container;
    expect(plain.querySelector("[data-trend]")).toBeNull();
    expect(plain.querySelectorAll("p")).toHaveLength(2);
  });
  it("CORE.G23 any node is rendered as a custom trend", () => {
    wrap(<IconStatCard label="Leads" value={9} trend={<span data-testid="delta">vs last week</span>} />);
    expect(screen.getByTestId("delta").textContent).toBe("vs last week");
  });
});

describe("CORE.EmptyState (D-crm N10)", () => {
  it("CORE.N10 renders icon, localized title, description and an action; the action is keyboard reachable", () => {
    const create = vi.fn();
    const { container } = wrap(<EmptyState icon={Users} title={{ en: "No contacts yet", ar: "لا جهات اتصال بعد" }} description="Add the first one."
      action={<Button size="sm" onClick={create}>New contact</Button>} headingLevel={3} />);
    expect(screen.getByRole("heading", { level: 3, name: "No contacts yet" })).toBeTruthy();
    expect(screen.getByText("Add the first one.")).toBeTruthy();
    expect(container.querySelector("svg.lucide-users")?.getAttribute("aria-hidden")).toBe("true");
    const btn = screen.getByRole("button", { name: "New contact" });
    btn.focus(); fireEvent.click(btn);
    expect(create).toHaveBeenCalled();
  });
  it("CORE.N10 Arabic title, small plain variant, no icon", () => {
    const { container } = wrap(<EmptyState icon={null} size="sm" variant="plain" title={{ en: "Nothing", ar: "لا شيء" }} />, "ar");
    expect(screen.getByText("لا شيء")).toBeTruthy();
    expect(container.querySelector("svg")).toBeNull();
    expect((container.querySelector("[data-sf-empty-state]") as HTMLElement).className).not.toContain("border-dashed");
  });
});

describe("CORE showcase pages (smoke)", () => {
  it("CORE.showcase the P35 core pages render in English and Arabic without errors", async () => {
    const pages = await import("../showcase/src/pages/p35-core");
    const routes = await import("../showcase/src/routes");
    for (const id of ["core-fields", "file-dropzone", "combobox-p35", "empty-trend", "record-p35", "record-extras", "editor-stepper-p35"]) {
      expect(routes.PAGES.some((p) => p.id === id)).toBe(true);
    }
    // PAGES follows the navigation order (rebuilt from GROUPS)
    expect(routes.PAGES.map((p) => p.id)).toEqual(routes.GROUPS.flatMap((g) => g.pages.map((p) => p.id)));
    const err = vi.spyOn(console, "error");
    for (const lang of ["en", "ar"] as const) {
      for (const P of [pages.CoreFieldsPage, pages.RecordExtrasPage, pages.RecordP35Page, pages.FileDropzonePage, pages.ComboboxP35Page, pages.EmptyAndTrendPage, pages.EditorStepperP35Page]) {
        const { unmount } = wrap(<P />, lang);
        unmount();
      }
    }
    expect(err).not.toHaveBeenCalled();
  });
});

describe("CORE.G15 RichTextEditor insert API + toolbar slot", () => {
  it("CORE.G15 toolbarEnd renders inside the toolbar; insertText / insertHtml go in at the end without a caret, sanitized, and emit onChange", () => {
    const ref = React.createRef<RichTextEditorHandle>();
    const change = vi.fn();
    const Host = () => (
      <RichTextEditor ref={ref} ariaLabel="Body" value="<p>Hello</p>" onChange={change}
        toolbarEnd={<button type="button" onClick={() => ref.current?.insertHtml('<b>Template</b><img src=x onerror="alert(1)">')}>Insert template</button>} />
    );
    const { container } = wrap(<Host />);
    const toolbar = screen.getByRole("toolbar", { name: "Body" });
    const insert = within(toolbar).getByRole("button", { name: "Insert template" });
    fireEvent.click(insert);
    const last = change.mock.calls.at(-1)![0] as string;
    expect(last).toContain("<b>Template</b>");
    expect(last).not.toMatch(/img|onerror/);
    act(() => ref.current!.insertText(" — thanks"));
    expect(change.mock.calls.at(-1)![0]).toMatch(/— thanks$/);
    expect(ref.current!.getHtml()).toBe(change.mock.calls.at(-1)![0]);
    expect(container.querySelector("[role=textbox]")!.innerHTML).not.toContain("onerror");
  });
  it("CORE.G15 inserts at the saved caret, not at the end", () => {
    const ref = React.createRef<RichTextEditorHandle>();
    const change = vi.fn();
    wrap(<RichTextEditor ref={ref} ariaLabel="Body" value="<p>AB</p>" onChange={change} />);
    const box = screen.getByRole("textbox", { name: "Body" });
    const text = box.querySelector("p")!.firstChild!;
    const r = document.createRange(); r.setStart(text, 1); r.collapse(true);
    const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(r);
    fireEvent.keyUp(box, { key: "ArrowRight" });
    act(() => ref.current!.insertText("x"));
    expect(change.mock.calls.at(-1)![0]).toBe("<p>AxB</p>");
  });
  it("CORE.G15 without the new props the editor is unchanged (no toolbar slot)", () => {
    const { container } = wrap(<RichTextEditor value="" onChange={() => {}} />);
    expect(container.querySelector("[data-toolbar-end]")).toBeNull();
  });
});

describe("CORE.G20 MonthInput (month granularity)", () => {
  it("CORE.G20 parses / formats YYYY-MM in en and ar", () => {
    expect(parseMonthValue("2026-03")).toEqual({ y: 2026, m: 3 });
    expect(parseMonthValue("2026-13")).toBeNull();
    expect(formatMonthValue("2026-03")).toBe("March 2026");
    expect(formatMonthValue("2026-03", "ar")).toBe("مارس ٢٠٢٦");
  });
  it("CORE.G20 opens a month grid, picks with the mouse; clears with ×; min / max disable months", async () => {
    const change = vi.fn();
    wrap(<MonthInput aria-label="Readiness" value="2026-03" onChange={change} min="2026-02" max="2026-10" />);
    const trigger = screen.getByRole("button", { name: "Readiness: March 2026" });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "March 2026" }).getAttribute("aria-pressed")).toBe("true");
    expect((within(dialog).getByRole("button", { name: "January 2026" }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(dialog).getByRole("button", { name: "November 2026" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: "June 2026" }));
    expect(change).toHaveBeenLastCalledWith("2026-06");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(change).toHaveBeenLastCalledWith(null);
  });
  it("CORE.G20 keyboard: arrows move (mirrored in RTL), Up/Down by a row, PageDown changes year, Enter picks", async () => {
    const change = vi.fn();
    wrap(<MonthInput aria-label="m" value="2026-05" onChange={change} />, "ar");
    fireEvent.click(screen.getByRole("button", { name: /^m: / }));
    const dialog = await screen.findByRole("dialog");
    const may = within(dialog).getByRole("button", { name: "مايو ٢٠٢٦" });
    may.focus();
    // RTL: ArrowLeft moves forward (to June)
    fireEvent.keyDown(may, { key: "ArrowLeft" });
    await screen.findByRole("button", { name: "يونيو ٢٠٢٦" });
    expect(within(dialog).getByRole("button", { name: "يونيو ٢٠٢٦" }).tabIndex).toBe(0);
    fireEvent.keyDown(dialog.querySelector("[data-month='6']")!, { key: "ArrowDown" }); // September
    fireEvent.keyDown(dialog.querySelector("[data-month='9']")!, { key: "PageDown" }); // 2027
    expect(dialog.querySelector("[data-year]")!.textContent).toBe("٢٠٢٧");
    fireEvent.click(dialog.querySelector("[data-month='9']")!); // Enter / Space on a <button> fire click
    expect(change).toHaveBeenLastCalledWith("2027-09");
  });
});

describe("CORE.N8 Stepper overflow cue + followCurrent", () => {
  const steps: StepperStep[] = Array.from({ length: 10 }, (_, i) => ({ label: `Step ${i + 1}`, state: i < 4 ? "done" : i === 4 ? "current" : "upcoming" }));
  const layout = (el: HTMLElement, o: { scrollWidth: number; clientWidth: number; scrollLeft: number }) => {
    Object.defineProperty(el, "scrollWidth", { configurable: true, get: () => o.scrollWidth });
    Object.defineProperty(el, "clientWidth", { configurable: true, get: () => o.clientWidth });
    Object.defineProperty(el, "scrollLeft", { configurable: true, get: () => o.scrollLeft, set: (v) => { o.scrollLeft = v; } });
  };
  it("CORE.N8 shows a cue on each side with hidden steps; the chevron scrolls by a page; the strip is keyboard focusable", () => {
    const geo = { scrollWidth: 1000, clientWidth: 400, scrollLeft: 0 };
    const scrollBy = vi.fn();
    const { container } = wrap(<Stepper steps={steps} ariaLabel="Wizard" overflowCue />);
    const ol = container.querySelector("ol")!;
    layout(ol, geo);
    (ol as unknown as { scrollBy: typeof scrollBy }).scrollBy = scrollBy;
    fireEvent.scroll(ol);
    expect(container.querySelector("[data-overflow-cue='after']")).toBeTruthy();
    expect(container.querySelector("[data-overflow-cue='before']")).toBeNull();
    geo.scrollLeft = 300; fireEvent.scroll(ol);
    expect(container.querySelector("[data-overflow-cue='before']")).toBeTruthy();
    fireEvent.click(container.querySelector("[data-overflow-cue='after'] button")!);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 240, behavior: "smooth" });
    geo.scrollLeft = 600; fireEvent.scroll(ol);
    expect(container.querySelector("[data-overflow-cue='after']")).toBeNull();
    expect(ol.tabIndex).toBe(0);
    expect(container.querySelector("[data-overflow-cue]")!.getAttribute("aria-hidden")).toBe("true");
  });
  it("CORE.N8 RTL: 'after' scrolls toward the left (negative), the cue sits on the left", () => {
    const geo = { scrollWidth: 1000, clientWidth: 400, scrollLeft: -300 };
    const scrollBy = vi.fn();
    const { container } = wrap(<Stepper steps={steps} ariaLabel="Wizard" overflowCue />, "ar");
    const ol = container.querySelector("ol")!;
    layout(ol, geo);
    (ol as unknown as { scrollBy: typeof scrollBy }).scrollBy = scrollBy;
    fireEvent.scroll(ol);
    const after = container.querySelector("[data-overflow-cue='after']")!;
    expect(after.className).toContain("left-0");
    fireEvent.click(after.querySelector("button")!);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -240, behavior: "smooth" });
  });
  it("CORE.N8 followCurrent centres the current step in the strip (scrolls the strip, not the page)", () => {
    const proto = HTMLOListElement.prototype as unknown as Record<string, unknown>;
    const scrollBy = vi.fn();
    Object.defineProperty(proto, "scrollWidth", { configurable: true, get: () => 1000 });
    Object.defineProperty(proto, "clientWidth", { configurable: true, get: () => 400 });
    proto.scrollBy = scrollBy;
    const rect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const cur = this.getAttribute("aria-current") === "step";
      return { left: cur ? 600 : 0, width: cur ? 100 : 400, top: 0, height: 40, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });
    try {
      wrap(<Stepper steps={steps} ariaLabel="Wizard" followCurrent />);
      expect(scrollBy).toHaveBeenCalledWith({ left: 650 - 200 });
    } finally {
      delete proto.scrollWidth; delete proto.clientWidth; delete proto.scrollBy; rect.mockRestore();
    }
  });
  it("CORE.N8 without the props the markup is unchanged (no wrapper, not focusable)", () => {
    const { container } = wrap(<Stepper steps={steps} ariaLabel="Wizard" />);
    expect(container.querySelector("[data-stepper-rail]")).toBeNull();
    expect(container.querySelector("ol")!.hasAttribute("tabindex")).toBe(false);
  });
});
