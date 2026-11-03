/**
 * The "Frappe layer" group: the 0.4.0 Frappe components on a SIMULATED Frappe site (playground/src/demo/sim-site.ts —
 * `createFixtureTransport` with the real 15.110 metadata for ToDo / User / Contact and two authored demo DocTypes).
 * Every section carries a status strip; labels follow docs/release/COMPONENT-COMPLETION-MATRIX.md. Nothing here is
 * evidence of real-site behaviour: rows marked "read path verified" rest on tests/real/sada-real.test.tsx.
 */
import * as React from "react";
import { ArrowRight, Plus, RadioTower } from "lucide-react";
import {
  ActionBar, Alert, AlertDescription, AlertTitle, AssigneeGroup, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, CommentComposer,
  LifecycleBar, Skeleton, StatusBadge, ThemeProvider, useLocale, useTheme, type Assignee, type ColumnDef, type LifecycleActionItem, type MentionOption, type UserOption,
} from "@ui";
import {
  DATA_IMPORT_METHODS, DOWNLOAD_TEMPLATE_METHOD, FrappeAssignTo, FrappeExportDialog, FrappeForm, FrappeListView, FrappeStatusIndicator, FrappeTimeline,
  FrappeWorkflowActions, bulkMenu, canExport, canImport, createFrappeClient, fieldDisplayStatus, readableFields, rolePermissions, useDoc, useMetaBundle,
  usePermissions, withFrappeApi, type BulkKind, type FrappeDoc, type PermType,
} from "@ui/frappe";
import { SCENARIO_HANDLERS, TRAVEL, TRAVELS, USERS, simulatedFiles, type FileCall, type SimSite } from "../../../../playground/src/demo/sim-site";
import { Example, Section } from "../../doc/Doc";
import { l, useTr, type L } from "../../i18n";
import { MatrixBadge, Picker, Readout, SESSIONS, SessionBadge, SimProvider, StatusStrip, useSimSite, type MatrixStatus, type SessionKey } from "./shared";

// ---------------------------------------------------------------------------------------------------------------------
// 1. Component gallery
// ---------------------------------------------------------------------------------------------------------------------

const GALLERY: { name: string; row: string; purpose: L; status: MatrixStatus; section: string }[] = [
  { name: "FrappeListView", row: "15–19", purpose: l("A DocType's list from its metadata: columns, filters, saved filters, sort, paging, selection.", "قائمة نوع مستند من بياناته الوصفية: الأعمدة والتصفية والتصفيات المحفوظة والفرز والتصفّح والتحديد."), status: "verified-read", section: "frappe-list-view" },
  { name: "FrappeBulkActions · bulkMenu", row: "21", purpose: l("Delete / submit / cancel / edit / assign on the selection, gated by the user's rights.", "حذف / اعتماد / إلغاء / تعديل / إسناد على التحديد، مقيّدة بحقوق المستخدم."), status: "partial", section: "frappe-list-view" },
  { name: "Saved filters · user settings (server)", row: "20", purpose: l("List Filter rows and __UserSettings instead of localStorage.", "صفوف List Filter و __UserSettings بدل localStorage."), status: "simulated", section: "frappe-list-view" },
  { name: "useListRealtime", row: "13", purpose: l("Reload the list on the server's list_update event (debounced).", "إعادة تحميل القائمة عند حدث list_update من الخادم (مع تأخير)."), status: "skeleton", section: "frappe-list-view" },
  { name: "FrappeErrorState", row: "10", purpose: l("One rendering per error kind; Retry only when retrying can succeed.", "عرض واحد لكل نوع خطأ؛ إعادة المحاولة فقط عندما يمكن أن تنجح."), status: "verified-read", section: "frappe-list-view" },
  { name: "FrappeForm · FrappeFormView", row: "24", purpose: l("Load, edit, save, submit, cancel, amend a document from its DocType.", "تحميل مستند وتعديله وحفظه واعتماده وإلغاؤه وتعديله بعد الإلغاء من نوعه."), status: "verified-read", section: "frappe-forms" },
  { name: "FrappeField", row: "25", purpose: l("The field dispatcher: one control per fieldtype.", "موزّع الحقول: عنصر تحكّم لكل نوع حقل."), status: "verified-read", section: "frappe-forms" },
  { name: "FrappeLinkField · FrappeDynamicLinkField", row: "26", purpose: l("Link search (search_link) and validation (validate_link); Dynamic Link follows its type field.", "بحث الروابط (search_link) والتحقّق (validate_link)؛ الرابط الديناميكي يتبع حقل نوعه."), status: "verified-read", section: "frappe-forms" },
  { name: "FrappeChildTable", row: "27", purpose: l("Child-table grid with add / remove / reorder.", "شبكة الجداول الفرعية مع إضافة وحذف وإعادة ترتيب."), status: "verified-read", section: "frappe-forms" },
  { name: "FrappeTableMultiSelect", row: "28", purpose: l("Table MultiSelect as pills over the child's first Link field.", "اختيار متعدد من جدول على شكل حبّات فوق أول حقل رابط في الجدول الفرعي."), status: "simulated", section: "frappe-forms" },
  { name: "Behaviour engine (depends_on, mandatory, defaults)", row: "29", purpose: l("Desk's expressions evaluated in the browser.", "تعابير ديسك تُقيَّم في المتصفّح."), status: "simulated", section: "frappe-forms" },
  { name: "FrappeTimeline · CommentComposer", row: "34, 39", purpose: l("The record's activity: comments with mentions, versions, assignments, workflow logs.", "نشاط السجل: التعليقات مع الإشارات والإصدارات والإسنادات وسجلات سير العمل."), status: "simulated", section: "frappe-record" },
  { name: "FrappeStatusIndicator", row: "35", purpose: l("The status chip with frappe.get_indicator's precedence.", "شارة الحالة بترتيب أسبقية frappe.get_indicator."), status: "simulated", section: "frappe-record" },
  { name: "FrappeWorkflowActions · useWorkflow", row: "32", purpose: l("Workflow state and the transitions the user may apply.", "حالة سير العمل والانتقالات التي يمكن للمستخدم تطبيقها."), status: "simulated", section: "frappe-workflow" },
  { name: "LifecycleBar · ActionBar · StatusBadge", row: "41", purpose: l("Generic stepper, actions menu and status chip (no Frappe).", "متتبّع خطوات وقائمة إجراءات وشارة حالة عامة (بلا فرابيه)."), status: "generic", section: "frappe-workflow" },
  { name: "FrappeAssignTo", row: "33", purpose: l("ToDo-based assignment: add / remove through assign_to.", "الإسناد عبر ToDo: إضافة وإزالة من خلال assign_to."), status: "partial", section: "frappe-assign" },
  { name: "AssigneeGroup · AssignPicker", row: "40", purpose: l("Generic assignees with a searchable picker (no Frappe).", "مُسنَد إليهم عامّون مع منتقٍ قابل للبحث (بلا فرابيه)."), status: "generic", section: "frappe-assign" },
  { name: "usePermissions · canImport · canExport", row: "7", purpose: l("Desk's frm.perm ladder in the client; field display status per permlevel.", "سلّم frm.perm في العميل؛ حالة عرض الحقل لكل permlevel."), status: "partial", section: "frappe-permissions" },
  { name: "Import entry · startDataImport · useImportStatus", row: "23", purpose: l("List menu entry gated by canImport; the Data Import tool's client sequence as functions (dev.28).", "مدخل في قائمة القائمة مقيّد بـ canImport؛ تسلسل أداة الاستيراد كدوال (dev.28)."), status: "simulated", section: "frappe-import-export" },
  { name: "FrappeExportDialog · downloadExportTemplate", row: "22", purpose: l("Desk's Export Data dialog; the file always comes from the server's download_template (dev.28).", "حوار تصدير البيانات في ديسك؛ الملف يأتي دائماً من download_template على الخادم (dev.28)."), status: "simulated", section: "frappe-import-export" },
];

export function FrappeGalleryPage() {
  const tr = useTr();
  return (
    <div className="space-y-12">
      <StatusStrip verified="10, 15–19, 24–27" parts={[["FrappeListView", "verified-read"], ["FrappeForm + fields", "verified-read"], ["workflow / assign / timeline / status", "simulated"], ["Import / Export (dev.28; matrix rows 22–23 still read MISSING at dev.26)", "simulated"]]}
        note={l("Status words come from docs/release/COMPONENT-COMPLETION-MATRIX.md (0.4.0-dev.26; Import / Export arrived in dev.28, docs/components/list.md §6a). \"Verified\" means the read path replayed recorded real 15.110 responses in tests; no write has run on a real site; nothing is production ready.", "كلمات الحالة من docs/release/COMPONENT-COMPLETION-MATRIX.md ‏(0.4.0-dev.26؛ الاستيراد / التصدير وصلا في dev.28، docs/components/list.md §6a). «مُتحقَّق» تعني أن مسار القراءة أُعيد تشغيله على استجابات 15.110 حقيقية مسجّلة في الاختبارات؛ لم تُشغَّل أي كتابة على موقع حقيقي؛ لا شيء جاهز للإنتاج.")} />
      <Section title={l("The 0.4 Frappe components", "مكوّنات فرابيه 0.4")} description={l("One card per component with its matrix row and status; each links to the section where it runs on the simulated site.", "بطاقة لكل مكوّن مع صفّه في المصفوفة وحالته؛ كل بطاقة تربط بالقسم الذي يعمل فيه على الموقع المحاكى.")}>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label={tr(l("Frappe components", "مكوّنات فرابيه"))}>
          {GALLERY.map((g) => (
            <li key={g.name} className="min-w-0">
              <Card className="flex h-full flex-col">
                <CardHeader className="space-y-2 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="font-mono text-sm leading-snug" dir="ltr">{g.name}</CardTitle>
                    <Badge variant="outline" dir="ltr" className="shrink-0">{tr(l("row", "صف"))} {g.row}</Badge>
                  </div>
                  <MatrixBadge status={g.status} />
                </CardHeader>
                <CardContent className="mt-auto space-y-3">
                  <CardDescription>{tr(g.purpose)}</CardDescription>
                  <a href={`#${g.section}`} className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                    {tr(l("Open section", "فتح القسم"))} <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
                  </a>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// 2. FrappeListView
// ---------------------------------------------------------------------------------------------------------------------

type ToDoRow = { name: string; description?: string; status?: string; priority?: string };
const TODO_LABELS = {
  status: { en: "Status", ar: "الحالة" }, priority: { en: "Priority", ar: "الأولوية" }, date: { en: "Due Date", ar: "تاريخ الاستحقاق" },
  allocated_to: { en: "Allocated To", ar: "مُسندة إلى" }, assigned_by: { en: "Assigned By", ar: "أسندها" }, reference_type: { en: "Reference Type", ar: "نوع المرجع" },
  reference_name: { en: "Reference Name", ar: "اسم المرجع" }, role: { en: "Role", ar: "الدور" }, assigned_by_full_name: { en: "Assigned By Full Name", ar: "اسم من أسندها" }, assignment_rule: { en: "Assignment Rule", ar: "قاعدة الإسناد" },
};
const TODO_COLUMNS: ColumnDef<ToDoRow>[] = [{ key: "description", label: { en: "Task", ar: "المهمة" }, type: "text", fieldtype: "Text Editor", className: "max-w-[26rem]" }];

type ListScenario = "default" | "loading" | "empty" | "error";

export function FrappeListViewPage() {
  const tr = useTr();
  const { isRTL } = useLocale();
  const [scenario, setScenario] = React.useState<ListScenario>("default");
  const [session, setSession] = React.useState<SessionKey>("admin");
  const [log, setLog] = React.useState<string[]>([]);
  const [events, setEvents] = React.useState(0);
  const site = useSimSite({
    handlers: scenario === "error" ? SCENARIO_HANDLERS["list-error"] : undefined,
    latency: scenario === "loading" ? 3_600_000 : 0,
    todoCount: scenario === "empty" ? 0 : 45,
  }, [scenario]);
  const push = (line: string) => setLog((s) => [line, ...s].slice(0, 6));
  const serverEvent = () => {
    const name = site.addTodo();
    site.realtime.emit({ event: "list_update", doctype: "ToDo" });
    setEvents((n) => n + 1);
    push(`realtime: list_update (ToDo) → ${name} inserted; the list reloads after the quiet period`);
  };

  return (
    <div className="space-y-12">
      <StatusStrip verified="15–19, 10" parts={[["FrappeListView · reportview decode · list meta · query · List View Settings (15–19)", "verified-read"], ["FrappeErrorState (10)", "verified-read"], ["saved filters / user settings on the server (20)", "simulated"], ["bulk delete / assign (21)", "partial"], ["Export entry in the ⋯ menu (22; the showcase file server refuses with a labelled 417 here)", "simulated"], ["useListRealtime (13)", "skeleton"]]} />
      <Section title={l("ToDo on the simulated site", "المهام على الموقع المحاكى")} description={l("Columns, filter fields and quick filters come from the real Frappe 15.110 ToDo metadata (getdoctype, in-page). Search, filters, saved filters (stored as List Filter rows by the simulator), the column manager, sorting, paging, selection and the bulk actions all work; delete and assign run through the simulator's delete_items / assign_to.add_multiple.", "الأعمدة وحقول التصفية والتصفيات السريعة تأتي من بيانات ToDo الحقيقية في فرابيه 15.110 ‏(getdoctype داخل الصفحة). البحث والتصفية والتصفيات المحفوظة (يحفظها المحاكي كصفوف List Filter) ومدير الأعمدة والفرز والتصفّح والتحديد والإجراءات الجماعية كلها تعمل؛ الحذف والإسناد يمرّان عبر delete_items / assign_to.add_multiple في المحاكي.")}>
        <div className="flex flex-col gap-3">
          <Picker legend={l("Scenario", "السيناريو")} value={scenario} onChange={setScenario} options={[
            { value: "default", label: l("45 rows", "45 صفاً") }, { value: "loading", label: l("Loading", "جارٍ التحميل") }, { value: "empty", label: l("Empty", "فارغ") }, { value: "error", label: l("Error 403 (permission denied)", "خطأ 403 (رُفض الإذن)") },
          ]} />
          <Picker legend={l("Session", "الجلسة")} value={session} onChange={setSession} options={[
            { value: "admin", label: l("Administrator — System Manager", "المدير — System Manager") }, { value: "salesOnly", label: l("Sales User only — no right on ToDo (bulk bar offers nothing)", "Sales User فقط — بلا حق على ToDo (شريط الإجراءات فارغ)") },
          ]} />
          <div className="flex flex-wrap items-center gap-2">
            <SessionBadge session={session} />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={serverEvent} disabled={scenario !== "default"}>
              <RadioTower className="size-4" aria-hidden /> {tr(l("Simulate server event (list_update)", "محاكاة حدث من الخادم (list_update)"))}
            </Button>
            {events > 0 && <Badge variant="info" dir="ltr">{events} event(s) · {site.realtime.listeners()} listener(s)</Badge>}
          </div>
        </div>
        <Example className="p-0" code={`<FrappeProvider client={client} session={{ user, roles }}>
  <FrappeListView doctype="ToDo"
    columns={[{ key: "description", label: { en: "Task", ar: "المهمة" }, type: "text" }]}
    fieldLabels={{ status: { en: "Status", ar: "الحالة" } }}
    groupByFields={["status", "priority", "allocated_to"]}
    bulk={{}}                              // delete / assign, gated by usePermissions()
    serverStorage={{ user }}               // saved filters → List Filter rows; prefs → __UserSettings
    realtime={port} realtimeDebounceMs={400}
    controls={{ sortMenu: true }} onRowClick={(row) => open(row.name)} onCreate={() => create()} />
</FrappeProvider>`}>
          <SimProvider site={site} session={session} key={`${scenario}-${session}`}>
            <div className="px-4 py-4 md:px-6">
              <FrappeListView<ToDoRow>
                doctype="ToDo" columns={TODO_COLUMNS} fieldLabels={TODO_LABELS} groupByFields={["status", "priority", "allocated_to"]}
                bulk={{ onDone: (kind, outcome, names) => push(`bulk ${kind}: ${names.length} row(s)${outcome.queued ? " (queued by the server)" : ""}${outcome.failed.length ? `, failed: ${outcome.failed.join(", ")}` : ""}`), onError: (e, kind) => push(`bulk ${kind} failed: ${e instanceof Error ? e.message : String(e)}`) }}
                serverStorage={{ user: SESSIONS[session].user }}
                realtime={site.realtime} realtimeDebounceMs={400}
                controls={{ sortMenu: true }}
                onRowClick={(r) => push(`onRowClick: ${r.name}`)}
                onCreate={() => push("onCreate")}
                toolbarActions={<Button className="shrink-0 gap-2" onClick={() => push("New ToDo clicked (the app routes to a form)")}><Plus className="h-4 w-4" />{isRTL ? "مهمة جديدة" : "New ToDo"}</Button>}
              />
            </div>
          </SimProvider>
        </Example>
        <Readout label="events →">{log.length ? log.join("\n") : "—"}</Readout>
        <Alert>
          <AlertTitle>{tr(l("What the labels mean here", "معنى التسميات هنا"))}</AlertTitle>
          <AlertDescription className="space-y-1 text-xs">
            <p>{tr(l("Rows, counts and link searches are answered in memory. The 403 scenario is a failure handler on reportview.get; the simulator itself never checks permissions, so the Sales User session still sees rows — on a real site the server decides.", "الصفوف والأعداد وبحث الروابط تُجاب في الذاكرة. سيناريو 403 معالج فشل على reportview.get؛ المحاكي نفسه لا يفحص الأذونات، لذا ما تزال جلسة Sales User ترى الصفوف — على موقع حقيقي الخادم هو من يقرّر."))}</p>
            <p>{tr(l("Realtime is a skeleton (matrix row 13): the button feeds a fake port with list_update; the list reloads whole after the quiet period (400 ms here, 2 s by default) and ignores events while rows are selected. Desk re-requests only the changed names.", "الزمن الحقيقي هيكل أولي (صف 13): الزر يغذّي منفذاً وهمياً بـ list_update؛ تُعاد القائمة كاملةً بعد فترة الهدوء (400 م.ث هنا، 2 ث افتراضياً) وتُهمل الأحداث أثناء وجود صفوف محدّدة. ديسك يعيد طلب الأسماء المتغيّرة فقط."))}</p>
          </AlertDescription>
        </Alert>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// 3. FrappeForm
// ---------------------------------------------------------------------------------------------------------------------

type FormScenario = "contact" | "new-todo" | "todo" | "travel" | "travel-saved" | "readonly" | "save-error" | "loading" | "error" | "sales-saved";
const FORM_SCENARIOS: { value: FormScenario; label: L; blurb: L; status: MatrixStatus }[] = [
  { value: "contact", label: l("Contact (child tables, Dynamic Link)", "جهة اتصال (جداول فرعية ورابط ديناميكي)"), blurb: l("The real Contact metadata: Contact Email and Contact Phone child tables, and the Links table whose Dynamic Link follows Link DocType. Edit, add rows, save through the simulator.", "بيانات Contact الحقيقية: جدولا Contact Email و Contact Phone الفرعيان، وجدول Links الذي يتبع رابطه الديناميكي Link DocType. عدّل وأضف صفوفاً واحفظ عبر المحاكي."), status: "verified-read" },
  { value: "new-todo", label: l("New ToDo (mandatory, Link search)", "مهمة جديدة (إلزامي وبحث رابط)"), blurb: l("Save with an empty Description to see the Missing Fields dialog; Allocated To searches Users through search_link; Reference Name is a Dynamic Link on Reference Type.", "احفظ مع وصف فارغ لترى حوار الحقول الناقصة؛ «مُسندة إلى» يبحث في المستخدمين عبر search_link؛ «اسم المرجع» رابط ديناميكي على «نوع المرجع»."), status: "verified-read" },
  { value: "todo", label: l("Saved ToDo", "مهمة محفوظة"), blurb: l("TD-0002 loaded with getdoc; the Not Saved badge appears on the first edit; Ctrl/⌘+S saves.", "TD-0002 محمّلة عبر getdoc؛ تظهر شارة «غير محفوظ» عند أول تعديل؛ Ctrl/⌘+S يحفظ."), status: "verified-read" },
  { value: "travel", label: l("New Travel Request (depends_on, Table MultiSelect)", "طلب سفر جديد (depends_on واختيار متعدد)"), blurb: l("An authored demo DocType: tick \"Needs a visa\" and \"Visa country\" appears and becomes mandatory (depends_on / mandatory_depends_on); Companions is a Table MultiSelect over User; Internal notes is a permlevel-1 field (System Manager only).", "نوع مستند تجريبي: علّم «يحتاج تأشيرة» فيظهر «بلد التأشيرة» ويصبح إلزامياً (depends_on / mandatory_depends_on)؛ «المرافقون» اختيار متعدد من جدول على User؛ «ملاحظات داخلية» حقل permlevel 1 ‏(System Manager فقط)."), status: "simulated" },
  { value: "travel-saved", label: l("Saved Travel Request (versions)", "طلب سفر محفوظ (إصدارات)"), blurb: l("TR-0003 — the London trip with a visa; the DocType tracks changes, so every save writes a Version row the timeline shows.", "TR-0003 — رحلة لندن مع تأشيرة؛ النوع يتابع التغييرات فيكتب كل حفظ صفّ Version يعرضه الخط الزمني."), status: "simulated" },
  { value: "readonly", label: l("Submitted memo (read-only)", "مذكرة معتمدة (للقراءة فقط)"), blurb: l("AM-2 is submitted (docstatus 1): fields are read-only except Notes (allow_on_submit); Cancel is the only action.", "AM-2 معتمدة (docstatus 1): الحقول للقراءة فقط عدا «ملاحظات» (allow_on_submit)؛ الإلغاء هو الإجراء الوحيد."), status: "verified-read" },
  { value: "sales-saved", label: l("Sales User on a saved Travel Request (read-only by role)", "Sales User على طلب سفر محفوظ (قراءة فقط بحسب الدور)"), blurb: l("TR-0001 as Lina (Sales User): write is denied, so every field is read-only and Save is gone; the permlevel-1 Internal notes field is hidden. DEMO OVERRIDE: the simulator normally answers docinfo.permissions with every right; this scenario answers as a real server would for a restricted user.", "TR-0001 بوصفك لينا (Sales User): لا حق كتابة، فكل الحقول للقراءة فقط ولا زر حفظ؛ حقل «ملاحظات داخلية» (permlevel 1) مخفي. تجاوز تجريبي: المحاكي عادةً يجيب docinfo.permissions بكل الحقوق؛ هذا السيناريو يجيب كما يجيب خادم حقيقي لمستخدم مقيّد."), status: "partial" },
  { value: "save-error", label: l("Save error 417", "خطأ حفظ 417"), blurb: l("Edit Sara's contact and save: the simulator answers TimestampMismatchError; the form keeps the edits and offers Reload.", "عدّل جهة اتصال سارة واحفظ: المحاكي يجيب TimestampMismatchError؛ يحتفظ النموذج بالتعديلات ويعرض إعادة التحميل."), status: "verified-read" },
  { value: "loading", label: l("Loading", "جارٍ التحميل"), blurb: l("The skeleton, with a text status after 300 ms (the simulator never answers in this scenario).", "الهيكل، مع نص حالة بعد 300 م.ث (المحاكي لا يجيب في هذا السيناريو)."), status: "verified-read" },
  { value: "error", label: l("Error 403 (permission denied)", "خطأ 403 (رُفض الإذن)"), blurb: l("getdoc answers PermissionError: FrappeErrorState with the server's message and no Retry (retrying cannot succeed).", "getdoc يجيب PermissionError: ‏FrappeErrorState برسالة الخادم ودون إعادة محاولة (لن تنجح)."), status: "verified-read" },
];

export function FrappeFormsPage() {
  const tr = useTr();
  const [scenario, setScenario] = React.useState<FormScenario>("contact");
  const [saved, setSaved] = React.useState("");
  const site = useSimSite({
    handlers: scenario === "error" ? SCENARIO_HANDLERS["form-error"] : scenario === "save-error" ? SCENARIO_HANDLERS["form-save-error"] : undefined,
    latency: scenario === "loading" ? 3_600_000 : 0,
    docinfoPermissions: scenario === "sales-saved" ? { read: 1, write: 0, create: 0, delete: 0, submit: 0, cancel: 0, amend: 0, report: 1, export: 0, import: 0, print: 1, email: 1, share: 0 } : undefined,
  }, [scenario]);
  const current = FORM_SCENARIOS.find((s) => s.value === scenario)!;
  const session: SessionKey = scenario === "sales-saved" ? "sales" : "admin";
  const form = (() => {
    switch (scenario) {
      case "contact": case "error": case "loading": case "save-error": return <FrappeForm doctype="Contact" name="Sara Al-Otaibi" onSaved={(d, a) => setSaved(`onSaved: ${d.name} (${a})`)} guardUnload={false} />;
      case "new-todo": return <FrappeForm doctype="ToDo" onSaved={(d, a) => setSaved(`onSaved: ${d.name} (${a})`)} guardUnload={false} />;
      case "todo": return <FrappeForm doctype="ToDo" name="TD-0002" onSaved={(d, a) => setSaved(`onSaved: ${d.name} (${a})`)} guardUnload={false} />;
      case "travel": return <FrappeForm doctype="Travel Request" onSaved={(d, a) => setSaved(`onSaved: ${d.name} (${a})`)} guardUnload={false} />;
      case "travel-saved": return <FrappeForm doctype="Travel Request" name="TR-0003" onSaved={(d, a) => setSaved(`onSaved: ${d.name} (${a})`)} guardUnload={false} />;
      case "sales-saved": return <FrappeForm doctype="Travel Request" name="TR-0001" onSaved={(d, a) => setSaved(`onSaved: ${d.name} (${a})`)} guardUnload={false} />;
      case "readonly": return <FrappeForm doctype="Approval Memo" name="AM-2" onSaved={(d, a) => setSaved(`onSaved: ${d.name} (${a})`)} guardUnload={false} />;
    }
  })();
  return (
    <div className="space-y-12">
      <StatusStrip verified="24–27, 10" parts={[["FrappeForm · FrappeField · Link / Dynamic Link · child tables (24–27)", "verified-read"], ["FrappeErrorState (10)", "verified-read"], ["Table MultiSelect (28)", "simulated"], ["depends_on / mandatory engine (29)", "simulated"], ["save / submit / cancel (writes)", "simulated"], ["role-based read-only on a saved document (7)", "partial"]]} />
      <Section title={l("Scenarios", "السيناريوهات")} description={l("Pick a document and a state. Every form is the real FrappeForm over the simulated site; saves go to memory and come back as the server would answer.", "اختر مستنداً وحالة. كل نموذج هو FrappeForm الحقيقي على الموقع المحاكى؛ الحفظ يذهب إلى الذاكرة ويعود كما يجيب الخادم.")}>
        <Picker legend={l("Scenario", "السيناريو")} value={scenario} onChange={(v) => { setScenario(v); setSaved(""); }} options={FORM_SCENARIOS.map((s) => ({ value: s.value, label: s.label }))} />
        <div className="flex flex-wrap items-center gap-2">
          <MatrixBadge status={current.status} />
          <SessionBadge session={session} />
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">{tr(current.blurb)}</p>
        <Example className="p-4 md:p-6" code={`<FrappeProvider client={client} session={{ user, roles }}>
  <FrappeForm doctype="Contact" name="Sara Al-Otaibi" onSaved={(doc, action) => …} />
  <FrappeForm doctype="ToDo" />                                   // new document, Desk defaults
  <FrappeForm doctype="Travel Request" newDocDefaults={{ routeOptions: { destination: "Riyadh" } }} />
</FrappeProvider>`}>
          <SimProvider site={site} session={session} key={scenario}>{form}</SimProvider>
        </Example>
        <Readout label="callbacks →">{saved || "—"}</Readout>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// 4. Record: status, timeline, comments
// ---------------------------------------------------------------------------------------------------------------------

function useSeeded(site: SimSite, doctype: string, name: string, edit: Record<string, unknown>) {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    setReady(false);
    void site.seedHistory(doctype, name, edit).then(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, [site, doctype, name]); // eslint-disable-line react-hooks/exhaustive-deps
  return ready;
}

function RecordDemo({ doctype, name }: { doctype: string; name: string }) {
  const tr = useTr();
  const q = useDoc(doctype, name);
  if (!q.data) return <Skeleton className="h-64 w-full" />;
  const doc = q.data.doc;
  const title = String(doc.title ?? doc.purpose ?? doc.description ?? doc.name).replace(/<[^>]+>/g, "");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h4 className="text-lg font-semibold text-foreground">{title}</h4>
        <FrappeStatusIndicator doc={doc} />
        <FrappeStatusIndicator doc={doc} variant="dot" />
        <span className="font-mono text-xs text-muted-foreground" dir="ltr">{doc.doctype} · {doc.name} · modified {String(doc.modified).slice(0, 16)}</span>
      </div>
      <p className="text-xs text-muted-foreground">{tr(l("Below: FrappeTimeline with its comment box. Add a comment (type @ to mention a user), edit or delete it, expand a version line to see every changed field. The history was seeded through the simulator: two comments, an assignment and one edit (Version rows).", "أدناه: FrappeTimeline مع صندوق التعليق. أضف تعليقاً (اكتب @ للإشارة إلى مستخدم) أو عدّله أو احذفه، ووسّع سطر إصدار لترى كل الحقول المتغيّرة. السجل مُهيّأ عبر المحاكي: تعليقان وإسناد وتعديل واحد (صفوف Version)."))}</p>
      <FrappeTimeline doc={doc} user="Administrator" isSystemManager canDeleteComment showFilters />
    </div>
  );
}

export function FrappeRecordPage() {
  const site = useSimSite({}, []);
  const ready = useSeeded(site, "ToDo", "TD-0001", { status: "Closed", priority: "Low" });
  return (
    <div className="space-y-12">
      <StatusStrip parts={[["FrappeTimeline · buildTimelineItems · formatVersion (34)", "simulated"], ["CommentComposer · mentions · sanitiser (39)", "generic"], ["FrappeStatusIndicator · resolveIndicator (35)", "simulated"], ["add_comment / update_comment / delete (writes)", "simulated"]]}
        note={l("docinfo normalisation was replayed on recorded real responses (they were empty on Sada), so the item builders ran on real shapes; every comment, version and assignment shown here comes from the in-memory simulator.", "تطبيع docinfo أُعيد تشغيله على استجابات حقيقية مسجّلة (كانت فارغة على سدى)، فعملت بُناة العناصر على أشكال حقيقية؛ كل تعليق وإصدار وإسناد هنا يأتي من المحاكي في الذاكرة.")} />
      <Section title={l("TD-0001: status, versions, comments", "TD-0001: الحالة والإصدارات والتعليقات")} description={l("FrappeStatusIndicator (pill and dot) over the document, then FrappeTimeline: created / modified lines, Version rows (ToDo has track_changes), the assignment log, comments with mentions, and the All / Comments / Changes filters.", "FrappeStatusIndicator (حبّة ونقطة) فوق المستند، ثم FrappeTimeline: سطرا الإنشاء والتعديل، وصفوف Version (ToDo يتابع التغييرات)، وسجل الإسناد، والتعليقات مع الإشارات، وتصفيات الكل / التعليقات / التغييرات.")}>
        <Example code={`const { data } = useDoc("ToDo", "TD-0001");
<FrappeStatusIndicator doc={data.doc} />
<FrappeTimeline doc={data.doc} user={session.user} isSystemManager canDeleteComment showFilters />`}>
          <SimProvider site={site}>{ready ? <RecordDemo doctype="ToDo" name="TD-0001" /> : <Skeleton className="h-64 w-full" />}</SimProvider>
        </Example>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// 5. Workflow
// ---------------------------------------------------------------------------------------------------------------------

function WorkflowDemo({ onApplied }: { onApplied: (s: string) => void }) {
  const tr = useTr();
  const q = useDoc("Approval Memo", "AM-1");
  if (!q.data) return <Skeleton className="h-40 w-full" />;
  const doc = q.data.doc;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h4 className="text-lg font-semibold text-foreground">{String(doc.title)}</h4>
        <FrappeStatusIndicator doc={doc} />
        <Badge variant="outline" dir="ltr">docstatus {String(doc.docstatus)} · {String(doc.workflow_state)}</Badge>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{tr(l("variant=\"steps\" — the stepper with actor and time per state (from the Workflow comments the simulator writes), plus the Actions menu; every action asks first (confirm).", "variant=\"steps\" — المتتبّع مع الفاعل والوقت لكل حالة (من تعليقات Workflow التي يكتبها المحاكي)، مع قائمة الإجراءات؛ كل إجراء يطلب تأكيداً (confirm)."))}</p>
        <FrappeWorkflowActions doc={doc} user="Administrator" roles={["System Manager"]} variant="steps" confirm showCurrentEntry onApplied={(d, a) => onApplied(`onApplied: ${a} → ${String(d.workflow_state)} (docstatus ${String(d.docstatus)})`)} />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{tr(l("variant=\"compact\" — badge and actions only (Desk's Actions dropdown).", "variant=\"compact\" — الشارة والإجراءات فقط (قائمة إجراءات ديسك)."))}</p>
        <FrappeWorkflowActions doc={doc} user="Administrator" roles={["System Manager"]} onApplied={(d, a) => onApplied(`onApplied: ${a} → ${String(d.workflow_state)}`)} />
      </div>
    </div>
  );
}

const DEAL_STATES = [
  { id: "new", label: l("New", "جديدة"), tone: "info" as const }, { id: "qualified", label: l("Qualified", "مؤهّلة"), tone: "brand" as const },
  { id: "proposal", label: l("Proposal sent", "أُرسل العرض"), tone: "warning" as const }, { id: "won", label: l("Won", "رُبحت"), tone: "success" as const },
];

function GenericLifecycleDemo() {
  const tr = useTr();
  const [idx, setIdx] = React.useState(1);
  const [history, setHistory] = React.useState<Record<string, { by: string; at: number }>>({ new: { by: "Sara Q", at: Date.now() - 3 * 864e5 }, qualified: { by: "Khaled Q", at: Date.now() - 36e5 } });
  const [log, setLog] = React.useState("");
  const states = DEAL_STATES.map((s) => ({ id: s.id, label: tr(s.label), tone: s.tone, by: history[s.id]?.by, at: history[s.id]?.at }));
  const next = DEAL_STATES[idx + 1];
  const actions: LifecycleActionItem[] = [
    ...(next ? [{ id: next.id, label: tr(l(`Move to ${next.label.en}`, `نقل إلى ${next.label.ar}`)), confirm: next.id === "won" ? tr(l("Close this deal as won?", "إغلاق هذه الصفقة كرابحة؟")) : undefined }] : []),
    ...(idx > 0 ? [{ id: DEAL_STATES[idx - 1].id, label: tr(l("Step back", "خطوة للخلف")), tone: "neutral" as const }] : []),
    { id: "lost", label: tr(l("Mark lost (fails)", "تعليم كخاسرة (تفشل)")), tone: "danger" as const },
  ];
  const run = async (a: LifecycleActionItem) => {
    await new Promise((r) => setTimeout(r, 400));
    if (a.id === "lost") throw new Error(tr(l("The server refused: a deal with an open proposal cannot be lost.", "رفض الخادم: لا يمكن خسارة صفقة لها عرض مفتوح.")));
    const i = DEAL_STATES.findIndex((s) => s.id === a.id);
    setIdx(i);
    setHistory((h) => ({ ...h, [a.id]: { by: "You", at: Date.now() } }));
    setLog(`onAction: ${a.id}`);
  };
  return (
    <div className="space-y-6">
      <LifecycleBar states={states} current={DEAL_STATES[idx].id} actions={actions} onAction={run} variant="steps" currentMarker={tr(l("Current phase", "المرحلة الحالية"))} />
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground">{tr(l("ActionBar alone, variant=\"buttons\":", "ActionBar وحده، variant=\"buttons\":"))}</span>
        <ActionBar actions={actions} onAction={run} variant="buttons" />
        <StatusBadge label={tr(DEAL_STATES[idx].label)} tone={DEAL_STATES[idx].tone} variant="dot" />
      </div>
      <Readout label="→">{log || "—"}</Readout>
    </div>
  );
}

export function FrappeWorkflowPage() {
  const site = useSimSite({}, []);
  // Seed: comments + an edit, then Reject (Pending → Draft) and Request Approval (Draft → Pending) through the simulator's
  // apply_workflow, so both past states carry a Workflow log (actor and time under the stepper).
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    void (async () => {
      await site.seedHistory("Approval Memo", "AM-1", { title: "Annual travel budget 2027", amount: 14000 });
      for (const action of ["Reject", "Request Approval"]) {
        const cur = (await site.transport("frappe.desk.form.load.getdoc", { doctype: "Approval Memo", name: "AM-1" })).docs![0];
        await site.transport("frappe.model.workflow.apply_workflow", { doc: JSON.stringify(cur), action });
      }
      if (live) setReady(true);
    })();
    return () => { live = false; };
  }, [site]);
  const [log, setLog] = React.useState("");
  return (
    <div className="space-y-12">
      <StatusStrip parts={[["FrappeWorkflowActions · useWorkflow · workflow helpers (32)", "simulated"], ["apply_workflow (write)", "simulated"], ["LifecycleBar · ActionBar · StatusBadge (41)", "generic"]]}
        note={l("Sada has no Frappe Workflow, so nothing here touched a real response; the Approval Flow (Draft → Pending → Approved) is an authored demo workflow served by the simulator's getdoctype (__workflow_docs) and applied by its apply_workflow. The server's `condition` is never evaluated client-side.", "لا يوجد سير عمل فرابيه في سدى، لذا لم يمسّ شيء هنا استجابة حقيقية؛ Approval Flow ‏(مسودة → معلّقة → معتمدة) سير عمل تجريبي يقدّمه getdoctype في المحاكي (__workflow_docs) ويطبّقه apply_workflow فيه. شرط الخادم `condition` لا يُقيَّم في العميل أبداً.")} />
      <Section title={l("Approval Memo AM-1 on the Approval Flow", "مذكرة الاعتماد AM-1 على Approval Flow")} description={l("AM-1 is Pending: Approve moves it to Approved (docstatus 1), Reject sends it back to Draft. The stepper marks past, current and future states with who moved it and when.", "AM-1 معلّقة: «اعتماد» ينقلها إلى «معتمدة» (docstatus 1)، و«رفض» يعيدها إلى «مسودة». يعلّم المتتبّع الحالات الماضية والحالية والمقبلة مع من نقلها ومتى.")}>
        <Example code={`<FrappeWorkflowActions doc={doc} user={session.user} roles={session.roles} variant="steps" confirm showCurrentEntry
  onApplied={(doc, action) => …} />`}>
          <SimProvider site={site}>{ready ? <WorkflowDemo onApplied={setLog} /> : <Skeleton className="h-40 w-full" />}</SimProvider>
        </Example>
        <Readout label="→">{log || "—"}</Readout>
      </Section>
      <Section title={l("Generic LifecycleBar and ActionBar", "LifecycleBar و ActionBar العامّان")} description={l("Frappe-free: states, actions and callbacks are props. \"Mark lost\" rejects on purpose to show the inline error and retry.", "بلا فرابيه: الحالات والإجراءات والاستدعاءات كلها خصائص. «تعليم كخاسرة» يرفض عمداً ليُظهر الخطأ المضمّن وإعادة المحاولة.")}>
        <Example code={`<LifecycleBar states={[{ id: "new", label: "New", by: "Sara", at }, …]} current="qualified" variant="steps"
  actions={[{ id: "proposal", label: "Move to Proposal sent" }, { id: "won", label: "Move to Won", confirm: "Close this deal as won?" }]}
  onAction={async (a) => api.apply(a.id)} />`}>
          <GenericLifecycleDemo />
        </Example>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// 6. Assignment and comments
// ---------------------------------------------------------------------------------------------------------------------

const DEMO_USERS: UserOption[] = USERS.map((u) => ({ id: u, label: u.split("@")[0].replace(/^./, (c) => c.toUpperCase()) + " Q", description: u }));
const searchDemoUsers = async (q: string) => { await new Promise((r) => setTimeout(r, 150)); return DEMO_USERS.filter((u) => `${u.label} ${u.id}`.toLowerCase().includes(q.toLowerCase())); };
const searchDemoMentions = async (q: string): Promise<MentionOption[]> => [...(await searchDemoUsers(q)).map((u) => ({ id: u.id, label: u.label })), ...("sales team".includes(q.toLowerCase()) ? [{ id: "Sales Team", label: "Sales Team", isGroup: true }] : [])];

function GenericAssignDemo() {
  const tr = useTr();
  const [assignees, setAssignees] = React.useState<Assignee[]>([{ id: USERS[0], name: "Sara Q", description: "Owner" }]);
  const [log, setLog] = React.useState("");
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <AssigneeGroup assignees={assignees} searchUsers={searchDemoUsers} me={DEMO_USERS[1]} withDetails
        onAssign={async (users, details) => { setAssignees((a) => [...a, ...users.map((u) => ({ id: u.id, name: u.label, description: details.description }))]); setLog(`onAssign: ${users.map((u) => u.id).join(", ")} ${JSON.stringify(details)}`); }}
        onRemove={async (a) => { setAssignees((s) => s.filter((x) => x.id !== a.id)); setLog(`onRemove: ${a.id}`); }} canRemove={() => true} />
      <AssigneeGroup variant="list" single heading={tr(l("Assignee (single, list)", "المسؤول (واحد، قائمة)"))} assignees={assignees.slice(0, 1)} searchUsers={searchDemoUsers}
        onAssign={async (users) => { setAssignees([{ id: users[0].id, name: users[0].label }]); setLog(`onAssign (single): ${users[0].id}`); }} onRemove={async () => { setAssignees([]); setLog("onRemove (single)"); }} canRemove={() => true} />
      <div className="md:col-span-2"><Readout label="→">{log || "—"}</Readout></div>
    </div>
  );
}

function ComposerDemo() {
  const [html, setHtml] = React.useState("");
  return (
    <div className="space-y-3">
      <CommentComposer searchMentions={searchDemoMentions} onSubmit={async (h) => { await new Promise((r) => setTimeout(r, 300)); setHtml(h); }} />
      <Readout label="onSubmit(html) →">{html || "—"}</Readout>
    </div>
  );
}

export function FrappeAssignPage() {
  const tr = useTr();
  const site = useSimSite({}, []);
  return (
    <div className="space-y-12">
      <StatusStrip parts={[["FrappeAssignTo (33) — close / bulk / group assignment missing", "partial"], ["assign_to.add / remove (writes)", "simulated"], ["AssigneeGroup · AssignPicker (40)", "generic"], ["CommentComposer · mentions (39)", "generic"]]} />
      <Section title={l("FrappeAssignTo on Travel Request TR-0001", "FrappeAssignTo على طلب السفر TR-0001")} description={l("Add an assignee (search Users through the simulator's search_link; \"Assign to me\"; comment, due date and priority as in Desk's dialog), then remove. The list is re-read from docinfo after every change — the 5-row answer of assign_to.add is never used as the source of truth.", "أضف مسؤولاً (بحث المستخدمين عبر search_link في المحاكي؛ «إسناد إليّ»؛ التعليق وتاريخ الاستحقاق والأولوية كما في حوار ديسك)، ثم أزِله. تُقرأ القائمة من docinfo بعد كل تغيير — إجابة assign_to.add ذات الخمسة صفوف لا تُستخدم مرجعاً أبداً.")}>
        <Example code={`<FrappeAssignTo doc={doc} user={session.user} userFullName="Administrator" canAssign canWrite withDetails />
<FrappeAssignTo doc={doc} user={session.user} single variant="list" heading="Assignee" canAssign canWrite />`}>
          <SimProvider site={site}>
            <div className="grid gap-6 md:grid-cols-2">
              <FrappeAssignTo doc={TRAVELS[0]} user="Administrator" userFullName="Administrator" canAssign canWrite withDetails />
              <FrappeAssignTo doc={TRAVELS[1]} user="Administrator" userFullName="Administrator" single variant="list" heading={tr(l("Assignee", "المسؤول"))} canAssign canWrite />
            </div>
          </SimProvider>
        </Example>
      </Section>
      <Section title={l("Generic AssigneeGroup and AssignPicker", "AssigneeGroup و AssignPicker العامّان")} description={l("No Frappe: assignees in, callbacks out. Stacked avatars (Desk-like) and the single-assignee list variant.", "بلا فرابيه: المُسنَد إليهم يدخلون، والاستدعاءات تخرج. صور رمزية متراكبة (كديسك) ومتغيّر القائمة لمسؤول واحد.")}>
        <Example code={`<AssigneeGroup assignees={assignees} searchUsers={search} me={me} withDetails
  onAssign={(users, details) => …} onRemove={(a) => …} canRemove={() => true} />`}>
          <GenericAssignDemo />
        </Example>
      </Section>
      <Section title={l("CommentComposer with mentions", "CommentComposer مع الإشارات")} description={l("Type @ and a few letters: the mention list is keyboard driven (arrows, Enter, Escape); Ctrl/⌘+Enter submits. The output HTML follows the server contract (span.mention[data-id]).", "اكتب @ وبعض الحروف: قائمة الإشارات تُدار بلوحة المفاتيح (الأسهم و Enter و Escape)؛ Ctrl/⌘+Enter يرسل. HTML الناتج يتبع عقد الخادم (span.mention[data-id]).")}>
        <Example code={`<CommentComposer searchMentions={(q) => searchUsers(q)} onSubmit={(html, draft) => api.addComment(html)} />`}>
          <ComposerDemo />
        </Example>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// 7. Permissions playground
// ---------------------------------------------------------------------------------------------------------------------

const RIGHTS: PermType[] = ["read", "write", "create", "delete", "import", "export"];
const BULK_LABEL: Record<BulkKind, string> = { edit: "Edit", submit: "Submit", cancel: "Cancel", assign: "Assign To", delete: "Delete" };

function PermissionsLive({ session }: { session: SessionKey }) {
  const tr = useTr();
  const s = SESSIONS[session];
  const bundle = useMetaBundle("Travel Request");
  const perms = usePermissions(bundle.data);
  if (!bundle.data) return <Skeleton className="h-40 w-full" />;
  const meta = bundle.data.meta;
  const level0 = perms.levels[0];
  const imp = canImport(meta, s.roles, level0);
  const exp = canExport(s.roles, level0);
  const menu = bulkMenu({ permissions: level0, isSubmittable: !!meta.is_submittable, hasWorkflow: !!perms.workflow, allowEdit: false, hasEditableFields: true });
  const newDoc: FrappeDoc = { doctype: "Travel Request", name: "new-travel-request-1", __islocal: 1 } as FrappeDoc;
  const internal = meta.fields.find((f) => f.fieldname === "internal_notes")!;
  const status = fieldDisplayStatus(internal, newDoc, perms.levels);
  const readable = readableFields(meta.fields.filter((f) => !["Section Break", "Column Break"].includes(f.fieldtype)), perms.levels);
  const yes = (v: boolean) => <Badge variant={v ? "success" : "outline"}>{v ? tr(l("yes", "نعم")) : tr(l("no", "لا"))}</Badge>;
  const hides: [string, boolean, L][] = [
    ["Import menu entry (canImport)", imp, l("needs allow_import on the DocType and System Manager or the import right", "يتطلّب allow_import على نوع المستند و System Manager أو حق الاستيراد")],
    ["Export dialog (canExport)", exp, l("System Manager, else the export right (if_owner rows included; the server checks every row's owner)", "System Manager أو حق التصدير (شاملاً صفوف if_owner؛ الخادم يفحص مالك كل صف)")],
    ["New document button (create)", !!level0?.create, l("the form's Save needs create on a new document", "حفظ النموذج يتطلّب create على مستند جديد")],
    ["Bulk actions menu", menu.length > 0, l(menu.length ? `offers: ${menu.map((k) => BULK_LABEL[k]).join(", ")}` : "nothing is offered", menu.length ? `يعرض: ${menu.map((k) => BULK_LABEL[k]).join(", ")}` : "لا يُعرض شيء")],
    ["Internal notes (permlevel 1)", status !== "None", l(`display status: ${status}`, `حالة العرض: ${status}`)],
    ["Readable fields", readable.length > 0, l(`${readable.length} of ${meta.fields.filter((f) => !["Section Break", "Column Break"].includes(f.fieldtype)).length} data fields`, `${readable.length} من ${meta.fields.filter((f) => !["Section Break", "Column Break"].includes(f.fieldtype)).length} حقل بيانات`)],
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">{tr(l("usePermissions(bundle).levels[0] — rights on a new Travel Request", "usePermissions(bundle).levels[0] — الحقوق على طلب سفر جديد"))}</h4>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-3 py-2 text-start font-medium">{tr(l("Right", "الحق"))}</th><th className="px-3 py-2 text-start font-medium">{tr(l("Granted", "مُمنوح"))}</th></tr></thead>
            <tbody>
              {RIGHTS.map((r) => (
                <tr key={r} className="border-t border-border"><td className="px-3 py-1.5 font-mono text-xs" dir="ltr">{r}</td><td className="px-3 py-1.5">{yes(!!level0?.[r])}</td></tr>
              ))}
              <tr className="border-t border-border"><td className="px-3 py-1.5 font-mono text-xs" dir="ltr">canImport(meta, roles, level0)</td><td className="px-3 py-1.5">{yes(imp)}</td></tr>
              <tr className="border-t border-border"><td className="px-3 py-1.5 font-mono text-xs" dir="ltr">canExport(roles, level0)</td><td className="px-3 py-1.5">{yes(exp)}</td></tr>
              <tr className="border-t border-border"><td className="px-3 py-1.5 font-mono text-xs" dir="ltr">levels[1] (permlevel 1)</td><td className="px-3 py-1.5 font-mono text-xs" dir="ltr">{JSON.stringify(perms.levels[1] ?? {})}</td></tr>
              <tr className="border-t border-border"><td className="px-3 py-1.5 font-mono text-xs" dir="ltr">known (rights computed, not the rule-9 denial)</td><td className="px-3 py-1.5">{yes(perms.known)}</td></tr>
            </tbody>
          </table>
        </div>
        {s.roles === undefined && (
          <Alert>
            <AlertTitle>{tr(l("Roles unknown: rule 9 — missing information denies", "الأدوار غير معروفة: القاعدة 9 — نقص المعلومات يعني الرفض"))}</AlertTitle>
            <AlertDescription className="text-xs">{tr(l("Without session.roles (and not the Administrator user) nothing is granted: a new document gets no right, a saved one only what the server's docinfo.permissions say, and usePermissions().known is false — the form below prints \"Read only\" (data-permissions=\"unknown\") instead of \"forbidden\". Before dev.26 this case was optimistic (matrix row 7a); fixed in dev.27.", "دون session.roles (ولست المستخدم Administrator) لا يُمنح شيء: المستند الجديد بلا حق، والمحفوظ بما تقوله docinfo.permissions من الخادم فقط، و usePermissions().known تكون false — يطبع النموذج أدناه «للقراءة فقط» (data-permissions=\"unknown\") بدل «ممنوع». قبل dev.26 كانت هذه الحالة متفائلة (صف 7أ)؛ أُصلحت في dev.27."))}</AlertDescription>
          </Alert>
        )}
      </div>
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">{tr(l("What the UI hides for this session", "ما تخفيه الواجهة لهذه الجلسة"))}</h4>
        <ul className="space-y-2 text-sm">
          {hides.map(([name, shown, why]) => (
            <li key={name} className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2">
              <span className="font-mono text-xs text-foreground" dir="ltr">{name}</span>
              <Badge variant={shown ? "success" : "warning"}>{shown ? tr(l("shown", "ظاهر")) : tr(l("hidden", "مخفي"))}</Badge>
              <span className="text-xs text-muted-foreground">{tr(why)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="lg:col-span-2 space-y-2">
        <h4 className="text-sm font-semibold text-foreground">{tr(l("Live: a new Travel Request as this session", "مباشر: طلب سفر جديد بهذه الجلسة"))}</h4>
        <p className="text-xs text-muted-foreground">{tr(l("Internal notes (permlevel 1) is shown only to System Manager; Sales User and Exporter have no create right, so Save is withheld; Data Entry may create and import.", "«ملاحظات داخلية» (permlevel 1) تظهر لـ System Manager فقط؛ Sales User و Exporter بلا حق إنشاء فلا زر حفظ؛ Data Entry يمكنه الإنشاء والاستيراد."))}</p>
        <FrappeForm doctype="Travel Request" guardUnload={false} />
      </div>
    </div>
  );
}

export function FrappePermissionsPage() {
  const tr = useTr();
  const [session, setSession] = React.useState<SessionKey>("admin");
  const site = useSimSite({}, []);
  return (
    <div className="space-y-12">
      <StatusStrip parts={[["usePermissions · buildDocPermissions · rolePermissions · fieldDisplayStatus (7; rule 9 since dev.27)", "partial"], ["canImport · canExport · readableFields · permissionsKnown", "simulated"], ["bulkMenu (21)", "partial"]]}
        note={l("Client-side mirror of Desk's frm.perm; the server is the authority. The real check agreed with get_doc_permissions for two full-rights users only (weak evidence). The simulator answers docinfo.permissions with every right, so saved documents are not role-gated here; this playground reasons about a NEW document, where only the role rows count.", "مرآة في العميل لـ frm.perm في ديسك؛ الخادم هو المرجع. الفحص الحقيقي اتفق مع get_doc_permissions لمستخدمَين كاملي الحقوق فقط (دليل ضعيف). المحاكي يجيب docinfo.permissions بكل الحقوق، فالمستندات المحفوظة غير مقيّدة بالدور هنا؛ تستدلّ هذه الساحة على مستند جديد حيث تُحتسب صفوف الأدوار وحدها.")} />
      <Section title={l("Role picker over Travel Request", "منتقي الأدوار على طلب السفر")} description={l("Travel Request's role rows: System Manager (everything, plus permlevel 1), Sales User (read), Data Entry (read / write / create / import; the DocType has allow_import), Exporter (read / export). \"No roles\" is an empty role list; \"Roles unknown\" omits session.roles.", "صفوف أدوار طلب السفر: System Manager (كل شيء مع permlevel 1)، Sales User (قراءة)، Data Entry (قراءة / كتابة / إنشاء / استيراد؛ النوع يسمح بالاستيراد)، Exporter (قراءة / تصدير). «بلا أدوار» قائمة أدوار فارغة؛ «أدوار غير معروفة» تُسقط session.roles.")}>
        <Picker legend={l("Session", "الجلسة")} value={session} onChange={setSession} options={[
          { value: "admin", label: l("System Manager", "System Manager") }, { value: "sales", label: l("Sales User (read-only)", "Sales User (قراءة فقط)") }, { value: "dataEntry", label: l("Data Entry (with import)", "Data Entry (مع استيراد)") },
          { value: "exporter", label: l("Exporter", "Exporter") }, { value: "none", label: l("No roles", "بلا أدوار") }, { value: "unknown", label: l("Roles unknown", "أدوار غير معروفة") },
        ]} />
        <SessionBadge session={session} />
        <Example code={`<FrappeProvider client={client} session={{ user, roles }}>
  const perms = usePermissions(bundle);                 // Desk's frm.perm for a new document
  perms.can("write"); canImport(meta, roles, perms.levels[0]); canExport(roles, perms.levels[0]);
  bulkMenu({ permissions: perms.levels[0], isSubmittable, hasWorkflow, allowEdit, hasEditableFields });
  fieldDisplayStatus(df, doc, perms.levels)             // "Write" | "Read" | "None"`}>
          <SimProvider site={site} session={session} key={session}><PermissionsLive session={session} /></SimProvider>
        </Example>
        <p className="text-xs text-muted-foreground">{tr(l("Rights not shown (submit, cancel, amend, print, email, share, report, select) follow the same rows; Travel Request is not submittable.", "الحقوق غير المعروضة (اعتماد وإلغاء وتعديل بعد الإلغاء وطباعة وبريد ومشاركة وتقرير واختيار) تتبع الصفوف نفسها؛ طلب السفر غير قابل للاعتماد."))}</p>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// 8. Import / Export (dev.28) — gated menu entries, the Export dialog, the exact requests; the file server is simulated
// ---------------------------------------------------------------------------------------------------------------------

type IoSession = "admin" | "sales" | "dataEntry" | "exporter" | "none";
const IO_SESSIONS: { value: IoSession; label: L }[] = [
  { value: "admin", label: l("System Manager", "System Manager") }, { value: "dataEntry", label: l("Data Entry (import right)", "Data Entry (حق الاستيراد)") },
  { value: "exporter", label: l("Exporter (export right)", "Exporter (حق التصدير)") }, { value: "sales", label: l("Sales User (neither)", "Sales User (لا هذا ولا ذاك)") }, { value: "none", label: l("No roles", "بلا أدوار") },
];
const fmtCall = (c: FileCall) => `${c.kind} ${c.method}\n  ${JSON.stringify(c.args, null, 1).replace(/\n\s*/g, " ")}\n  → ${c.outcome}`;

function RefusedExportDemo({ site, calls }: { site: SimSite; calls: (c: FileCall) => void }) {
  const tr = useTr();
  const bundle = useMetaBundle("Travel Request");
  const [open, setOpen] = React.useState(false);
  // the same simulated site, with a file transport that refuses (what a site answers a user without the export right)
  const api = React.useMemo(() => withFrappeApi(createFrappeClient({ transport: site.transport, files: simulatedFiles("refuse", calls) })), [site, calls]);
  if (!bundle.data) return <Skeleton className="h-10 w-48" />;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>{tr(l("Open the Export dialog as Sales User (server refuses)", "فتح حوار التصدير بوصفك Sales User (الخادم يرفض)"))}</Button>
      <FrappeExportDialog api={api} bundle={bundle.data} open={open} onOpenChange={setOpen} filters={[]} />
    </>
  );
}
export function FrappeImportExportPage() {
  const tr = useTr();
  const [session, setSession] = React.useState<IoSession>("admin");
  const [log, setLog] = React.useState<string[]>([]);
  const push = React.useCallback((line: string) => setLog((s) => [line, ...s].slice(0, 8)), []);
  const onCall = React.useCallback((c: FileCall) => push(fmtCall(c)), [push]);
  // Exporter / System Manager / Data Entry: the simulated server answers a labelled text file; Sales User / no roles never reach the dialog from the list.
  const site = useSimSite({ files: simulatedFiles("respond", onCall) }, [onCall]);
  const s = SESSIONS[session];
  const level0 = s.roles ? rolePermissions(TRAVEL.permissions, s.roles).levels[0] : undefined;
  const imp = canImport(TRAVEL, s.roles, level0), exp = canExport(s.roles, level0);
  return (
    <div className="space-y-12">
      <StatusStrip parts={[["Import entry · onImport · startDataImport sequence (23, dev.28)", "simulated"], ["FrappeExportDialog · downloadExportTemplate (22, dev.28)", "simulated"], ["canImport · canExport gates", "simulated"]]}
        note={l("SIMULATED, end to end. The list's ⋯ menu and the selection bar are the real package; the file transport is a stub that records the exact request the package would POST and answers either a 403 (Sales User) or a 40-byte text file that says it is a simulated response. No export is ever built from client data; no import runs (uploads are refused by the stub). The package's own default would navigate to /app/data-import — here onImport only logs.", "محاكاة من البداية إلى النهاية. قائمة ⋯ وشريط التحديد هما الحزمة الحقيقية؛ ناقل الملفات بديل يسجّل الطلب الدقيق الذي سترسله الحزمة ويجيب إمّا بـ 403 ‏(Sales User) أو بملف نصي صغير يقول إنه استجابة محاكاة. لا يُبنى أي تصدير من بيانات العميل؛ لا يُشغَّل أي استيراد (البديل يرفض الرفع). الافتراضي في الحزمة ينتقل إلى /app/data-import — هنا onImport يسجّل فقط.")} />
      <Section title={l("Gated entries on the Travel Request list", "المدخلان المقيّدان في قائمة طلبات السفر")} description={l("Switch the session: the ⋯ menu offers Import only when canImport (allow_import and System Manager or the import right) and Export only when canExport; select rows and Export appears in the selection bar preset to the checked names. Open the dialog, pick fields, press Export: the request is recorded below and the simulated server answers a labelled text file (the browser saves it as SIMULATED-not-an-export.txt).", "بدّل الجلسة: تعرض قائمة ⋯ «استيراد» فقط عند canImport (allow_import و System Manager أو حق الاستيراد) و«تصدير» فقط عند canExport؛ حدّد صفوفاً فيظهر «تصدير» في شريط التحديد مضبوطاً على الأسماء المحدّدة. افتح الحوار واختر الحقول واضغط تصدير: يُسجَّل الطلب أدناه ويجيب الخادم المحاكى بملف نصي موسوم (يحفظه المتصفّح باسم SIMULATED-not-an-export.txt).")}>
        <Picker legend={l("Session", "الجلسة")} value={session} onChange={(v) => { setSession(v); setLog([]); }} options={IO_SESSIONS} />
        <div className="flex flex-wrap items-center gap-2">
          <SessionBadge session={session} />
          <Badge variant={imp ? "success" : "outline"} dir="ltr">canImport: {String(imp)}</Badge>
          <Badge variant={exp ? "success" : "outline"} dir="ltr">canExport: {String(exp)}</Badge>
        </div>
        <Example className="p-0" code={`<FrappeProvider client={createFrappeClient({ transport, files })} session={{ user, roles }}>
  <FrappeListView doctype="Travel Request" selectable
    onImport={() => openMyImportFlow()}           // default: location.assign("/app/data-import/new?reference_doctype=…")
    ioLabels={{ importEntry: "Import", exportEntry: "Export", title: "Export Data" }} />
</FrappeProvider>
// the dialog posts: ${DOWNLOAD_TEMPLATE_METHOD}
//   { doctype, file_type: "CSV" | "Excel", export_records: "all" | "by_filter" | "5_records" | "blank_template", export_fields: JSON, export_filters: JSON | null }`}>
          <SimProvider site={site} session={session} key={session}>
            <div className="px-4 py-4 md:px-6">
              <FrappeListView doctype="Travel Request" selectable storage={null} rowMeta={false} onImport={() => push(`onImport → the app opens its Data Import flow (package default: location.assign("/app/data-import/new?reference_doctype=Travel%20Request"))`)} />
            </div>
          </SimProvider>
        </Example>
        <Readout label="file transport →">{log.length ? log.join("\n\n") : "—"}</Readout>
      </Section>
      <Section title={l("Permission denied by the server", "الخادم يرفض الإذن")} description={l("The client gate hides the entry for Sales User, but the server is the authority: this opens the same FrappeExportDialog over a transport that answers 403 PermissionError — shown inside the dialog as FrappeErrorState, no file, no retry.", "بوابة العميل تخفي المدخل عن Sales User، لكن الخادم هو المرجع: هذا يفتح FrappeExportDialog نفسه فوق ناقل يجيب 403 PermissionError — يُعرض داخل الحوار كـ FrappeErrorState، بلا ملف ولا إعادة محاولة.")}>
        <Example code={`<FrappeExportDialog api={api} bundle={bundle} open onOpenChange={…} filters={list.filters} levels={perms.levels} />`}>
          <SimProvider site={site} session="sales"><RefusedExportDemo site={site} calls={onCall} /></SimProvider>
        </Example>
      </Section>
      <Section title={l("What an import would send (never run here)", "ما سيرسله الاستيراد (لا يُشغَّل هنا)")} description={l("startDataImport reproduces Desk's Data Import sequence; every step is a write on the site, so the showcase only lists the methods. Nothing on this page creates a Data Import document.", "startDataImport يعيد تسلسل أداة الاستيراد في ديسك؛ كل خطوة كتابة على الموقع، لذا يكتفي المعرض بسرد الأساليب. لا شيء في هذه الصفحة ينشئ مستند Data Import.")}>
        <Readout label="startDataImport(api, { referenceDoctype, importType, file, filename }) →">{[
          `1. ${DATA_IMPORT_METHODS.save}  (new Data Import: reference_doctype, import_type — server checks allow_import + import right)`,
          `2. ${DATA_IMPORT_METHODS.upload}  (multipart; doctype "Data Import", fieldname import_file, is_private 1)`,
          `3. ${DATA_IMPORT_METHODS.save}  (import_file = file_url — the server parses the template here)`,
          `4. ${DATA_IMPORT_METHODS.preview}`,
          `5. ${DATA_IMPORT_METHODS.start}  → true (enqueued) | false (already queued)`,
          `6. ${DATA_IMPORT_METHODS.status} / ${DATA_IMPORT_METHODS.logs}  (useImportStatus polls; realtime data_import_progress)`,
          `7. ${DATA_IMPORT_METHODS.erroredRows}  (Export Errored Rows)`,
        ].join("\n")}</Readout>
        <p className="text-xs text-muted-foreground">{tr(l("Server fact: the Data Import DocType grants create to System Manager only, so a Data Entry user with the import right is refused at step 1 (403) — Desk and the package both still show the entry.", "حقيقة من الخادم: نوع Data Import يمنح الإنشاء لـ System Manager فقط، فيُرفض مستخدم Data Entry ذو حق الاستيراد في الخطوة 1 ‏(403) — ديسك والحزمة يعرضان المدخل مع ذلك."))}</p>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// 9. RTL and LTR side by side · 10. Light and dark side by side
// ---------------------------------------------------------------------------------------------------------------------

/** A nested, element-scoped ThemeProvider: its own theme / language / direction on a wrapper <div> (popups portal inside it). */
function Pane({ theme, language, title, children }: { theme: "light" | "dark"; language: "en" | "ar"; title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="font-mono text-xs text-muted-foreground" dir="ltr">{title}</p>
      <ThemeProvider scope="element" storageKeys={null} theme={theme} language={language} className="sf-app min-w-0 overflow-hidden rounded-2xl border border-border p-4">
        {children}
      </ThemeProvider>
    </div>
  );
}

function PaneContent({ site, list, form, timeline }: { site: SimSite; list?: boolean; form?: string; timeline?: boolean }) {
  return (
    <SimProvider site={site}>
      <div className="space-y-6">
        {list && <FrappeListView<ToDoRow> doctype="ToDo" columns={TODO_COLUMNS} fieldLabels={TODO_LABELS} pageSize={5} storage={null} rowMeta={false} />}
        {form && <FrappeForm doctype="Travel Request" name={form} guardUnload={false} />}
        {timeline && <TimelinePane />}
      </div>
    </SimProvider>
  );
}

function TimelinePane() {
  const q = useDoc("ToDo", "TD-0001");
  if (!q.data) return <Skeleton className="h-40 w-full" />;
  return <FrappeTimeline doc={q.data.doc} user="Administrator" isSystemManager canDeleteComment />;
}

export function FrappeRtlPage() {
  const tr = useTr();
  const { isDark } = useTheme();
  const theme = isDark ? "dark" : "light";
  const site = useSimSite({}, []);
  return (
    <div className="space-y-12">
      <StatusStrip verified="15–19, 24–27" parts={[["FrappeListView (15–19)", "verified-read"], ["FrappeForm (24–27)", "verified-read"], ["Table MultiSelect (28)", "simulated"]]} />
      <Section title={l("Arabic (RTL) and English (LTR), the same list and form", "العربية (يمين إلى يسار) والإنجليزية (يسار إلى يمين)، القائمة والنموذج نفسهما")} description={l("Two element-scoped ThemeProviders over one simulated site: the left pane is forced to Arabic, the right to English, whatever the page language. TR-0002's purpose mixes Arabic and Latin text; TD-0012's title mixes both with an ID — isolates and <bdi> keep the word order.", "مزوّدا سمة محدودا العنصر على موقع محاكى واحد: اللوحة الأولى مثبّتة على العربية والثانية على الإنجليزية أياً كانت لغة الصفحة. غرض TR-0002 يخلط العربية واللاتينية؛ عنوان TD-0012 يخلطهما مع معرّف — العوازل و <bdi> تحفظ ترتيب الكلمات.")}>
        <Example className="p-4" code={`<ThemeProvider scope="element" storageKeys={null} language="ar" theme={theme}>…</ThemeProvider>
<ThemeProvider scope="element" storageKeys={null} language="en" theme={theme}>…</ThemeProvider>`}>
          <div className="grid gap-6 xl:grid-cols-2">
            <Pane theme={theme} language="ar" title='language="ar" · dir="rtl"'><PaneContent site={site} list form="TR-0002" /></Pane>
            <Pane theme={theme} language="en" title='language="en" · dir="ltr"'><PaneContent site={site} list form="TR-0002" /></Pane>
          </div>
        </Example>
        <p className="text-xs text-muted-foreground">{tr(l("The page's own direction (the header's language switch) is unchanged by these panes; each pane carries its own dir and lang attributes.", "اتجاه الصفحة نفسها (مبدّل اللغة في الرأس) لا يتغيّر بهذه اللوحات؛ كل لوحة تحمل خاصيتَي dir و lang الخاصتين بها."))}</p>
      </Section>
    </div>
  );
}

export function FrappeThemesPage() {
  const tr = useTr();
  const { language } = useLocale();
  const site = useSimSite({}, []);
  const ready = useSeeded(site, "ToDo", "TD-0001", { status: "Closed", priority: "Low" });
  return (
    <div className="space-y-12">
      <StatusStrip verified="15–19, 24–27" parts={[["FrappeListView (15–19)", "verified-read"], ["FrappeForm (24–27)", "verified-read"], ["FrappeTimeline (34)", "simulated"]]} />
      <Section title={l("Light and dark, side by side", "الفاتح والداكن جنباً إلى جنب")} description={l("Two element-scoped ThemeProviders over one simulated site: list, form and timeline in light on one side and dark on the other, in the page's language. Tokens only — no component carries a hard-coded colour.", "مزوّدا سمة محدودا العنصر على موقع محاكى واحد: القائمة والنموذج والخط الزمني بالفاتح في جهة والداكن في الأخرى، بلغة الصفحة. رموز فقط — لا مكوّن يحمل لوناً ثابتاً.")}>
        <Example className="p-4" code={`<ThemeProvider scope="element" storageKeys={null} theme="light" language={language}>…</ThemeProvider>
<ThemeProvider scope="element" storageKeys={null} theme="dark" language={language}>…</ThemeProvider>`}>
          <div className="grid gap-6 xl:grid-cols-2">
            <Pane theme="light" language={language} title='theme="light"'>{ready ? <PaneContent site={site} list form="TR-0001" timeline /> : <Skeleton className="h-64 w-full" />}</Pane>
            <Pane theme="dark" language={language} title='theme="dark"'>{ready ? <PaneContent site={site} list form="TR-0001" timeline /> : <Skeleton className="h-64 w-full" />}</Pane>
          </div>
        </Example>
        <p className="text-xs text-muted-foreground">{tr(l("The header's theme switch still changes the page; these two panes are pinned.", "مبدّل السمة في الرأس ما يزال يغيّر الصفحة؛ هاتان اللوحتان مثبّتتان."))}</p>
      </Section>
    </div>
  );
}
