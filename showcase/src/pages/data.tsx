import * as React from "react";
import { Plus } from "lucide-react";
import {
  Badge, Button, FilterBuilder, ListView, Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader,
  TableRow, activeConditionCount, applyFilterQuery, EMPTY_QUERY,
  type ColumnDef, type FilterField, type FilterQuery,
} from "@ui";
import { queryToFrappe } from "@ui/frappe";
// The playground's demos — the package's real ListView / FrappeListView on Sear's data and a simulated Frappe site.
import { FieldLibraryDemo } from "../../../playground/src/showcase/FieldLibraryDemo";
import { FrappeDemo } from "../../../playground/src/showcase/FrappeDemo";
import { Example, Props, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";

const LIST_CODE = `const columns: ColumnDef<Preset>[] = [
  { key: "name", label: { en: "Name", ar: "الاسم" }, type: "text" },
  { key: "fields_count", label: { en: "Fields", ar: "الحقول" }, type: "number" },
  { key: "modified_at", label: { en: "Last Modified", ar: "آخر تعديل" }, type: "date" },
];

<ListView
  rows={presets}
  columns={columns}
  rowKey={(r) => r.id}
  viewKey="Field Preset"            // remembers columns, sort and saved filters
  onRowClick={open}
  rowActions={[{ key: "delete", label: { en: "Delete", ar: "حذف" }, icon: Trash2, tone: "destructive", onSelect: remove }]}
  toolbarActions={<Button><Plus /> Create Field Preset</Button>}
/>`;

export function ListViewPage() {
  return (
    <div className="space-y-12">
      <Section title={l("Sear's Field Library, on ListView", "مكتبة الحقول في سير، على ListView")} description={l("Search, saved filters, the advanced filter, the column manager, sortable headers and paging are on by default. Try them — including the column manager's hidden “Created By” column.", "البحث والتصفيات المحفوظة والتصفية المتقدّمة وإدارة الأعمدة وترويسات الفرز والتصفّح مفعّلة افتراضياً. جرّبها — بما فيها عمود «أنشئت بواسطة» المخفي في إدارة الأعمدة.")}>
        <Example code={LIST_CODE} className="p-0"><FieldLibraryDemo variant="sear" /></Example>
        <Props rows={[
          ["rows · columns · rowKey", "T[] · ColumnDef<T>[] · (row) => string", l("The data, its columns (type drives filtering and sorting), and a stable key.", "البيانات وأعمدتها (النوع يحدّد التصفية والفرز) ومفتاح ثابت.")],
          ["viewKey · storage", 'string · { prefs, saved } | null', l("Persist preferences and saved filters (localStorage by default); omit viewKey to keep them in memory.", "حفظ التفضيلات والتصفيات المحفوظة (localStorage افتراضياً)؛ احذف viewKey لإبقائها في الذاكرة.")],
          ["controls", "{ search, savedFilters, filter, columns, sortMenu, quickFiltersCustomizable }", l("Turn toolbar parts on or off.", "تشغيل أجزاء شريط الأدوات أو إيقافها.")],
          ["mode · total · onStateChange", '"client" | "server"', l("Server mode: the app fetches what onStateChange describes (debounced typing).", "وضع الخادم: يجلب التطبيق ما يصفه onStateChange (مع تأخير الكتابة).")],
          ["rowActions · onRowClick · toolbarActions", "", l("Per-row buttons (with optional confirmation), row navigation, and the trailing toolbar slot.", "أزرار لكل صف (مع تأكيد اختياري) والتنقّل بالصف وخانة نهاية شريط الأدوات.")],
        ]} />
      </Section>
    </div>
  );
}

export function ListFeaturesPage() {
  return (
    <div className="space-y-12">
      <Section title={l("PMO's list features, opt-in", "ميزات قوائم PMO، اختيارية")} description={l("Selection with bulk actions, group-by, the sort menu, a customisable quick filter, a confirmation on delete, and a row style (presets with 10+ fields are tinted).", "التحديد مع الإجراءات الجماعية والتجميع وقائمة الفرز والتصفية السريعة القابلة للتخصيص والتأكيد عند الحذف وتنسيق الصف (المجموعات ذات 10 حقول فأكثر ملوّنة).")}>
        <Example className="p-0" code={`<ListView
  {...base}
  selectable
  bulkActions={[{ key: "delete", label: { en: "Delete", ar: "حذف" }, icon: Trash2, variant: "destructive", run: (keys) => removeMany(keys) }]}
  groupByOptions={[{ key: "created_by", label: "Created By", groupOf: (r) => ({ key: r.created_by, label: r.created_by }) }]}
  quickFilterFields={["created_by"]}
  controls={{ sortMenu: true, quickFiltersCustomizable: true }}
  rowActions={[{ key: "delete", …, confirm: { title: { en: "Delete this preset?", ar: "حذف هذه المجموعة؟" } } }]}
  rowClassName={(r) => (r.fields_count >= 10 ? "bg-warning/5" : undefined)}
/>`}>
          <FieldLibraryDemo variant="features" />
        </Example>
      </Section>
    </div>
  );
}

type Empty = { id: string; title: string };
const EMPTY_COLUMNS: ColumnDef<Empty>[] = [{ key: "title", label: { en: "Title", ar: "العنوان" }, type: "text" }];

export function ListStatesPage() {
  const tr = useTr();
  return (
    <div className="space-y-12">
      <Section title={l("Loading", "التحميل")}>
        <Example className="p-0" code={`<ListView {...base} rows={[]} loading />`}><FieldLibraryDemo variant="loading" /></Example>
      </Section>
      <Section title={l("Error, with retry", "الخطأ، مع إعادة المحاولة")}>
        <Example className="p-0" code={`<ListView {...base} error onRetry={refetch} />   // error may also be a message`}><FieldLibraryDemo variant="error" /></Example>
      </Section>
      <Section title={l("Empty", "فارغة")}>
        <Example code={`<ListView rows={[]} columns={columns} rowKey={(r) => r.id} emptyMessage="No templates yet" />`}>
          <ListView<Empty> rows={[]} columns={EMPTY_COLUMNS} rowKey={(r) => r.id} emptyMessage={tr(l("No templates yet", "لا توجد قوالب بعد"))}
            toolbarActions={<Button className="gap-2 shrink-0"><Plus className="h-4 w-4" />{tr(l("New template", "قالب جديد"))}</Button>} />
        </Example>
      </Section>
    </div>
  );
}

type Room = { id: string; room: string; type: string; floor: number; rate: number; available: boolean; next_free: string };
const ROOMS: Room[] = [
  { id: "1", room: "Room 101", type: "single", floor: 1, rate: 320, available: true, next_free: "2026-10-17" },
  { id: "2", room: "Room 102", type: "double", floor: 1, rate: 450, available: false, next_free: "2026-10-20" },
  { id: "3", room: "Suite 201", type: "suite", floor: 2, rate: 1200, available: true, next_free: "2026-10-17" },
  { id: "4", room: "Room 203", type: "double", floor: 2, rate: 480, available: true, next_free: "2026-10-18" },
  { id: "5", room: "Suite 301", type: "suite", floor: 3, rate: 1500, available: false, next_free: "2026-11-02" },
  { id: "6", room: "Room 305", type: "single", floor: 3, rate: 340, available: true, next_free: "2026-10-17" },
];

export function FiltersPage() {
  const tr = useTr();
  const fields: FilterField[] = [
    { name: "room", label: tr(l("Room", "الغرفة")), type: "text" },
    { name: "type", label: tr(l("Type", "النوع")), type: "select", options: [
      { value: "single", label: tr(l("Single", "فردية")) }, { value: "double", label: tr(l("Double", "مزدوجة")) }, { value: "suite", label: tr(l("Suite", "جناح")) },
    ] },
    { name: "floor", label: tr(l("Floor", "الطابق")), type: "number" },
    { name: "rate", label: tr(l("Rate", "السعر")), type: "number", fieldtype: "Currency" },
    { name: "available", label: tr(l("Available", "متاحة")), type: "boolean" },
    { name: "next_free", label: tr(l("Next free", "أول يوم متاح")), type: "date" },
  ];
  const [query, setQuery] = React.useState<FilterQuery>({
    conjunction: "and",
    conditions: [{ id: "c1", field: "type", operator: "equals", value: "suite" }, { id: "c2", field: "rate", operator: "lt", value: "1400" }],
  });
  const rows = applyFilterQuery(ROOMS, query, fields);
  const frappe = queryToFrappe(query, new Set(fields.map((f) => f.name)), new Map(fields.map((f) => [f.name, f.fieldtype ?? ""])));
  return (
    <div className="space-y-12">
      <Section title={l("FilterBuilder on its own", "منشئ التصفية وحده")} description={l("The List View's Filter button and its popover — open it to edit the conditions (operators follow the field type) and switch between AND and OR. applyFilterQuery runs the query on rows in the browser.", "زر التصفية في عرض القائمة ونافذته — افتحه لتعديل الشروط (العوامل تتبع نوع الحقل) والتبديل بين AND و OR. ‏applyFilterQuery يطبّق الاستعلام على الصفوف في المتصفح.")}>
        <Example code={`const [query, setQuery] = useState<FilterQuery>(EMPTY_QUERY);
<FilterBuilder fields={fields} query={query} onChange={setQuery} activeCount={activeConditionCount(query)} />
const visible = applyFilterQuery(rows, query, fields);`}>
          <div className="space-y-6">
            <FilterBuilder fields={fields} query={query} onChange={setQuery} activeCount={activeConditionCount(query)} />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">{tr(l("Matches:", "المطابق:"))}</span>
              {rows.length ? rows.map((r) => <Badge key={r.id} variant="secondary" dir="ltr">{r.room}</Badge>) : <span className="text-sm text-muted-foreground">—</span>}
              <Button variant="ghost" size="xs" onClick={() => setQuery(EMPTY_QUERY)}>{tr(l("Clear", "مسح"))}</Button>
            </div>
          </div>
        </Example>
      </Section>
      <Section title={l("As Frappe filters", "كمرشّحات فرابيه")} description={l("@solvfast/ui/frappe translates the same query for frappe.client.get_list: AND → filters, OR → or_filters.", "‏‎@solvfast/ui/frappe‎ يترجم الاستعلام نفسه لـ frappe.client.get_list: ‏AND ← filters و OR ← or_filters.")}>
        <Example code={`import { queryToFrappe } from "@solvfast/ui/frappe";
const { filters, or_filters } = queryToFrappe(query, knownFields, fieldtypes);`}>
          <pre dir="ltr" className="overflow-x-auto rounded-xl bg-muted/50 p-4 text-start font-mono text-xs text-foreground">{JSON.stringify({ filters: frappe.filters, or_filters: frappe.or_filters }, null, 2)}</pre>
        </Example>
      </Section>
    </div>
  );
}

export function FrappePage() {
  const tr = useTr();
  return (
    <div className="space-y-12">
      <div className="flex flex-wrap gap-2">
        <Badge variant="warning">{tr(l("Simulated Frappe site — no network", "موقع فرابيه محاكى — دون شبكة"))}</Badge>
        <Badge variant="info">{tr(l("Real-site validation deferred", "التحقّق على موقع حقيقي مؤجّل"))}</Badge>
      </div>
      <Section title={l("ToDo, from the DocType's metadata", "المهام، من بيانات نوع المستند")} description={l("Columns, filter fields and labels come from Frappe's getdoctype for ToDo (the real Frappe 15 metadata, served by an in-page simulation); rows, counts and link search use the stock list APIs. The app adds a curated first column, Arabic labels, group-by fields, bulk and row actions.", "الأعمدة وحقول التصفية والتسميات تأتي من getdoctype لنوع ToDo (بيانات فرابيه 15 الحقيقية، تقدّمها محاكاة داخل الصفحة)؛ الصفوف والأعداد والبحث في الروابط تستخدم واجهات القوائم القياسية. يضيف التطبيق عموداً أول مختاراً وتسميات عربية وحقول تجميع وإجراءات جماعية وللصفوف.")}>
        <Example className="p-0" code={`import { FrappeProvider, FrappeListView, createFrappeClient } from "@solvfast/ui/frappe";

const client = createFrappeClient();          // same-origin, CSRF from window.csrf_token
<FrappeProvider client={client}>
  <FrappeListView doctype="ToDo"
    columns={[{ key: "description", label: { en: "Task", ar: "المهمة" }, type: "text" }]}
    fieldLabels={{ status: { en: "Status", ar: "الحالة" } }}
    groupByFields={["status", "priority"]}
    selectable bulkActions={…} rowActions={…} />
</FrappeProvider>`}>
          <FrappeDemo variant="default" />
        </Example>
      </Section>
      <Section title={l("Server error", "خطأ من الخادم")} description={l("A 403 PermissionError from get_list, shown with Frappe's message and a retry.", "خطأ 403 ‏PermissionError من get_list، يُعرض برسالة فرابيه مع إعادة المحاولة.")}>
        <Example className="p-0"><FrappeDemo variant="error" /></Example>
      </Section>
    </div>
  );
}

const INVOICES = [
  ["INV-001", "paid", 250], ["INV-002", "pending", 150], ["INV-003", "unpaid", 350], ["INV-004", "paid", 450],
] as const;

export function TablePage() {
  const tr = useTr();
  const status = { paid: [l("Paid", "مدفوعة"), "success"], pending: [l("Pending", "معلّقة"), "warning"], unpaid: [l("Unpaid", "غير مدفوعة"), "destructive"] } as const;
  const total = INVOICES.reduce((n, r) => n + r[2], 0);
  return (
    <div className="space-y-12">
      <Section title={l("Table", "الجدول")} description={l("The plain table — for small, fixed data you lay out yourself. For data people search, filter, sort or page through, use the List View.", "الجدول البسيط — لبيانات قليلة وثابتة تنسّقها بنفسك. للبيانات التي يُبحث فيها أو تُصفّى أو تُرتّب أو تُقلّب صفحاتها استخدم عرض القائمة.")}>
        <Example code={`<Table>
  <TableCaption>Recent invoices</TableCaption>
  <TableHeader>
    <TableRow><TableHead>Invoice</TableHead><TableHead>Status</TableHead><TableHead className="text-end">Amount</TableHead></TableRow>
  </TableHeader>
  <TableBody>
    <TableRow><TableCell className="font-medium">INV-001</TableCell><TableCell>…</TableCell><TableCell className="text-end">250.00</TableCell></TableRow>
  </TableBody>
  <TableFooter><TableRow><TableCell colSpan={2}>Total</TableCell><TableCell className="text-end">1,200.00</TableCell></TableRow></TableFooter>
</Table>`}>
          <Table>
            <TableCaption>{tr(l("Recent invoices", "أحدث الفواتير"))}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{tr(l("Invoice", "الفاتورة"))}</TableHead>
                <TableHead>{tr(l("Status", "الحالة"))}</TableHead>
                <TableHead className="text-end">{tr(l("Amount", "المبلغ"))}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {INVOICES.map(([id, st, amount]) => (
                <TableRow key={id}>
                  <TableCell className="font-medium" dir="ltr">{id}</TableCell>
                  <TableCell><Badge variant={status[st][1]}>{tr(status[st][0])}</Badge></TableCell>
                  <TableCell className="text-end tabular-nums" dir="ltr">{amount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>{tr(l("Total", "الإجمالي"))}</TableCell>
                <TableCell className="text-end tabular-nums" dir="ltr">{total.toFixed(2)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Example>
        <Props rows={[
          ["Table · TableHeader · TableBody · TableFooter", "", l("<table> (in a horizontal scroll wrapper), <thead>, <tbody>, <tfoot>.", "‏<table> (داخل حاوية تمرير أفقي) و <thead> و <tbody> و <tfoot>.")],
          ["TableRow · TableHead · TableCell · TableCaption", "", l("<tr> (hover tint; data-state=\"selected\" for a selected row), <th>, <td>, <caption>.", "‏<tr> (تظليل عند المرور؛ data-state=\"selected\" للصف المحدّد) و <th> و <td> و <caption>.")],
        ]} />
      </Section>
    </div>
  );
}

