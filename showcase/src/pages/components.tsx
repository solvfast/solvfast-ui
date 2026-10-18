import * as React from "react";
import { Bell, Check, Clock, Download, Globe2, History, Layers, ListChecks, Plus, Search, Settings, Sparkles, Trash2 } from "lucide-react";
import {
  Avatar, AvatarFallback, AvatarImage, Badge, Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
  Checkbox, IconStatCard, Input, Label, RadioGroup, RadioGroupItem, ScrollArea, Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator,
  SelectTrigger, SelectValue, Separator, Skeleton, StatCard, Switch, Tabs, TabsContent, TabsList, TabsTrigger, Textarea, Tooltip,
  TooltipContent, TooltipProvider, TooltipTrigger,
} from "@ui";
import avatarImg from "../../../playground/src/demo/sear-assets/customer-icon.png";
import { DS_STATS, MODULE_CARDS } from "../../../playground/src/demo/cards-demo";
import { Cell, Example, Props, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";

const VARIANTS = ["default", "secondary", "outline", "ghost", "destructive", "ai-outline", "text"] as const;

export function Buttons() {
  const tr = useTr();
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="space-y-12">
      <Section title={l("Variants", "الأنواع")} description={l("Primary for the main action; secondary, outline and ghost for the rest; destructive for removals; ai-outline only for AI actions; text for inline actions.", "الأساسي للإجراء الرئيسي؛ الثانوي والمحدّد والشفاف للباقي؛ الهدّام للحذف؛ ai-outline لإجراءات الذكاء الاصطناعي فقط؛ النصي للإجراءات داخل النص.")}>
        <Example center code={`<Button>Save</Button>
<Button variant="secondary">Draft</Button>
<Button variant="outline">Cancel</Button>
<Button variant="ghost">More</Button>
<Button variant="destructive">Delete</Button>
<Button variant="ai-outline"><Sparkles /> Generate</Button>
<Button variant="text">Learn more</Button>`}>
          {VARIANTS.map((v) => (
            <Cell key={v} label={v}>
              <Button variant={v}>{v === "ai-outline" && <Sparkles className="h-4 w-4" />}{tr({
                default: l("Save", "حفظ"), secondary: l("Draft", "مسودّة"), outline: l("Cancel", "إلغاء"), ghost: l("More", "المزيد"),
                destructive: l("Delete", "حذف"), "ai-outline": l("Generate", "توليد"), text: l("Learn more", "اعرف المزيد"),
              }[v])}</Button>
            </Cell>
          ))}
        </Example>
      </Section>
      <Section title={l("Sizes", "الأحجام")}>
        <Example center code={`<Button size="xs">Extra small</Button>
<Button size="sm">Small</Button>
<Button>Default</Button>
<Button size="icon" aria-label="Add"><Plus /></Button>
<Button size="icon-sm" aria-label="Settings"><Settings /></Button>`}>
          <Cell label="xs"><Button size="xs">{tr(l("Extra small", "صغير جداً"))}</Button></Cell>
          <Cell label="sm"><Button size="sm">{tr(l("Small", "صغير"))}</Button></Cell>
          <Cell label="default"><Button>{tr(l("Default", "افتراضي"))}</Button></Cell>
          <Cell label="icon"><Button size="icon" aria-label={tr(l("Add", "إضافة"))}><Plus className="h-4 w-4" /></Button></Cell>
          <Cell label="icon-sm"><Button size="icon-sm" variant="outline" aria-label={tr(l("Settings", "الإعدادات"))}><Settings className="h-4 w-4" /></Button></Cell>
        </Example>
      </Section>
      <Section title={l("States and icons", "الحالات والأيقونات")} description={l("loading shows a spinner and disables the button; icons sit at either end; fullWidth stretches it.", "‏loading يعرض مؤشّراً ويعطّل الزر؛ الأيقونات في أي طرف؛ fullWidth يمدّه.")}>
        <Example center code={`<Button loading={saving} onClick={save}>Save</Button>
<Button disabled>Disabled</Button>
<Button variant="outline"><Download /> Export</Button>
<Button fullWidth>Continue</Button>`}>
          <Cell label="loading"><Button loading={busy} onClick={() => { setBusy(true); setTimeout(() => setBusy(false), 1600); }}>{tr(l("Click to save", "اضغط للحفظ"))}</Button></Cell>
          <Cell label="disabled"><Button disabled>{tr(l("Disabled", "معطّل"))}</Button></Cell>
          <Cell label="icon + label"><Button variant="outline" className="gap-2"><Download className="h-4 w-4" />{tr(l("Export", "تصدير"))}</Button></Cell>
          <Cell label="destructive + icon"><Button variant="destructive" className="gap-2"><Trash2 className="h-4 w-4" />{tr(l("Delete", "حذف"))}</Button></Cell>
          <div className="w-full max-w-sm"><Cell label="fullWidth"><Button fullWidth>{tr(l("Continue", "متابعة"))}</Button></Cell></div>
        </Example>
        <Props rows={[
          ["variant", VARIANTS.map((v) => `"${v}"`).join(" | "), l("Look and emphasis.", "الشكل ودرجة الإبراز.")],
          ["size", '"xs" | "sm" | "default" | "icon" | "icon-sm"', l("Height and padding; icon sizes are square.", "الارتفاع والهوامش؛ أحجام الأيقونة مربّعة.")],
          ["loading", "boolean", l("Spinner, and disabled while true.", "مؤشّر، ومعطّل ما دام true.")],
          ["fullWidth", "boolean", l("Fill the container's width.", "ملء عرض الحاوية.")],
          ["asChild", "boolean", l("Render the styles on your own element (e.g. a link).", "تطبيق الأنماط على عنصرك الخاص (مثل رابط).")],
        ]} />
      </Section>
    </div>
  );
}

const BADGES = ["default", "secondary", "outline", "destructive", "brand", "success", "warning", "info"] as const;
export function Badges() {
  const tr = useTr();
  return (
    <div className="space-y-12">
      <Section title={l("Variants", "الأنواع")} description={l("Badges label; they are not buttons. Pair colour with text — never colour alone.", "الشارات تسمية وليست أزراراً. اجمع اللون مع النص — لا تعتمد على اللون وحده.")}>
        <Example center code={`<Badge>Default</Badge>
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="destructive">Overdue</Badge>`}>
          {BADGES.map((v) => (
            <Cell key={v} label={v}><Badge variant={v}>{tr({
              default: l("Default", "افتراضي"), secondary: l("Draft", "مسودّة"), outline: l("Tag", "وسم"), destructive: l("Overdue", "متأخّر"),
              brand: l("New", "جديد"), success: l("Active", "نشط"), warning: l("Pending", "قيد الانتظار"), info: l("Beta", "تجريبي"),
            }[v])}</Badge></Cell>
          ))}
        </Example>
      </Section>
      <Section title={l("In context", "في السياق")}>
        <Example center>
          <span className="flex items-center gap-2 text-sm text-foreground">{tr(l("Inbox", "الوارد"))} <Badge variant="info" className="h-5 px-1.5">12</Badge></span>
          <span className="flex items-center gap-2 text-sm text-foreground">{tr(l("Status", "الحالة"))} <Badge variant="success" className="gap-1"><Check className="h-3 w-3" />{tr(l("Approved", "معتمد"))}</Badge></span>
        </Example>
      </Section>
    </div>
  );
}

export function Cards() {
  const tr = useTr();
  return (
    <div className="space-y-12">
      <Section title={l("Structure", "البنية")} description={l("Card is the glass container; CardHeader, CardTitle, CardDescription, CardContent and CardFooter lay out its parts.", "‏Card هي الحاوية الزجاجية؛ وتنظّم CardHeader و CardTitle و CardDescription و CardContent و CardFooter أجزاءها.")}>
        <Example code={`<Card>
  <CardHeader>
    <CardTitle>Field presets</CardTitle>
    <CardDescription>Reusable groups of form fields.</CardDescription>
  </CardHeader>
  <CardContent>128 fields in 9 presets</CardContent>
  <CardFooter><Button size="sm">Open</Button></CardFooter>
</Card>`}>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>{tr(l("Field presets", "مجموعات الحقول"))}</CardTitle><CardDescription>{tr(l("Reusable groups of form fields.", "مجموعات قابلة لإعادة الاستخدام من حقول النماذج."))}</CardDescription></CardHeader>
              <CardContent className="text-sm text-muted-foreground">{tr(l("128 fields in 9 presets", "128 حقلاً في 9 مجموعات"))}</CardContent>
              <CardFooter className="gap-2"><Button size="sm">{tr(l("Open", "فتح"))}</Button><Button size="sm" variant="ghost">{tr(l("Share", "مشاركة"))}</Button></CardFooter>
            </Card>
            <Card>
              <CardHeader><CardDescription>{tr(l("Open requests", "الطلبات المفتوحة"))}</CardDescription><CardTitle className="font-brand text-4xl">42</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">{tr(l("+6 since yesterday", "‎+6‎ منذ الأمس"))}</CardContent>
            </Card>
          </div>
        </Example>
      </Section>
    </div>
  );
}

export function StatCards() {
  const [opened, setOpened] = React.useState("");
  return (
    <div className="space-y-12">
      <Section title={l("StatCard — from the Design System", "‏StatCard — من نظام التصميم")} description={l("The Design System's stat card (section “Data display — stat cards”): liquid glass, a label, a large value and an optional trend pill — green when up, red when down.", "بطاقة الإحصاء في نظام التصميم (قسم «عرض البيانات — بطاقات إحصائية»): زجاج سائل وتسمية وقيمة كبيرة وشارة اتجاه اختيارية — خضراء للصعود وحمراء للهبوط.")}>
        <Example code={`<StatCard label="Components" value="128" trend={{ value: "+12%", direction: "up" }} />
<StatCard label="Tokens" value="342" trend={{ value: "+4%", direction: "up" }} />
<StatCard label="Deprecated" value="7" trend={{ value: "-2%", direction: "down" }} />`}>
          <div className="grid gap-4 sm:grid-cols-3">
            {DS_STATS.map(([label, value, delta, up]) => (
              <StatCard key={label} label={label} value={value} trend={{ value: delta, direction: up ? "up" : "down" }} />
            ))}
          </div>
        </Example>
        <Example title={l("Localised label and number, no trend, clickable", "تسمية ورقم مترجمان، دون اتجاه، قابلة للنقر")} code={`<StatCard label={{ en: "Open tickets", ar: "التذاكر المفتوحة" }} value={1280} onClick={openTickets} />`}>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label={{ en: "Open tickets", ar: "التذاكر المفتوحة" }} value={1280} onClick={() => setOpened("open-tickets")} />
          </div>
        </Example>
      </Section>
      <Section title={l("IconStatCard — from Sear's overview", "‏IconStatCard — من نظرة سير العامة")} description={l("Sear Studio's overview card: the container pane, a tinted icon square, the module name and its total. Sear colours the squares by grid position (row + column) from its brand palette; that rotation is the app's, shown here with the playground's data.", "بطاقة نظرة استوديو سير العامة: لوحة الحاوية ومربع أيقونة ملوّن واسم الوحدة وإجماليها. يلوّن سير المربعات حسب موضعها في الشبكة (الصف + العمود) من ألوان علامته؛ هذا التدوير من التطبيق، ويظهر هنا ببيانات الملعب.")}>
        <Example code={`<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
  {modules.map((m) => (
    <IconStatCard key={m.id} label={{ en: m.en, ar: m.ar }} value={m.total} icon={m.icon} color={m.color}
      href={m.href} onClick={(e) => { e.preventDefault(); navigate(m.href); }} />
  ))}
</div>`}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {MODULE_CARDS.map((c) => (
              <IconStatCard key={c.id} label={c.label} value={c.total} icon={c.icon} color={c.color} onClick={() => setOpened(c.id)} />
            ))}
          </div>
          <p className="mt-4 font-mono text-xs text-muted-foreground" dir="ltr">{opened ? `onClick → ${opened}` : ""}</p>
        </Example>
      </Section>
      <Section title={l("Props", "الخصائص")}>
        <Props rows={[
          ["label", 'string | { en, ar }', l("The name above (StatCard) or beside the icon (IconStatCard).", "الاسم فوق القيمة (StatCard) أو بجانب الأيقونة (IconStatCard).")],
          ["value", "number | string", l("Numbers are formatted for the language (Arabic digits in Arabic); strings are shown as given.", "تُنسَّق الأرقام حسب اللغة (أرقام عربية في العربية)؛ النصوص تُعرض كما هي.")],
          ["trend", '{ value, direction: "up" | "down" }', l("StatCard: the pill — green up, red down.", "‏StatCard: الشارة — خضراء للصعود وحمراء للهبوط.")],
          ["icon · color", "LucideIcon · CSS colour", l("IconStatCard: the icon (default Layers) and its colour; the square is that colour at 10%. Default violet #512195, the same in both themes, as in Sear.", "‏IconStatCard: الأيقونة (افتراضياً Layers) ولونها؛ المربع بنفس اللون بنسبة 10%. الافتراضي البنفسجي ‎#512195‎، نفسه في السمتين كما في سير.")],
          ["href · onClick", "", l("href renders a link, onClick alone a button; otherwise a plain card. The package never navigates — with a router, handle onClick.", "‏href يجعلها رابطاً، و onClick وحده زراً؛ وإلا فهي بطاقة عادية. الحزمة لا تنتقل أبداً — مع موجّه، عالج onClick.")],
        ]} />
      </Section>
    </div>
  );
}

export function Fields() {
  const tr = useTr();
  return (
    <div className="space-y-12">
      <Section title={l("Input and Textarea", "حقل الإدخال ومنطقة النص")} description={l("Always pair a field with a Label (or an aria-label).", "اربط كل حقل بتسمية Label (أو aria-label).")}>
        <Example code={`<Label htmlFor="name">Name</Label>
<Input id="name" placeholder="Corporate booking" />
<Label htmlFor="notes">Notes</Label>
<Textarea id="notes" rows={3} />
<Input disabled value="Read only" />`}>
          <div className="grid max-w-xl gap-5">
            <div className="grid gap-1.5"><Label htmlFor="sc-name">{tr(l("Name", "الاسم"))}</Label><Input id="sc-name" placeholder={tr(l("Corporate booking", "حجز الشركات"))} /></div>
            <div className="grid gap-1.5">
              <Label htmlFor="sc-search">{tr(l("With an icon", "مع أيقونة"))}</Label>
              <div className="relative"><Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="sc-search" className="ps-9" placeholder={tr(l("Search…", "بحث…"))} /></div>
            </div>
            <div className="grid gap-1.5"><Label htmlFor="sc-notes">{tr(l("Notes", "ملاحظات"))}</Label><Textarea id="sc-notes" rows={3} placeholder={tr(l("Add details…", "أضف التفاصيل…"))} /><p className="text-xs text-muted-foreground">{tr(l("A hint under the field.", "تلميح تحت الحقل."))}</p></div>
            <div className="grid gap-1.5"><Label htmlFor="sc-dis">{tr(l("Disabled", "معطّل"))}</Label><Input id="sc-dis" disabled defaultValue={tr(l("Read only", "للقراءة فقط"))} /></div>
          </div>
        </Example>
      </Section>
    </div>
  );
}

export function Choices() {
  const tr = useTr();
  const [notify, setNotify] = React.useState(true);
  const [all, setAll] = React.useState<boolean | "indeterminate">("indeterminate");
  return (
    <div className="space-y-12">
      <Section title={l("Checkbox", "مربع الاختيار")} description={l("Checked, unchecked, indeterminate (some of a group) and disabled.", "محدّد وغير محدّد وجزئي (بعض المجموعة) ومعطّل.")}>
        <Example code={`<Checkbox id="terms" checked={checked} onCheckedChange={setChecked} />
<Label htmlFor="terms">Accept the terms</Label>
<Checkbox checked="indeterminate" />`}>
          <div className="flex flex-wrap gap-8">
            <label className="flex items-center gap-2 text-sm"><Checkbox defaultChecked /> {tr(l("Checked", "محدّد"))}</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox /> {tr(l("Unchecked", "غير محدّد"))}</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={all} onCheckedChange={(c) => setAll(c)} /> {tr(l("Some selected (click)", "تحديد جزئي (اضغط)"))}</label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground"><Checkbox disabled /> {tr(l("Disabled", "معطّل"))}</label>
          </div>
        </Example>
      </Section>
      <Section title={l("Switch", "المفتاح")} description={l("For settings that apply at once.", "للإعدادات التي تُطبّق فوراً.")}>
        <Example code={`<Switch id="notify" checked={on} onCheckedChange={setOn} />
<Label htmlFor="notify">Email notifications</Label>`}>
          <div className="flex flex-wrap gap-8">
            <label className="flex items-center gap-3 text-sm"><Switch checked={notify} onCheckedChange={setNotify} /> {tr(l("Email notifications", "إشعارات البريد"))} <Badge variant={notify ? "success" : "secondary"}>{notify ? tr(l("On", "مفعّل")) : tr(l("Off", "متوقّف"))}</Badge></label>
            <label className="flex items-center gap-3 text-sm text-muted-foreground"><Switch disabled /> {tr(l("Disabled", "معطّل"))}</label>
          </div>
        </Example>
      </Section>
    </div>
  );
}

export function SelectPage() {
  const tr = useTr();
  const [v, setV] = React.useState("medium");
  return (
    <div className="space-y-12">
      <Section title={l("Single choice", "اختيار واحد")} description={l("Keyboard and screen-reader friendly; mirrors in Arabic.", "يعمل بلوحة المفاتيح وقارئ الشاشة؛ ينعكس في العربية.")}>
        <Example code={`<Select value={priority} onValueChange={setPriority}>
  <SelectTrigger className="w-56" aria-label="Priority"><SelectValue placeholder="Priority" /></SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Priority</SelectLabel>
      <SelectItem value="high">High</SelectItem>
      <SelectItem value="medium">Medium</SelectItem>
      <SelectItem value="low">Low</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>`}>
          <div className="flex flex-wrap items-end gap-6">
            <Cell label={`value: "${v}"`}>
              <Select value={v} onValueChange={setV}>
                <SelectTrigger className="w-56" aria-label={tr(l("Priority", "الأولوية"))}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>{tr(l("Priority", "الأولوية"))}</SelectLabel>
                    <SelectItem value="high">{tr(l("High", "عالية"))}</SelectItem>
                    <SelectItem value="medium">{tr(l("Medium", "متوسّطة"))}</SelectItem>
                    <SelectItem value="low">{tr(l("Low", "منخفضة"))}</SelectItem>
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectItem value="none" disabled>{tr(l("Unassigned (disabled)", "غير محدّدة (معطّل)"))}</SelectItem>
                </SelectContent>
              </Select>
            </Cell>
            <Cell label="placeholder">
              <Select>
                <SelectTrigger className="w-56" aria-label={tr(l("City", "المدينة"))}><SelectValue placeholder={tr(l("Choose a city", "اختر مدينة"))} /></SelectTrigger>
                <SelectContent>{[l("Riyadh", "الرياض"), l("Jeddah", "جدة"), l("Dammam", "الدمام")].map((c) => <SelectItem key={c.en} value={c.en}>{tr(c)}</SelectItem>)}</SelectContent>
              </Select>
            </Cell>
            <Cell label="disabled"><Select disabled><SelectTrigger className="w-40" aria-label="disabled"><SelectValue placeholder={tr(l("Disabled", "معطّل"))} /></SelectTrigger><SelectContent /></Select></Cell>
          </div>
        </Example>
      </Section>
    </div>
  );
}

export function TabsPage() {
  const tr = useTr();
  return (
    <div className="space-y-12">
      <Section title={l("Tabs", "علامات التبويب")} description={l("Sear's tab strip: a liquid-glass pill rail; the active tab is in the primary colour. Use for views of the same thing — not for navigation between pages. Arrow keys move between tabs (mirrored in Arabic), Home and End jump to the ends.", "شريط تبويب سير: سكة زجاجية على شكل حبة؛ التبويب النشط باللون الأساسي. للعروض المختلفة للشيء نفسه — لا للتنقّل بين الصفحات. الأسهم تتنقّل بين التبويبات (معكوسة في العربية)، و Home و End للطرفين.")}>
        <Example code={`<Tabs defaultValue="details">
  <TabsList aria-label="Preset">
    <TabsTrigger value="details">Details</TabsTrigger>
    <TabsTrigger value="fields">Fields</TabsTrigger>
    <TabsTrigger value="history" disabled>History</TabsTrigger>
  </TabsList>
  <TabsContent value="details">…</TabsContent>
</Tabs>`}>
          <Tabs defaultValue="details" className="max-w-xl">
            <TabsList aria-label={tr(l("Preset", "المجموعة"))}>
              <TabsTrigger value="details">{tr(l("Details", "التفاصيل"))}</TabsTrigger>
              <TabsTrigger value="fields">{tr(l("Fields", "الحقول"))}</TabsTrigger>
              <TabsTrigger value="history" disabled>{tr(l("History", "السجل"))}</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="pt-4 text-sm text-muted-foreground">{tr(l("Name, description and owner of the preset.", "اسم المجموعة ووصفها ومالكها."))}</TabsContent>
            <TabsContent value="fields" className="pt-4 text-sm text-muted-foreground">{tr(l("11 fields in 3 sections.", "11 حقلاً في 3 أقسام."))}</TabsContent>
          </Tabs>
        </Example>
        <Example title={l("With icons", "مع أيقونات")} code={`<TabsList aria-label="Sections">
  <TabsTrigger value="overview"><Layers />Overview</TabsTrigger>
  <TabsTrigger value="fields"><ListChecks />Fields</TabsTrigger>
</TabsList>`}>
          <Tabs defaultValue="fields">
            <TabsList aria-label={tr(l("Sections", "الأقسام"))}>
              <TabsTrigger value="overview"><Layers />{tr(l("Overview", "نظرة عامة"))}</TabsTrigger>
              <TabsTrigger value="fields"><ListChecks />{tr(l("Fields", "الحقول"))}</TabsTrigger>
              <TabsTrigger value="history"><History />{tr(l("History", "السجل"))}</TabsTrigger>
            </TabsList>
          </Tabs>
        </Example>
        <Example title={l("Full width, compact — Sear's Working Hours “Coverage” toggle", "بعرض كامل ومضغوط — مفتاح «نوع التغطية» في ساعات العمل في سير")} code={`<TabsList aria-label="Coverage" className="flex w-full max-w-md">
  <TabsTrigger value="24_7" className="min-w-0 flex-1 text-xs [&_svg]:size-3.5"><Globe2 />24/7</TabsTrigger>
  <TabsTrigger value="business" className="min-w-0 flex-1 text-xs [&_svg]:size-3.5"><Clock />Business Hours</TabsTrigger>
</TabsList>`}>
          <Tabs defaultValue="business">
            <TabsList aria-label={tr(l("Coverage", "نوع التغطية"))} className="flex w-full max-w-md">
              <TabsTrigger value="24_7" className="min-w-0 flex-1 text-xs [&_svg]:size-3.5"><Globe2 />24/7</TabsTrigger>
              <TabsTrigger value="business" className="min-w-0 flex-1 text-xs [&_svg]:size-3.5"><Clock />{tr(l("Business Hours", "ساعات العمل"))}</TabsTrigger>
            </TabsList>
          </Tabs>
        </Example>
      </Section>
    </div>
  );
}

export function AvatarPage() {
  const tr = useTr();
  return (
    <div className="space-y-12">
      <Section title={l("Image and fallback", "الصورة والبديل")} description={l("The fallback shows while the image loads or when it fails.", "يظهر البديل أثناء تحميل الصورة أو عند فشلها.")}>
        <Example center code={`<Avatar>
  <AvatarImage src={user.image} alt={user.name} />
  <AvatarFallback>SA</AvatarFallback>
</Avatar>`}>
          <Cell label="image"><Avatar><AvatarImage src={avatarImg} alt={tr(l("Customer", "عميل"))} /><AvatarFallback>CU</AvatarFallback></Avatar></Cell>
          <Cell label="fallback"><Avatar><AvatarImage src="/missing.png" alt="" /><AvatarFallback>{tr(l("SA", "سع"))}</AvatarFallback></Avatar></Cell>
          <Cell label="size via className"><Avatar className="h-14 w-14"><AvatarFallback className="text-lg">KM</AvatarFallback></Avatar></Cell>
          <Cell label="group">
            <div className="flex -space-x-2 rtl:space-x-reverse">
              {["SA", "KM", "OS", "LH"].map((i) => <Avatar key={i} className="border-2 border-background"><AvatarFallback>{i}</AvatarFallback></Avatar>)}
            </div>
          </Cell>
        </Example>
      </Section>
    </div>
  );
}

export function SkeletonSeparator() {
  const tr = useTr();
  return (
    <div className="space-y-12">
      <Section title={l("Skeleton", "الهيكل")} description={l("Shapes that stand in for content while it loads.", "أشكال تحلّ محل المحتوى أثناء التحميل.")}>
        <Example code={`<Skeleton className="h-10 w-10 rounded-full" />
<Skeleton className="h-4 w-48" />`}>
          <div className="flex items-center gap-4"><Skeleton className="h-12 w-12 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-56" /><Skeleton className="h-4 w-40" /></div></div>
        </Example>
      </Section>
      <Section title={l("Separator", "الفاصل")}>
        <Example code={`<Separator />
<Separator orientation="vertical" />`}>
          <div className="max-w-md space-y-3 text-sm">
            <p className="font-medium text-foreground">{tr(l("Field presets", "مجموعات الحقول"))}</p>
            <Separator />
            <div className="flex h-5 items-center gap-3 text-muted-foreground">
              <span>{tr(l("Fields", "الحقول"))}</span><Separator orientation="vertical" /><span>{tr(l("Sections", "الأقسام"))}</span><Separator orientation="vertical" /><span>{tr(l("History", "السجل"))}</span>
            </div>
          </div>
        </Example>
      </Section>
    </div>
  );
}

export function ScrollAreaPage() {
  const tr = useTr();
  return (
    <div className="space-y-12">
      <Section title={l("Scroll area", "منطقة التمرير")}>
        <Example code={`<ScrollArea className="h-56 w-64 rounded-xl border">
  {items.map((i) => <div key={i}>…</div>)}
</ScrollArea>`}>
          <ScrollArea className="h-56 w-72 rounded-xl border border-border">
            <div className="p-3">
              <p className="pb-2 text-sm font-medium text-foreground">{tr(l("Recent activity", "النشاط الأخير"))}</p>
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i} className="border-b border-border py-2 text-sm text-muted-foreground last:border-0">{tr(l(`Request #${1040 + i} updated`, `تم تحديث الطلب رقم ${1040 + i}`))}</div>
              ))}
            </div>
          </ScrollArea>
        </Example>
      </Section>
    </div>
  );
}

export function TooltipPage() {
  const tr = useTr();
  return (
    <div className="space-y-12">
      <Section title={l("Tooltip", "التلميح")} description={l("Wrap the app (or the area) in one TooltipProvider. Tooltips are labels, not content — keep them short.", "غلّف التطبيق (أو المنطقة) بمزوّد TooltipProvider واحد. التلميحات تسميات لا محتوى — اجعلها قصيرة.")}>
        <Example center code={`<TooltipProvider delayDuration={150}>
  <Tooltip>
    <TooltipTrigger asChild><Button size="icon-sm" aria-label="Notifications"><Bell /></Button></TooltipTrigger>
    <TooltipContent side="bottom">Notifications</TooltipContent>
  </Tooltip>
</TooltipProvider>`}>
          <TooltipProvider delayDuration={150}>
            {(["top", "bottom", "left", "right"] as const).map((side) => (
              <Tooltip key={side}>
                <TooltipTrigger asChild><Button variant="outline" size="sm">{side}</Button></TooltipTrigger>
                <TooltipContent side={side}>{tr(l("Saved 2 minutes ago", "حُفظ قبل دقيقتين"))}</TooltipContent>
              </Tooltip>
            ))}
            <Tooltip>
              <TooltipTrigger asChild><Button variant="outline" size="icon-sm" aria-label={tr(l("Notifications", "الإشعارات"))}><Bell className="h-4 w-4" /></Button></TooltipTrigger>
              <TooltipContent>{tr(l("Notifications", "الإشعارات"))}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Example>
      </Section>
    </div>
  );
}

export function RadioPage() {
  const tr = useTr();
  const [plan, setPlan] = React.useState("monthly");
  const plans = [["monthly", l("Monthly", "شهري")], ["yearly", l("Yearly — save 20%", "سنوي — وفّر 20%")], ["lifetime", l("Lifetime (not available)", "مدى الحياة (غير متاح)")]] as const;
  return (
    <div className="space-y-12">
      <Section title={l("Radio group", "مجموعة الاختيار")} description={l("One choice from a short list that stays visible. Arrow keys move and select (mirrored in Arabic); a disabled option is skipped. For long lists use Select.", "اختيار واحد من قائمة قصيرة ظاهرة. الأسهم تتنقّل وتختار (معكوسة في العربية)؛ الخيار المعطّل يُتخطّى. للقوائم الطويلة استخدم القائمة المنسدلة.")}>
        <Example code={`const [plan, setPlan] = useState("monthly");
<RadioGroup value={plan} onValueChange={setPlan} aria-label="Billing">
  <div className="flex items-center gap-2">
    <RadioGroupItem value="monthly" id="monthly" />
    <Label htmlFor="monthly">Monthly</Label>
  </div>
  …
  <RadioGroupItem value="lifetime" id="lifetime" disabled />
</RadioGroup>`}>
          <RadioGroup value={plan} onValueChange={setPlan} aria-label={tr(l("Billing", "الفوترة"))} className="max-w-xs">
            {plans.map(([v, label]) => (
              <div key={v} className="flex items-center gap-2">
                <RadioGroupItem value={v} id={`sc-plan-${v}`} disabled={v === "lifetime"} />
                <Label htmlFor={`sc-plan-${v}`}>{tr(label)}</Label>
              </div>
            ))}
          </RadioGroup>
          <p className="mt-4 font-mono text-xs text-muted-foreground" dir="ltr">value: "{plan}"</p>
        </Example>
        <Example title={l("In a row", "في صف")} code={`<RadioGroup defaultValue="email" className="flex gap-6">…</RadioGroup>`}>
          <RadioGroup defaultValue="email" className="flex flex-wrap gap-6" aria-label={tr(l("Send by", "الإرسال عبر"))}>
            {[["email", l("Email", "البريد")], ["sms", l("SMS", "رسالة نصية")], ["whatsapp", l("WhatsApp", "واتساب")]].map(([v, label]) => (
              <div key={v as string} className="flex items-center gap-2">
                <RadioGroupItem value={v as string} id={`sc-send-${v}`} />
                <Label htmlFor={`sc-send-${v}`}>{tr(label as { en: string; ar: string })}</Label>
              </div>
            ))}
          </RadioGroup>
        </Example>
      </Section>
    </div>
  );
}

