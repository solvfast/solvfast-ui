/**
 * Sidebar — Sear's StudioShell `<aside>` (baseline 7abc895-dirty): brand row + app switcher, navigation with groups,
 * active states, a collapsible rail (tooltips when collapsed) and the collapse toggle. Solid `bg-sidebar`, not glass.
 *
 * Changes from Sear (VENDORED.md): navigation, brand and switcher come from props; routing is the app's (`currentPath`,
 * `onNavigate`, optional `isActive`) — no react-router; groups nest to any depth (Sear rendered one child level;
 * deeper levels reuse the child style with more indent).
 */
import * as React from "react";
import { ArrowLeftToLine, ArrowRightToLine, ChevronDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../primitives/tooltip";
import { useLocale } from "../theme/ThemeProvider";
import { AppSwitcher, type AppSwitcherProps } from "./AppSwitcher";
import { defaultIsActive, loc, type IsActive, type Localized, type NavItem } from "./nav";

export interface ShellBrand {
  name: Localized;
  /** Logo image beside the name (Sear: the app logo, `w-14 h-14`). */
  logoSrc?: string;
  /** Size classes for `logoSrc` (default `w-11 h-11`). */
  logoClassName?: string;
  /** A wide logo with the name baked in — replaces logo + name. */
  logoWideSrc?: string;
  /** Icon component instead of an image: drawn on a brand-gradient tile unless `iconBare`. */
  icon?: React.ComponentType<{ className?: string }>;
  iconBare?: boolean;
  /** Classes for the name (default `text-foreground`; Sear passes `text-brand-violet`). */
  nameClassName?: string;
  /** Where clicking the brand goes. */
  href?: string;
}

export interface SidebarProps {
  brand: ShellBrand;
  items?: NavItem[];
  /** Replaces the navigation list (e.g. a tree). Hidden while collapsed. */
  body?: React.ReactNode;
  currentPath: string;
  onNavigate: (href: string, item?: NavItem) => void;
  isActive?: IsActive;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  /** The brand-row menu: switcher config, a custom node, or `false`. */
  switcher?: Omit<AppSwitcherProps, "onNavigate"> | React.ReactNode | false;
}

const leafClasses = (active: boolean, collapsed: boolean) =>
  `w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
    collapsed ? "justify-center" : ""
  } ${active ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted font-light"}`;
const childClasses = (active: boolean) =>
  `w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
    active ? "text-primary font-medium" : "text-foreground hover:bg-muted font-light"
  }`;
const firstHref = (item: NavItem): string | undefined => item.href ?? item.children?.map(firstHref).find(Boolean);

interface TreeCtx { currentPath: string; isActive: IsActive; onNavigate: SidebarProps["onNavigate"]; isRTL: boolean; language: "ar" | "en"; }

function Group({ item, ctx, active, level }: { item: NavItem; ctx: TreeCtx; active: boolean; level: number }) {
  const [open, setOpen] = React.useState(active);
  React.useEffect(() => { if (active) setOpen(true); }, [active]);
  const Icon = item.icon;
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className={level === 0 ? leafClasses(active, false) : childClasses(active)}>
        {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
        <span className="whitespace-nowrap flex-1 text-start">{loc(item.label, ctx.language)}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "" : "-rotate-90 rtl:rotate-90"}`} />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5 ps-5">
          {item.children!.map((child) => {
            const cactive = ctx.isActive(child, ctx.currentPath);
            if (child.children?.length) return <Group key={child.id} item={child} ctx={ctx} active={cactive} level={level + 1} />;
            const CIcon = child.icon;
            return (
              <button key={child.id} onClick={() => child.href && ctx.onNavigate(child.href, child)} aria-current={cactive ? "page" : undefined} className={childClasses(cactive)}>
                {CIcon && <CIcon className="h-4 w-4 flex-shrink-0" />}
                <span className="whitespace-nowrap">{loc(child.label, ctx.language)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Item({ item, ctx, collapsed }: { item: NavItem; ctx: TreeCtx; collapsed: boolean }) {
  const active = ctx.isActive(item, ctx.currentPath);
  // A parent with children is an accordion; on the collapsed rail it degrades to a leaf (no flyout).
  if (item.children?.length && !collapsed) return <Group item={item} ctx={ctx} active={active} level={0} />;
  const label = loc(item.label, ctx.language);
  const href = firstHref(item);
  const Icon = item.icon;
  const inner = (
    <button
      onClick={() => href && ctx.onNavigate(href, item)}
      className={leafClasses(active, collapsed)}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
    >
      {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
      {!collapsed && <span className="whitespace-nowrap">{label}</span>}
    </button>
  );
  if (!collapsed) return inner;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side={ctx.isRTL ? "left" : "right"}>{label}</TooltipContent>
    </Tooltip>
  );
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !React.isValidElement(v) && !Array.isArray(v);

export function Sidebar({
  brand, items = [], body, currentPath, onNavigate, isActive = defaultIsActive, collapsed, onCollapsedChange, switcher,
}: SidebarProps) {
  const { language, isRTL, t } = useLocale();
  const ctx: TreeCtx = { currentPath, isActive, onNavigate, isRTL, language };
  const name = loc(brand.name, language);
  const logoClassName = brand.logoClassName ?? "w-11 h-11";
  const BrandIcon = brand.icon;
  const goHome = () => brand.href && onNavigate(brand.href);
  const CollapseIcon = collapsed ? (isRTL ? ArrowLeftToLine : ArrowRightToLine) : (isRTL ? ArrowRightToLine : ArrowLeftToLine);

  const mark = (compact: boolean) =>
    brand.logoSrc ? (
      <img src={brand.logoSrc} alt={name} className={compact ? `${logoClassName} shrink-0 object-contain` : `${logoClassName} object-contain shrink-0`} />
    ) : compact && brand.logoWideSrc ? (
      <img src={brand.logoWideSrc} alt={name} className="h-9 w-9 shrink-0 object-contain" />
    ) : BrandIcon && brand.iconBare ? (
      <BrandIcon className="w-9 h-9 rounded-lg shrink-0 object-contain" />
    ) : BrandIcon ? (
      <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center bg-gradient-to-br from-brand-flame to-brand-violet text-white">
        <BrandIcon className="h-5 w-5" />
      </div>
    ) : null;

  let switcherEl: React.ReactNode = null;
  if (isPlainObject(switcher) && Array.isArray((switcher as { sections?: unknown }).sections)) {
    switcherEl = <AppSwitcher {...(switcher as Omit<AppSwitcherProps, "onNavigate">)} onNavigate={(href) => onNavigate(href)} />;
  } else if (switcher !== false && switcher !== undefined) {
    switcherEl = switcher as React.ReactNode;
  }

  return (
    <aside className={`hidden md:flex ${collapsed ? "w-16" : "w-64"} flex-col bg-sidebar border-e border-border transition-[width] duration-200`}>
      {/* Brand row — h-14 so its border lines up with the top bar's. */}
      <div className={`flex items-center gap-2 min-h-14 px-3 border-b border-border ${collapsed ? "justify-center" : ""}`}>
        {collapsed ? (
          <button type="button" onClick={goHome} aria-label={name} className="hover:opacity-80 transition-opacity">
            {mark(true)}
          </button>
        ) : (
          <>
            {brand.logoWideSrc && !brand.logoSrc ? (
              <><img src={brand.logoWideSrc} alt={name} className="h-10 w-auto max-w-[190px] min-w-0 object-contain" /><span className="flex-1" /></>
            ) : (
              <button type="button" onClick={goHome} aria-label={name} className="flex items-center gap-2.5 flex-1 min-w-0 text-start hover:opacity-80 transition-opacity">
                {mark(false)}
                <span className={`text-base font-semibold leading-tight ${brand.nameClassName ?? "text-foreground"}`}>{name}</span>
              </button>
            )}
            {switcherEl}
          </>
        )}
      </div>

      {body ? (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{!collapsed && body}</div>
      ) : (
        <TooltipProvider delayDuration={100}>
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
            {items.map((item) => <Item key={item.id} item={item} ctx={ctx} collapsed={collapsed} />)}
          </nav>
        </TooltipProvider>
      )}

      <div className="px-2 py-3 border-t border-border">
        <button
          onClick={() => onCollapsedChange(!collapsed)}
          aria-pressed={collapsed}
          aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
          title={collapsed ? t("expand") : t("collapse")}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-light ${collapsed ? "justify-center" : "justify-start"}`}
        >
          <CollapseIcon className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span className="whitespace-nowrap">{t("collapse")}</span>}
        </button>
      </div>
    </aside>
  );
}
