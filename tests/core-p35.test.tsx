/**
 * P35 "core" workstream — generic capabilities the CRM audit (docs/audit/p35/D-crm.md §3c) found missing.
 * Test names carry the gap id (CORE.G<n>; CORE.P34 = the AssigneeGroup role line lost in P34, D-crm row A18).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import {
  AssigneeGroup, FileDropzone, fileMatchesAccept, formatFileSize, validateFiles, LifecycleBar, StatusBadge, StatusDot, ThemeProvider, resolveStatusColor, statusColorStyles,
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
