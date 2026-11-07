/**
 * P35 views — the view switcher (Desk list_view_select.js) and `availableViews(meta)`. Core: rendered with Testing
 * Library; Frappe: pure (meta in, options out). No server is involved.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "../src";
import { ViewSwitcher, switcherOptions, type ViewOption } from "../src/list/views";
import { availableViews, calendarFieldMapFromMeta, kanbanGroupFields } from "../src/frappe/views";
import type { DocTypeMeta } from "../src/frappe/contract";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => cleanup());

const wrap = (ui: React.ReactNode, lang: "en" | "ar" = "en") => render(<ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>{ui}</ThemeProvider>);
const open = () => fireEvent.keyDown(screen.getByTestId("sf-view-switcher"), { key: "Enter" });

const TASK: DocTypeMeta = {
  name: "Task", title_field: "subject", image_field: "cover",
  fields: [
    { fieldname: "subject", fieldtype: "Data", label: "Subject" },
    { fieldname: "status", fieldtype: "Select", label: "Status", options: "Open\nWorking\nClosed" },
    { fieldname: "exp_start_date", fieldtype: "Date", label: "Expected Start" },
    { fieldname: "exp_end_date", fieldtype: "Date", label: "Expected End" },
    { fieldname: "color", fieldtype: "Color", label: "Color" },
    { fieldname: "cover", fieldtype: "Attach Image", label: "Cover" },
  ],
};
const BARE: DocTypeMeta = { name: "Note", fields: [{ fieldname: "title", fieldtype: "Data" }] };

describe("LV.H0 view switcher (Core)", () => {
  const views: ViewOption[] = [
    { view: "list", available: true }, { view: "report", available: true }, { view: "image", available: false, reason: "no_image_field" },
    { view: "gantt", available: true }, // a host claiming an unimplemented view: never offered
  ];
  it("LV.H0 offers only available, implemented views; the current one is marked; choosing calls onChange", () => {
    const onChange = vi.fn();
    wrap(<ViewSwitcher views={views} value="list" onChange={onChange} />);
    expect(screen.getByTestId("sf-view-switcher").textContent).toContain("List view");
    open();
    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.getAttribute("data-view"))).toEqual(["list", "report"]);
    expect(items[0].getAttribute("aria-current")).toBe("true");
    fireEvent.click(items[1]);
    expect(onChange).toHaveBeenCalledWith("report");
  });
  it("LV.H0 showUnavailable lists the others disabled with their reason (an unimplemented view says so)", () => {
    const onChange = vi.fn();
    wrap(<ViewSwitcher views={views} value="list" onChange={onChange} showUnavailable />);
    open();
    const image = screen.getAllByRole("menuitem").find((i) => i.getAttribute("data-view") === "image")!;
    expect(image.getAttribute("aria-disabled")).toBe("true");
    expect(within(image).getByTestId("sf-view-reason").textContent).toBe("The DocType has no image field");
    const gantt = screen.getAllByRole("menuitem").find((i) => i.getAttribute("data-view") === "gantt")!;
    expect(gantt.getAttribute("aria-disabled")).toBe("true");
    expect(gantt.textContent).toContain("Not available in this package yet");
    fireEvent.click(image);
    expect(onChange).not.toHaveBeenCalled();
  });
  it("LV.H0 labels in Arabic", () => {
    wrap(<ViewSwitcher views={views} value="report" onChange={() => {}} />, "ar");
    expect(screen.getByTestId("sf-view-switcher").textContent).toContain("عرض تقرير");
  });
  it("LV.H0 switcherOptions never trusts available:true for an unimplemented view", () => {
    expect(switcherOptions([{ view: "tree", available: true }], true)).toEqual([{ view: "tree", available: false, reason: "not_implemented" }]);
    expect(switcherOptions([{ view: "tree", available: true }])).toEqual([]);
  });
});

describe("LV.H0 availableViews(meta) (Frappe, list_view_select.js:52-133)", () => {
  const byView = (o: ViewOption[]) => Object.fromEntries(o.map((v) => [v.view, v.available ? "yes" : v.reason]));
  it("LV.H0 Task: list, report, image (image_field), kanban (Select field), calendar (date fields); the rest not implemented", () => {
    const v = availableViews(TASK);
    expect(v.map((x) => x.view)).toEqual(["list", "report", "dashboard", "gantt", "kanban", "calendar", "image", "inbox", "tree", "map"]);
    expect(byView(v)).toEqual({
      list: "yes", report: "yes", image: "yes", kanban: "yes", calendar: "yes",
      dashboard: "not_implemented", gantt: "not_implemented", inbox: "not_communication", tree: "not_tree", map: "no_geolocation",
    });
  });
  it("LV.H0 a bare DocType: no image field, no kanban source, no date field", () => {
    expect(byView(availableViews(BARE))).toMatchObject({ image: "no_image_field", kanban: "no_kanban_source", calendar: "no_date_field" });
  });
  it("LV.H0 Kanban from a board alone; calendar from a passed field map, or off with calendar:false", () => {
    expect(byView(availableViews(BARE, { kanbanBoards: [{ name: "B" }] })).kanban).toBe("yes");
    expect(byView(availableViews(TASK, { calendar: false })).calendar).toBe("no_date_field");
    expect(byView(availableViews({ ...BARE, fields: [...BARE.fields, { fieldname: "on", fieldtype: "Datetime" }] }, { calendar: { start: "on" } })).calendar).toBe("yes");
  });
  it("LV.H0 is_tree / Geolocation / Communication: possible on Desk, not implemented here (never available)", () => {
    const v = byView(availableViews({ name: "Communication", is_tree: 1, fields: [{ fieldname: "location", fieldtype: "Geolocation" }] }));
    expect(v).toMatchObject({ tree: "not_implemented", map: "not_implemented", inbox: "not_implemented" });
  });
  it("LV.H0 calendarFieldMapFromMeta guesses start/end/title/color; kanbanGroupFields lists Select fields", () => {
    expect(calendarFieldMapFromMeta(TASK)).toEqual({ start: "exp_start_date", end: "exp_end_date", title: "subject", color: "color", allDay: true });
    expect(calendarFieldMapFromMeta(BARE)).toBeNull();
    expect(kanbanGroupFields(TASK).map((f) => f.fieldname)).toEqual(["status"]);
  });
});
