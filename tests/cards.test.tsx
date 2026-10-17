import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Cable } from "lucide-react";
import { IconStatCard, StatCard, ThemeProvider } from "../src";

const html = document.documentElement;
beforeEach(() => { localStorage.clear(); html.className = ""; ["data-theme", "lang", "dir"].forEach((a) => html.removeAttribute(a)); });
afterEach(cleanup);

const inLang = (language: "en" | "ar", ui: React.ReactNode) =>
  render(<ThemeProvider defaultLanguage={language} storageKeys={null}>{ui}</ThemeProvider>);

describe("StatCard (Design System)", () => {
  it("is a static liquid-glass div with the DS classes; label and value as given", () => {
    const { container } = inLang("en", <StatCard label="Components" value="128" />);
    const root = container.firstElementChild!;
    expect(root.tagName).toBe("DIV");
    expect(root.className).toBe("sf-glass sf-glass--lg rounded-[20px] p-5 text-card-foreground");
    expect(screen.getByText("Components").className).toBe("text-sm text-muted-foreground");
    expect(screen.getByText("128").className).toBe("font-brand text-4xl font-bold leading-none");
  });

  it("trend pill: up is emerald with the rising icon, down is rose with the falling one", () => {
    inLang("en", <><StatCard label="Up" value="1" trend={{ value: "+12%", direction: "up" }} /><StatCard label="Down" value="2" trend={{ value: "-2%", direction: "down" }} /></>);
    const up = screen.getByText("+12%"), down = screen.getByText("-2%");
    expect(up.className).toContain("bg-emerald-100");
    expect(up.querySelector("svg")!.getAttribute("class")).toContain("lucide-trending-up");
    expect(down.className).toContain("bg-rose-100");
    expect(down.querySelector("svg")!.getAttribute("class")).toContain("lucide-trending-down");
  });

  it("no trend → no pill", () => {
    const { container } = inLang("en", <StatCard label="Tokens" value="342" />);
    expect(container.querySelectorAll("span").length).toBe(1);
  });

  it("numbers follow the language (ar-EG digits in Arabic); strings pass through; labels take { en, ar }", () => {
    inLang("ar", <StatCard label={{ en: "Tickets", ar: "التذاكر" }} value={1280} trend={{ value: "+4%", direction: "up" }} />);
    expect(screen.getByText("التذاكر")).toBeTruthy();
    expect(screen.getByText((1280).toLocaleString("ar-EG"))).toBeTruthy();
    expect(screen.getByText("+4%")).toBeTruthy();
  });

  it("href → a link (interactive glass, focus ring); onClick alone → a button", () => {
    const click = vi.fn();
    const { container, rerender } = inLang("en", <StatCard label="Open" value="3" href="/tickets?open=1" />);
    const a = container.querySelector("a")!;
    expect(a.getAttribute("href")).toBe("/tickets?open=1");
    expect(a.className).toContain("sf-glass--interactive");
    expect(a.className).toContain("focus-visible:ring-2");
    rerender(<ThemeProvider storageKeys={null}><StatCard label="Open" value="3" onClick={click} /></ThemeProvider>);
    const b = screen.getByRole("button");
    expect(b.getAttribute("type")).toBe("button");
    fireEvent.click(b);
    expect(click).toHaveBeenCalledTimes(1);
  });
});

describe("IconStatCard (Sear overview)", () => {
  it("Sear's pane, icon square and type; default icon Layers in Sear's violet at 0x1a", () => {
    const { container } = inLang("en", <IconStatCard label="Field Library" value={12} />);
    const root = container.firstElementChild!;
    expect(root.tagName).toBe("DIV");
    expect(root.className).toBe("sf-glass-pane sf-glass-pane--airy rounded-[20px] text-card-foreground block p-4 transition-colors hover:bg-muted/30");
    const square = root.querySelector("span")! as HTMLElement;
    expect(square.className).toBe("flex items-center justify-center shrink-0 h-9 w-9 rounded-lg"); // rounded-xl merged away, as in Sear
    expect(square.style.color).toBe("rgb(81, 33, 149)");
    expect(square.style.backgroundColor).toBe("rgba(81, 33, 149, 0.1)");
    expect(square.querySelector("svg")!.getAttribute("class")).toContain("lucide-layers");
    expect(screen.getByText("Field Library").className).toBe("text-sm font-semibold text-foreground truncate min-w-0");
    expect(screen.getByText("12").className).toBe("mt-3 text-2xl font-bold leading-none tabular-nums text-foreground");
  });

  it("custom icon and colour; a non-hex colour is tinted with color-mix", () => {
    const { container } = inLang("en", <><IconStatCard label="A" value={1} icon={Cable} color="#11bf9d" /><IconStatCard label="B" value={2} color="hsl(var(--brand-flame))" /></>);
    const [a, b] = Array.from(container.querySelectorAll<HTMLElement>("span[style]"));
    expect(a.querySelector("svg")!.getAttribute("class")).toContain("lucide-cable");
    expect(a.style.backgroundColor).toBe("rgba(17, 191, 157, 0.1)");
    expect(b.getAttribute("style")).toContain("color-mix(in srgb, hsl(var(--brand-flame)) 10%, transparent)");
  });

  it("Arabic label and digits; zero is shown", () => {
    inLang("ar", <IconStatCard label={{ en: "Routing", ar: "التوجيه" }} value={0} />);
    expect(screen.getByText("التوجيه")).toBeTruthy();
    expect(screen.getByText((0).toLocaleString("ar-EG"))).toBeTruthy();
  });

  it("href → a link named by its content (no aria-label hiding the count); onClick works on the link", () => {
    const click = vi.fn((e: React.MouseEvent) => e.preventDefault());
    inLang("en", <IconStatCard label="Channels" value={7} href="/studio/channels" onClick={click} />);
    const link = screen.getByRole("link", { name: "Channels 7" });
    expect(link.getAttribute("aria-label")).toBeNull();
    fireEvent.click(link);
    expect(click).toHaveBeenCalledTimes(1);
  });
});
