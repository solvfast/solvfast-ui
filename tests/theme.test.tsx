import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ThemeProvider, useLocale, useTheme, usePortalContainer, Popover, PopoverContent, PopoverTrigger } from "../src";

const html = document.documentElement;
function Probe() {
  const { theme, toggleTheme } = useTheme();
  const { language, direction, toggleLanguage, t } = useLocale();
  return (
    <div>
      <span data-testid="state">{`${theme}|${language}|${direction}|${t("toggleTheme")}`}</span>
      <button onClick={toggleTheme}>theme</button>
      <button onClick={toggleLanguage}>lang</button>
    </div>
  );
}
const state = () => screen.getByTestId("state").textContent;

beforeEach(() => { localStorage.clear(); html.className = ""; ["data-theme", "lang", "dir"].forEach((a) => html.removeAttribute(a)); });
afterEach(cleanup);

describe("ThemeProvider — document scope", () => {
  it("applies sf-theme, dark, data-theme, lang and dir to <html>", () => {
    render(<ThemeProvider defaultTheme="dark" defaultLanguage="ar"><Probe /></ThemeProvider>);
    expect(html.classList.contains("sf-theme")).toBe(true);
    expect(html.classList.contains("dark")).toBe(true);
    expect(html.getAttribute("data-theme")).toBe("dark");
    expect(html.getAttribute("lang")).toBe("ar");
    expect(html.getAttribute("dir")).toBe("rtl");
    expect(state()).toBe("dark|ar|rtl|تبديل المظهر");
  });

  it("toggles and persists to every configured key; reads keys in order", () => {
    localStorage.setItem("legacy_theme", "dark");
    render(<ThemeProvider storageKeys={{ theme: ["legacy_theme", "app_theme"], language: "app_lang" }}><Probe /></ThemeProvider>);
    expect(state()?.startsWith("dark|en|ltr")).toBe(true); // first key wins
    act(() => screen.getByText("theme").click());
    act(() => screen.getByText("lang").click());
    expect(localStorage.getItem("legacy_theme")).toBe("light");
    expect(localStorage.getItem("app_theme")).toBe("light");
    expect(localStorage.getItem("app_lang")).toBe("ar");
    expect(html.classList.contains("dark")).toBe(false);
    expect(html.getAttribute("dir")).toBe("rtl");
  });

  it("restores <html> on unmount (leaves the page as it found it)", () => {
    html.className = "host-class";
    html.setAttribute("lang", "fr");
    const { unmount } = render(<ThemeProvider defaultTheme="dark"><Probe /></ThemeProvider>);
    unmount();
    expect(html.className).toBe("host-class");
    expect(html.getAttribute("lang")).toBe("fr");
    expect(html.hasAttribute("data-theme")).toBe(false);
  });

  it("controlled props win and callbacks fire", () => {
    const seen: string[] = [];
    render(<ThemeProvider theme="light" onThemeChange={(t) => seen.push(t)} storageKeys={null}><Probe /></ThemeProvider>);
    act(() => screen.getByText("theme").click());
    expect(seen).toEqual(["dark"]);
    expect(state()?.startsWith("light")).toBe(true); // still controlled
    expect(localStorage.length).toBe(0); // storageKeys={null} disables persistence
  });

  it("merges message overrides per language", () => {
    render(<ThemeProvider defaultLanguage="en" messages={{ en: { toggleTheme: "Switch look" } }}><Probe /></ThemeProvider>);
    expect(state()).toContain("Switch look");
  });
});

describe("outside a provider", () => {
  it("hooks fall back to <html> instead of throwing (fixes Sear's Navbar crash)", () => {
    html.setAttribute("lang", "ar");
    html.classList.add("dark");
    render(<Probe />);
    expect(state()).toBe("dark|ar|rtl|تبديل المظهر");
  });
});

describe("ThemeProvider — element scope", () => {
  it("scopes classes to a wrapper and portals popups inside it", async () => {
    function Host() { return <span data-testid="host">{usePortalContainer() ? "has-host" : "no-host"}</span>; }
    render(
      <ThemeProvider scope="element" defaultTheme="dark" defaultLanguage="en">
        <Host />
        <Popover open><PopoverTrigger>open</PopoverTrigger><PopoverContent>inside</PopoverContent></Popover>
      </ThemeProvider>,
    );
    expect(html.classList.contains("sf-theme")).toBe(false);
    const wrapper = document.querySelector(".sf-theme")!;
    expect(wrapper.classList.contains("dark")).toBe(true);
    expect(wrapper.getAttribute("data-theme")).toBe("dark");
    expect(await screen.findByText("has-host")).toBeTruthy();
    const popup = await screen.findByText("inside");
    expect(wrapper.contains(popup)).toBe(true); // tokens reach the popup
    expect(popup.closest(".sf-popper")).toBeTruthy();
  });
});
