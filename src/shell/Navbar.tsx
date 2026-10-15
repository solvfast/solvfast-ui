/**
 * Top bar — Sear's StudioShell `TopBar` (baseline 7abc895-dirty): airy glass pane, page title, a help slot, search,
 * notifications, language and theme toggles; the brand logo shows on mobile only (the sidebar holds it on desktop).
 *
 * Changes from Sear (VENDORED.md): title / help / search / notifications are props instead of Sear routes, its
 * HEADER_HELP map and its notification store; works without a provider (BUG FIX — Sear's TopBar crashed outside its
 * AppProvider); aria-labels localized (Sear's were English-only).
 */
import * as React from "react";
import { Globe, Moon, Search, Sun } from "lucide-react";
import { Button } from "../primitives/button";
import { Input } from "../primitives/input";
import { useLocale, useTheme } from "../theme/ThemeProvider";
import { NotificationPanel, type NotificationPanelProps } from "./NotificationPanel";

export interface NavbarSearch {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Enter pressed. */
  onSubmit?: (value: string) => void;
  placeholder?: string;
}

export interface NavbarProps {
  title: React.ReactNode;
  /** Shown next to the title (Sear: the page's "ⓘ Need help" affordance). */
  help?: React.ReactNode;
  /** Mobile-only brand logo (desktop shows it in the sidebar). */
  logo?: { src: string; alt: string; onClick?: () => void };
  /**
   * Search box. Default: Sear's search input with no behaviour. Pass an object to make it controlled, a node to
   * replace it, or `false` to hide it.
   */
  search?: NavbarSearch | React.ReactNode | false;
  /** Bell + panel props, a custom node, or `false` (default: hidden). */
  notifications?: NotificationPanelProps | React.ReactNode | false;
  showLanguageToggle?: boolean;
  showThemeToggle?: boolean;
  /** Extra controls after the built-in ones. */
  actions?: React.ReactNode;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !React.isValidElement(v) && !Array.isArray(v);

export function Navbar({
  title, help, logo, search, notifications = false, showLanguageToggle = true, showThemeToggle = true, actions,
}: NavbarProps) {
  const { t, toggleLanguage } = useLocale();
  const { isDark, toggleTheme } = useTheme();

  let searchEl: React.ReactNode = null;
  if (search === undefined || isPlainObject(search)) {
    const s = (search ?? {}) as NavbarSearch;
    searchEl = (
      <div className="relative hidden md:block">
        <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder={s.placeholder ?? t("search")}
          aria-label={s.placeholder ?? t("search")}
          value={s.value}
          defaultValue={s.defaultValue}
          onChange={s.onChange ? (e) => s.onChange!(e.target.value) : undefined}
          onKeyDown={s.onSubmit ? (e) => { if (e.key === "Enter") s.onSubmit!((e.target as HTMLInputElement).value); } : undefined}
          className=" w-48 ps-8 text-sm bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
    );
  } else if (search !== false) {
    searchEl = <div className="hidden md:block">{search as React.ReactNode}</div>;
  }

  let notificationsEl: React.ReactNode = null;
  if (isPlainObject(notifications) && Array.isArray((notifications as NotificationPanelProps).items)) {
    notificationsEl = <NotificationPanel {...(notifications as NotificationPanelProps)} />;
  } else if (notifications !== false) {
    notificationsEl = notifications as React.ReactNode;
  }

  return (
    <div className="sf-glass-pane sf-glass-pane--airy  sticky top-0 z-50 h-14 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-2 min-w-0">
        {logo && (
          <button type="button" onClick={logo.onClick} aria-label={logo.alt} className="md:hidden shrink-0 hover:opacity-80 transition-opacity">
            <img src={logo.src} alt={logo.alt} className="h-8 w-8 object-contain" />
          </button>
        )}
        <h1 className="text-lg font-medium text-foreground truncate">{title}</h1>
        {help}
      </div>
      <div className="flex items-center gap-1">
        {searchEl}
        {notificationsEl}
        {showLanguageToggle && (
          <Button variant="ghost" size="icon-sm" onClick={toggleLanguage} className="!rounded-lg text-muted-foreground hover:bg-muted" aria-label={t("toggleLanguage")}>
            <Globe className="h-4 w-4" />
          </Button>
        )}
        {showThemeToggle && (
          <Button variant="ghost" size="icon-sm" onClick={toggleTheme} className="!rounded-lg text-muted-foreground hover:bg-muted" aria-label={t("toggleTheme")}>
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        )}
        {actions}
      </div>
    </div>
  );
}
