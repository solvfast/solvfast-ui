/**
 * 0.7.0-dev.7 — Sayr's Appearance in the package: brand colours, the workspace background, the company logo, the
 * user menu, and System Settings' First Day of the Week in the date pickers.
 * The colour and background values are the ones Sayr's server writes (sear_product engines/appearance.py `css()`
 * and its test_system_settings_page.py): the same inputs must give the same tokens and layers in both places.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Home } from "lucide-react";
import {
  AppShell, BACKGROUND_PRESETS, BrandTheme, CompanyLogo, DEFAULT_WORKSPACE_BACKGROUND, ThemeProvider, UserMenu,
  applyBrandTheme, brandTokens, colorBackground, imageLayerStyle, presetBackground, userInitials,
  type NavItem, type ShellUser,
} from "../src";
import { formatContextFromBoot } from "../src/frappe/services/boot";
import { DateField } from "../src/primitives/date-time-field";

const html = document.documentElement;
beforeEach(() => { localStorage.clear(); html.className = ""; html.removeAttribute("style"); });
afterEach(cleanup);

const GREEN = { primaryColor: "#228C2E", secondaryColor: "#C223D7" };
const user = (over: Partial<ShellUser> = {}): ShellUser => ({
  name: "sara@example.com", fullName: "Sara Ahmed", image: null, onProfile: vi.fn(), onLogout: vi.fn(), ...over,
});

describe("brand colours", () => {
  it("sets nothing at the default colours", () => {
    expect(brandTokens({ primaryColor: "#512195", secondaryColor: "#25d0fe" }, false)).toEqual({});
  });

  it("gives the same tokens as Sayr's server for a custom brand", () => {
    const light = brandTokens(GREEN, false);
    expect(light["--primary"]).toBe("127 61% 34%");
    expect(light["--primary-foreground"]).toBe("0 0% 100%");
    expect(light["--btn-primary-bg"]).toBe("hsl(127 61% 34%)");
    expect(light["--brand-cyan"]).toBe("293 72% 49%");
    // A dark primary is lifted to stay visible on the dark theme, with dark text on it.
    const dark = brandTokens(GREEN, true);
    expect(dark["--primary"]).toBe("127 61% 60%");
    expect(dark["--primary-foreground"]).toBe("240 19% 10%");
  });

  it("puts the tokens on <html> and removes them when the brand returns to the default", () => {
    applyBrandTheme(GREEN, false);
    expect(html.style.getPropertyValue("--primary")).toBe("127 61% 34%");
    applyBrandTheme({ primaryColor: "#512195", secondaryColor: "#25D0FE" }, false);
    expect(html.style.getPropertyValue("--primary")).toBe("");
    expect(html.style.getPropertyValue("--brand-cyan")).toBe("");
  });

  it("<BrandTheme> follows the theme's light/dark", () => {
    render(<ThemeProvider defaultTheme="dark" defaultLanguage="en" storageKeys={null}><BrandTheme brand={GREEN} /></ThemeProvider>);
    expect(html.style.getPropertyValue("--primary")).toBe("127 61% 60%");
  });
});

describe("workspace background", () => {
  const noSpaces = (s: string) => s.replace(/\s+/g, "");

  it("draws the same layers as Sayr's server (the Ocean preset)", () => {
    const ocean = presetBackground(BACKGROUND_PRESETS.find((p) => p.id === "ocean")!);
    expect(noSpaces(colorBackground(ocean, false))).toBe(
      "linear-gradient(100deg,rgba(37,99,235,0.22)0%,rgba(34,211,238,0.22)50%,rgba(14,165,233,0.22)100%),#f0f1f6",
    );
    expect(colorBackground(ocean, true, "transparent").endsWith(", transparent")).toBe(true);
  });

  it("the default is spots of four colours, capped intensity", () => {
    expect(DEFAULT_WORKSPACE_BACKGROUND).toMatchObject({ mode: "color", style: "spots", intensity: 12 });
    expect(colorBackground({ ...DEFAULT_WORKSPACE_BACKGROUND, intensity: 90 }, false)).toContain("rgba(37,208,254,0.35)");
  });

  it("quotes a photo's URL, so Frappe's repeat-upload names work", () => {
    const style = imageLayerStyle({ ...DEFAULT_WORKSPACE_BACKGROUND, mode: "image", image: "/files/bg (2).jpg" }, false);
    expect(style.backgroundImage).toBe('url("/files/bg (2).jpg")');
  });
});

describe("company logo and user menu", () => {
  it("uses the dark variant only in the dark theme", () => {
    const { rerender } = render(
      <ThemeProvider theme="light" defaultLanguage="en" storageKeys={null}><CompanyLogo src="/logo.png" darkSrc="/logo-dark.png" /></ThemeProvider>,
    );
    expect(document.querySelector("img")?.getAttribute("src")).toBe("/logo.png");
    rerender(<ThemeProvider theme="dark" defaultLanguage="en" storageKeys={null}><CompanyLogo src="/logo.png" darkSrc="/logo-dark.png" /></ThemeProvider>);
    expect(document.querySelector("img")?.getAttribute("src")).toBe("/logo-dark.png");
  });

  it("initials as Frappe: the first letter of the first two words", () => {
    expect(userInitials("Sara Ahmed Ali")).toBe("SA");
    expect(userInitials("administrator")).toBe("A");
  });

  it("opens with the name and email, and runs My Profile and Log out", async () => {
    const u = user();
    render(<ThemeProvider defaultLanguage="en" storageKeys={null}><UserMenu user={u} /></ThemeProvider>);
    const trigger = screen.getByRole("button", { name: "Account" });
    expect(trigger.textContent).toBe("SA");

    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(await screen.findByText("sara@example.com")).toBeTruthy();
    fireEvent.click(await screen.findByRole("menuitem", { name: "My Profile" }));
    expect(u.onProfile).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole("button", { name: "Account" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Log out" }));
    expect(u.onLogout).toHaveBeenCalledTimes(1);
  });

  it("is labelled in Arabic", async () => {
    render(<ThemeProvider defaultLanguage="ar" storageKeys={null}><UserMenu user={user()} /></ThemeProvider>);
    fireEvent.keyDown(screen.getByRole("button", { name: "الحساب" }), { key: "Enter" });
    expect(await screen.findByRole("menuitem", { name: "ملفي الشخصي" })).toBeTruthy();
    expect(await screen.findByRole("menuitem", { name: "تسجيل الخروج" })).toBeTruthy();
  });
});

describe("AppShell", () => {
  const ITEMS: NavItem[] = [{ id: "home", href: "/home", icon: Home, label: "Home" }];
  const shell = (extra: Partial<Parameters<typeof AppShell>[0]> = {}) => render(
    <ThemeProvider defaultLanguage="en" storageKeys={null}>
      <AppShell brand={{ name: "Tickets" }} items={ITEMS} currentPath="/home" onNavigate={() => {}} search={false} {...extra}>
        <p>page</p>
      </AppShell>
    </ThemeProvider>,
  );

  it("shows the company logo, the user menu and the background when given", () => {
    const { container } = shell({
      companyLogo: { src: "/files/logo (3).png", alt: "Acme" }, user: user(), background: DEFAULT_WORKSPACE_BACKGROUND,
    });
    expect(screen.getByAltText("Acme").getAttribute("src")).toBe("/files/logo (3).png");
    expect(screen.getByRole("button", { name: "Account" })).toBeTruthy();
    const root = container.querySelector(".sf-app")!;
    expect(root.className).toContain("isolate");
    expect(root.firstElementChild?.hasAttribute("data-sf-backdrop")).toBe(true);
  });

  it("is unchanged without them", () => {
    const { container } = shell();
    expect(screen.queryByRole("button", { name: "Account" })).toBeNull();
    expect(container.querySelector("[data-sf-backdrop]")).toBeNull();
    expect(container.querySelector(".sf-app")!.className).not.toContain("isolate");
  });
});

describe("First Day of the Week", () => {
  it("is read from the boot's sysdefaults", () => {
    expect(formatContextFromBoot({ sysdefaults: { first_day_of_the_week: "Monday" } }).firstDayOfWeek).toBe(1);
    expect(formatContextFromBoot({ sysdefaults: { first_day_of_the_week: "Sunday" } }).firstDayOfWeek).toBe(0);
    expect(formatContextFromBoot({ sysdefaults: {} }).firstDayOfWeek).toBeUndefined();
  });

  it("starts the date picker's week on that day", async () => {
    render(
      <ThemeProvider defaultLanguage="en" storageKeys={null}>
        <DateField value="2026-11-20" onChange={() => {}} weekStartsOn={1} />
      </ThemeProvider>,
    );
    await act(async () => { fireEvent.click(screen.getByRole("button")); });
    await waitFor(() => expect(document.querySelectorAll("th[aria-label], th abbr, [role='columnheader']").length).toBeGreaterThan(0));
    const first = document.querySelector("[role='columnheader']") ?? document.querySelector("thead th");
    expect(first?.getAttribute("aria-label") ?? first?.textContent).toMatch(/^Mo/);
  });
});
