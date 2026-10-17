import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AlertDialog, AlertDialogContent, AlertDialogTitle, Calendar, Dialog, DialogContent, DialogTitle, Tabs, TabsList,
  TabsTrigger, ThemeProvider,
} from "../src";

const html = document.documentElement;
beforeEach(() => { localStorage.clear(); html.className = ""; ["data-theme", "lang", "dir"].forEach((a) => html.removeAttribute(a)); });
afterEach(cleanup);

const inLang = (language: "en" | "ar", ui: React.ReactNode) =>
  render(<ThemeProvider defaultLanguage={language} storageKeys={null}>{ui}</ThemeProvider>);

const strip = (
  <Tabs defaultValue="a">
    <TabsList aria-label="Sections">
      <TabsTrigger value="a">A</TabsTrigger>
      <TabsTrigger value="b">B</TabsTrigger>
      <TabsTrigger value="c" disabled>C</TabsTrigger>
      <TabsTrigger value="d">D</TabsTrigger>
    </TabsList>
  </Tabs>
);

describe("Tabs — Sear's SegmentedTabs look", () => {
  it("glass pill rail; pill tabs; the active one in primary, no underline", () => {
    inLang("en", strip);
    const list = screen.getByRole("tablist", { name: "Sections" });
    expect(list.className).toContain("sf-glass");
    expect(list.className).toContain("!rounded-full");
    expect(list.className).not.toContain("border-b");
    const a = screen.getByRole("tab", { name: "A" });
    expect(a.getAttribute("data-state")).toBe("active");
    expect(a.className).toContain("rounded-full");
    expect(a.className).toContain("data-[state=active]:text-primary");
    expect(a.className).not.toContain("border-b-2");
  });

  // Radix moves focus in a timeout after keydown (and selects the focused tab: automatic activation).
  const press = async (from: HTMLElement, key: string, to: HTMLElement) => {
    fireEvent.keyDown(from, { key });
    await waitFor(() => expect(document.activeElement).toBe(to));
    expect(to.getAttribute("data-state")).toBe("active");
  };

  it("arrow keys skip disabled tabs and follow the reading direction", async () => {
    inLang("en", strip);
    const [a, b, , d] = screen.getAllByRole("tab");
    a.focus();
    await press(a, "ArrowRight", b);
    await press(b, "ArrowRight", d); // C is disabled
    await press(d, "Home", a);
    cleanup();
    inLang("ar", strip);
    const [a2, b2, , d2] = screen.getAllByRole("tab");
    a2.focus();
    await press(a2, "ArrowLeft", b2); // Arabic: left is next
    await press(b2, "ArrowLeft", d2);
    await press(d2, "End", d2);
    await press(d2, "ArrowRight", b2);
  });
});

describe("Dialogs — Sear's glassy dialog", () => {
  it("Dialog and AlertDialog content carry the glass marker on top of the DS surface classes", () => {
    const check = (el: HTMLElement) => {
      expect(el.className).toContain("sf-glass-dialog");
      expect(el.className).toContain("sf-lg-surface");
      expect(el.className).toContain("sf-aurora-bar"); // kept, as in Sear: the marker rule outranks it
    };
    inLang("en", <Dialog open><DialogContent aria-describedby={undefined}><DialogTitle>D</DialogTitle></DialogContent></Dialog>);
    check(screen.getByRole("dialog"));
    cleanup();
    inLang("en", <AlertDialog open><AlertDialogContent aria-describedby={undefined}><AlertDialogTitle>A</AlertDialogTitle></AlertDialogContent></AlertDialog>);
    check(screen.getByRole("alertdialog"));
  });
});

describe("Calendar — the date pickers' surface on its own", () => {
  it("root carries the calendar surface marker", () => {
    const { container } = inLang("en", <Calendar mode="single" />);
    expect(container.querySelector(".rdp-root")!.className).toContain("sf-calendar");
  });
});
