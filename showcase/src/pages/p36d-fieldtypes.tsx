/**
 * P36d fieldtypes — the "Frappe Field Types" showcase group. Every Frappe 15.110 field type (DocField.fieldtype, plus Long
 * Int, Page Break and the six Data options) rendered through the package's real `FrappeField` / `FrappeFormView` from
 * a DocField. Reference: docs/audit/p36d/FIELD-TYPES.md (row ids FT-nn, file:line for every native behaviour).
 *
 * Server answers (search_link, validate_link, upload_file) come from the in-browser SIMULATOR (createSimSite →
 * createFixtureTransport) and are labelled SIMULATED. Types the package has no control for (Signature, Barcode,
 * Geolocation, Icon) are shown as "Not implemented yet" with FrappeField's read-only fallback — never faked.
 */
import * as React from "react";
import { Alert, AlertDescription, AlertTitle, Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, ThemeProvider, useLocale, useTheme } from "@ui";
import { FrappeField, FrappeFormView, FrappeProvider, type FieldDisplayStatus, type FrappeDoc, type FrappeDocField, type MetaBundle } from "@ui/frappe";
import { createSimSite, type SimSite } from "../../../playground/src/demo/sim-site";
import { Example, Section } from "../doc/Doc";
import { l, useTr, type L } from "../i18n";
import { Picker, Readout, StatusStrip } from "./frappe/shared";
import { FIELD_TYPES, SAMPLES, arabicTranslations, rowLabel, type FieldSample, type FieldTypeRow, type FtClass, type FtStatus } from "./p36d-fieldtypes-data";

// ---------------------------------------------------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------------------------------------------------

const STATUS_VARIANT: Record<FtStatus, "success" | "warning" | "destructive" | "outline"> = { COMPLETE: "success", PARTIAL: "warning", MISSING: "destructive", "n/a": "outline" };
const STATUS_TEXT: Record<FtStatus, L> = {
  COMPLETE: l("Complete", "مكتمل"), PARTIAL: l("Partial", "جزئي"), MISSING: l("Not implemented yet", "غير منفَّذ بعد"), "n/a": l("Not a DocField option", "ليس خياراً في DocField"),
};
const CLASS_TEXT: Record<FtClass, L> = {
  input: l("Input", "إدخال"), composite: l("Composite", "مركّب"), integration: l("Special integration", "تكامل خاص"), display: l("Display", "عرض"), layout: l("Layout", "تخطيط"),
};

function StatusBadgeFt({ status }: { status: FtStatus }) {
  const tr = useTr();
  return <Badge variant={STATUS_VARIANT[status]} data-ft-status={status}>{tr(STATUS_TEXT[status])}</Badge>;
}

/** One simulated site per page (fresh data, own query cache); `latency` keeps the loading states visible. */
function useFtSite(latency = 0): SimSite {
  return React.useMemo(() => createSimSite({ latency, fileMode: "respond", todoCount: 3 }), [latency]);
}

/**
 * FrappeProvider over the simulated site. In Arabic the provider gets Desk's __() dictionary for the demo labels and
 * Select options (`translations`), so FrappeField translates them exactly as it does a site's.
 */
function FtProvider({ site, children }: { site: SimSite; children: React.ReactNode }) {
  const { language } = useLocale();
  const translations = React.useMemo(() => (language === "ar" ? arabicTranslations() : undefined), [language]);
  const s = site.transport.store.session ?? { user: "Administrator", fullName: "Administrator", roles: ["System Manager", "All"] };
  return (
    <FrappeProvider client={site.client} queryClient={site.qc} session={{ user: s.user, fullName: s.fullName, roles: s.roles }} translations={translations}>
      {children}
    </FrappeProvider>
  );
}

/** The demo document a standalone field belongs to (Attach targets an existing simulated ToDo). */
const demoDoc = (df: Partial<FrappeDocField>, value: unknown): FrappeDoc => {
  const attach = df.fieldtype === "Attach" || df.fieldtype === "Attach Image";
  return { doctype: attach ? "ToDo" : "FT Demo", name: attach ? "TD-0001" : "FT-0001", reference_doctype: "User", logo: "/files/company-logo.png", [df.fieldname ?? "value"]: value } as FrappeDoc;
};

const emptyOf = (fieldtype: string): unknown => (fieldtype === "Check" ? 0 : ["Int", "Long Int", "Float", "Currency", "Percent", "Rating", "Duration"].includes(fieldtype) ? null : "");
const show = (v: unknown) => (v === undefined ? "undefined" : JSON.stringify(v));

/** A live FrappeField with its own value; the stored value (what a save would send) is shown under it. */
function LiveField({ df, initial, status, error, testId }: { df: FrappeDocField; initial: unknown; status?: FieldDisplayStatus; error?: React.ReactNode; testId?: string }) {
  const [value, setValue] = React.useState<unknown>(initial);
  const doc = demoDoc(df, value);
  return (
    <div className="min-w-0 space-y-2" data-testid={testId}>
      <FrappeField df={df} value={value} onChange={setValue} doc={doc} status={status} error={error} onButtonClick={() => setValue((n: unknown) => Number(n ?? 0) + 1)} />
      <p className="truncate font-mono text-[11px] text-muted-foreground" dir="ltr" title={show(value)}>value: {show(value)}</p>
    </div>
  );
}

function StateCard({ title, note, children }: { title: L; note?: L; children: React.ReactNode }) {
  const tr = useTr();
  return (
    <div className="min-w-0 space-y-3 rounded-xl border border-border bg-background/40 p-4">
      <div className="space-y-0.5">
        <p className="text-xs font-semibold text-foreground">{tr(title)}</p>
        {note && <p className="text-[11px] text-muted-foreground">{tr(note)}</p>}
      </div>
      {children}
    </div>
  );
}

function NoteCard({ title, children }: { title: L; children: L }) {
  const tr = useTr();
  return (
    <div className="min-w-0 space-y-1 rounded-xl border border-dashed border-border p-4">
      <p className="text-xs font-semibold text-foreground">{tr(title)}</p>
      <p className="text-[11px] text-muted-foreground">{tr(children)}</p>
    </div>
  );
}

/** A nested, element-scoped ThemeProvider (its own theme / language / direction; popups portal inside it). */
function Pane({ theme, language, title, children }: { theme: "light" | "dark"; language: "en" | "ar"; title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-2" data-ft-pane={`${language}-${theme}`}>
      <p className="font-mono text-xs text-muted-foreground" dir="ltr">{title}</p>
      <ThemeProvider scope="element" storageKeys={null} theme={theme} language={language} className="sf-app min-w-0 overflow-hidden rounded-2xl border border-border p-4">
        {children}
      </ThemeProvider>
    </div>
  );
}

const SIM_NOTE = l(
  "SIMULATED backend operations: search_link, validate_link and upload_file are answered by the in-browser simulator (createFixtureTransport). Nothing on this page ran against a real Frappe site; the server is always the authority.",
  "عمليات خلفية محاكاة: يجيب المحاكي داخل المتصفّح (createFixtureTransport) عن search_link و validate_link و upload_file. لم يُشغَّل شيء في هذه الصفحة على موقع فرابيه حقيقي؛ الخادم هو المرجع دائماً.",
);

// ---------------------------------------------------------------------------------------------------------------------
// 1. Inventory
// ---------------------------------------------------------------------------------------------------------------------

type InvFilter = "all" | FtClass | "missing";

export function FieldTypesInventoryPage() {
  const tr = useTr();
  const [filter, setFilter] = React.useState<InvFilter>("all");
  const docfield = FIELD_TYPES.filter((r) => r.docfieldOption);
  const count = (s: FtStatus) => docfield.filter((r) => r.status === s).length;
  const rows = FIELD_TYPES.filter((r) => filter === "all" || (filter === "missing" ? r.status === "MISSING" : r.cls === filter));
  const site = useFtSite();
  return (
    <div className="space-y-12">
      <StatusStrip parts={[["FrappeField · FrappeFormView", "simulated"], ["NumberInput · TimeInput · DurationInput · LinkInput · Rating · ColorInput · AttachInput", "generic"]]}
        note={l("The inventory is read from the Frappe 15.110 source (frappe/model/__init__.py, DocField.fieldtype, form/controls/, formatters.js); the full table with file:line for every behaviour is docs/audit/p36d/FIELD-TYPES.md.",
          "الجرد مأخوذ من مصدر فرابيه 15.110 (frappe/model/__init__.py و DocField.fieldtype و form/controls/ و formatters.js)؛ الجدول الكامل مع الملف والسطر لكل سلوك في docs/audit/p36d/FIELD-TYPES.md.")} />
      <Section title={l("Every field type, and what the package covers", "كل أنواع الحقول، وما تغطيه الحزمة")}
        description={l("The 43 options of DocField.fieldtype, plus Long Int (a data type that is not a DocField option), Page Break (layout.js only) and the six Data options (Email, Name, Phone, URL, Barcode, IBAN). Complete = value, stored format, read display, statuses and the main interaction match Desk; Partial = a native behaviour that changes data, validation or the main interaction is missing.",
          "خيارات DocField.fieldtype الثلاثة والأربعون، ومعها Long Int (نوع بيانات ليس خياراً في DocField) و Page Break (في layout.js فقط) وخيارات Data الستة (Email و Name و Phone و URL و Barcode و IBAN). «مكتمل» = القيمة وصيغة الحفظ والعرض للقراءة والحالات والتفاعل الرئيسي مطابقة لديسك؛ «جزئي» = ينقصه سلوك أصلي يغيّر البيانات أو التحقّق أو التفاعل الرئيسي.")}>
        <div className="flex flex-wrap items-center gap-2" data-testid="ft-counts">
          <span className="text-xs text-muted-foreground">{tr(l(`${docfield.length} DocField types:`, `${docfield.length} نوعاً في DocField:`))}</span>
          <Badge variant="success">{tr(l("Complete", "مكتمل"))} {count("COMPLETE")}</Badge>
          <Badge variant="warning">{tr(l("Partial", "جزئي"))} {count("PARTIAL")}</Badge>
          <Badge variant="destructive">{tr(l("Not implemented yet", "غير منفَّذ بعد"))} {count("MISSING")}</Badge>
        </div>
        <Picker legend={l("Show", "عرض")} value={filter} onChange={setFilter} options={[
          { value: "all", label: l("All", "الكل") }, { value: "input", label: CLASS_TEXT.input }, { value: "integration", label: CLASS_TEXT.integration },
          { value: "composite", label: CLASS_TEXT.composite }, { value: "display", label: CLASS_TEXT.display }, { value: "layout", label: CLASS_TEXT.layout },
          { value: "missing", label: l("Not implemented yet", "غير منفَّذ بعد") },
        ]} />
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[760px] text-sm" data-testid="ft-inventory">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                {[l("Id", "المعرّف"), l("Field type", "نوع الحقل"), l("Class", "الفئة"), l("Status", "الحالة"), l("Frappe control", "عنصر فرابيه"), l("DS component", "مكوّن نظام التصميم"), l("Missing", "الناقص")].map((h) => (
                  <th key={h.en} className="px-3 py-2 text-start font-medium">{tr(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top" data-ft-row={r.id}>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground" dir="ltr">{r.id}</td>
                  <td className="px-3 py-2 font-medium text-foreground" dir="ltr">{rowLabel(r)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{tr(CLASS_TEXT[r.cls])}</td>
                  <td className="px-3 py-2"><StatusBadgeFt status={r.status} /></td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground" dir="ltr">{r.native}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground" dir="ltr">{r.ds}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{tr(r.gap)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title={l("Not implemented yet", "غير منفَّذ بعد")}
        description={l("No control exists for these types. FrappeField shows the stored value READ-ONLY in every status (it never offers a text box that could corrupt it) and the form lists the field in its issues banner. Shown here as they render today — not a mock-up of a future control.",
          "لا يوجد عنصر تحكم لهذه الأنواع. يعرض FrappeField القيمة المحفوظة للقراءة فقط في كل الحالات (ولا يقدّم مربع نص قد يفسدها)، ويذكر النموذج الحقل في شريط المشكلات. معروضة هنا كما تظهر اليوم — لا نموذجاً تخيّلياً لعنصر قادم.")}>
        <FtProvider site={site}>
          <div className="grid gap-4 md:grid-cols-2" data-testid="ft-missing">
            {FIELD_TYPES.some((r) => r.status === "MISSING") ? null : (
              <p className="text-sm text-muted-foreground md:col-span-2" data-ft-missing-empty="">
                {tr(l("None since P36e: every DocField type has a control. Several are PARTIAL (e.g. Barcode and Geolocation are display only) — see the inventory above for what each one lacks.",
                  "لا شيء منذ P36e: لكل نوع حقل عنصر تحكم. عدد منها جزئي (مثل الباركود والموقع الجغرافي للعرض فقط) — راجع الجرد أعلاه لمعرفة ما ينقص كلاً منها."))}
              </p>
            )}
            {FIELD_TYPES.filter((r) => r.status === "MISSING").map((r) => {
              const s = SAMPLES[r.id];
              return (
                <StateCard key={r.id} title={l(`${r.fieldtype} — Not implemented yet`, `${r.fieldtype} — غير منفَّذ بعد`)} note={r.gap}>
                  <LiveField df={{ fieldname: "value", label: s.label.en, ...s.df } as FrappeDocField} initial={s.filled} />
                </StateCard>
              );
            })}
          </div>
        </FtProvider>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// 2. Inspector — one type, every state
// ---------------------------------------------------------------------------------------------------------------------

const INSPECTABLE = FIELD_TYPES.filter((r) => SAMPLES[r.id]);
const LOADING_TYPES = new Set(["Link", "Dynamic Link"]);
const POPUP_TYPES = new Set(["Select", "Link", "Dynamic Link", "Autocomplete", "Date", "Datetime", "Attach", "Attach Image"]);

function dfFor(s: FieldSample, extra: Partial<FrappeDocField> = {}): FrappeDocField {
  return { fieldname: "value", label: s.label.en, ...s.df, ...extra } as FrappeDocField;
}

/** The state grid of one type. `compact`: the three states shown in the side-by-side panes. */
function StateGrid({ row, compact = false, slowSite }: { row: FieldTypeRow; compact?: boolean; slowSite?: SimSite }) {
  const s = SAMPLES[row.id];
  const ft = String(s.df.fieldtype);
  const display = row.cls === "display";
  const missing = row.status === "MISSING";
  const empty = emptyOf(ft);
  const k = row.id; // remount the cells when the type changes
  if (display) {
    return (
      <div className="grid gap-4 sm:grid-cols-2" data-testid="ft-states">
        <StateCard title={l("Rendered from the DocField", "معروض من DocField")} note={l("A display type stores no value (frappe.model.display_fieldtypes).", "نوع عرض لا يحفظ قيمة (frappe.model.display_fieldtypes).")}>
          <LiveField key={k} df={dfFor(s)} initial={null} />
        </StateCard>
        {!compact && <NoteCard title={l("States", "الحالات")}>{l("Display types have no required, read-only or error state: Desk cannot make them mandatory (doctype.py:1268-1273) and the permlevel reset skips them (base_document.py:1263-1275). Button is always clickable (button.js:2-5).", "أنواع العرض بلا حالة إلزامية أو قراءة فقط أو خطأ: لا يسمح ديسك بجعلها إلزامية (doctype.py:1268-1273) ويتجاوزها إرجاع قيم مستوى الصلاحية (base_document.py:1263-1275). الزر قابل للنقر دائماً (button.js:2-5).")}</NoteCard>}
      </div>
    );
  }
  if (missing) {
    return (
      <div className="grid gap-4 sm:grid-cols-2" data-testid="ft-states">
        <StateCard title={l("Filled — status Write", "ممتلئ — حالة الكتابة")} note={l("No control: the raw stored value, read-only, even with write permission.", "لا عنصر تحكم: القيمة المحفوظة كما هي، للقراءة فقط، حتى مع صلاحية الكتابة.")}>
          <LiveField key={k} df={dfFor(s)} initial={s.filled} status="Write" />
        </StateCard>
        <StateCard title={l("Empty", "فارغ")}>
          <LiveField key={`${k}-e`} df={dfFor(s)} initial={empty} status="Write" />
        </StateCard>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="ft-states">
      <StateCard title={l("Default (empty) — focus / type here", "افتراضي (فارغ) — ركّز واكتب هنا")} note={POPUP_TYPES.has(ft) ? l("Opens its picker / dropdown.", "يفتح المنتقي / القائمة المنسدلة.") : undefined}>
        <LiveField key={`${k}-d`} df={dfFor(s)} initial={empty} />
      </StateCard>
      <StateCard title={l("Filled", "ممتلئ")}>
        <LiveField key={`${k}-f`} df={dfFor(s)} initial={s.filled} />
      </StateCard>
      <StateCard title={l("Required, empty (reqd: 1)", "إلزامي وفارغ (reqd: 1)")} note={l("Desk: red label marker and has-error (base_input.js:207-229).", "ديسك: علامة حمراء على التسمية و has-error (base_input.js:207-229).")}>
        <LiveField key={`${k}-r`} df={dfFor(s, { reqd: 1 })} initial={empty} />
      </StateCard>
      {!compact && (
        <>
          <StateCard title={l("Read-only (read_only: 1)", "للقراءة فقط (read_only: 1)")} note={l("The formatted value, never an input (perm.js:258).", "القيمة المنسّقة، لا حقل إدخال أبداً (perm.js:258).")}>
            <LiveField key={`${k}-ro`} df={dfFor(s, { read_only: 1 })} initial={s.filled} />
          </StateCard>
          <StateCard title={l("No write on its permlevel (status Read)", "بلا كتابة على مستوى صلاحيته (حالة القراءة)")} note={l("What the form passes for permlevel / submitted / set_only_once (perm.js:191-268).", "ما يمرّره النموذج لمستوى الصلاحية / المستند المعتمد / set_only_once (perm.js:191-268).")}>
            <LiveField key={`${k}-p`} df={dfFor(s)} initial={s.filled} status="Read" />
          </StateCard>
          <StateCard title={l("Validation error", "خطأ تحقّق")} note={s.invalid !== undefined ? l("A value Desk's control flags, plus the server's message.", "قيمة يعلّمها عنصر ديسك، مع رسالة الخادم.") : l("The server's message on the field (the form maps it from the save error).", "رسالة الخادم على الحقل (يربطها النموذج من خطأ الحفظ).")}>
            <ErrorField key={`${k}-x`} s={s} />
          </StateCard>
        </>
      )}
      {!compact && LOADING_TYPES.has(ft) && slowSite && (
        <StateCard title={l("Loading (SIMULATED slow server, 1.5 s)", "تحميل (خادم محاكى بطيء، 1.5 ث)")} note={l("Type to search: the list shows Searching… until the simulated search_link answers.", "اكتب للبحث: تعرض القائمة «جارٍ البحث…» حتى يجيب search_link المحاكى.")}>
          <FtProvider site={slowSite}><LiveField key={`${k}-l`} df={dfFor(s)} initial={empty} /></FtProvider>
        </StateCard>
      )}
      {!compact && !LOADING_TYPES.has(ft) && (
        <NoteCard title={l("Loading", "التحميل")}>{s.simulated ? l("Uploads show their progress in the uploader (Links & files page).", "يظهر تقدّم الرفع في أداة الرفع (صفحة الروابط والملفات).") : l("No server call while editing: this type has no loading state (the form shows its own skeleton).", "لا استدعاء للخادم أثناء التحرير: لا حالة تحميل لهذا النوع (يعرض النموذج هيكله الخاص).")}</NoteCard>
      )}
      {!compact && (
        <NoteCard title={l("Disabled", "معطّل")}>{l("Frappe has no separate disabled state for a DocField: df.disabled demotes Write to Read (perm.js:210), shown above as Read.", "لا توجد في فرابيه حالة «معطّل» مستقلة لحقل: df.disabled يحوّل الكتابة إلى قراءة (perm.js:210)، كما في حالة القراءة أعلاه.")}</NoteCard>
      )}
    </div>
  );
}

function ErrorField({ s }: { s: FieldSample }) {
  const tr = useTr();
  return <LiveField df={dfFor(s)} initial={s.invalid ?? s.filled} error={tr(s.serverError)} />;
}

type Compare = "page" | "langs" | "themes";

export function FieldTypesInspectorPage() {
  const tr = useTr();
  const { isDark } = useTheme();
  const { language } = useLocale();
  const [id, setId] = React.useState("FT-01");
  const [compare, setCompare] = React.useState<Compare>("page");
  const site = useFtSite();
  const slowSite = useFtSite(1500);
  const row = INSPECTABLE.find((r) => r.id === id) ?? INSPECTABLE[0];
  const theme = isDark ? "dark" : "light";
  return (
    <div className="space-y-12">
      <StatusStrip parts={[["FrappeField", "simulated"], ["Core controls (src/fields, src/primitives)", "generic"]]} note={SIM_NOTE} />
      <Section title={l("Inspect one field type", "افحص نوع حقل واحد")}
        description={l("Pick a type: it is rendered through FrappeField from a DocField, in each state the control has. Under every control is the stored value — what a save would send — so you can check the round-trip (Check 0/1, Rating 0…1, Duration seconds, Date YYYY-MM-DD, Time HH:mm:ss). Use the header's switches for Arabic / English and light / dark, or compare side by side below.",
          "اختر نوعاً: يُعرض عبر FrappeField من DocField في كل حالة يملكها العنصر. تحت كل عنصر القيمة المحفوظة — ما يرسله الحفظ — لتتحقّق من الذهاب والإياب (Check ‏0/1، Rating ‏0…1، Duration بالثواني، Date ‏YYYY-MM-DD، Time ‏HH:mm:ss). استخدم مبدّلَي الرأس للعربية / الإنجليزية والفاتح / الداكن، أو قارن جنباً إلى جنب أدناه.")}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground" id="ft-type-label">{tr(l("Field type", "نوع الحقل"))}</span>
          <Select value={row.id} onValueChange={setId}>
            <SelectTrigger className="w-72 max-w-full" aria-labelledby="ft-type-label" data-testid="ft-type-picker"><SelectValue /></SelectTrigger>
            <SelectContent>
              {INSPECTABLE.map((r) => <SelectItem key={r.id} value={r.id}>{rowLabel(r)}{r.status === "MISSING" ? ` — ${tr(STATUS_TEXT.MISSING)}` : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-xs" data-testid="ft-type-header">
          <span className="font-semibold text-foreground" dir="ltr">{rowLabel(row)}</span>
          <StatusBadgeFt status={row.status} />
          <Badge variant="outline">{tr(CLASS_TEXT[row.cls])}</Badge>
          {SAMPLES[row.id].simulated && <Badge variant="warning">{tr(l("SIMULATED server", "خادم محاكى"))}</Badge>}
          <span className="font-mono text-muted-foreground" dir="ltr">frappe/…/form/{row.native}</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono text-muted-foreground" dir="ltr">{row.ds}</span>
          {row.gap.en !== "—" && <span className="basis-full text-muted-foreground">{tr(l("Missing: ", "الناقص: "))}{tr(row.gap)}</span>}
        </div>
        {row.status === "MISSING" && (
          <Alert variant="destructive" data-testid="ft-not-implemented">
            <AlertTitle>{tr(l("Not implemented yet", "غير منفَّذ بعد"))}</AlertTitle>
            <AlertDescription>{tr(l("The package has no control for this type. Below is exactly what FrappeField renders today: the stored value, read-only.", "لا عنصر تحكم لهذا النوع في الحزمة. أدناه ما يعرضه FrappeField اليوم تماماً: القيمة المحفوظة للقراءة فقط."))}</AlertDescription>
          </Alert>
        )}
        <Example code={`<FrappeField df={${JSON.stringify(dfFor(SAMPLES[row.id]))}} value={value} onChange={setValue} doc={doc} />`}>
          <FtProvider site={site}><StateGrid row={row} slowSite={slowSite} /></FtProvider>
        </Example>
      </Section>
      <Section title={l("Directions and themes, side by side", "الاتجاهات والسمات جنباً إلى جنب")}
        description={l("The same type in two element-scoped ThemeProviders: Arabic (RTL) next to English (LTR), or light next to dark. Labels and Select options go through the provider's translations, as Desk's __() does.",
          "النوع نفسه في مزوّدَي سمة محدودَي العنصر: العربية (من اليمين إلى اليسار) بجانب الإنجليزية (من اليسار إلى اليمين)، أو الفاتح بجانب الداكن. تمرّ التسميات وخيارات القائمة عبر ترجمات المزوّد كما تفعل __() في ديسك.")}>
        <Picker legend={l("Compare", "قارن")} value={compare} onChange={setCompare} options={[
          { value: "page", label: l("Off", "إيقاف") }, { value: "langs", label: l("Arabic + English", "العربية + الإنجليزية") }, { value: "themes", label: l("Light + dark", "الفاتح + الداكن") },
        ]} />
        {compare !== "page" && (
          <div className="grid gap-6 xl:grid-cols-2" data-testid="ft-compare">
            {(compare === "langs"
              ? [{ lang: "ar" as const, th: theme as "light" | "dark", title: 'language="ar" · dir="rtl"' }, { lang: "en" as const, th: theme as "light" | "dark", title: 'language="en" · dir="ltr"' }]
              : [{ lang: language, th: "light" as const, title: 'theme="light"' }, { lang: language, th: "dark" as const, title: 'theme="dark"' }]
            ).map((p) => (
              <Pane key={p.title} theme={p.th} language={p.lang} title={p.title}>
                <FtProvider site={site}><StateGrid row={row} compact /></FtProvider>
              </Pane>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// 3. Links, selections and files (SIMULATED server)
// ---------------------------------------------------------------------------------------------------------------------

const LINK_METHODS = ["frappe.desk.search.search_link", "frappe.client.validate_link", "upload_file", "frappe.core.api.file.get_max_file_size"];

const LINK_BUNDLE: MetaBundle = {
  doctype: "FT Demo",
  meta: { name: "FT Demo", fields: [] },
  children: { "FT Participant": { name: "FT Participant", istable: 1, fields: [{ fieldname: "user", fieldtype: "Link", options: "User", label: "User", in_list_view: 1 }] } },
};

function RequestLog({ site }: { site: SimSite }) {
  const [, tick] = React.useState(0);
  React.useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 700); return () => clearInterval(t); }, []);
  const calls = site.transport.store.calls.filter((c) => LINK_METHODS.includes(c.method)).slice(-6).reverse();
  return <Readout label="SIMULATED requests (newest first):">{calls.length ? calls.map((c) => `${c.method} ${JSON.stringify(c.args).slice(0, 220)}`).join("\n") : "—"}</Readout>;
}

function DynamicLinkPair() {
  const [doc, setDoc] = React.useState<FrappeDoc>({ doctype: "FT Demo", name: "FT-0001", reference_doctype: "User", reference_name: "" } as FrappeDoc);
  const typeDf: FrappeDocField = { fieldname: "reference_doctype", fieldtype: "Select", label: "Reference type", options: "\nUser\nContact" };
  const nameDf: FrappeDocField = { fieldname: "reference_name", fieldtype: "Dynamic Link", label: "Reference", options: "reference_doctype" };
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FrappeField df={typeDf} value={doc.reference_doctype} doc={doc} onChange={(v) => setDoc((d) => ({ ...d, reference_doctype: v as string, reference_name: "" }))} />
      <div className="min-w-0 space-y-2">
        <FrappeField df={nameDf} value={doc.reference_name} doc={doc} onChange={(v) => setDoc((d) => ({ ...d, reference_name: v as string }))} />
        <p className="truncate font-mono text-[11px] text-muted-foreground" dir="ltr">value: {show({ reference_doctype: doc.reference_doctype, reference_name: doc.reference_name })}</p>
      </div>
    </div>
  );
}

function TableMultiSelectDemo() {
  const [rows, setRows] = React.useState<FrappeDoc[]>([{ doctype: "FT Participant", name: "row-1", user: "lina@example.com", parentfield: "participants", idx: 1 } as FrappeDoc]);
  const df: FrappeDocField = { fieldname: "participants", fieldtype: "Table MultiSelect", label: "Participants", options: "FT Participant" };
  return (
    <div className="min-w-0 space-y-2">
      <FrappeField df={df} value={rows} onChange={(v) => setRows(v as FrappeDoc[])} bundle={LINK_BUNDLE} doc={{ doctype: "FT Demo", name: "FT-0001" } as FrappeDoc} />
      <p className="truncate font-mono text-[11px] text-muted-foreground" dir="ltr">value: {show(rows.map((r) => r.user))}</p>
    </div>
  );
}

export function FieldTypesLinksPage() {
  const [speed, setSpeed] = React.useState<"fast" | "slow">("fast");
  const fast = useFtSite();
  const slow = useFtSite(1500);
  const site = speed === "fast" ? fast : slow;
  const link = SAMPLES["FT-14"];
  return (
    <div className="space-y-12">
      <StatusStrip parts={[["FrappeLinkField · FrappeDynamicLinkField · FrappeTableMultiSelect · FrappeAttachField", "simulated"], ["LinkInput · AttachInput", "generic"]]} note={SIM_NOTE} />
      <Section title={l("Link, Dynamic Link and Table MultiSelect (SIMULATED)", "Link و Dynamic Link و Table MultiSelect (محاكاة)")}
        description={l("Desk's Link control: search_link 500 ms after typing (reference_doctype, page_length), a pick or a typed value goes through validate_link (a name the server does not know is cleared), titles, the open-record link. Pick the slow server to see the loading state.",
          "عنصر الربط في ديسك: search_link بعد 500 م.ث من توقّف الكتابة (reference_doctype و page_length)، والقيمة المختارة أو المكتوبة تمرّ عبر validate_link (يُمسح الاسم الذي لا يعرفه الخادم)، والعناوين، ورابط فتح السجل. اختر الخادم البطيء لترى حالة التحميل.")}>
        <Picker legend={l("SIMULATED server", "الخادم المحاكى")} value={speed} onChange={setSpeed} options={[{ value: "fast", label: l("Instant", "فوري") }, { value: "slow", label: l("Slow (1.5 s)", "بطيء (1.5 ث)") }]} />
        <Example code={`<FrappeField df={{ fieldtype: "Link", options: "User", … }} value={value} onChange={setValue} />`}>
          <FtProvider key={speed} site={site}>
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <StateCard title={l("Link — empty", "Link — فارغ")}><LiveField df={dfFor(link)} initial="" testId="ft-link-empty" /></StateCard>
                <StateCard title={l("Link — filled", "Link — ممتلئ")}><LiveField df={dfFor(link)} initial={link.filled} /></StateCard>
                <StateCard title={l("Link — read (status Read)", "Link — قراءة")}><LiveField df={dfFor(link)} initial={link.filled} status="Read" /></StateCard>
              </div>
              <StateCard title={l("Dynamic Link: its DocType comes from the sibling field", "Dynamic Link: نوع المستند من الحقل المجاور")} note={l("No search while the type is empty (dynamic_link.js:2-30).", "لا بحث ما دام النوع فارغاً (dynamic_link.js:2-30).")}>
                <DynamicLinkPair />
              </StateCard>
              <StateCard title={l("Table MultiSelect: one child row per picked value", "Table MultiSelect: صف فرعي لكل قيمة مختارة")} note={l("The child DocType's first Link field; duplicates and unknown names are dropped (table_multiselect.js:84-121).", "أول حقل Link في نوع المستند الفرعي؛ تُسقط القيم المكرّرة والأسماء غير المعروفة (table_multiselect.js:84-121).")}>
                <TableMultiSelectDemo />
              </StateCard>
            </div>
          </FtProvider>
        </Example>
        <RequestLog site={site} />
      </Section>
      <Section title={l("Attach and Attach Image (SIMULATED upload)", "Attach و Attach Image (رفع محاكى)")}
        description={l("Standalone attach fields on the simulated ToDo TD-0001: Attach opens Desk's uploader (My Device / Library / Link); the value becomes the File's URL. Inside a form the form is also saved — see Attach Image (SIMULATED) in the Frappe layer.",
          "حقول إرفاق مستقلة على المهمة المحاكاة TD-0001: «إرفاق» يفتح أداة الرفع في ديسك (جهازي / المكتبة / رابط)؛ وتصبح القيمة رابط الملف. داخل النموذج يُحفظ النموذج أيضاً — انظر «إرفاق صورة (محاكاة)» في طبقة فرابيه.")}>
        <Example code={`<FrappeField df={{ fieldtype: "Attach Image", … }} value={url} onChange={setUrl} doc={{ doctype: "ToDo", name: "TD-0001" }} />`}>
          <FtProvider site={fast}>
            <div className="grid gap-4 sm:grid-cols-2">
              {(["FT-29", "FT-30"] as const).map((rid) => (
                <React.Fragment key={rid}>
                  <StateCard title={l(`${SAMPLES[rid].df.fieldtype} — empty`, `${SAMPLES[rid].df.fieldtype} — فارغ`)}><LiveField df={dfFor(SAMPLES[rid])} initial={null} /></StateCard>
                  <StateCard title={l(`${SAMPLES[rid].df.fieldtype} — filled`, `${SAMPLES[rid].df.fieldtype} — ممتلئ`)}><LiveField df={dfFor(SAMPLES[rid])} initial={SAMPLES[rid].filled} /></StateCard>
                </React.Fragment>
              ))}
            </div>
          </FtProvider>
        </Example>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// 4. Layout and display types in a form
// ---------------------------------------------------------------------------------------------------------------------

const LAYOUT_BUNDLE: MetaBundle = {
  doctype: "FT Demo",
  meta: {
    name: "FT Demo", autoname: "hash",
    fields: [
      { fieldname: "details_tab", fieldtype: "Tab Break", label: "Details" },
      { fieldname: "customer_name", fieldtype: "Data", label: "Customer name", reqd: 1 },
      { fieldname: "status", fieldtype: "Select", label: "Status", options: "\nOpen\nReplied\nClosed" },
      { fieldname: "column_break_1", fieldtype: "Column Break" },
      { fieldname: "billing_heading", fieldtype: "Heading", label: "Billing details" },
      { fieldname: "notice", fieldtype: "HTML", options: "<p><b>Note:</b> prices exclude VAT.</p>" },
      { fieldname: "recalculate", fieldtype: "Button", label: "Recalculate" },
      { fieldname: "more_section", fieldtype: "Section Break", label: "More", collapsible: 1 },
      { fieldname: "notes", fieldtype: "Small Text", label: "Notes" },
      { fieldname: "items_tab", fieldtype: "Tab Break", label: "Items" },
      { fieldname: "items", fieldtype: "Table", label: "Items", options: "FT Item" },
      { fieldname: "fold", fieldtype: "Fold" },
      { fieldname: "extra_section", fieldtype: "Section Break", label: "After the Fold" },
      { fieldname: "logo", fieldtype: "Attach Image", label: "Logo" },
      { fieldname: "logo_preview", fieldtype: "Image", label: "Logo preview", options: "logo" },
    ] as FrappeDocField[],
  },
  children: {
    "FT Item": { name: "FT Item", istable: 1, fields: [
      { fieldname: "item", fieldtype: "Data", label: "Item", in_list_view: 1, reqd: 1 },
      { fieldname: "qty", fieldtype: "Int", label: "Qty", in_list_view: 1 },
      { fieldname: "rate", fieldtype: "Currency", label: "Rate", in_list_view: 1 },
    ] as FrappeDocField[] },
  },
};

/** Every right at permlevel 0 for the demo form (without permissions FrappeFormView is read-only). */
const WRITE_ALL = { levels: [{ read: true, write: true, create: true }], can: () => true, known: true };

export function FieldTypesLayoutPage() {
  const tr = useTr();
  const site = useFtSite();
  const [saved, setSaved] = React.useState<string>("—");
  const doc = React.useMemo<FrappeDoc>(() => ({
    doctype: "FT Demo", name: "FT-0001", docstatus: 0, customer_name: "Acme Travel", status: "Open", notes: "", logo: "/files/company-logo.png",
    items: [{ doctype: "FT Item", name: "it-1", idx: 1, parentfield: "items", parenttype: "FT Demo", parent: "FT-0001", item: "Flight RUH-DXB", qty: 2, rate: 950 }],
  } as unknown as FrappeDoc), []);
  return (
    <div className="space-y-12">
      <StatusStrip parts={[["FrappeFormView (buildLayout)", "simulated"], ["FrappeChildTable → DataGrid", "simulated"]]}
        note={l("The form runs with the demo DocType's meta in memory; Save hands the document to the page (nothing is sent to a server).", "يعمل النموذج ببيانات نوع المستند التجريبي في الذاكرة؛ «حفظ» يسلّم المستند إلى الصفحة (لا يُرسل شيء إلى خادم).")} />
      <Section title={l("Layout and display types in one form", "أنواع التخطيط والعرض في نموذج واحد")}
        description={l("Tab Break (Details, Items), Column Break, Section Break (collapsible, closed by default), Heading, HTML (sanitized), Button, Table (FT Item rows), Fold, Attach Image and Image (shows doc[options]). Fold is PARTIAL: Desk hides what follows behind “Show more details” (layout.js:270-295); the package shows it as a plain section.",
          "فاصل التبويب (التفاصيل، الأصناف)، وفاصل العمود، وفاصل القسم (قابل للطي ومغلق افتراضياً)، والعنوان، و HTML (منقّى)، والزر، والجدول (صفوف FT Item)، و Fold، وإرفاق صورة، والصورة (تعرض doc[options]). ‏Fold جزئي: يخفي ديسك ما بعده خلف «إظهار المزيد من التفاصيل» (layout.js:270-295)؛ والحزمة تعرضه قسماً عادياً.")}>
        <Example code={`<FrappeFormView bundle={bundle} doc={doc} permissions={permissions} onSave={save} />`}>
          <FtProvider site={site}>
            <div data-testid="ft-layout-form">
              <FrappeFormView bundle={LAYOUT_BUNDLE} doc={doc} guardUnload={false} permissions={WRITE_ALL}
                onSave={async (d) => { setSaved(JSON.stringify({ customer_name: d.customer_name, status: d.status, items: (d.items as FrappeDoc[] | undefined)?.length ?? 0 })); return d; }} />
            </div>
          </FtProvider>
        </Example>
        <Readout label={tr(l("Last save handed to the page:", "آخر حفظ سُلِّم إلى الصفحة:"))}>{saved}</Readout>
      </Section>
    </div>
  );
}

