/**
 * App shell — Sear's StudioShell layout (sear_studio_app/StudioShell.tsx, baseline 7abc895-dirty): Sidebar + glass
 * top bar overlaying the content column + one scrolling <main> + mobile bottom navigation, on the `sf-app` surface
 * (flat background in light, Sear's aurora in dark).
 *
 * Everything app-specific is a prop: brand, navigation, routing (`currentPath` + `onNavigate`), switcher sections,
 * notifications, help, search. No router, no app data. The rail state persists under `collapsedStorageKey`
 * (Sear: "studio_sidebar_collapsed").
 * 0.3.0: a PageHeader inside the shell publishes its title to the top bar (Sear's one-title pattern); `mobile.primary`
 * picks the mobile bar's items. Neither changes anything when unused.
 */
import * as React from "react";
import { useLocale, useTheme } from "../theme/ThemeProvider";
import { ShellTitleContext, useShellTitleHost } from "../primitives/page-header";
import { MobileNav, type MobileNavProps } from "./MobileNav";
import { Navbar, type NavbarProps } from "./Navbar";
import { WorkspaceBackdrop } from "../theme/WorkspaceBackdrop";
import type { WorkspaceBackground } from "../theme/workspaceBackground";
import { Sidebar, type ShellBrand, type SidebarProps } from "./Sidebar";
import { deepestActive, loc, type IsActive, type Localized, type NavItem } from "./nav";

export interface AppShellProps
  extends Pick<NavbarProps, "help" | "search" | "notifications" | "showLanguageToggle" | "showThemeToggle" | "actions" | "companyLogo" | "user"> {
  brand: ShellBrand;
  items: NavItem[];
  currentPath: string;
  onNavigate: (href: string, item?: NavItem) => void;
  isActive?: IsActive;
  /** Fixed page title (wins over everything); default: the title of a mounted `PageHeader`, else the deepest active
   *  item's label, else the brand name. */
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
  /** Mobile bottom-nav options (`primary`: the bar's items — see MobileNavProps). */
  mobile?: Pick<MobileNavProps, "maxItems" | "exit" | "primary">;
  /** 0.7.0-dev.7: a workspace background behind the sidebar and pages (over the dark aurora). Page roots stay clear. */
  background?: WorkspaceBackground;
  /** Run 1 (A-29, WCAG 2.4.2): the browser tab's title follows the page — default "{page title} · {brand}" (Desk
   *  page.js:747-764 / toolbar.js:71-74 set it per page); a function builds it; `false` leaves `document.title` alone.
   *  The previous title is restored when the shell unmounts. */
  documentTitle?: boolean | ((pageTitle: string, brand: string) => string);
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
  mobile, help, search, notifications, showLanguageToggle, showThemeToggle, actions, companyLogo, user, background, documentTitle = true, children,
}: AppShellProps) {
  const { language, isRTL, t } = useLocale();
  const mainId = React.useId();
  const mainRef = React.useRef<HTMLElement>(null);
  const { isDark } = useTheme();
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
  const [publishedTitle, titleApi] = useShellTitleHost();
  const pageTitle = title ? loc(title, language)
    : publishedTitle ? loc(publishedTitle, language)
    : active ? loc(active.label, language) : brandName;

  // Run 1 A-29: the tab title follows the page; restored on unmount (the restore effect is declared first so it reads
  // the title from before the shell set it)
  const titleFn = typeof documentTitle === "function" ? documentTitle : null;
  React.useEffect(() => {
    if (documentTitle === false || typeof document === "undefined") return;
    const before = document.title;
    return () => { document.title = before; };
  }, [documentTitle === false]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (documentTitle === false || typeof document === "undefined") return;
    const next = titleFn ? titleFn(pageTitle, brandName) : pageTitle && pageTitle !== brandName ? `${pageTitle} · ${brandName}` : brandName;
    if (next) document.title = next;
  }, [documentTitle, titleFn, pageTitle, brandName]);

  return (
    <div className={`sf-app flex h-dvh w-full overflow-hidden bg-background text-foreground${background ? " relative isolate" : ""}`} dir={isRTL ? "rtl" : "ltr"}>
      {/* Behind everything in the shell's own stacking context: above its background (and the dark aurora), below the
          sidebar and pages. In dark the colours sit on the aurora instead of their own base, as on Sayr's home page. */}
      {background && <WorkspaceBackdrop bg={background} isDark={isDark} base={isDark ? "transparent" : undefined} className="-z-10" />}
      {/* Run 1 A-28 (WCAG 2.4.1): the first Tab stop (after the decorative backdrop, which takes no focus) skips the navigation; it focuses <main> without touching the URL
          (the app's router owns it) */}
      <a href={`#${mainId}`} onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }} data-skip-link=""
        className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring">
        {t("skipToContent")}
      </a>
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
            companyLogo={companyLogo} user={user}
            logo={brand.logoSrc ? { src: brand.logoSrc, alt: brandName, onClick: brand.href ? () => onNavigate(brand.href!) : undefined } : undefined}
          />
        </div>
        <main ref={mainRef} id={mainId} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none overflow-x-hidden overscroll-contain pt-14 pb-16 md:pb-0">
          <ShellTitleContext.Provider value={titleApi}>{children}</ShellTitleContext.Provider>
        </main>
      </div>

      <MobileNav
        items={items} currentPath={currentPath} onNavigate={onNavigate} isActive={isActive}
        brand={{ name: brand.name, logoSrc: brand.logoSrc }} exit={mobile?.exit} maxItems={mobile?.maxItems} primary={mobile?.primary}
      />
    </div>
  );
}
