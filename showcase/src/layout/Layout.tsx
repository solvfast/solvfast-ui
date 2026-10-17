/** The documentation frame, after the Design System site (design_system App.tsx + StyleGuide.tsx `SideNav`):
 *  a full-width glass header bar that detaches into a floating pill on scroll (brand · language · theme); a left rail
 *  with search and collapsible groups that collapses to an icon strip; on small screens a sticky bar with the current
 *  section and a menu drawer. Every control is a @solvfast/ui component. */
import * as React from "react";
import { ChevronDown, Languages, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun } from "lucide-react";
import {
  Button, Input, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, Tooltip, TooltipContent, TooltipProvider,
  TooltipTrigger, cn, useLocale, useTheme,
} from "@ui";
import { version } from "../../../package.json";
import { GROUPS, PAGES } from "../routes";
import { useTr, type L } from "../i18n";

const RAIL_KEY = "sfui-showcase-rail";

function Brand() {
  return (
    <a href="#overview" className="flex items-center gap-2.5" aria-label="@solvfast/ui">
      <span className="grid size-8 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, hsl(var(--brand-violet)), hsl(var(--brand-flame)))" }} aria-hidden>S</span>
      <span className="font-brand text-xl font-bold leading-none text-foreground">solvfast<span className="text-primary">/ui</span></span>
      <span className="hidden rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground sm:inline" dir="ltr">{version}</span>
    </a>
  );
}

function RailButton({ icon: Icon, label, onClick, current, iconClassName }: { icon: typeof Search; label: L; onClick?: () => void; current?: boolean; iconClassName?: string }) {
  const tr = useTr();
  const { isRTL } = useLocale();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={onClick} aria-label={tr(label)}
          className={cn("relative flex size-9 items-center justify-center rounded-md transition-colors", current ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground")}>
          {current && <span className="absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-primary" aria-hidden />}
          <Icon className={cn("size-4", iconClassName)} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side={isRTL ? "left" : "right"}>{tr(label)}</TooltipContent>
    </Tooltip>
  );
}

function SideNav({ active, onNavigate, mini, onToggleMini }: {
  active: string; onNavigate: (id: string) => void; mini?: boolean; onToggleMini?: () => void;
}) {
  const tr = useTr();
  const [q, setQ] = React.useState("");
  const [closed, setClosed] = React.useState<Set<string>>(() => new Set());
  const query = q.trim().toLowerCase();

  // Collapsed rail — icons with tooltips; any of them expands the rail (as on the DS site).
  if (mini) {
    return (
      <TooltipProvider delayDuration={150}>
        <div className="flex flex-col items-center gap-1">
          <RailButton icon={PanelLeftOpen} iconClassName="rtl:rotate-180" label={{ en: "Expand sidebar", ar: "توسيع الشريط الجانبي" }} onClick={onToggleMini} />
          <RailButton icon={Search} label={{ en: "Search", ar: "بحث" }} onClick={onToggleMini} />
          <div className="my-1 h-px w-6 bg-border" />
          {GROUPS.map((g) => <RailButton key={g.id} icon={g.icon} label={g.title} onClick={onToggleMini} current={g.pages.some((p) => p.id === active)} />)}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start gap-2">
        {onToggleMini && (
          <button type="button" onClick={onToggleMini} aria-label={tr({ en: "Collapse sidebar", ar: "طيّ الشريط الجانبي" })}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <PanelLeftClose className="size-4 rtl:rotate-180" />
          </button>
        )}
        <div className="relative w-full">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr({ en: "Search…", ar: "بحث…" })} aria-label={tr({ en: "Search the components", ar: "البحث في المكوّنات" })} className="h-10 ps-9" />
        </div>
      </div>
      <nav aria-label={tr({ en: "@solvfast/ui components", ar: "مكوّنات ‎@solvfast/ui‎" })} className="space-y-1">
        {GROUPS.map((g) => {
          const pages = g.pages.filter((p) => !query || `${p.title.en} ${p.title.ar}`.toLowerCase().includes(query));
          if (!pages.length) return null;
          const open = query !== "" || !closed.has(g.id);
          const Icon = g.icon;
          return (
            <div key={g.id} className="pb-1">
              <button type="button" aria-expanded={open} onClick={() => setClosed((s) => { const n = new Set(s); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n; })}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 font-brand text-sm font-semibold text-foreground hover:bg-accent/50">
                <Icon className="size-4 text-muted-foreground" aria-hidden />
                <span className="flex-1 text-start">{tr(g.title)}</span>
                <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", !open && "-rotate-90 rtl:rotate-90")} aria-hidden />
              </button>
              {open && (
                <ul className="ms-4 mt-0.5 space-y-0.5 border-s border-border ps-2">
                  {pages.map((p) => (
                    <li key={p.id}>
                      <a href={`#${p.id}`} onClick={() => onNavigate(p.id)} aria-current={active === p.id ? "true" : undefined}
                        className={cn("-ms-px block rounded-e-md border-s-2 px-2.5 py-1 text-[13px] transition-colors",
                          active === p.id ? "border-primary bg-accent font-medium text-foreground" : "border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground")}>
                        {tr(p.title)}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}

export function Layout({ active, onNavigate, children }: { active: string; onNavigate: (id: string) => void; children: React.ReactNode }) {
  const tr = useTr();
  const { isDark, toggleTheme } = useTheme();
  const { language, toggleLanguage } = useLocale();
  const [drawer, setDrawer] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [mini, setMini] = React.useState<boolean>(() => {
    try { const s = sessionStorage.getItem(RAIL_KEY); if (s === "0" || s === "1") return s === "1"; } catch { /* storage unavailable */ }
    return typeof window !== "undefined" && window.innerWidth < 1280;
  });
  const toggleMini = () => setMini((v) => { try { sessionStorage.setItem(RAIL_KEY, v ? "0" : "1"); } catch { /* ignore */ } return !v; });
  React.useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const current = PAGES.find((p) => p.id === active);

  return (
    <div className="sf-app relative min-h-screen">
      <div className="sc-aurora pointer-events-none fixed inset-0" aria-hidden />
      <div className="relative">
        {/* Header — a full glass bar at the top; on scroll it detaches into a floating pill (as on the DS site). */}
        <header className={cn("sticky top-0 z-40 transition-[padding,background-color,border-color,box-shadow] duration-300 ease-out motion-reduce:transition-none",
          scrolled ? "px-3 pt-3 md:px-6" : "border-b border-border/60 bg-background/60 shadow-sm backdrop-blur-md")}>
          <div className={cn("mx-auto flex items-center justify-between gap-3 transition-[max-width,padding,border-radius] duration-300 ease-out motion-reduce:transition-none",
            scrolled ? "sf-glass-pane sf-glass-pane--airy max-w-[1200px] rounded-full px-5 py-2" : "max-w-[1440px] px-4 py-3 md:px-10")}>
            <Brand />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={toggleLanguage} aria-label={tr({ en: "Switch to Arabic", ar: "التبديل إلى الإنجليزية" })}>
                <Languages className="h-4 w-4" /> {language === "ar" ? "EN" : "ع"}
              </Button>
              <Button variant="outline" size="icon-sm" onClick={toggleTheme} aria-label={tr({ en: "Toggle theme", ar: "تبديل السمة" })}>
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] px-4 md:px-10 lg:flex lg:gap-12">
          <aside className={cn("hidden shrink-0 transition-[width] duration-200 lg:block", mini ? "lg:w-14" : "lg:w-56")}>
            <div className="sticky top-[84px] max-h-[calc(100vh-104px)] overflow-y-auto overflow-x-hidden py-6">
              <SideNav active={active} onNavigate={onNavigate} mini={mini} onToggleMini={toggleMini} />
            </div>
          </aside>

          <main className="min-w-0 flex-1 pb-24">
            {/* Tablet / phone: a sticky bar with the current section and the menu drawer. */}
            <div className="sticky top-14 z-30 -mx-4 flex items-center gap-3 border-y border-border bg-background/80 px-4 py-2 backdrop-blur-md md:-mx-10 md:px-10 lg:hidden">
              <Sheet open={drawer} onOpenChange={setDrawer}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5"><Menu className="h-4 w-4" />{tr({ en: "Menu", ar: "القائمة" })}</Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 overflow-y-auto">
                  <SheetHeader className="text-start"><SheetTitle>{tr({ en: "Components", ar: "المكوّنات" })}</SheetTitle></SheetHeader>
                  <div className="mt-4"><SideNav active={active} onNavigate={(id) => { setDrawer(false); onNavigate(id); }} /></div>
                </SheetContent>
              </Sheet>
              <span className="truncate text-xs font-medium text-muted-foreground">{current ? tr(current.title) : ""}</span>
            </div>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
