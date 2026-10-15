import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, Globe, Moon, Sun, Search,
  LayoutGrid, ArrowLeftToLine, ArrowRightToLine, MoreHorizontal, ArrowLeft,
} from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';

// ServeFast primitives (copied tree, reused unchanged)
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import workspaceLogo from '@sear/assets/source-logos/my-workspace.svg';

// In-app guidance — feature-level help in the page header (Plan 0179)
import { FeatureHelp } from '@sear/components/daleel/FieldHelp';
import NotificationCenter from '@sear/components/NotificationCenter';

// Map a nav item's `to` path → its Daleel feature-header surface anchor (so the header shows ⓘ + Need help).
const HEADER_HELP: Record<string, string> = {
  // Sayr Studio modules
  '/life_cycles': 'sear_studio.surface.lifecycles_list',
  '/sla_policy': 'sear_studio.surface.sla_policy',
  '/assignment_profile': 'sear_studio.surface.assignment_profile',
  '/service_module': 'sear_studio.surface.surveys',
  '/workflow_components': 'sear_studio.surface.workflow_components',
  '/calendars': 'sear_studio.surface.calendars',
  '/connectors': 'sear_studio.surface.connectors',
  '/channels': 'sear_studio.surface.channels',
  '/field_library': 'sear_studio.surface.field_library',
  '/message_templates': 'sear_studio.surface.message_templates',
  '/notifications': 'sear_studio.surface.notifications',
  '/playbooks': 'playbooks.surface.playbooks',
  '/routing': 'sear_studio.surface.routing',
  // Senaiy-Pedia
  '/knowledge_base': 'senaiypedia.surface.knowledge_base',
  '/lifecycle': 'sear_studio.surface.lifecycles_list',
  '/workflows': 'sear_studio.surface.workflow_builder',
  // Playbooks (KnowledgeHubShell uses absolute nav `to` paths)
  '/workspace/knowledge/playbooks': 'playbooks.surface.playbooks',
  '/workspace/knowledge/playbooks/configuration/life_cycles': 'sear_studio.surface.lifecycles_list',
  '/workspace/knowledge/playbooks/configuration/workflows': 'sear_studio.surface.workflow_builder',
};

// This app's own providers
import { useLanguage } from '../shared/i18n/LanguageProvider';
import { useTheme } from '../shared/theme/ThemeProvider';
import { WORKSPACE_SECTIONS } from '../shared/injection/binaDropdown';

// ─────────────────────────────────────────────────────────────────────────────
// Shared shell used by BOTH Sayr Studio and the Knowledge Hub apps so the two
// frames are guaranteed identical: sidebar (brand + app-switcher dropdown + nav
// + collapse toggle) + top bar (title + search + globe + theme) + content slot.
// Scopes `.sear-studio` so the ported ServeFast design tokens apply.
// ─────────────────────────────────────────────────────────────────────────────

export type NavItem = {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  en: string;
  ar: string;
  children?: NavItem[];
  /**
   * Absolute path prefixes under which this item should NOT be considered active,
   * even though they're nested under its `to`. Use when a sibling owns a deeper
   * sub-tree (e.g. a base "list" item vs. a "/configuration" sibling) so the base
   * item doesn't stay highlighted while you're in the sibling's pages.
   */
  exclude?: string[];
};

export type StudioShellProps = {
  /** Brand wordmark — English label. */
  brandLabel: string;
  /** Brand wordmark — Arabic label (optional; falls back to brandLabel). */
  brandLabelAr?: string;
  /** Brand mark icon (lucide-style component). */
  brandIcon: React.ComponentType<{ className?: string }>;
  /** When true, render brandIcon as-is (e.g. a logo image) WITHOUT the gradient
   *  tile wrapper. Default false = the gradient tile (Sayr Studio / SenaiyPedia). */
  brandIconBare?: boolean;
  /** Optional wide brand logo (image with the app name baked in). When set, the sidebar
   *  brand area renders THIS instead of the icon + wordmark text. */
  brandLogoWide?: string;
  /** Bare image logo (URL) rendered beside the wordmark (w-11 h-11 by default, like the
   *  ServeFast apps). Use for the illustrated source-app logos. Keeps the wordmark. */
  brandLogoSrc?: string;
  /** Size class for `brandLogoSrc` (default 'w-11 h-11'). */
  brandLogoClassName?: string;
  /** Class for the brand wordmark text (default `text-foreground`; pass violet to match
   *  the ServeFast app sidebars). */
  brandLabelClassName?: string;
  /** Sidebar nav items. `to` may be absolute (`/workspace/...`) or a basePath segment.
   *  Optional when `sidebarBody` is provided (a fully custom sidebar body). */
  navItems?: NavItem[];
  /** Prefix for relative `to` segments + active-state matching (e.g. Sayr Studio base). */
  basePath?: string;
  /** App name to highlight as "current" inside the workspace flyout. */
  currentAppName?: string;
  /** Where the red "Logout" row navigates (default `/workspace`). E.g. the Sada
   *  apps page for the Sada apps. */
  logoutTo?: string;
  /** Label for the exit row (default "Back to My Workspace"; package apps pass e.g.
   *  "Back to Sada"). */
  logoutLabel?: string;
  /** Fixed top-bar title (English) — overrides the navItems-derived title. */
  title?: string;
  /** Fixed top-bar title (Arabic; falls back to `title`). */
  titleAr?: string;
  /** Custom sidebar content rendered below the logo+divider, in place of navItems. */
  sidebarBody?: React.ReactNode;
  /** Custom functional search node for the top bar (replaces the decorative input). */
  headerSearch?: React.ReactNode;
  /** Replaces the default workspace AppSwitcher in the sidebar brand row (e.g. a
   *  package-scoped switcher like Sada's). */
  headerSwitcher?: React.ReactNode;
  /** Content (Sayr Studio passes <Outlet/>; Knowledge Hub passes the page). */
  children: React.ReactNode;
};

// Resolve a nav `to` into a real router path. Absolute `/workspace/...` paths are
// used as-is; everything else is prefixed by basePath (Sayr Studio segments).
const resolvePath = (to: string, basePath: string): string => {
  // No basePath → `to` is already an absolute path (Knowledge Hub uses /workspace/...).
  if (!basePath) return to;
  // Already prefixed (defensive).
  if (to === basePath || to.startsWith(`${basePath}/`)) return to;
  // Otherwise `to` is a segment under the app's base (Sayr Studio: /sla_policy → base/sla_policy).
  return `${basePath}${to}`;
};

// Active when the current pathname equals the resolved path or is nested under it.
const isPathActive = (pathname: string, full: string): boolean =>
  pathname === full || pathname.startsWith(full + '/');

const leafClasses = (active: boolean, collapsed: boolean) =>
  `w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
    collapsed ? 'justify-center' : ''
  } ${active ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted font-light'}`;

const SidebarItem: React.FC<{
  item: NavItem; isRTL: boolean; basePath: string; collapsed: boolean;
}> = ({ item, isRTL, basePath, collapsed }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const full = resolvePath(item.to, basePath);
  // A parent is "active" when its own path matches OR any of its children match
  // (so a group whose `to` is just an accordion anchor still auto-opens).
  const childActive = !!item.children?.some((c) => isPathActive(pathname, resolvePath(c.to, basePath)));
  // An item can opt out of activation under deeper sibling sub-trees (e.g. a base
  // "list" item shouldn't stay active while you're in its "/configuration" sibling).
  const excluded = !!item.exclude?.some((ex) => isPathActive(pathname, resolvePath(ex, basePath)));
  const active = !excluded && (isPathActive(pathname, full) || childActive);

  // Collapsible parent (e.g. Calendars → Working Hours / Holidays). When the rail
  // is collapsed we still navigate to the parent on click (no flyout submenu).
  if (item.children && item.children.length && !collapsed) {
    return <SidebarGroup item={item} isRTL={isRTL} basePath={basePath} parentActive={active} />;
  }

  const label = isRTL ? item.ar : item.en;
  const inner = (
    <button
      onClick={() => navigate(full)}
      className={leafClasses(active, collapsed)}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
    >
      <item.icon className="h-4 w-4 flex-shrink-0" />
      {!collapsed && <span className="whitespace-nowrap">{label}</span>}
    </button>
  );
  if (!collapsed) return inner;
  // DS Sidebar: the collapsed rail labels items with a Tooltip, not a title attribute,
  // and the tooltip side follows direction.
  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side={isRTL ? 'left' : 'right'}>{label}</TooltipContent>
    </Tooltip>
  );
};

const SidebarGroup: React.FC<{
  item: NavItem; isRTL: boolean; basePath: string; parentActive: boolean;
}> = ({ item, isRTL, basePath, parentActive }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(parentActive);
  useEffect(() => { if (parentActive) setOpen(true); }, [parentActive]);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={leafClasses(parentActive, false)}
      >
        <item.icon className="h-4 w-4 flex-shrink-0" />
        <span className="whitespace-nowrap flex-1 text-start">{isRTL ? item.ar : item.en}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? '' : '-rotate-90 rtl:rotate-90'}`} />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5 ps-5">
          {item.children!.map(child => {
            const cfull = resolvePath(child.to, basePath);
            const cactive = isPathActive(pathname, cfull);
            return (
              <button
                key={child.to}
                onClick={() => navigate(cfull)}
                aria-current={cactive ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                  cactive ? 'text-primary font-medium' : 'text-foreground hover:bg-muted font-light'
                }`}
              >
                <child.icon className="h-4 w-4 flex-shrink-0" />
                <span className="whitespace-nowrap">{isRTL ? child.ar : child.en}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// App-switcher dropdown — a faithful React replica of the Organization Structure
// dropdown (binaDropdown.js): a "My Workspace" row that opens a grouped flyout of
// all workspace apps (sections + sub-groups, in order), a Dark Mode toggle, and a
// the exit row ("Back to My Workspace", or a package's "Back to …"). Uses explicit colors + fixed positioning so it is
// never transparent (CSS tokens don't reach portals) and never clipped.

// Portable theme access so <AppSwitcher /> can be reused OUTSIDE the Sayr Studio
// shell (e.g. the ServeFast launcher header, which lives in a different provider
// tree). When the shared ThemeProvider IS present we use it as-is; otherwise we
// fall back to the same persistence the provider uses (`bina_theme` localStorage
// + the `bina:toggle-dark` window event + the `dark` class on <html>), so the
// dropdown stays identical and never crashes on a missing provider.
function usePortableTheme(): { theme: string; toggleTheme: () => void } {
  const ctx = useTheme(); // useContext — returns undefined when no provider
  const [fallbackTheme, setFallbackTheme] = useState<string>(() => {
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) return 'dark';
    return (typeof localStorage !== 'undefined' && localStorage.getItem('bina_theme')) || 'light';
  });
  if (ctx) return ctx;
  return {
    theme: fallbackTheme,
    toggleTheme: () => {
      const next = fallbackTheme === 'dark' ? 'light' : 'dark';
      setFallbackTheme(next);
      try { localStorage.setItem('bina_theme', next); } catch {}
      document.documentElement.classList.toggle('dark', next === 'dark');
      window.dispatchEvent(new Event('bina:toggle-dark'));
    },
  };
}

export const AppSwitcher: React.FC<{ currentAppName?: string; logoutTo?: string; logoutLabel?: string }> = ({ currentAppName, logoutTo = '/workspace', logoutLabel = 'Back to My Workspace' }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = usePortableTheme();
  const isDark = theme === 'dark';

  // Navigation behaviour is unchanged: the ported WORKSPACE_SECTIONS urls are still
  // stripped of their /client-s-ia prefix. (Those targets are a separate product question.)
  const goto = (url: string) => navigate(url.replace(/^\/client-s-ia/, ''));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Open menu"
          className='group relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-[180ms] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:!translate-y-0 active:duration-[120ms] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 glass glass--interactive glass--clear size-8 rounded-full !rounded-lg text-muted-foreground hover:bg-muted'
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
            My Workspace
          </DropdownMenuSubTrigger>
          {/* Portaled: DropdownMenuContent has overflow-y-auto, and SubContent is not
              portaled by default, so without this the flyout is clipped inside it. */}
          <DropdownMenuPortal>
          <DropdownMenuSubContent className="max-h-[82vh] w-[17rem] overflow-y-auto">
            <DropdownMenuItem className="gap-2.5" onSelect={() => goto('/workspace')}>
              <LayoutGrid className="h-3.5 w-3.5 text-primary" />
              <span className="font-semibold">My Workspace</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {WORKSPACE_SECTIONS.map((sec: any, i: number) => (
              <React.Fragment key={sec.title}>
                {i > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-[0.09em] text-primary">
                  {sec.title}
                </DropdownMenuLabel>
                {sec.groups
                  ? sec.groups.map((grp: any, gi: number) => (
                      <React.Fragment key={grp.label}>
                        {gi > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                          {grp.label}
                        </DropdownMenuLabel>
                        {grp.items.map((item: any) => (
                          <FlyoutAppRow key={item.url} item={item} currentAppName={currentAppName} onClick={goto} />
                        ))}
                      </React.Fragment>
                    ))
                  : sec.items.map((item: any) => (
                      <FlyoutAppRow key={item.url} item={item} currentAppName={currentAppName} onClick={goto} />
                    ))}
              </React.Fragment>
            ))}
          </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuItem className="gap-2" onSelect={() => toggleTheme()}>
          {isDark
            ? <Sun className="h-3.5 w-3.5 text-muted-foreground" />
            : <Moon className="h-3.5 w-3.5 text-muted-foreground" />}
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* A navigation action (not a logout) — apps may override the target/label. */}
        <DropdownMenuItem className="gap-2" onSelect={() => navigate(logoutTo)}>
          <img src={workspaceLogo} alt="" className="h-[18px] w-[18px] object-contain" />
          {logoutLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const FlyoutAppRow: React.FC<{ item: any; currentAppName?: string; onClick: (url: string) => void }> = ({ item, currentAppName, onClick }) => {
  const isCurrent = !!currentAppName && item.name === currentAppName;
  return (
    <DropdownMenuItem className="gap-2.5" onSelect={() => onClick(item.url)}>
      <img src={item.logo} alt="" className="h-[26px] w-[26px] shrink-0 object-contain" />
      <span className={cn('text-start', isCurrent && 'font-semibold text-primary')}>{item.name}</span>
    </DropdownMenuItem>
  );
};

// TopBar mirrors ServeFast's TopBar: active-section title + search + globe + theme.
// Title is derived from the deepest matching nav item (so a child page shows its
// own title), falling back to the brand label.
const TopBar: React.FC<{
  navItems: NavItem[]; basePath: string; brandLabel: string; brandLabelAr?: string;
  titleOverride?: string; titleOverrideAr?: string; headerSearch?: React.ReactNode;
  brandLogoSrc?: string; logoTo?: string;
}> = ({ navItems, basePath, brandLabel, brandLabelAr, titleOverride, titleOverrideAr, headerSearch, brandLogoSrc, logoTo }) => {
  const { pathname } = useLocation();
  const { lang, toggleLang } = useLanguage();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isRTL = lang === 'ar';
  const isDark = theme === 'dark';

  const flat: NavItem[] = navItems.flatMap(i => i.children ? [i, ...i.children] : [i]);
  const matches = flat.filter(i => isPathActive(pathname, resolvePath(i.to, basePath)));
  const active = matches.sort((a, b) => resolvePath(b.to, basePath).length - resolvePath(a.to, basePath).length)[0];
  const fallback = isRTL ? (brandLabelAr || brandLabel) : brandLabel;
  const title = titleOverride
    ? (isRTL ? (titleOverrideAr || titleOverride) : titleOverride)
    : (active ? (isRTL ? active.ar : active.en) : fallback);

  // App header — LIQUID `.glass` (engine.css:85), matching the popover/menu surfaces.
  // NOTE this is a deliberate deviation: the DS integration rule (StyleGuide.tsx:4343) assigns
  // `.glass-bar` to the app header, a flat pane tier. `.glass` is the liquid control tier —
  // more translucent (12% vs 22%) with an 8-layer bevel + lift. Requested explicitly.
  // Side effect: the pane tiers are force-solid below 640px (glass.css:148) but `.glass` is
  // NOT, so the header now keeps its blur on mobile where `.glass-bar` would have gone solid.
  // `border-b` / `shadow-sm` are dropped — `.glass` supplies its own bevel and lift.
  return (
    <div className="glass-pane glass-pane--airy  sticky top-0 z-50 h-14 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-2 min-w-0">
        {/* Mobile-only brand logo (the sidebar that normally holds it is hidden on mobile). */}
        {brandLogoSrc && (
          <button type="button" onClick={() => navigate(logoTo || '/workspace')} aria-label={brandLabel}
            className="md:hidden shrink-0 hover:opacity-80 transition-opacity">
            <img src={brandLogoSrc} alt={brandLabel} className="h-8 w-8 object-contain" />
          </button>
        )}
        <h1 className="text-lg font-medium text-foreground truncate">{title}</h1>
        {active && HEADER_HELP[active.to] && <FeatureHelp anchor={HEADER_HELP[active.to]} />}
      </div>
      <div className="flex items-center gap-1">
        {headerSearch ? (
          <div className="hidden md:block">{headerSearch}</div>
        ) : (
        <div className="relative hidden md:block">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={isRTL ? 'بحث...' : 'Search...'}
            className=" w-48 ps-8 text-sm bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        )}
        <NotificationCenter isRTL={isRTL} />
        <Button variant="ghost" size="icon-sm" onClick={toggleLang} className="!rounded-lg text-muted-foreground hover:bg-muted" aria-label="Toggle language">
          <Globe className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={toggleTheme} className="!rounded-lg text-muted-foreground hover:bg-muted" aria-label="Toggle theme">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

// Mobile bottom nav (md:hidden) — mirrors the Omnichannels reference: the key modules
// plus a "More" sheet holding the overflow modules and the Back-to-package/workspace
// action. Solid bg (no backdrop-blur) per the house perf rules.
const StudioMobileNav: React.FC<{
  navItems: NavItem[]; basePath: string; brandLabel: string; brandLabelAr?: string;
  brandLogoSrc?: string; logoutTo?: string; logoutLabel?: string; isRTL: boolean;
}> = ({ navItems, basePath, brandLabel, brandLabelAr, brandLogoSrc, logoutTo, logoutLabel, isRTL }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  if (!navItems.length) return null;
  // Leaves fill the bottom bar (first 4); parent items (with sub-tabs) always go to "More".
  const leaves = navItems.filter((i) => !(i.children && i.children.length));
  const parents = navItems.filter((i) => i.children && i.children.length);
  const primary = leaves.slice(0, 4);
  const overflow = [...leaves.slice(4), ...parents];
  const backTo = logoutTo || '/workspace';
  const backLabel = logoutLabel || (isRTL ? 'العودة إلى مساحة العمل' : 'Back to My Workspace');
  const overflowActive = overflow.some((i) => isPathActive(pathname, resolvePath(i.to, basePath)));
  const go = (to: string) => { setMoreOpen(false); navigate(resolvePath(to, basePath)); };
  return (
    <>
      {/* Mobile bottom nav — DS `.glass-subtle` (the GlassDock tier). Measured on the live DS:
          bg 14% grey, backdrop blur(8px) saturate(1.56). Kept edge-to-edge rather than the DS's
          floating rounded dock, so the safe-area padding and full-width hit targets are
          unchanged; only the surface becomes glass. */}
      <nav className="glass-pane glass-pane--airy  !fixed inset-x-0 bottom-0 z-50 md:hidden pb-[env(safe-area-inset-bottom,6px)]">
        <div className="flex h-16 items-stretch justify-between gap-0.5 px-1">
          {primary.map((item) => {
            const active = isPathActive(pathname, resolvePath(item.to, basePath));
            const Icon: any = item.icon;
            return (
              <button key={item.to} onClick={() => go(item.to)}
                className={`flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors ${active ? 'text-brand-flame font-medium' : 'text-muted-foreground'}`}>
                {Icon && <Icon className="h-5 w-5 shrink-0" />}
                <span className="max-w-full truncate text-[10px] leading-none">{isRTL ? item.ar : item.en}</span>
              </button>
            );
          })}
          <button onClick={() => setMoreOpen(true)}
            className={`flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors ${overflowActive ? 'text-brand-flame font-medium' : 'text-muted-foreground'}`}>
            <MoreHorizontal className="h-5 w-5 shrink-0" />
            <span className="text-[10px] leading-none">{isRTL ? 'المزيد' : 'More'}</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        {/* `sear-studio` must be repeated here: SheetContent is wrapped in a Radix Portal, so it
            renders under document.body and does NOT inherit the `.sear-studio` scope that the
            shell's root div establishes. Without it the studio accent vars (--brand-flame etc.,
            defined only under `.sear-studio` in sear-studio.css) are undefined inside the sheet
            and the active nav row renders with no colour at all. */}
        <SheetContent side={isRTL ? 'right' : 'left'} className="sear-studio flex w-72 flex-col pb-8 pt-4">
          <div className="flex items-center gap-3 px-3 pb-3">
            {brandLogoSrc && <img src={brandLogoSrc} alt="" className="h-9 w-9 object-contain shrink-0" />}
            <span className="text-base font-semibold leading-tight text-brand-violet">
              {isRTL ? (brandLabelAr || brandLabel) : brandLabel}
            </span>
          </div>
          <div className="h-px bg-border mb-2" />
          <div className="flex-1 space-y-1 overflow-y-auto">
            {overflow.map((item) => {
              const active = isPathActive(pathname, resolvePath(item.to, basePath));
              const Icon: any = item.icon;
              return (
                <button key={item.to} onClick={() => go(item.to)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors ${active ? 'bg-brand-flame/10 text-brand-flame font-medium' : 'text-foreground hover:bg-muted'}`}>
                  {Icon && <Icon className="h-5 w-5 shrink-0" />}
                  <span>{isRTL ? item.ar : item.en}</span>
                </button>
              );
            })}
          </div>
          <div className="h-px bg-border my-2" />
          <button onClick={() => { setMoreOpen(false); navigate(backTo); }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted">
            <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
            <span>{backLabel}</span>
          </button>
        </SheetContent>
      </Sheet>
    </>
  );
};

export const StudioShell: React.FC<StudioShellProps> = ({
  brandLabel, brandLabelAr, brandIcon: BrandIcon, brandIconBare = false, brandLogoWide,
  brandLogoSrc, brandLogoClassName = 'w-11 h-11', brandLabelClassName = 'text-foreground', navItems = [], basePath = '',
  currentAppName, title, titleAr, sidebarBody, headerSearch, headerSwitcher, children, logoutTo, logoutLabel,
}) => {
  const { lang } = useLanguage();
  const isRTL = lang === 'ar';
  const navigate = useNavigate();
  // Where the brand logo navigates: the app's parent (package apps page for a package
  // app, e.g. Sada → /workspace/packages/sada; else the workspace home).
  const logoTo = logoutTo || '/workspace';

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('studio_sidebar_collapsed') === '1'; } catch { return false; }
  });
  const toggleCollapsed = () => setCollapsed(c => {
    const next = !c;
    try { localStorage.setItem('studio_sidebar_collapsed', next ? '1' : '0'); } catch { /* ignore */ }
    return next;
  });

  const CollapseIcon = collapsed
    ? (isRTL ? ArrowLeftToLine : ArrowRightToLine)
    : (isRTL ? ArrowRightToLine : ArrowLeftToLine);

  return (
    <div className="sear-studio flex h-dvh w-full overflow-hidden bg-background text-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
      <aside className={`hidden md:flex ${collapsed ? 'w-16' : 'w-64'} flex-col bg-sidebar border-e border-border transition-[width] duration-200`}>
        {/* Logo section: brand mark + wordmark + app-switcher dropdown.
            Fixed h-14 so its bottom border lines up exactly with the TopBar's h-14 divider. */}
        <div className={`flex items-center gap-2 min-h-14 px-3 border-b border-border ${collapsed ? 'justify-center' : ''}`}>
          {collapsed ? (
            <button type="button" onClick={() => navigate(logoTo)} aria-label={brandLabel} className="hover:opacity-80 transition-opacity">
              {brandLogoSrc ? (
                <img src={brandLogoSrc} alt={brandLabel} className={`${brandLogoClassName} shrink-0 object-contain`} />
              ) : brandLogoWide ? (
                <img src={brandLogoWide} alt={brandLabel} className="h-9 w-9 shrink-0 object-contain" />
              ) : brandIconBare ? (
                <BrandIcon className="w-9 h-9 rounded-lg shrink-0 object-contain" />
              ) : (
                <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center bg-gradient-to-br from-brand-flame to-brand-violet text-white">
                  <BrandIcon className="h-5 w-5" />
                </div>
              )}
            </button>
          ) : (
            <>
              {brandLogoWide ? (
                // Wide brand logo (name baked in) replaces the icon + wordmark.
                <><img src={brandLogoWide} alt={brandLabel} className="h-10 w-auto max-w-[190px] min-w-0 object-contain" /><span className="flex-1" /></>
              ) : (
                <button type="button" onClick={() => navigate(logoTo)} aria-label={brandLabel}
                  className="flex items-center gap-2.5 flex-1 min-w-0 text-start hover:opacity-80 transition-opacity">
                  {brandLogoSrc ? (
                    <img src={brandLogoSrc} alt={brandLabel} className={`${brandLogoClassName} object-contain shrink-0`} />
                  ) : brandIconBare ? (
                    <BrandIcon className="w-9 h-9 rounded-lg shrink-0 object-contain" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center bg-gradient-to-br from-brand-flame to-brand-violet text-white">
                      <BrandIcon className="h-5 w-5" />
                    </div>
                  )}
                  <span className={`text-base font-semibold leading-tight ${brandLabelClassName}`}>
                    {isRTL ? (brandLabelAr || brandLabel) : brandLabel}
                  </span>
                </button>
              )}
              {headerSwitcher ?? <AppSwitcher currentAppName={currentAppName} logoutTo={logoutTo} logoutLabel={logoutLabel} />}
            </>
          )}
        </div>

        {sidebarBody ? (
          // Custom sidebar body (e.g. the Senaiy-Pedia tree). Hidden when collapsed.
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {!collapsed && sidebarBody}
          </div>
        ) : (
          <TooltipProvider delayDuration={100}>
            <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
              {navItems.map(item => (
                <SidebarItem key={item.to} item={item} isRTL={isRTL} basePath={basePath} collapsed={collapsed} />
              ))}
            </nav>
          </TooltipProvider>
        )}

        {/* Collapse toggle */}
        <div className="px-2 py-3 border-t border-border">
          <button
            onClick={toggleCollapsed}
            aria-pressed={collapsed}
            aria-label={collapsed ? (isRTL ? 'توسيع الشريط الجانبي' : 'Expand sidebar') : (isRTL ? 'طي الشريط الجانبي' : 'Collapse sidebar')}
            title={collapsed ? (isRTL ? 'توسيع' : 'Expand') : (isRTL ? 'طي' : 'Collapse')}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-light ${collapsed ? 'justify-center' : 'justify-start'}`}
          >
            <CollapseIcon className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span className="whitespace-nowrap">{isRTL ? 'طي' : 'Collapse'}</span>}
          </button>
        </div>
      </aside>

      {/* The glass header OVERLAYS the content column, and <main> is the ONE scroller for the
          page. `pt-14` lives on the scroller itself, so it scrolls WITH the content: the page
          starts below the 56px bar and then passes underneath it. That is what makes
          `.glass-bar` read as glass — a backdrop-blur needs moving content behind it.
          Pages must therefore NOT declare their own `flex-1 min-h-0 overflow-auto` region. */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="absolute inset-x-0 top-0 z-50">
          <TopBar navItems={navItems} basePath={basePath} brandLabel={brandLabel} brandLabelAr={brandLabelAr}
            titleOverride={title} titleOverrideAr={titleAr} headerSearch={headerSearch}
            brandLogoSrc={brandLogoSrc} logoTo={logoTo} />
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pt-14 pb-16 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav — the sidebar is hidden on mobile, so this carries navigation. */}
      <StudioMobileNav
        navItems={navItems} basePath={basePath}
        brandLabel={brandLabel} brandLabelAr={brandLabelAr} brandLogoSrc={brandLogoSrc}
        logoutTo={logoutTo} logoutLabel={logoutLabel} isRTL={isRTL}
      />
    </div>
  );
};

export default StudioShell;
