import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  Label, RadioGroup, RadioGroupItem, Stepper, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, ThemeProvider,
  type StepperStep,
} from "../src";
import { Toaster, toast } from "../src/toast";

const html = document.documentElement;
beforeEach(() => { localStorage.clear(); html.className = ""; ["data-theme", "lang", "dir"].forEach((a) => html.removeAttribute(a)); });
afterEach(cleanup);

const inLang = (language: "en" | "ar", ui: React.ReactNode, theme: "light" | "dark" = "light") =>
  render(<ThemeProvider defaultLanguage={language} defaultTheme={theme} storageKeys={null}>{ui}</ThemeProvider>);

describe("Table (Design System)", () => {
  it("a semantic table in a scroll wrapper, with the DS classes", () => {
    const { container } = inLang("en", (
      <Table>
        <TableHeader><TableRow><TableHead>Invoice</TableHead></TableRow></TableHeader>
        <TableBody><TableRow><TableCell>INV-001</TableCell></TableRow></TableBody>
      </Table>
    ));
    const wrapper = container.firstElementChild!;
    expect(wrapper.className).toBe("relative w-full overflow-auto");
    expect(screen.getByRole("table").className).toBe("w-full caption-bottom text-sm");
    expect(screen.getByRole("columnheader", { name: "Invoice" }).className).toContain("text-start");
    expect(screen.getAllByRole("row")[1].className).toContain("hover:bg-muted/50");
  });
});

describe("RadioGroup (Design System)", () => {
  const group = (
    <RadioGroup defaultValue="a" aria-label="Plan">
      {["a", "b", "c", "d"].map((v) => (
        <div key={v}><RadioGroupItem value={v} id={`r-${v}`} disabled={v === "c"} /><Label htmlFor={`r-${v}`}>{v.toUpperCase()}</Label></div>
      ))}
    </RadioGroup>
  );
  // Radix moves focus in a timeout after keydown; the focused radio becomes checked.
  const press = async (from: HTMLElement, key: string, to: HTMLElement) => {
    fireEvent.keyDown(from, { key });
    await waitFor(() => expect(document.activeElement).toBe(to));
    expect(to.getAttribute("data-state")).toBe("checked");
  };

  it("one checked radio; clicking a label checks its radio; disabled stays unchecked", () => {
    inLang("en", group);
    expect(screen.getByRole("radiogroup", { name: "Plan" })).toBeTruthy();
    const [a, b, c] = screen.getAllByRole("radio");
    expect(a.getAttribute("data-state")).toBe("checked");
    fireEvent.click(screen.getByText("B"));
    expect(b.getAttribute("data-state")).toBe("checked");
    expect(a.getAttribute("data-state")).toBe("unchecked");
    fireEvent.click(c);
    expect(c.getAttribute("data-state")).toBe("unchecked");
    expect(c.hasAttribute("disabled")).toBe(true);
  });

  it("arrow keys move and check, skip disabled radios, and follow the reading direction", async () => {
    inLang("en", group);
    const [a, b, , d] = screen.getAllByRole("radio");
    a.focus();
    await press(a, "ArrowDown", b);
    await press(b, "ArrowDown", d); // C is disabled
    cleanup();
    inLang("ar", group);
    const [a2, b2] = screen.getAllByRole("radio");
    a2.focus();
    await press(a2, "ArrowLeft", b2); // Arabic: left is next
  });
});

describe("Stepper (Design System pattern = Sear's)", () => {
  const steps: StepperStep[] = [
    { label: "Account", state: "done" },
    { label: { en: "Channels", ar: "القنوات" }, state: "error", note: "2 fields missing", srNote: "this step has errors", clickable: true },
    { label: "Routing", state: "current" },
    { label: "Review", state: "upcoming" },
  ];

  it("an ordered list on a glass rail; the current step is aria-current; done = check, error = X + note + screen-reader note", () => {
    inLang("en", <Stepper ariaLabel="Setup" steps={steps} />);
    const list = screen.getByRole("list", { name: "Setup" });
    expect(list.tagName).toBe("OL");
    expect(list.className).toContain("sf-glass");
    const items = screen.getAllByRole("listitem");
    expect(items[2].getAttribute("aria-current")).toBe("step");
    expect(items[0].querySelector("svg")!.getAttribute("class")).toContain("lucide-check");
    expect(items[1].querySelector("svg")!.getAttribute("class")).toContain("lucide-x");
    expect(screen.getByText("2 fields missing")).toBeTruthy();
    expect(screen.getByText("— this step has errors").className).toBe("sr-only");
    expect(items[3].textContent).toContain("4");
  });

  it("steps are buttons, clickable only when `clickable` and `onJump` are set; labels follow the language", () => {
    const onJump = vi.fn();
    inLang("ar", <Stepper ariaLabel={{ en: "Setup", ar: "الإعداد" }} steps={steps} onJump={onJump} />);
    expect(screen.getByRole("list", { name: "الإعداد" })).toBeTruthy();
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => (b as HTMLButtonElement).disabled)).toEqual([true, false, true, true]);
    fireEvent.click(buttons[1]);
    expect(onJump).toHaveBeenCalledWith(1);
    expect(screen.getByText("القنوات")).toBeTruthy();
  });
});

describe("Toaster (@solvfast/ui/toast)", () => {
  it("follows the theme and direction: bottom-right in English, bottom-left in Arabic", () => {
    const { container, unmount } = inLang("en", <Toaster />);
    let host = container.querySelector("section")!;
    expect(host.getAttribute("aria-label")).toMatch(/Notifications/);
    unmount();
    const ar = inLang("ar", <Toaster />, "dark");
    host = ar.container.querySelector("section")!;
    expect(host).toBeTruthy();
  });

  it("toast() from the entry shows a card toast on the right side and in the theme", async () => {
    const { container } = inLang("ar", <Toaster />, "dark");
    act(() => { toast("Preset saved", { description: "11 fields" }); });
    const item = await waitFor(() => {
      const li = container.querySelector("[data-sonner-toast]");
      if (!li) throw new Error("no toast yet");
      return li as HTMLElement;
    });
    expect(item.textContent).toContain("Preset saved");
    expect(item.className).toContain("bg-card");
    const list = container.querySelector("[data-sonner-toaster]")!;
    expect(list.getAttribute("data-x-position")).toBe("left");
    expect(list.getAttribute("data-y-position")).toBe("bottom");
    expect(list.getAttribute("dir")).toBe("rtl");
    expect(list.getAttribute("data-sonner-theme") ?? list.getAttribute("data-theme")).toBe("dark");
  });
});
