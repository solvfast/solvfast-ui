/**
 * App switcher — Sear's sidebar dropdown (StudioShell.tsx `AppSwitcher`, baseline 7abc895-dirty): a "My Workspace"
 * sub-menu listing the workspace apps by section / group, a light/dark item, and an exit row.
 *
 * Changes from Sear (VENDORED.md): sections, links and logos come from the app (`sections`, no hard-coded
 * WORKSPACE_SECTIONS or /client-s-ia URLs); BUG FIX — the current app is matched by a stable `id`
 * (Sear compared display names, "Sayr Studio" vs "Sear Studio", so it never highlighted); strings are localized
 * (Sear's were English-only); the trigger is the package Button rather than an inlined copy of its classes.
 */
import * as React from "react";
import { ChevronDown, LayoutGrid, Moon, Sun } from "lucide-react";
import { Button } from "../primitives/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "../primitives/dropdown-menu";
import { cn } from "../lib/cn";
import { useLocale, useTheme } from "../theme/ThemeProvider";
import { loc, type Localized } from "./nav";

export interface SwitcherApp {
  id: string;
  name: Localized;
  href: string;
  logoSrc?: string;
}
export interface SwitcherSection {
  title: Localized;
  items?: SwitcherApp[];
  groups?: { label: Localized; items: SwitcherApp[] }[];
}
export interface AppSwitcherProps {
  sections: SwitcherSection[];
  /** id of the app the user is in — highlighted in the list. */
  currentAppId?: string;
  /** The first row of the list (Sear: "My Workspace" → the workspace home). Omit to hide. */
  home?: { href: string; label?: Localized };
  /** The exit row at the bottom (Sear: "Back to My Workspace"). Omit to hide. */
  exit?: { href: string; label?: Localized; iconSrc?: string };
  /** Show the light/dark item (default true). */
  showThemeToggle?: boolean;
  onNavigate: (href: string) => void;
}

export function AppSwitcher({ sections, currentAppId, home, exit, showThemeToggle = true, onNavigate }: AppSwitcherProps) {
  const { language, t } = useLocale();
  const { isDark, toggleTheme } = useTheme();

  const row = (app: SwitcherApp) => {
    const isCurrent = app.id === currentAppId;
    return (
      <DropdownMenuItem key={app.id} className="gap-2.5" onSelect={() => onNavigate(app.href)} aria-current={isCurrent ? "true" : undefined}>
        {app.logoSrc && <img src={app.logoSrc} alt="" className="h-[26px] w-[26px] shrink-0 object-contain" />}
        <span className={cn("text-start", isCurrent && "font-semibold text-primary")}>{loc(app.name, language)}</span>
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("openMenu")} className="!rounded-lg text-muted-foreground hover:bg-muted">
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
            {t("myWorkspace")}
          </DropdownMenuSubTrigger>
          {/* Portaled: DropdownMenuContent scrolls, and SubContent is not portaled by default. */}
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="max-h-[82vh] w-[17rem] overflow-y-auto">
              {home && (
                <>
                  <DropdownMenuItem className="gap-2.5" onSelect={() => onNavigate(home.href)}>
                    <LayoutGrid className="h-3.5 w-3.5 text-primary" />
                    <span className="font-semibold">{home.label ? loc(home.label, language) : t("myWorkspace")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {sections.map((sec, i) => (
                <React.Fragment key={`${loc(sec.title, "en")}-${i}`}>
                  {i > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-[0.09em] text-primary">
                    {loc(sec.title, language)}
                  </DropdownMenuLabel>
                  {sec.groups
                    ? sec.groups.map((grp, gi) => (
                        <React.Fragment key={`${loc(grp.label, "en")}-${gi}`}>
                          {gi > 0 && <DropdownMenuSeparator />}
                          <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                            {loc(grp.label, language)}
                          </DropdownMenuLabel>
                          {grp.items.map(row)}
                        </React.Fragment>
                      ))
                    : sec.items?.map(row)}
                </React.Fragment>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {showThemeToggle && (
          <DropdownMenuItem className="gap-2" onSelect={() => toggleTheme()}>
            {isDark ? <Sun className="h-3.5 w-3.5 text-muted-foreground" /> : <Moon className="h-3.5 w-3.5 text-muted-foreground" />}
            {isDark ? t("lightMode") : t("darkMode")}
          </DropdownMenuItem>
        )}

        {exit && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2" onSelect={() => onNavigate(exit.href)}>
              {exit.iconSrc && <img src={exit.iconSrc} alt="" className="h-[18px] w-[18px] object-contain" />}
              {exit.label ? loc(exit.label, language) : t("backToWorkspace")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
