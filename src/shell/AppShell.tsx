/**
 * App shell — Sear's StudioShell layout (sear_studio_app/StudioShell.tsx, baseline 7abc895-dirty): Sidebar + glass
 * top bar overlaying the content column + one scrolling <main> + mobile bottom navigation, on the `sf-app` surface
 * (flat background in light, Sear's aurora in dark).
 *
 * Everything app-specific is a prop: brand, navigation, routing (`currentPath` + `onNavigate`), switcher sections,
 * notifications, help, search. No router, no app data. The rail state persists under `collapsedStorageKey`
 * (Sear: "studio_sidebar_collapsed").
 */
import * as React from "react";
import { useLocale } from "../theme/ThemeProvider";
import { MobileNav, type MobileNavProps } from "./MobileNav";
import { Navbar, type NavbarProps } from "./Navbar";
import { Sidebar, type ShellBrand, type SidebarProps } from "./Sidebar";
import { deepestActive, loc, type IsActive, type Localized, type NavItem } from "./nav";

export interface AppShellProps
  extends Pick<NavbarProps, "help" | "search" | "notifications" | "showLanguageToggle" | "showThemeToggle" | "actions"> {
  brand: ShellBrand;
  items: NavItem[];
  currentPath: string;
  onNavigate: (href: string, item?: NavItem) => void;
  isActive?: IsActive;
  /** Fixed page title; default: the deepest active item's label, else the brand name. */
  title?: Localized;
  switcher?: SidebarProps["switcher"];
  /** Replaces the sidebar's navigation list. */
  sidebarBody?: React.ReactNode;
  /** Controlled rail state. Uncontrolled: `defaultCollapsed` + persistence under `collapsedStorageKey`. */
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** localStorage key for the rail state (default "sf-sidebar-collapsed"; `null` disables persistence). */
  collapsedStorageKey?: string | null;
  /** Mobile bottom-nav options. */
  mobile?: Pick<MobileNavProps, "maxItems" | "exit">;
  children: React.ReactNode;
}

function readBool(key: string | null | undefined): boolean | undefined {
  if (!key) return undefined;
  try {
    const v = localStorage.getItem(key);
    return v === "1" ? true : v === "0" ? false : undefined;
  } catch {
    return undefined;
  }
}

export function AppShell({
  brand, items, currentPath, onNavigate, isActive, title, switcher, sidebarBody,
  collapsed: collapsedProp, defaultCollapsed = false, onCollapsedChange, collapsedStorageKey = "sf-sidebar-collapsed",
  mobile, help, search, notifications, showLanguageToggle, showThemeToggle, actions, children,
}: AppShellProps) {
  const { language, isRTL } = useLocale();
  const [collapsedState, setCollapsedState] = React.useState<boolean>(() => readBool(collapsedStorageKey) ?? defaultCollapsed);
  const collapsed = collapsedProp ?? collapsedState;
  const setCollapsed = (next: boolean) => {
    if (collapsedProp === undefined) setCollapsedState(next);
    if (collapsedStorageKey) {
      try { localStorage.setItem(collapsedStorageKey, next ? "1" : "0"); } catch { /* ignore */ }
    }
    onCollapsedChange?.(next);
  };

  const brandName = loc(brand.name, language);
  const active = deepestActive(items, currentPath);
  const pageTitle = title ? loc(title, language) : active ? loc(active.label, language) : brandName;

  return (
    <div className="sf-app flex h-dvh w-full overflow-hidden bg-background text-foreground" dir={isRTL ? "rtl" : "ltr"}>
      <Sidebar
        brand={brand} items={items} body={sidebarBody} currentPath={currentPath} onNavigate={onNavigate}
        isActive={isActive} collapsed={collapsed} onCollapsedChange={setCollapsed} switcher={switcher}
      />

      {/* The glass header OVERLAYS the content column and <main> is the one scroller, so content passes under the
          blur. `pt-14` on the scroller keeps the first row below the 56px bar. */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="absolute inset-x-0 top-0 z-50">
          <Navbar
            title={pageTitle} help={help} search={search} notifications={notifications}
            showLanguageToggle={showLanguageToggle} showThemeToggle={showThemeToggle} actions={actions}
            logo={brand.logoSrc ? { src: brand.logoSrc, alt: brandName, onClick: brand.href ? () => onNavigate(brand.href!) : undefined } : undefined}
          />
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pt-14 pb-16 md:pb-0">
          {children}
        </main>
      </div>

      <MobileNav
        items={items} currentPath={currentPath} onNavigate={onNavigate} isActive={isActive}
        brand={{ name: brand.name, logoSrc: brand.logoSrc }} exit={mobile?.exit} maxItems={mobile?.maxItems}
      />
    </div>
  );
}
