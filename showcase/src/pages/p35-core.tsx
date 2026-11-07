/** P35 core — the Core field controls (no Showcase section before), LikeToggle / AssignDialog, and the generic
 *  capabilities added for the CRM audit (G7, G11, G13, G14, G16, G17, G23, EmptyState). Everything is in-memory. */
import * as React from "react";
import { Briefcase, FileText, Mail, Phone, Users } from "lucide-react";
import {
  AssignDialog, AssigneeGroup, Button, ColorInput, DataGrid, DurationInput, EmptyState, FieldShell, FileDropzone, IconStatCard,
  LifecycleBar, LikeToggle, LinkInput, NumberInput, Rating, SearchCombobox, StatusBadge, StatusDot, TagInput, TimeInput, Timeline,
  formatFileSize, useLocale, type Assignee, type ComboOption, type DataGridColumn, type LifecycleStateItem, type Suggestion, type TimelineItem,
  type UserOption,
} from "@ui";
import { Example, Props, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";

const Out = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-3 font-mono text-xs text-muted-foreground" dir="ltr">{children}</p>
);

const CUSTOMERS: Suggestion[] = [
  { value: "CUST-0001", label: "Acme Trading", description: "Riyadh" },
  { value: "CUST-0002", label: "Beta Logistics", description: "Jeddah" },
  { value: "CUST-0003", label: "Gamma Foods", description: "Dammam" },
];
const searchCustomers = async (q: string) => CUSTOMERS.filter((c) => `${c.label} ${c.value} ${c.description}`.toLowerCase().includes(q.toLowerCase()));

const USERS: UserOption[] = [
  { id: "rana@example.com", label: "Rana Haddad", description: "Account Executive" },
  { id: "omar@example.com", label: "Omar Saleh", description: "Sales Manager" },
  { id: "lina@example.com", label: "Lina Aziz", description: "Support Lead" },
];
const searchUsers = async (q: string) => USERS.filter((u) => u.label.toLowerCase().includes(q.toLowerCase()));

// ---------------------------------------------------------------------------------------------------------------------
// The Core field controls (0.4.0) — no Showcase section existed (P35 audit E)
// ---------------------------------------------------------------------------------------------------------------------

interface Line { item: string; qty: number | null; rate: number | null }
const LINES: Line[] = [{ item: "Consulting", qty: 2, rate: 1500 }, { item: "Licence", qty: 1, rate: 900 }];

export function CoreFieldsPage() {
  const tr = useTr();
  const [num, setNum] = React.useState<number | null>(1234.5);
  const [time, setTime] = React.useState<string | null>("09:30:00");
  const [dur, setDur] = React.useState<number | null>(93_780);
  const [link, setLink] = React.useState<string | null>("CUST-0002");
  const [tags, setTags] = React.useState<string[]>(["vip", "renewal"]);
  const [rating, setRating] = React.useState<number | null>(3.5);
  const [color, setColor] = React.useState<string | null>("#512195");
  const [rows, setRows] = React.useState<Line[]>(LINES);
  const columns: DataGridColumn<Line>[] = [
    { key: "item", label: tr(l("Item", "البند")), width: 4, required: true, renderCell: (r) => r.item || "—" },
    { key: "qty", label: tr(l("Qty", "الكمية")), width: 2, align: "end", renderCell: (r) => r.qty ?? "—",
      renderEditor: (r, i) => <NumberInput aria-label="qty" kind="int" value={r.qty} onChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, qty: v } : x)))} /> },
    { key: "rate", label: tr(l("Rate", "السعر")), width: 3, align: "end", renderCell: (r) => r.rate ?? "—",
      renderEditor: (r, i) => <NumberInput aria-label="rate" kind="currency" value={r.rate} onChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, rate: v } : x)))} /> },
  ];
  return (
    <div className="space-y-12">
      <Section title={l("Number, time and duration", "الرقم والوقت والمدة")} description={l("Value in, value out. NumberInput writes on blur (Int / Float / Currency / Percent, arithmetic, locale separators); TimeInput parses leniently and emits HH:mm:ss; DurationInput edits seconds through d / h / m / s boxes.", "قيمة تدخل وقيمة تخرج. ‏NumberInput يكتب عند المغادرة (صحيح / عشري / عملة / نسبة، وحساب، وفواصل اللغة)؛ و TimeInput يقرأ بمرونة ويُخرج HH:mm:ss؛ و DurationInput يحرّر الثواني عبر خانات ي / س / د / ث.")}>
        <Example code={`<NumberInput kind="currency" precision={2} value={n} onChange={setN} prefix="SAR" />
<TimeInput value={t} onChange={setT} showNow />
<DurationInput value={seconds} onChange={setSeconds} />`}>
          <div className="grid gap-4 sm:grid-cols-3">
            <FieldShell label={tr(l("Amount", "المبلغ"))} htmlFor="sc-num"><NumberInput id="sc-num" kind="currency" precision={2} value={num} onChange={setNum} prefix="SAR" /></FieldShell>
            <FieldShell label={tr(l("Start time", "وقت البدء"))} htmlFor="sc-time"><TimeInput id="sc-time" value={time} onChange={setTime} showNow /></FieldShell>
            <FieldShell label={tr(l("Duration", "المدة"))}><DurationInput aria-label={tr(l("Duration", "المدة"))} value={dur} onChange={setDur} /></FieldShell>
          </div>
          <Out>{JSON.stringify({ num, time, dur })}</Out>
        </Example>
        <Props rows={[
          ["NumberInput", "kind · precision · numberFormat · rounding · min · max · prefix · suffix", l("Desk's Int / Float / Currency / Percent control; out-of-range is flagged, never clamped.", "عنصر ديسك للصحيح / العشري / العملة / النسبة؛ القيمة خارج المدى تُعلَّم ولا تُقصّ.")],
          ["TimeInput", "withSeconds · hour12 · showNow · onUnparsable", l("Lenient parsing (\"930\", \"9:30 pm\"); writes HH:mm:ss.", "قراءة مرنة (\"930\" و \"9:30 pm\")؛ يكتب HH:mm:ss.")],
          ["DurationInput", "hideDays · hideSeconds", l("Seconds in, seconds out.", "ثوانٍ تدخل وثوانٍ تخرج.")],
        ]} />
      </Section>
      <Section title={l("Link and tags", "الربط والوسوم")} description={l("LinkInput searches as you type (debounced) and stores one value; TagInput stores several, from results or free text.", "‏LinkInput يبحث أثناء الكتابة (مع تأخير) ويخزّن قيمة واحدة؛ و TagInput يخزّن عدّة قيم من النتائج أو نص حر.")}>
        <Example code={`<LinkInput value={v} onChange={setV} search={searchCustomers} href={v ? \`/customer/\${v}\` : undefined}
  actions={(typed) => [{ key: "new", label: \`Create "\${typed}"\`, onSelect: create }]} />
<TagInput value={tags} onChange={setTags} allowCreate />`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell label={tr(l("Customer", "العميل"))} htmlFor="sc-link">
              <LinkInput id="sc-link" value={link} displayValue={CUSTOMERS.find((c) => c.value === link)?.label} onChange={setLink} search={searchCustomers} debounceMs={150}
                href={link ? "#core-fields" : undefined} actions={(typed) => (typed ? [{ key: "new", label: tr(l(`Create "${typed}"`, `إنشاء "${typed}"`)), onSelect: () => {} }] : [])} />
            </FieldShell>
            <FieldShell label={tr(l("Tags", "الوسوم"))}><TagInput aria-label={tr(l("Tags", "الوسوم"))} value={tags} onChange={setTags} allowCreate /></FieldShell>
          </div>
          <Out>{JSON.stringify({ link, tags })}</Out>
        </Example>
      </Section>
      <Section title={l("Rating and colour", "التقييم واللون")} description={l("Rating: click sets, clicking the current value clears (unless required), arrows follow the reading direction. ColorInput accepts #RRGGBB, like Desk.", "التقييم: النقر يحدّد، والنقر على القيمة الحالية يمسحها (ما لم تكن مطلوبة)، والأسهم تتبع اتجاه القراءة. و ColorInput يقبل ‎#RRGGBB‎ كما في ديسك.")}>
        <Example code={`<Rating value={r} onChange={setR} allowHalf />
<ColorInput value={c} onChange={setC} />`}>
          <div className="grid items-end gap-4 sm:grid-cols-2">
            <FieldShell label={tr(l("Satisfaction", "الرضا"))}><Rating aria-label={tr(l("Satisfaction", "الرضا"))} value={rating} onChange={setRating} allowHalf /></FieldShell>
            <FieldShell label={tr(l("Brand colour", "لون العلامة"))} htmlFor="sc-color"><ColorInput id="sc-color" value={color} onChange={setColor} /></FieldShell>
          </div>
          <Out>{JSON.stringify({ rating, color })}</Out>
        </Example>
      </Section>
      <Section title={l("DataGrid (child table)", "DataGrid (جدول فرعي)")} description={l("Desk's grid: row numbers, select and delete, inline edit of one row at a time, keyboard insert / duplicate, paging above 50 rows.", "شبكة ديسك: أرقام الصفوف، التحديد والحذف، تحرير صف واحد في كل مرة، الإدراج / التكرار بلوحة المفاتيح، والتصفّح فوق 50 صفاً.")}>
        <Example code={`<DataGrid rows={rows} getRowKey={(_, i) => String(i)} columns={columns} editable inlineEdit
  onAddRow={add} onDeleteRows={remove} />`}>
          <DataGrid rows={rows} getRowKey={(_, i) => String(i)} columns={columns} editable inlineEdit label={tr(l("Items", "البنود"))}
            onAddRow={() => setRows((rs) => [...rs, { item: "", qty: null, rate: null }])}
            onDeleteRows={(ix) => setRows((rs) => rs.filter((_, i) => !ix.includes(i)))} />
        </Example>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// LikeToggle and AssignDialog — no Showcase section before (P35 audit E)
// ---------------------------------------------------------------------------------------------------------------------

export function RecordExtrasPage() {
  const tr = useTr();
  const [liked, setLiked] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [log, setLog] = React.useState("");
  return (
    <div className="space-y-12">
      <Section title={l("LikeToggle", "زر الإعجاب")} description={l("The heart of Desk's form header and list rows. A returned promise keeps it pending; a rejection leaves the state unchanged.", "قلب رأس النموذج وصفوف القائمة في ديسك. الوعد المُعاد يبقيه معلّقاً؛ والرفض يُبقي الحالة كما هي.")}>
        <Example code={`<LikeToggle liked={liked} onToggle={async (next) => { await save(next); setLiked(next); }} title="Liked by Rana" />`} center>
          <LikeToggle liked={liked} onToggle={async (next) => { await new Promise((r) => setTimeout(r, 400)); setLiked(next); }} title={tr(l("Liked by Rana", "أعجب رنا"))} />
          <span className="text-sm text-muted-foreground">{liked ? tr(l("Liked", "معجب")) : tr(l("Not liked", "غير معجب"))}</span>
        </Example>
      </Section>
      <Section title={l("AssignDialog", "حوار الإسناد")} description={l("Desk's Assign To dialog for one or many records: assign to me, users, Complete By, Priority, Comment. The host performs the assignment.", "حوار ‎Assign To‎ في ديسك لسجل أو عدّة سجلات: أسنِد إليّ، المستخدمون، الإنجاز بحلول، الأولوية، التعليق. المضيف يُجري الإسناد.")}>
        <Example code={`<AssignDialog open={open} onOpenChange={setOpen} searchUsers={search} me={me} count={3} details
  onAssign={async (users, details) => assign(users, details)} />`} center>
          <Button onClick={() => setOpen(true)}>{tr(l("Assign 3 records…", "إسناد 3 سجلات…"))}</Button>
          <AssignDialog open={open} onOpenChange={setOpen} searchUsers={searchUsers} me={USERS[0]} count={3} details
            onAssign={async (users, d) => { setLog(JSON.stringify({ users: users.map((u) => u.id), ...d })); }} />
          {log ? <Out>{log}</Out> : null}
        </Example>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// P35 record capabilities: AssigneeGroup description, StatusBadge colour (G17), LifecycleBar steps (G7), Timeline (G13)
// ---------------------------------------------------------------------------------------------------------------------

const NOW = Date.now();

export function RecordP35Page() {
  const tr = useTr();
  const [picked, setPicked] = React.useState("");
  const assignees: Assignee[] = [
    { id: "rana", name: "Rana Haddad", description: tr(l("Account Executive", "مسؤولة حسابات")) },
    { id: "omar", name: "Omar Saleh", description: tr(l("2026-11-20 · High · Call back", "2026-11-20 · عالية · معاودة الاتصال")) },
  ];
  const deal: LifecycleStateItem[] = [
    { id: "new", label: tr(l("New", "جديدة")), step: "past", by: "Rana", at: NOW - 86_400_000 * 6 },
    { id: "qualified", label: tr(l("Qualified", "مؤهّلة")), step: "past", by: "Rana", at: NOW - 86_400_000 * 4 },
    { id: "proposal", label: tr(l("Proposal", "عرض")), step: "past", by: "Omar", at: NOW - 86_400_000 * 2 },
    { id: "won", label: tr(l("Won", "مكسوبة")), step: "skipped" },
    { id: "lost", label: tr(l("Lost", "خاسرة")), step: "failed", by: "Omar", at: NOW - 3_600_000 },
  ];
  const feed: TimelineItem[] = [
    { id: "m", kind: "communication", at: NOW - 600_000, actor: "Rana", summary: tr(l("sent the proposal by email", "أرسلت العرض بالبريد")), icon: <Mail />, tone: "info" },
    { id: "p", kind: "custom", at: NOW - 3_600_000, actor: "Omar", summary: tr(l("logged a 12-minute call", "سجّل مكالمة 12 دقيقة")), icon: <Phone />, tone: "success" },
    { id: "f", kind: "attachment", at: NOW - 7_200_000, actor: "Rana", summary: "proposal-v2.pdf", href: "#record-p35", icon: <FileText /> },
    { id: "c", kind: "comment", at: NOW - 9_000_000, actor: "Lina", body: tr(l("<p>Client asked for a discount.</p>", "<p>طلب العميل خصماً.</p>")) },
  ];
  return (
    <div className="space-y-12">
      <Section title={l("AssigneeGroup: role line", "AssigneeGroup: سطر الدور")} description={l("The list variant shows each assignee's description (role, or the assignment's date / priority / comment) under the name, like Desk's sidebar.", "متغيّر القائمة يُظهر وصف كل مُسنَد إليه (الدور، أو تاريخ الإسناد / أولويته / تعليقه) تحت الاسم، كما في الشريط الجانبي لديسك.")}>
        <Example code={`<AssigneeGroup variant="list" assignees={[{ id, name: "Rana Haddad", description: "Account Executive" }]} searchUsers={search} />`}>
          <div className="max-w-xs"><AssigneeGroup variant="list" assignees={assignees} searchUsers={searchUsers} onAssign={async () => {}} canRemove={() => true} onRemove={async () => {}} /></div>
        </Example>
      </Section>
      <Section title={l("StatusBadge / StatusDot: configured colour (G17)", "StatusBadge / StatusDot: لون مُهيّأ (G17)")} description={l("`color` takes any CSS colour or a palette token (violet, teal, sky, flame, success…). The text mixes the colour with the theme's foreground, so a yellow or navy stays readable in light and dark. Without `color` nothing changes.", "‏`color` يقبل أي لون CSS أو رمزاً من اللوحة (violet و teal و sky و flame و success…). يُمزج لون النص مع لون الواجهة الأمامي للسمة فيبقى الأصفر أو الكحلي مقروءاً في الفاتح والداكن. دون `color` لا يتغيّر شيء.")}>
        <Example code={`<StatusBadge label="Negotiation" color="#f59e0b" />
<StatusBadge label="Qualified" color="violet" />
<StatusBadge label="Open" variant="dot" color="#0ea5e9" />
<StatusDot label="Lost" color="#ef4444" />`}>
          <div className="flex flex-wrap items-center gap-3">
            {[["#f59e0b", l("Negotiation", "تفاوض")], ["#facc15", l("On hold", "معلّقة")], ["#1e3a8a", l("Contract", "عقد")], ["violet", l("Qualified", "مؤهّلة")], ["teal", l("Won", "مكسوبة")], ["flame", l("Urgent", "عاجلة")]].map(([c, label]) => (
              <StatusBadge key={String(c)} label={tr(label as ReturnType<typeof l>)} color={String(c)} />
            ))}
            <StatusBadge label={tr(l("Open", "مفتوحة"))} variant="dot" color="#0ea5e9" />
            <StatusDot label={tr(l("Lost", "خاسرة"))} color="#ef4444" />
          </div>
        </Example>
      </Section>
      <Section title={l("LifecycleBar: per-step state (G7)", "LifecycleBar: حالة كل خطوة (G7)")} description={l("`step` on a state overrides its position: a Lost deal shows Won as skipped (no tick) and Lost as failed. States without `step` keep the positional past / current / future.", "‏`step` على الحالة يتجاوز موضعها: الصفقة الخاسرة تُظهر «مكسوبة» متخطّاة (دون علامة) و«خاسرة» متعثّرة. الحالات دون `step` تبقى سابقة / حالية / لاحقة حسب الموضع.")}>
        <Example code={`<LifecycleBar current="lost" states={[
  { id: "proposal", label: "Proposal", step: "past" },
  { id: "won", label: "Won", step: "skipped" },
  { id: "lost", label: "Lost", step: "failed", by: "Omar", at },
]} />`}>
          <div className="max-w-sm"><LifecycleBar states={deal} current="lost" showCurrentEntry /></div>
        </Example>
      </Section>
      <Section title={l("Timeline: icons, tone and onItemSelect (G13)", "Timeline: الأيقونات واللون و onItemSelect (G13)")} description={l("`item.icon` replaces the per-kind icon and `item.tone` tints it; `onItemSelect` turns summaries into buttons (click-to-open); `showActor` prefixes the actor.", "‏`item.icon` يحلّ محل أيقونة النوع و `item.tone` يلوّنها؛ و `onItemSelect` يجعل الملخّصات أزراراً (انقر للفتح)؛ و `showActor` يضيف اسم الفاعل.")}>
        <Example code={`<Timeline items={[{ id, kind: "communication", summary: "sent the proposal", icon: <Mail />, tone: "info", … }]}
  showActor onItemSelect={(item, e) => { e.preventDefault(); open(item); }} />`}>
          <Timeline items={feed} showActor onItemSelect={(item, e) => { e.preventDefault(); setPicked(item.id); }} />
          <Out>{picked ? `onItemSelect → ${picked}` : "onItemSelect → —"}</Out>
        </Example>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// FileDropzone (G14)
// ---------------------------------------------------------------------------------------------------------------------

export function FileDropzonePage() {
  const tr = useTr();
  const { language } = useLocale();
  const [files, setFiles] = React.useState<File[]>([]);
  const [added, setAdded] = React.useState<string>("");
  return (
    <div className="space-y-12">
      <Section title={l("FileDropzone", "منطقة إفلات الملفات")} description={l("Click, Enter / Space, or drag files in. `accept`, `maxSize`, `maxFiles` and `multiple` are checked with a message per refused file; chosen files are listed with a preview and a remove button. It never uploads: `onFilesAdded` is where the host starts its upload.", "انقر أو اضغط Enter / Space أو اسحب الملفات. تُفحص `accept` و `maxSize` و `maxFiles` و `multiple` مع رسالة لكل ملف مرفوض؛ وتُعرض الملفات المختارة مع معاينة وزر إزالة. لا يرفع شيئاً: ‏`onFilesAdded` هو مكان بدء الرفع لدى المضيف.")}>
        <Example code={`<FileDropzone multiple accept=".pdf,image/*" maxSize={2 * 1024 * 1024} maxFiles={3}
  value={files} onChange={setFiles} onFilesAdded={(f) => upload(f)} />`}>
          <FileDropzone multiple accept=".pdf,image/*" maxSize={2 * 1024 * 1024} maxFiles={3} value={files} onChange={setFiles}
            onFilesAdded={(f) => setAdded(f.map((x) => `${x.name} (${formatFileSize(x.size, language)})`).join(", "))} />
          <Out>{added ? `onFilesAdded → ${added}` : "onFilesAdded → —"}</Out>
        </Example>
        <Example title={l("Compact, single file", "مضغوطة، ملف واحد")} code={`<FileDropzone compact accept=".csv" />`}>
          <div className="max-w-sm"><FileDropzone compact accept=".csv" labels={{ prompt: tr(l("Choose a CSV file", "اختر ملف CSV")) }} /></div>
        </Example>
        <Props rows={[
          ["value · onChange", "File[] · (files) => void", l("The chosen files (controlled, or internal when value is omitted).", "الملفات المختارة (متحكَّم بها، أو داخلية عند غياب value).")],
          ["onFilesAdded · onReject", "(files) · (rejections)", l("The files of one pick / drop; the refused ones with reason type / size / count.", "ملفات اختيار / إفلات واحد؛ والمرفوضة مع السبب type / size / count.")],
          ["accept · multiple · maxSize · maxFiles", "string · boolean · bytes · number", l("Same accept syntax as <input>; single mode replaces the chosen file.", "صيغة accept نفسها في ‎<input>‎؛ والوضع المفرد يستبدل الملف المختار.")],
          ["showList · preview · compact · labels", "", l("Hide the list (render your own with upload progress), image thumbnails, a one-line zone, texts.", "إخفاء القائمة (اعرض قائمتك مع تقدّم الرفع)، صور مصغّرة، منطقة بسطر واحد، النصوص.")],
        ]} />
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// SearchCombobox static / multiple (G16) and LinkInput groups + icons (G11)
// ---------------------------------------------------------------------------------------------------------------------

const TYPES: ComboOption[] = [
  { value: "lead", label: "Lead" }, { value: "deal", label: "Deal" }, { value: "contact", label: "Contact" },
  { value: "org", label: "Organization" }, { value: "task", label: "Task", description: "To-dos and follow-ups" },
];
const RECORDS: Suggestion[] = [
  { value: "LEAD-001", label: "Acme Trading", description: "LEAD-001", group: "Leads", icon: <Users className="h-4 w-4 text-muted-foreground" /> },
  { value: "LEAD-002", label: "Acme Foods", description: "LEAD-002", group: "Leads", icon: <Users className="h-4 w-4 text-muted-foreground" /> },
  { value: "DEAL-014", label: "Acme renewal 2027", description: "DEAL-014", group: "Deals", icon: <Briefcase className="h-4 w-4 text-muted-foreground" /> },
];

export function ComboboxP35Page() {
  const tr = useTr();
  const [types, setTypes] = React.useState<string[]>(["lead", "deal"]);
  const [one, setOne] = React.useState<string>("");
  const [rec, setRec] = React.useState<string | null>(null);
  return (
    <div className="space-y-12">
      <Section title={l("SearchCombobox: static options and multiple (G16)", "SearchCombobox: خيارات ثابتة واختيار متعدد (G16)")} description={l("`options` gives a fixed list filtered as you type (no loading); `multiple` toggles values and keeps the list open; `variant=\"field\"` takes the input look of the field controls. With `search` it is the 0.6.0 async combobox.", "‏`options` قائمة ثابتة تُصفّى أثناء الكتابة (دون تحميل)؛ و `multiple` يبدّل القيم ويُبقي القائمة مفتوحة؛ و `variant=\"field\"` يأخذ شكل حقول الإدخال. ومع `search` هو المربع غير المتزامن في 0.6.0.")}>
        <Example code={`<SearchCombobox options={types} multiple values={v} onValuesChange={setV} variant="field"
  placeholder="Record types" searchPlaceholder="Filter…" emptyText="No match" />
<SearchCombobox options={types} value={one} onSelect={setOne} … />`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell label={tr(l("Record types (multiple)", "أنواع السجلات (متعدد)"))} htmlFor="sc-types">
              <SearchCombobox id="sc-types" options={TYPES} multiple values={types} onValuesChange={setTypes} variant="field"
                placeholder={tr(l("Record types", "أنواع السجلات"))} searchPlaceholder={tr(l("Filter…", "تصفية…"))} emptyText={tr(l("No match", "لا تطابق"))} />
            </FieldShell>
            <FieldShell label={tr(l("One type (static)", "نوع واحد (ثابت)"))} htmlFor="sc-one">
              <SearchCombobox id="sc-one" options={TYPES} value={one} onSelect={setOne}
                placeholder={tr(l("Pick a type", "اختر نوعاً"))} searchPlaceholder={tr(l("Filter…", "تصفية…"))} emptyText={tr(l("No match", "لا تطابق"))} />
            </FieldShell>
          </div>
          <Out>{JSON.stringify({ types, one })}</Out>
        </Example>
      </Section>
      <Section title={l("LinkInput: groups and icons (G11)", "LinkInput: المجموعات والأيقونات (G11)")} description={l("`Suggestion.group` lists consecutive results under one heading (a role=group); `Suggestion.icon` leads the option (an icon or an avatar). Keyboard order stays flat.", "‏`Suggestion.group` يضع النتائج المتتالية تحت عنوان واحد (role=group)؛ و `Suggestion.icon` يتقدّم الخيار (أيقونة أو صورة رمزية). ترتيب لوحة المفاتيح يبقى مسطّحاً.")}>
        <Example code={`search={async (q) => [
  { value: "LEAD-001", label: "Acme Trading", group: "Leads", icon: <Users /> },
  { value: "DEAL-014", label: "Acme renewal 2027", group: "Deals", icon: <Briefcase /> },
]}`}>
          <div className="max-w-sm">
            <FieldShell label={tr(l("Related record", "سجل مرتبط"))} htmlFor="sc-rec">
              <LinkInput id="sc-rec" value={rec} displayValue={RECORDS.find((r) => r.value === rec)?.label} onChange={setRec} debounceMs={100}
                search={async (q) => RECORDS.filter((r) => `${r.label} ${r.value}`.toLowerCase().includes(q.toLowerCase()))} />
            </FieldShell>
          </div>
          <Out>{JSON.stringify({ rec })}</Out>
        </Example>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// EmptyState and IconStatCard trend (G23)
// ---------------------------------------------------------------------------------------------------------------------

export function EmptyAndTrendPage() {
  const tr = useTr();
  return (
    <div className="space-y-12">
      <Section title={l("EmptyState", "الحالة الفارغة")} description={l("\"Nothing here yet\" for a card, a rail section or a page: icon, title, description, action. `size=\"sm\"` for rail cards, `variant=\"plain\"` inside a box that already has a border.", "«لا شيء هنا بعد» لبطاقة أو قسم جانبي أو صفحة: أيقونة وعنوان ووصف وإجراء. ‏`size=\"sm\"` للبطاقات الجانبية، و `variant=\"plain\"` داخل صندوق له حدّ.")}>
        <Example code={`<EmptyState icon={Users} title="No contacts yet" description="Add the first contact of this organization."
  action={<Button size="sm">New contact</Button>} />
<EmptyState size="sm" icon={FileText} title="No attachments" />`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <EmptyState icon={Users} title={l("No contacts yet", "لا جهات اتصال بعد")} description={l("Add the first contact of this organization.", "أضف أول جهة اتصال لهذه المنظمة.")}
              action={<Button size="sm">{tr(l("New contact", "جهة اتصال جديدة"))}</Button>} />
            <EmptyState size="sm" icon={FileText} title={l("No attachments", "لا مرفقات")} />
          </div>
        </Example>
      </Section>
      <Section title={l("IconStatCard trend (G23)", "اتجاه IconStatCard ‏(G23)")} description={l("`trend={{ value, direction }}` adds StatCard's pill beside the total (with a screen-reader \"up\" / \"down\"); any node renders as a custom delta.", "‏`trend={{ value, direction }}` يضيف حبّة StatCard بجانب المجموع (مع «ارتفاع» / «انخفاض» لقارئ الشاشة)؛ وأي عقدة تُعرض كفرق مخصّص.")}>
        <Example code={`<IconStatCard label="Open deals" value={128} icon={Briefcase} trend={{ value: "+12%", direction: "up" }} />`}>
          <div className="grid gap-4 sm:grid-cols-3">
            <IconStatCard label={l("Open deals", "صفقات مفتوحة")} value={128} icon={Briefcase} trend={{ value: "+12%", direction: "up" }} />
            <IconStatCard label={l("Leads", "عملاء محتملون")} value={342} icon={Users} color="#0ea5e9" trend={{ value: "-4%", direction: "down" }} />
            <IconStatCard label={l("Contacts", "جهات الاتصال")} value={1290} icon={Users} color="#11BF9D" trend={<span className="text-xs text-muted-foreground">{tr(l("vs last week", "مقارنة بالأسبوع الماضي"))}</span>} />
          </div>
        </Example>
      </Section>
    </div>
  );
}
