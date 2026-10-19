/** 0.3.0 — the merged components (the rest of PMO's components/ui), in the package's look. */
import * as React from "react";
import { useForm } from "react-hook-form";
import { AlertCircle, Bold, CheckCircle2, Italic, Terminal, Underline } from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger, Alert, AlertDescription, AlertTitle, AspectRatio, Badge,
  Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button,
  Collapsible, CollapsibleContent, CollapsibleTrigger, ContextMenu, ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem,
  ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger,
  ContextMenuTrigger, EditableTitle, HoverCard, HoverCardContent, HoverCardTrigger, Input, Label, Menubar, MenubarContent,
  MenubarItem, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarSub, MenubarSubContent, MenubarSubTrigger, MenubarTrigger,
  NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger,
  PageHeader, Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext,
  PaginationPrevious, Pill, Progress, RichText, RichTextEditor, SearchCombobox, Slider, StatusDot, Toggle, ToggleGroup,
  ToggleGroupItem, navigationMenuTriggerStyle, useLocale, useTheme, type ComboOption,
} from "@ui";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@ui/form";
import { Example, Props, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";

const Out = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-4 font-mono text-xs text-muted-foreground" dir="ltr">{children}</p>
);

export function AlertPage() {
  const tr = useTr();
  return (
    <div className="space-y-12">
      <Section title={l("Alert", "التنبيه")} description={l("A static message in the page flow (role=\"alert\"). For transient confirmations use a toast.", "رسالة ثابتة ضمن الصفحة (role=\"alert\"). للتأكيدات العابرة استخدم التنبيه العابر.")}>
        <Example code={`<Alert>
  <Terminal className="h-4 w-4" />
  <AlertTitle>Heads up</AlertTitle>
  <AlertDescription>Your workspace syncs every 5 minutes.</AlertDescription>
</Alert>
<Alert variant="destructive">…</Alert>`}>
          <div className="grid gap-4">
            <Alert><Terminal className="h-4 w-4" /><AlertTitle>{tr(l("Heads up", "تنبيه"))}</AlertTitle><AlertDescription>{tr(l("Your workspace syncs every 5 minutes.", "تتم مزامنة مساحة العمل كل 5 دقائق."))}</AlertDescription></Alert>
            <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>{tr(l("Sync failed", "فشلت المزامنة"))}</AlertTitle><AlertDescription>{tr(l("Check the connection and try again.", "تحقّق من الاتصال وحاول مجدداً."))}</AlertDescription></Alert>
          </div>
        </Example>
      </Section>
    </div>
  );
}

export function ProgressPage() {
  const tr = useTr();
  const [v, setV] = React.useState(40);
  return (
    <div className="space-y-12">
      <Section title={l("Progress", "شريط التقدّم")} description={l("Determinate progress. Fills from the reading start — the right edge in Arabic.", "تقدّم محدد. يمتلئ من بداية القراءة — الحافة اليمنى في العربية.")}>
        <Example code={`<Progress value={40} aria-label="Upload" />`}>
          <div className="max-w-md space-y-4">
            <Progress value={v} aria-label={tr(l("Upload", "الرفع"))} />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setV((x) => Math.max(0, x - 20))}>−20</Button>
              <Button size="sm" variant="outline" onClick={() => setV((x) => Math.min(100, x + 20))}>+20</Button>
            </div>
            <Out>value: {v}</Out>
          </div>
        </Example>
      </Section>
    </div>
  );
}

export function TogglePage() {
  const tr = useTr();
  const [align, setAlign] = React.useState("start");
  return (
    <div className="space-y-12">
      <Section title={l("Toggle & toggle group", "زر التبديل ومجموعته")} description={l("A two-state button (aria-pressed), and a set of them: single choice (a radio group) or multiple. Arrow keys follow the reading direction.", "زر بحالتين (aria-pressed)، ومجموعة منها: اختيار واحد (مجموعة اختيار) أو متعدد. الأسهم تتبع اتجاه القراءة.")}>
        <Example code={`<Toggle aria-label="Bold"><Bold /></Toggle>
<ToggleGroup type="single" value={align} onValueChange={setAlign} aria-label="Alignment">
  <ToggleGroupItem value="start">Start</ToggleGroupItem> …
</ToggleGroup>
<ToggleGroup type="multiple" variant="outline">…</ToggleGroup>`}>
          <div className="flex flex-wrap items-center gap-6">
            <Toggle aria-label={tr(l("Bold", "عريض"))}><Bold /></Toggle>
            <ToggleGroup type="single" value={align} onValueChange={(v) => v && setAlign(v)} aria-label={tr(l("Alignment", "المحاذاة"))}>
              {[["start", l("Start", "البداية")], ["center", l("Center", "الوسط")], ["end", l("End", "النهاية")]].map(([v, label]) => (
                <ToggleGroupItem key={v as string} value={v as string}>{tr(label as { en: string; ar: string })}</ToggleGroupItem>
              ))}
            </ToggleGroup>
            <ToggleGroup type="multiple" variant="outline" aria-label={tr(l("Style", "النمط"))}>
              <ToggleGroupItem value="b" aria-label={tr(l("Bold", "عريض"))}><Bold /></ToggleGroupItem>
              <ToggleGroupItem value="i" aria-label={tr(l("Italic", "مائل"))}><Italic /></ToggleGroupItem>
              <ToggleGroupItem value="u" aria-label={tr(l("Underline", "تسطير"))}><Underline /></ToggleGroupItem>
            </ToggleGroup>
          </div>
          <Out>align: "{align}"</Out>
        </Example>
      </Section>
    </div>
  );
}

export function SliderPage() {
  const tr = useTr();
  const [v, setV] = React.useState([50]);
  return (
    <div className="space-y-12">
      <Section title={l("Slider", "المنزلق")} description={l("Pick a number in a range by dragging or with the arrow keys (mirrored in Arabic).", "اختيار رقم ضمن مدى بالسحب أو بالأسهم (معكوسة في العربية).")}>
        <Example code={`<Slider value={value} onValueChange={setValue} max={100} step={1} aria-label="Volume" />`}>
          <div className="max-w-md">
            <Slider value={v} onValueChange={setV} max={100} step={1} aria-label={tr(l("Volume", "مستوى الصوت"))} />
            <Out>value: {v[0]}</Out>
          </div>
        </Example>
      </Section>
    </div>
  );
}

export function AccordionPage() {
  const tr = useTr();
  const [open, setOpen] = React.useState(false);
  return (
    <div className="space-y-12">
      <Section title={l("Accordion & collapsible", "الأكورديون والقسم القابل للطي")} description={l("Sections that open and close; an accordion keeps one (or several) open.", "أقسام تُفتح وتُغلق؛ الأكورديون يُبقي قسماً واحداً (أو أكثر) مفتوحاً.")}>
        <Example code={`<Accordion type="single" collapsible>
  <AccordionItem value="a">
    <AccordionTrigger>Who can see this project?</AccordionTrigger>
    <AccordionContent>Members of the project team.</AccordionContent>
  </AccordionItem>
</Accordion>`}>
          <Accordion type="single" collapsible className="max-w-xl">
            {[[l("Who can see this project?", "من يمكنه رؤية هذا المشروع؟"), l("Members of the project team and its sponsors.", "أعضاء فريق المشروع ورعاته.")],
              [l("Can I move tasks between projects?", "هل يمكن نقل المهام بين المشاريع؟"), l("Yes — from the task's menu.", "نعم — من قائمة المهمة.")]].map(([q, a], i) => (
              <AccordionItem key={i} value={`q${i}`}><AccordionTrigger>{tr(q)}</AccordionTrigger><AccordionContent>{tr(a)}</AccordionContent></AccordionItem>
            ))}
          </Accordion>
        </Example>
        <Example title={l("Collapsible", "قابل للطي")} code={`<Collapsible open={open} onOpenChange={setOpen}>
  <CollapsibleTrigger asChild><Button variant="ghost" size="sm">Show 3 more</Button></CollapsibleTrigger>
  <CollapsibleContent>…</CollapsibleContent>
</Collapsible>`}>
          <Collapsible open={open} onOpenChange={setOpen} className="max-w-xl space-y-2">
            <CollapsibleTrigger asChild><Button variant="ghost" size="sm">{open ? tr(l("Show less", "عرض أقل")) : tr(l("Show 3 more", "عرض 3 أخرى"))}</Button></CollapsibleTrigger>
            <CollapsibleContent className="space-y-2">
              {["INV-004", "INV-005", "INV-006"].map((x) => <div key={x} className="rounded-md border border-border px-3 py-2 font-mono text-sm">{x}</div>)}
            </CollapsibleContent>
          </Collapsible>
        </Example>
      </Section>
    </div>
  );
}

export function StatusPillPage() {
  const tr = useTr();
  return (
    <div className="space-y-12">
      <Section title={l("Status dot & pill", "نقطة الحالة والحبّة")} description={l("Frappe-style status (a coloured dot and a label) and the rounded chip for assignees, statuses and filter tokens.", "حالة بأسلوب فرابيه (نقطة ملوّنة وتسمية) والشريحة الدائرية للمكلّفين والحالات ورموز التصفية.")}>
        <Example code={`<StatusDot tone="success" label="Won" />   // default · success · warning · info · destructive
<Pill><StatusDot tone="destructive" /> Lost</Pill>`}>
          <div className="flex flex-wrap items-center gap-6">
            <StatusDot label={tr(l("Draft", "مسودة"))} />
            <StatusDot tone="success" label={tr(l("Won", "مكسوبة"))} />
            <StatusDot tone="warning" label={tr(l("At risk", "معرّضة للخطر"))} />
            <StatusDot tone="info" label={tr(l("New lead", "عميل محتمل جديد"))} />
            <StatusDot tone="destructive" label={tr(l("Lost", "خاسرة"))} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Pill><span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">R</span>{tr(l("Rana", "رنا"))}</Pill>
            <Pill><StatusDot tone="destructive" />{tr(l("Lost", "خاسرة"))}</Pill>
            <Pill>{tr(l("Priority: high", "الأولوية: عالية"))}</Pill>
          </div>
        </Example>
      </Section>
    </div>
  );
}

export function AspectRatioPage() {
  const tr = useTr();
  return (
    <div className="space-y-12">
      <Section title={l("Aspect ratio", "نسبة الأبعاد")} description={l("Keeps content (an image, a video, a map) at a fixed width-to-height ratio.", "يحافظ على المحتوى (صورة، فيديو، خريطة) بنسبة ثابتة بين العرض والارتفاع.")}>
        <Example code={`<AspectRatio ratio={16 / 9}><img src={cover} alt="" className="h-full w-full object-cover" /></AspectRatio>`}>
          <div className="max-w-md">
            <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-xl bg-gradient-to-br from-primary/30 via-primary/10 to-transparent">
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">16 : 9 — {tr(l("cover image", "صورة الغلاف"))}</div>
            </AspectRatio>
          </div>
        </Example>
      </Section>
    </div>
  );
}

export function HoverCardPage() {
  const tr = useTr();
  return (
    <div className="space-y-12">
      <Section title={l("Hover card", "بطاقة التمرير")} description={l("A preview shown on hover or focus — for sighted mouse users; keep the same information reachable elsewhere.", "معاينة تظهر عند التمرير أو التركيز — للمستخدمين بالفأرة؛ أبقِ المعلومة نفسها متاحة في مكان آخر.")}>
        <Example center code={`<HoverCard>
  <HoverCardTrigger href="/users/rana">@rana</HoverCardTrigger>
  <HoverCardContent>…</HoverCardContent>
</HoverCard>`}>
          <HoverCard openDelay={100} closeDelay={100}>
            <HoverCardTrigger href="#hover-card" className="font-medium text-primary underline-offset-4 hover:underline">@rana</HoverCardTrigger>
            <HoverCardContent>
              <div className="space-y-1">
                <p className="text-sm font-semibold">{tr(l("Rana Haddad", "رنا حداد"))}</p>
                <p className="text-sm text-muted-foreground">{tr(l("Project manager · 12 open tasks", "مديرة مشاريع · 12 مهمة مفتوحة"))}</p>
              </div>
            </HoverCardContent>
          </HoverCard>
        </Example>
      </Section>
    </div>
  );
}

export function ContextMenuPage() {
  const tr = useTr();
  const [picked, setPicked] = React.useState("");
  const [pinned, setPinned] = React.useState(true);
  return (
    <div className="space-y-12">
      <Section title={l("Context menu", "قائمة السياق")} description={l("Actions on right-click (or long-press). Offer the same actions in a visible menu as well.", "إجراءات بالنقر الأيمن (أو الضغط المطوّل). وفّر الإجراءات نفسها في قائمة ظاهرة أيضاً.")}>
        <Example code={`<ContextMenu>
  <ContextMenuTrigger>Right-click here</ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem onSelect={open}>Open <ContextMenuShortcut>⌘O</ContextMenuShortcut></ContextMenuItem>
    <ContextMenuSub>…</ContextMenuSub>
  </ContextMenuContent>
</ContextMenu>`}>
          <ContextMenu>
            <ContextMenuTrigger data-testid="ctx-area" className="flex h-36 w-full max-w-md items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              {tr(l("Right-click here", "انقر بالزر الأيمن هنا"))}
            </ContextMenuTrigger>
            <ContextMenuContent className="w-56">
              <ContextMenuLabel>{tr(l("Task", "المهمة"))}</ContextMenuLabel>
              <ContextMenuItem onSelect={() => setPicked("open")}>{tr(l("Open", "فتح"))}<ContextMenuShortcut>⌘O</ContextMenuShortcut></ContextMenuItem>
              <ContextMenuItem onSelect={() => setPicked("duplicate")}>{tr(l("Duplicate", "تكرار"))}</ContextMenuItem>
              <ContextMenuSub>
                <ContextMenuSubTrigger>{tr(l("Move to", "نقل إلى"))}</ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <ContextMenuItem onSelect={() => setPicked("backlog")}>{tr(l("Backlog", "قائمة الانتظار"))}</ContextMenuItem>
                  <ContextMenuItem onSelect={() => setPicked("sprint")}>{tr(l("Current sprint", "الدورة الحالية"))}</ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuSeparator />
              <ContextMenuCheckboxItem checked={pinned} onCheckedChange={(c) => setPinned(!!c)}>{tr(l("Pinned", "مثبّتة"))}</ContextMenuCheckboxItem>
            </ContextMenuContent>
          </ContextMenu>
          <Out>picked: {picked || "—"} · pinned: {String(pinned)}</Out>
        </Example>
      </Section>
    </div>
  );
}

export function MenubarPage() {
  const tr = useTr();
  const [picked, setPicked] = React.useState("");
  return (
    <div className="space-y-12">
      <Section title={l("Menubar", "شريط القوائم")} description={l("A desktop-style row of menus (File, Edit, View…). Arrow keys move between menus.", "صف قوائم بأسلوب سطح المكتب (ملف، تحرير، عرض…). الأسهم تتنقّل بين القوائم.")}>
        <Example code={`<Menubar>
  <MenubarMenu>
    <MenubarTrigger>File</MenubarTrigger>
    <MenubarContent>
      <MenubarItem onSelect={create}>New task <MenubarShortcut>⌘N</MenubarShortcut></MenubarItem>
    </MenubarContent>
  </MenubarMenu>
</Menubar>`}>
          <Menubar className="w-fit">
            <MenubarMenu>
              <MenubarTrigger>{tr(l("File", "ملف"))}</MenubarTrigger>
              <MenubarContent>
                <MenubarItem onSelect={() => setPicked("new")}>{tr(l("New task", "مهمة جديدة"))}<MenubarShortcut>⌘N</MenubarShortcut></MenubarItem>
                <MenubarSub>
                  <MenubarSubTrigger>{tr(l("Share", "مشاركة"))}</MenubarSubTrigger>
                  <MenubarSubContent>
                    <MenubarItem onSelect={() => setPicked("email")}>{tr(l("Email link", "إرسال الرابط بالبريد"))}</MenubarItem>
                    <MenubarItem onSelect={() => setPicked("copy")}>{tr(l("Copy link", "نسخ الرابط"))}</MenubarItem>
                  </MenubarSubContent>
                </MenubarSub>
                <MenubarSeparator />
                <MenubarItem onSelect={() => setPicked("print")}>{tr(l("Print", "طباعة"))}</MenubarItem>
              </MenubarContent>
            </MenubarMenu>
            <MenubarMenu>
              <MenubarTrigger>{tr(l("View", "عرض"))}</MenubarTrigger>
              <MenubarContent>
                <MenubarItem onSelect={() => setPicked("board")}>{tr(l("Board", "لوحة"))}</MenubarItem>
                <MenubarItem onSelect={() => setPicked("list")}>{tr(l("List", "قائمة"))}</MenubarItem>
              </MenubarContent>
            </MenubarMenu>
          </Menubar>
          <Out>picked: {picked || "—"}</Out>
        </Example>
      </Section>
    </div>
  );
}

export function BreadcrumbsPage() {
  const tr = useTr();
  return (
    <div className="space-y-12">
      <Section title={l("Breadcrumb", "مسار التنقل")} description={l("Where this page sits. The separators point the reading way; the current page is aria-current.", "موقع هذه الصفحة. الفواصل تشير باتجاه القراءة؛ والصفحة الحالية aria-current.")}>
        <Example code={`<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem><BreadcrumbLink href="/projects">Projects</BreadcrumbLink></BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem><BreadcrumbPage>Website redesign</BreadcrumbPage></BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>`}>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem><BreadcrumbLink href="#breadcrumb">{tr(l("Home", "الرئيسية"))}</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbEllipsis /></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbLink href="#breadcrumb">{tr(l("Projects", "المشاريع"))}</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>{tr(l("Website redesign", "إعادة تصميم الموقع"))}</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </Example>
      </Section>
    </div>
  );
}

export function PaginationPage() {
  const [page, setPage] = React.useState(2);
  const go = (p: number) => (e: React.MouseEvent) => { e.preventDefault(); setPage(Math.min(5, Math.max(1, p))); };
  return (
    <div className="space-y-12">
      <Section title={l("Pagination", "ترقيم الصفحات")} description={l("Page links for long, server-paged lists (List View has its own pager). Strings are localized; the chevrons point the reading way.", "روابط الصفحات للقوائم الطويلة المجزّأة على الخادم (لعرض القائمة ترقيمه الخاص). النصوص مترجمة؛ والأسهم تشير باتجاه القراءة.")}>
        <Example code={`<Pagination>
  <PaginationContent>
    <PaginationItem><PaginationPrevious href="?page=1" /></PaginationItem>
    <PaginationItem><PaginationLink href="?page=2" isActive>2</PaginationLink></PaginationItem>
    <PaginationItem><PaginationEllipsis /></PaginationItem>
    <PaginationItem><PaginationNext href="?page=3" /></PaginationItem>
  </PaginationContent>
</Pagination>`}>
          <Pagination>
            <PaginationContent>
              <PaginationItem><PaginationPrevious href="#pagination" onClick={go(page - 1)} /></PaginationItem>
              {[1, 2, 3].map((p) => (
                <PaginationItem key={p}><PaginationLink href="#pagination" isActive={p === page} onClick={go(p)}>{p}</PaginationLink></PaginationItem>
              ))}
              <PaginationItem><PaginationEllipsis /></PaginationItem>
              <PaginationItem><PaginationLink href="#pagination" isActive={page === 5} onClick={go(5)}>5</PaginationLink></PaginationItem>
              <PaginationItem><PaginationNext href="#pagination" onClick={go(page + 1)} /></PaginationItem>
            </PaginationContent>
          </Pagination>
          <Out>page: {page}</Out>
        </Example>
      </Section>
    </div>
  );
}

export function NavigationMenuPage() {
  const tr = useTr();
  return (
    <div className="space-y-12">
      <Section title={l("Navigation menu", "قائمة التنقّل")} description={l("Site-style top navigation with panels. For an app, prefer the AppShell's sidebar.", "تنقّل علوي بأسلوب المواقع مع لوحات. للتطبيقات، فضّل الشريط الجانبي في هيكل التطبيق.")}>
        <Example className="min-h-[260px]" code={`<NavigationMenu>
  <NavigationMenuList>
    <NavigationMenuItem>
      <NavigationMenuTrigger>Projects</NavigationMenuTrigger>
      <NavigationMenuContent>…links…</NavigationMenuContent>
    </NavigationMenuItem>
    <NavigationMenuItem>
      <NavigationMenuLink href="/docs" className={navigationMenuTriggerStyle()}>Docs</NavigationMenuLink>
    </NavigationMenuItem>
  </NavigationMenuList>
</NavigationMenu>`}>
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger>{tr(l("Projects", "المشاريع"))}</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[280px] gap-1 p-2">
                    {[[l("All projects", "كل المشاريع"), l("Every project you can see.", "كل المشاريع التي يمكنك رؤيتها.")], [l("Portfolio", "المحفظة"), l("Health across programmes.", "الحالة عبر البرامج.")]].map(([t, d], i) => (
                      <li key={i}>
                        <NavigationMenuLink href="#navigation-menu" className="block rounded-md p-3 text-sm hover:bg-accent focus:bg-accent focus:outline-none">
                          <span className="font-medium">{tr(t)}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">{tr(d)}</span>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink href="#navigation-menu" className={navigationMenuTriggerStyle()}>{tr(l("Docs", "التوثيق"))}</NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </Example>
      </Section>
    </div>
  );
}

const REPOS: ComboOption[] = [
  { value: "solvfast/pmo", label: "solvfast/pmo", description: "Projects & delivery" },
  { value: "solvfast/ui", label: "solvfast/ui", description: "This package" },
  { value: "solvfast/api", label: "solvfast/api", description: "Backend services" },
  { value: "solvfast/docs", label: "solvfast/docs", description: "Handbook" },
];
/** A pretend server: answers after 400 ms. */
const searchRepos = (q: string) => new Promise<ComboOption[]>((r) => setTimeout(() => r(REPOS.filter((o) => o.value.includes(q.trim().toLowerCase()))), 400));

export function SearchComboboxPage() {
  const tr = useTr();
  const [repo, setRepo] = React.useState<string>();
  return (
    <div className="space-y-12">
      <Section title={l("Search combobox", "مربع البحث والاختيار")} description={l("Pick one record found by a server search (Frappe Link fields, GitHub repos…). Loads when opened, then 200 ms after typing stops; late answers to older searches are ignored.", "اختيار سجل واحد يُعثر عليه ببحث على الخادم (حقول الربط في فرابيه، مستودعات GitHub…). يحمّل عند الفتح، ثم بعد 200 م.ث من التوقف عن الكتابة؛ وتُتجاهل الإجابات المتأخرة لعمليات بحث أقدم.")}>
        <Example code={`<Label htmlFor="repo">Repository</Label>
<SearchCombobox id="repo" value={repo} onSelect={setRepo}
  search={(q) => api.searchRepos(q)}        // Promise<{ value, label, description? }[]>
  placeholder="Select a repository" searchPlaceholder="Search repositories…" emptyText="No repositories" />`}>
          <div className="max-w-sm space-y-2">
            <Label htmlFor="sc-repo">{tr(l("Repository", "المستودع"))}</Label>
            <SearchCombobox id="sc-repo" value={repo} onSelect={setRepo} search={searchRepos}
              placeholder={tr(l("Select a repository", "اختر مستودعاً"))} searchPlaceholder={tr(l("Search repositories…", "ابحث في المستودعات…"))} emptyText={tr(l("No repositories", "لا توجد مستودعات"))} />
          </div>
          <Out>value: {repo ? `"${repo}"` : "undefined"}</Out>
        </Example>
        <Props rows={[
          ["search", "(q) => Promise<ComboOption[]>", l("Called with the typed text; results show as returned (no client filtering).", "تُستدعى بالنص المكتوب؛ تظهر النتائج كما أُعيدت (دون تصفية محلية).")],
          ["queryKey", "string?", l("Optional reset key: when it changes, loaded options are dropped and reloaded (PMO's React Query key; no cache).", "مفتاح إعادة ضبط اختياري: عند تغيّره تُحذف الخيارات المحمّلة وتُعاد (مفتاح React Query في PMO؛ دون تخزين مؤقت).")],
          ["value · onSelect · id", "", l("The selected value, the callback, and the trigger's id (for a <Label htmlFor>).", "القيمة المختارة والدالة ومعرّف الزر (لاستخدام ‎<Label htmlFor>‎).")],
        ]} />
      </Section>
    </div>
  );
}

const XSS_SAMPLE = `<p>Hello <b>team</b> — see <a href="https://example.com">the brief</a>.</p><img src="x" onerror="window.__sfXss = 1"><a href="javascript:window.__sfXss = 2">bad link</a><script>window.__sfXss = 3</script><font><img src="x" onerror="window.__sfXss = 4"></font>`;

export function RichTextPage() {
  const tr = useTr();
  const [html, setHtml] = React.useState("<p>Kick-off on <b>Sunday</b>.</p><ul><li>Scope</li><li>Owners</li></ul>");
  return (
    <div className="space-y-12">
      <Section title={l("Rich text", "النص المنسّق")} description={l("A lightweight editor (bold, italic, underline, strike, lists) and its read-only view. Everything it shows or emits is sanitized.", "محرّر خفيف (عريض، مائل، تسطير، يتوسطه خط، قوائم) وعرضه للقراءة فقط. كل ما يعرضه أو يُخرجه منقّى.")}>
        <Example code={`<RichTextEditor value={html} onChange={setHtml} ariaLabel="Description" placeholder="Write…" />
<RichText value={html} />          // read-only; sanitizes whatever it is given`}>
          <div className="max-w-xl space-y-4">
            <RichTextEditor value={html} onChange={setHtml} ariaLabel={tr(l("Description", "الوصف"))} placeholder={tr(l("Write a description…", "اكتب وصفاً…"))} />
            <div className="rounded-xl border border-border p-4"><RichText value={html} /></div>
            <pre data-testid="rte-html" dir="ltr" className="overflow-x-auto rounded-md bg-muted/50 p-2 text-[11px]">{html}</pre>
          </div>
        </Example>
        <Example title={l("Untrusted HTML is sanitized", "الـ HTML غير الموثوق يُنقّى")} code={`<RichText value={'<img src=x onerror=…><a href="javascript:…">…</a><script>…</script>'} />
sanitizeHtml(html)   // allowlist: text + p, br, div, span, b, strong, i, em, u, s, strike, ul, ol, li, h3, blockquote, code, a[href=http(s)/mailto]`}>
          <div data-testid="rte-xss" className="max-w-xl rounded-xl border border-border p-4"><RichText value={XSS_SAMPLE} /></div>
        </Example>
      </Section>
    </div>
  );
}

type Profile = { name: string; email: string };
export function FormPage() {
  const tr = useTr();
  const form = useForm<Profile>({ defaultValues: { name: "", email: "" } });
  const [saved, setSaved] = React.useState<Profile | null>(null);
  return (
    <div className="space-y-12">
      <Section title={l("Form", "النموذج")} description={l("@solvfast/ui/form: labels, descriptions and error messages wired to react-hook-form (needs react-hook-form 7 in the app).", "‏@solvfast/ui/form: تسميات وأوصاف ورسائل خطأ موصولة بـ react-hook-form (يتطلّب react-hook-form 7 في التطبيق).")}>
        <Example code={`import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@solvfast/ui/form";

const form = useForm({ defaultValues: { name: "" } });
<Form {...form}>
  <form onSubmit={form.handleSubmit(save)}>
    <FormField control={form.control} name="name" rules={{ required: "Name is required" }} render={({ field }) => (
      <FormItem>
        <FormLabel>Name</FormLabel>
        <FormControl><Input {...field} /></FormControl>
        <FormDescription>Shown on invoices.</FormDescription>
        <FormMessage />
      </FormItem>
    )} />
  </form>
</Form>`}>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(setSaved)} className="max-w-sm space-y-4" noValidate>
              <FormField control={form.control} name="name" rules={{ required: tr(l("Name is required", "الاسم مطلوب")) }} render={({ field }) => (
                <FormItem>
                  <FormLabel>{tr(l("Name", "الاسم"))}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormDescription>{tr(l("Shown on invoices.", "يظهر في الفواتير."))}</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" rules={{ pattern: { value: /^\S+@\S+\.\S+$/, message: tr(l("Enter a valid email", "أدخل بريداً صحيحاً")) } }} render={({ field }) => (
                <FormItem>
                  <FormLabel>{tr(l("Email (optional)", "البريد (اختياري)"))}</FormLabel>
                  <FormControl><Input type="email" dir="ltr" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit">{tr(l("Save", "حفظ"))}</Button>
            </form>
          </Form>
          <Out>submitted: {saved ? JSON.stringify(saved) : "—"}</Out>
        </Example>
      </Section>
    </div>
  );
}

export function PageHeaderPage() {
  const tr = useTr();
  const { theme } = useTheme();
  const { language } = useLocale();
  const [title, setTitle] = React.useState(tr(l("Website redesign", "إعادة تصميم الموقع")));
  const [went, setWent] = React.useState("");
  return (
    <div className="space-y-12">
      <Section title={l("Page header", "رأس الصفحة")} description={l("Back button, title, subtitle, a details row and actions. Router-free: you navigate in onBack. Inside an AppShell, a text title becomes the top bar's title (the page's one h1) and the header keeps only the rest.", "زر الرجوع والعنوان والعنوان الفرعي وصف التفاصيل والإجراءات. دون موجّه: أنت تنتقل داخل onBack. داخل هيكل التطبيق يصبح العنوان النصي عنوان الشريط العلوي (عنوان h1 الوحيد للصفحة) ويحتفظ الرأس بالباقي.")}>
        <Example className="p-0" code={`<PageHeader
  title={<EditableTitle value={title} canEdit onSave={rename} />}
  subtitle="PRJ-0042"
  meta={<StatusDot tone="success" label="On track" />}
  actions={<Button size="sm">Share</Button>}
  onBack={() => navigate(-1)}            // "Back" / "رجوع"; the arrow follows the direction
/>`}>
          <PageHeader
            title={<EditableTitle value={title} canEdit onSave={setTitle} />}
            subtitle="PRJ-0042"
            meta={<div className="flex flex-wrap items-center gap-3"><StatusDot tone="success" label={tr(l("On track", "على المسار"))} /><Badge variant="secondary">{tr(l("Due 30 Nov", "الاستحقاق 30 نوفمبر"))}</Badge></div>}
            actions={<><Button size="sm" variant="outline">{tr(l("Share", "مشاركة"))}</Button><Button size="sm"><CheckCircle2 />{tr(l("Complete", "إكمال"))}</Button></>}
            onBack={() => setWent("back")}
          />
        </Example>
        <Out>title: "{title}" · onBack: {went || "—"}</Out>
        <Example title={l("Inside an AppShell", "داخل هيكل التطبيق")} className="p-0" code={`<AppShell …>
  <PageHeader title={{ en: "Website redesign", ar: "إعادة تصميم الموقع" }} subtitle="PRJ-0042" onBack={back} actions={…} />
  {/* the top bar now reads "Website redesign"; no second heading in the page */}
</AppShell>`}>
          <iframe key={`${theme}-${language}`} src="./#/demo/app-shell/page-header" title={tr(l("Page header in the app shell", "رأس الصفحة داخل هيكل التطبيق"))} className="block h-[420px] w-full" />
        </Example>
        <Props rows={[
          ["title", "ReactNode | string | { en, ar }", l("Text titles go to the AppShell's top bar when inside one; nodes always render in place.", "العناوين النصية تنتقل إلى الشريط العلوي داخل هيكل التطبيق؛ والعُقد تُعرض في مكانها دائماً.")],
          ["onBack · backLabel", "() => void · string", l("Shows the back button; the label defaults to the package's \"back\" message.", "يُظهر زر الرجوع؛ التسمية الافتراضية رسالة \"back\" في الحزمة.")],
          ["<EditableTitle>", "value · canEdit · onSave", l("Click to edit; Enter or leaving saves, Esc cancels.", "انقر للتعديل؛ Enter أو المغادرة تحفظ، وEsc تلغي.")],
        ]} />
      </Section>
    </div>
  );
}
