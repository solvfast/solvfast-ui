/** 0.3.0 — every merged component, including the two optional-peer entries (@ui/chart on recharts, @ui/form on
 *  react-hook-form). Rendered by the playground (?view=merged) and, through e2e/consumers/run.sh, by both clean
 *  installs (path A and path B). Playground only. */
import * as React from "react";
import { useForm } from "react-hook-form";
import { Bar, BarChart, XAxis } from "recharts";
import { Bold, Terminal } from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger, Alert, AlertDescription, AlertTitle, AspectRatio,
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Collapsible,
  CollapsibleContent, CollapsibleTrigger, ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, EditableTitle,
  HoverCard, HoverCardContent, HoverCardTrigger, Input, Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger,
  NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger,
  PageHeader, Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, Pill, Progress,
  RichText, RichTextEditor, SearchCombobox, Slider, StatusDot, Toggle, ToggleGroup, ToggleGroupItem, useLocale, type ComboOption,
} from "@ui";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@ui/chart";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ui/form";

const OPTIONS: ComboOption[] = [{ value: "acme/api", label: "acme/api", description: "Backend" }, { value: "acme/web", label: "acme/web" }];

export function MergedPage() {
  const { isRTL } = useLocale();
  const L = (en: string, ar: string) => (isRTL ? ar : en);
  const [title, setTitle] = React.useState("Website redesign");
  const [repo, setRepo] = React.useState<string>();
  const [html, setHtml] = React.useState("<p>Kick-off on <b>Sunday</b>.</p>");
  const [picked, setPicked] = React.useState("");
  const form = useForm<{ name: string }>({ defaultValues: { name: "" } });
  const config = { opened: { label: L("Opened", "مفتوحة"), color: "hsl(var(--primary))" } } satisfies ChartConfig;
  const data = [["Jan", 186], ["Feb", 305], ["Mar", 237], ["Apr", 73]].map(([m, v]) => ({ m, opened: v as number }));
  return (
    <div className="space-y-8 pb-24">
      <div data-testid="page-header">
        <PageHeader title={<EditableTitle value={title} canEdit onSave={setTitle} />} subtitle="PRJ-0042" meta={<StatusDot tone="success" label={L("On track", "على المسار")} />} onBack={() => setPicked("back")} actions={<Button size="sm">{L("Share", "مشاركة")}</Button>} />
      </div>
      <div className="grid gap-6 px-6 md:grid-cols-2">
        <div data-testid="alert"><Alert><Terminal className="h-4 w-4" /><AlertTitle>{L("Heads up", "تنبيه")}</AlertTitle><AlertDescription>{L("Syncs every 5 minutes.", "مزامنة كل 5 دقائق.")}</AlertDescription></Alert></div>
        <div data-testid="progress" className="space-y-4"><Progress value={40} aria-label={L("Upload", "الرفع")} /><Slider defaultValue={[50]} max={100} aria-label={L("Volume", "الصوت")} /></div>
        <div data-testid="toggles" className="flex flex-wrap items-center gap-3">
          <Toggle aria-label={L("Bold", "عريض")}><Bold /></Toggle>
          <ToggleGroup type="single" defaultValue="a" aria-label={L("Alignment", "المحاذاة")}><ToggleGroupItem value="a">A</ToggleGroupItem><ToggleGroupItem value="b">B</ToggleGroupItem></ToggleGroup>
          <StatusDot tone="warning" label={L("At risk", "معرّض للخطر")} /><Pill>{L("Priority: high", "الأولوية: عالية")}</Pill>
        </div>
        <div data-testid="nav" className="space-y-3">
          <Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href="#">{L("Projects", "المشاريع")}</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>PRJ-0042</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
          <Pagination className="justify-start"><PaginationContent><PaginationItem><PaginationPrevious href="#" /></PaginationItem><PaginationItem><PaginationLink href="#" isActive>1</PaginationLink></PaginationItem><PaginationItem><PaginationNext href="#" /></PaginationItem></PaginationContent></Pagination>
        </div>
        <div data-testid="accordion">
          <Accordion type="single" collapsible><AccordionItem value="q"><AccordionTrigger>{L("Who can see it?", "من يمكنه رؤيته؟")}</AccordionTrigger><AccordionContent>{L("The team.", "الفريق.")}</AccordionContent></AccordionItem></Accordion>
          <Collapsible><CollapsibleTrigger asChild><Button variant="ghost" size="sm">{L("More", "المزيد")}</Button></CollapsibleTrigger><CollapsibleContent>INV-004</CollapsibleContent></Collapsible>
        </div>
        <div data-testid="aspect" className="max-w-xs"><AspectRatio ratio={16 / 9} className="rounded-xl bg-primary/10" /></div>
        <div data-testid="combobox" className="max-w-xs">
          <SearchCombobox value={repo} onSelect={setRepo} search={async (q) => OPTIONS.filter((o) => o.value.includes(q))} placeholder={L("Select a repository", "اختر مستودعاً")} searchPlaceholder={L("Search…", "بحث…")} emptyText={L("None", "لا شيء")} />
        </div>
        <div data-testid="rich-text" className="space-y-3"><RichTextEditor value={html} onChange={setHtml} ariaLabel={L("Description", "الوصف")} /><RichText value={html} /></div>
        <div data-testid="popups" className="flex flex-wrap items-center gap-4">
          <HoverCard><HoverCardTrigger data-testid="hover-trigger" href="#">@rana</HoverCardTrigger><HoverCardContent>{L("Project manager", "مديرة مشاريع")}</HoverCardContent></HoverCard>
          <ContextMenu><ContextMenuTrigger data-testid="ctx" className="rounded-md border border-dashed border-border px-4 py-3 text-sm">{L("Right-click", "انقر بالزر الأيمن")}</ContextMenuTrigger><ContextMenuContent><ContextMenuItem onSelect={() => setPicked("ctx")}>{L("Open", "فتح")}</ContextMenuItem></ContextMenuContent></ContextMenu>
          <Menubar><MenubarMenu><MenubarTrigger>{L("File", "ملف")}</MenubarTrigger><MenubarContent><MenubarItem onSelect={() => setPicked("menubar")}>{L("New", "جديد")}</MenubarItem></MenubarContent></MenubarMenu></Menubar>
          <NavigationMenu><NavigationMenuList><NavigationMenuItem><NavigationMenuTrigger>{L("Projects", "المشاريع")}</NavigationMenuTrigger><NavigationMenuContent><NavigationMenuLink href="#" className="block w-48 p-3 text-sm">{L("All projects", "كل المشاريع")}</NavigationMenuLink></NavigationMenuContent></NavigationMenuItem></NavigationMenuList></NavigationMenu>
        </div>
        <div data-testid="chart"><ChartContainer config={config} className="h-48 w-full"><BarChart data={data}><XAxis dataKey="m" reversed={isRTL} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="opened" fill="var(--color-opened)" radius={4} /></BarChart></ChartContainer></div>
        <div data-testid="form">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => setPicked(`form:${v.name}`))} className="space-y-3" noValidate>
              <FormField control={form.control} name="name" rules={{ required: L("Name is required", "الاسم مطلوب") }} render={({ field }) => (
                <FormItem><FormLabel>{L("Name", "الاسم")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit">{L("Save", "حفظ")}</Button>
            </form>
          </Form>
        </div>
      </div>
      <p data-testid="picked" className="px-6 font-mono text-xs" dir="ltr">picked: {picked || "-"} · repo: {repo ?? "-"}</p>
    </div>
  );
}
