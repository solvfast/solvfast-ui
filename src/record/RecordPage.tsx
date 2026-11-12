import * as React from "react";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { Button } from "../primitives/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../primitives/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "../primitives/tabs";

/**
 * RecordPage — the CRM record page (Deal / Lead / Contact / Organization / Ticket details) as a layout: the toolbar
 * (Back on the start side; Save, Actions and ⋯ on the end side), then the 3 + 1 grid — the main column (the header card,
 * then the tabs) and the right rail (`aside`, e.g. a `RecordRail`). A 1:1 port of the CRM's markup.
 *
 * It also sets `sf-record-page`: the record page's surfaces (styles/src/sf-record-page.css — the CRM's airy glass cards
 * with 20px corners, in both themes), so another app gets the CRM look. Presentational: routing, permissions and
 * the save model are the host's (`actions` takes them).
 */

type IconType = React.ComponentType<{ className?: string }>;

export interface RecordPageProps {
  /** "Back to Deals": the toolbar's start. */
  back?: { label: React.ReactNode; onClick: () => void; icon?: IconType };
  /** Above the toolbar (e.g. a "sample data" banner). */
  banner?: React.ReactNode;
  /** The toolbar's end: e.g. the page Save button, an Actions menu, the ⋯ menu. */
  actions?: React.ReactNode;
  /** The main column's first block (e.g. a `RecordHeaderCard variant="crm"`). */
  header?: React.ReactNode;
  /** Rendered between the toolbar and the grid (dialogs, bridges — nothing visual). */
  between?: React.ReactNode;
  /** The right rail (e.g. `<RecordRail className="lg:col-span-1 lg:sticky lg:top-4 lg:self-start space-y-4" …/>`). */
  aside?: React.ReactNode;
  /** The main column after the header (e.g. the tabs). */
  children?: React.ReactNode;
  className?: string;
}

export function RecordPage({ back, banner, actions, header, between, aside, children, className }: RecordPageProps) {
  const { isRTL } = useLocale();
  const BackIcon = back?.icon ?? (isRTL ? ArrowRight : ArrowLeft);
  return (
    <div className={cn("sf-record-page p-4 md:p-6 max-w-[1600px] mx-auto", className)} data-record-page>
      {banner}
      <div className="flex items-center justify-between mb-4">
        {back ? (
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-brand-violet" onClick={back.onClick}>
            <BackIcon className="h-4 w-4" />{back.label}
          </Button>
        ) : <span />}
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      {between}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-start">
        <div className="lg:col-span-3 min-w-0 space-y-5">
          {header}
          {children}
        </div>
        {aside}
      </div>
    </div>
  );
}

export interface RecordQuickActionProps {
  icon: IconType;
  label: React.ReactNode;
  onClick?: () => void;
  /** `primary` = the secondary-filled pill (e.g. the record's main activity); default outline. */
  variant?: "ghost" | "primary";
  disabled?: boolean;
  className?: string;
}

/** A header quick action (Log Call, Note, …): an outline pill. */
export function RecordQuickAction({ icon: Icon, label, onClick, variant = "ghost", disabled, className }: RecordQuickActionProps) {
  return (
    <Button type="button" size="sm" variant={variant === "primary" ? "secondary" : "outline"} onClick={onClick} disabled={disabled}
      className={cn("h-8 gap-1.5 px-3 rounded-full text-xs font-medium", className)}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Button>
  );
}

export interface RecordQuickActionMenuItem {
  label: React.ReactNode;
  icon?: IconType;
  /** The item icon's colour classes (default muted). */
  iconClassName?: string;
  onSelect: () => void;
  disabled?: boolean;
}

export interface RecordQuickActionMenuProps {
  label: React.ReactNode;
  items: RecordQuickActionMenuItem[];
  /** `split` = an action with its variants (Meeting ▾: Schedule / Log; icon + label + small chevron);
   *  `more` = the "More ▾" overflow pill (label + chevron). */
  variant?: "split" | "more";
  icon?: IconType;
  /** The chevron glyph (default ChevronDown). */
  chevronIcon?: IconType;
  className?: string;
}

/** A header quick action with a menu: the CRM's split pill (Meeting ▾) or its More ▾ pill. */
export function RecordQuickActionMenu({ label, items, variant = "split", icon: Icon, chevronIcon: Chevron = ChevronDown, className }: RecordQuickActionMenuProps) {
  const trigger = variant === "more" ? (
    <Button type="button" size="sm" variant="outline" className={cn("h-8 gap-1 px-2.5 rounded-full text-xs font-medium", className)}>
      {label}<Chevron className="h-3.5 w-3.5" />
    </Button>
  ) : (
    <Button type="button" variant="outline" size="sm"
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors",
        "border border-border/70 bg-card/60 text-foreground/80 hover:border-brand-violet/30 hover:text-brand-violet hover:bg-brand-violet/5",
        className,
      )}>
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      <span>{label}</span>
      <Chevron className="h-3 w-3 opacity-60" />
    </Button>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {items.map((it, i) => (
          <DropdownMenuItem key={i} disabled={it.disabled} onSelect={() => it.onSelect()}>
            {it.icon ? <it.icon className={cn("h-4 w-4 me-2", it.iconClassName ?? "text-muted-foreground")} /> : null}
            {it.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface RecordTab { value: string; label: React.ReactNode; icon?: IconType }

export interface RecordTabsProps {
  value: string;
  onValueChange: (value: string) => void;
  tabs: RecordTab[];
  /** The panels (`TabsContent`), after the bar. */
  children?: React.ReactNode;
  className?: string;
}

/** The record page's full-width tab bar (About · History · Activities · …): equal tabs, an icon before each label. */
export function RecordTabs({ value, onValueChange, tabs, children, className }: RecordTabsProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className={className}>
      <TabsList className="flex w-full">
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value} className="min-w-0 flex-1 gap-1.5">
            {t.icon ? <t.icon className="h-3.5 w-3.5" /> : null}{t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
