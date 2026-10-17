/** The documentation frame, after the Design System site: a floating glass header (brand, language, theme), a left
 *  sidebar with search and collapsible groups (a sheet on small screens), and the page. */
import * as React from "react";
import { ChevronDown, Languages, Menu, Moon, Search, Sun } from "lucide-react";
import { Button, Card, Input, ScrollArea, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, cn, useLocale, useTheme } from "@ui";
import { GROUPS } from "../routes";
import { useTr } from "../i18n";

function Brand() {
  return (
    <a href="#/overview" className="flex items-center gap-2.5" aria-label="@solvfast/ui">
      <span className="grid size-8 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, hsl(var(--brand-violet)), hsl(var(--brand-flame)))" }} aria-hidden>S</span>
      <span className="font-brand text-xl font-bold leading-none text-foreground">solvfast<span className="text-primary">/ui</span></span>
    </a>
  );
}

function SideNav({ current, onNavigate }: { current: string; onNavigate?: () => void }) {
  const tr = useTr();
  const [q, setQ] = React.useState("");
  const [closed, setClosed] = React.useState<Set<string>>(() => new Set());
  const query = q.trim().toLowerCase();
  return (
    <nav aria-label={tr({ en: "Components", ar: "المكوّنات" })} className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr({ en: "Search…", ar: "بحث…" })} aria-label={tr({ en: "Search pages", ar: "البحث في الصفحات" })} className="h-9 ps-9" />
      </div>
      {GROUPS.map((g) => {
        const pages = g.pages.filter((p) => !query || `${p.title.en} ${p.title.ar}`.toLowerCase().includes(query));
        if (!pages.length) return null;
        const open = query !== "" || !closed.has(g.id);
        const Icon = g.icon;
        return (
          <div key={g.id} className="space-y-1">
            <button type="button" aria-expanded={open} onClick={() => setClosed((s) => { const n = new Set(s); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n; })}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-foreground hover:bg-accent/60">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-start">{tr(g.title)}</span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !open && "-rotate-90 rtl:rotate-90")} />
            </button>
            {open && (
              <ul className="ms-4 space-y-0.5 border-s border-border ps-2">
                {pages.map((p) => {
                  const active = p.id === current;
                  return (
                    <li key={p.id}>
                      <a href={`#/${p.id}`} onClick={onNavigate} aria-current={active ? "page" : undefined}
                        className={cn("relative block rounded-md px-3 py-1.5 text-sm transition-colors",
                          active ? "bg-accent font-medium text-foreground before:absolute before:inset-y-1 before:-start-[9px] before:w-0.5 before:rounded-full before:bg-primary"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")}>
                        {tr(p.title)}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function Layout({ current, children }: { current: string; children: React.ReactNode }) {
  const tr = useTr();
  const { isDark, toggleTheme } = useTheme();
  const { language, toggleLanguage } = useLocale();
  const [menu, setMenu] = React.useState(false);
  return (
    <div className="sf-app relative min-h-screen">
      <div className="sc-aurora pointer-events-none fixed inset-0" aria-hidden />
      <div className="relative">
        <div className="sticky top-0 z-40 px-3 pt-3 md:px-6">
          <Card className="mx-auto flex h-14 max-w-[1400px] flex-row items-center gap-3 rounded-2xl px-4">
            <Sheet open={menu} onOpenChange={setMenu}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 lg:hidden"><Menu className="h-4 w-4" />{tr({ en: "Menu", ar: "القائمة" })}</Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto">
                <SheetHeader className="text-start"><SheetTitle>{tr({ en: "Components", ar: "المكوّنات" })}</SheetTitle></SheetHeader>
                <div className="mt-4"><SideNav current={current} onNavigate={() => setMenu(false)} /></div>
              </SheetContent>
            </Sheet>
            <Brand />
            <span className="hidden rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground sm:inline">0.1.0-rc.1</span>
            <div className="ms-auto flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={toggleLanguage} aria-label={tr({ en: "Switch to Arabic", ar: "التبديل إلى الإنجليزية" })}>
                <Languages className="h-4 w-4" /> {language === "ar" ? "EN" : "ع"}
              </Button>
              <Button variant="outline" size="icon-sm" onClick={toggleTheme} aria-label={tr({ en: "Toggle theme", ar: "تبديل السمة" })}>
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </Card>
        </div>
        <div className="mx-auto flex max-w-[1400px] gap-10 px-3 py-8 md:px-6">
          <aside className="hidden w-60 shrink-0 lg:block">
            <ScrollArea className="sticky top-24 h-[calc(100vh-7rem)] pe-3">
              <SideNav current={current} />
            </ScrollArea>
          </aside>
          <main className="min-w-0 flex-1 pb-24">{children}</main>
        </div>
      </div>
    </div>
  );
}
