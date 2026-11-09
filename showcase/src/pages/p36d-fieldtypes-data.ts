/**
 * P36d fieldtypes — the Frappe 15.110 field-type inventory as data, for the "Frappe Field Types" showcase group and its
 * smoke test. The full reference (file:line for every claim, the server validation, the plan) is
 * docs/audit/p36d/FIELD-TYPES.md; the row ids (FT-nn) are the same. Source of the list: frappe/model/__init__.py
 * (data_fieldtypes :8-43, no_value_fields :53-64, data_field_options :80) and the 43 options of DocField.fieldtype
 * (core/doctype/docfield/docfield.json:102-108).
 */
import type { FrappeDocField } from "@ui/frappe";
import { l, type L } from "../i18n";

export type FtStatus = "COMPLETE" | "PARTIAL" | "MISSING" | "n/a";
export type FtClass = "input" | "composite" | "integration" | "display" | "layout";

export interface FieldTypeRow {
  id: string;
  fieldtype: string;
  /** A Data field's `options` (frappe.model.data_field_options). */
  dataOption?: string;
  cls: FtClass;
  status: FtStatus;
  /** Frappe client control, relative to frappe/public/js/frappe/form/. */
  native: string;
  /** The DS component(s) that render it. */
  ds: string;
  /** What is missing (empty for COMPLETE rows without notable gaps). */
  gap: L;
  /** An option of DocField.fieldtype (false: Long Int, Page Break, the Data option rows). */
  docfieldOption: boolean;
}

const row = (id: string, fieldtype: string, cls: FtClass, status: FtStatus, native: string, ds: string, gap: L, extra: Partial<FieldTypeRow> = {}): FieldTypeRow =>
  ({ id, fieldtype, cls, status, native, ds, gap, docfieldOption: true, ...extra });
const NONE = l("—", "—");

export const FIELD_TYPES: FieldTypeRow[] = [
  row("FT-01", "Data", "input", "PARTIAL", "controls/data.js:3", "FrappeField → <input type=text> (DebouncedText)", l("No duplicate-name check on the autoname field (data.js:189-227); no with_copy_button (data.js:130-144).", "لا تحقّق من تكرار الاسم في حقل التسمية التلقائية (data.js:189-227)؛ ولا زر نسخ with_copy_button (data.js:130-144).")),
  row("FT-01a", "Data", "input", "PARTIAL", "controls/data.js:293", "FrappeField (type=text, dir=ltr, Desk's soft check)", l("Option behaviour matches; the Data gaps (FT-01) apply.", "سلوك الخيار مطابق؛ وتنطبق نواقص Data ‏(FT-01)."), { dataOption: "Email", docfieldOption: false }),
  row("FT-01b", "Data", "input", "PARTIAL", "controls/data.js:290", "FrappeField (type=text, Desk's soft check)", l("Option behaviour matches (ASCII \\w, as Desk); the Data gaps (FT-01) apply.", "سلوك الخيار مطابق (‎\\w‎ بالأحرف اللاتينية كما في ديسك)؛ وتنطبق نواقص Data ‏(FT-01)."), { dataOption: "Name", docfieldOption: false }),
  row("FT-01c", "Data", "input", "PARTIAL", "controls/data.js:287", "FrappeField (type=text, dir=ltr, Desk's soft check)", l("Option behaviour matches; the Data gaps (FT-01) apply.", "سلوك الخيار مطابق؛ وتنطبق نواقص Data ‏(FT-01)."), { dataOption: "Phone", docfieldOption: false }),
  row("FT-01d", "Data", "input", "PARTIAL", "controls/data.js:81", "FrappeField (type=text, dir=ltr, Desk's soft check)", l("No open-link button (data.js:81-122); the read display is not a link (formatters.js:37-40).", "لا زر لفتح الرابط؛ والعرض للقراءة ليس رابطاً."), { dataOption: "URL", docfieldOption: false }),
  row("FT-01e", "Data", "input", "PARTIAL", "controls/data.js:146", "FrappeField (type=text)", l("No Scan button (data.js:146-173).", "لا زر للمسح الضوئي (data.js:146-173)."), { dataOption: "Barcode", docfieldOption: false }),
  row("FT-01f", "Data", "input", "PARTIAL", "controls/data.js:124", "FrappeField (type=text); grouped read display only", l("No grouping on input, spaces not stripped on save (data.js:268-278); no check.", "لا تجميع ولا حذف للمسافات عند الإدخال؛ ولا تحقّق."), { dataOption: "IBAN", docfieldOption: false }),
  row("FT-02", "Small Text", "input", "COMPLETE", "controls/text.js:18", "FrappeField → Textarea", NONE),
  row("FT-03", "Text", "input", "COMPLETE", "controls/text.js:1", "FrappeField → Textarea", NONE),
  row("FT-04", "Long Text", "input", "COMPLETE", "controls/text.js:17", "FrappeField → Textarea", NONE),
  row("FT-05", "Text Editor", "integration", "PARTIAL", "controls/text_editor.js:136", "RichTextEditor / RichText", l("No mentions, image upload or tables (Quill).", "لا إشارات ولا رفع صور ولا جداول (Quill).")),
  row("FT-06", "Markdown Editor", "integration", "PARTIAL", "controls/markdown_editor.js:1", "monospace Textarea", l("No preview, no image drop.", "لا معاينة ولا إفلات للصور.")),
  row("FT-07", "HTML Editor", "integration", "PARTIAL", "controls/html_editor.js:1", "monospace Textarea", l("No preview, no syntax highlighting.", "لا معاينة ولا تلوين للصياغة.")),
  row("FT-08", "Code", "integration", "PARTIAL", "controls/code.js:1", "monospace Textarea (dir=ltr)", l("No Ace editor, language or copy button.", "لا محرّر Ace ولا لغة ولا زر نسخ.")),
  row("FT-09", "JSON", "integration", "PARTIAL", "controls/json.js:1", "monospace Textarea", l("No JSON parse check.", "لا تحقّق من صحة JSON.")),
  row("FT-10", "Password", "input", "PARTIAL", "controls/password.js:1", "FrappeField (type=password)", l("No show/hide toggle, no strength meter.", "لا زر إظهار/إخفاء ولا مؤشر قوة.")),
  row("FT-11", "Read Only", "input", "COMPLETE", "controls/data.js:323", "ReadOnlyValue", NONE),
  row("FT-12", "Select", "input", "PARTIAL", "controls/select.js:1", "Select (Radix)", l("sort_options ignored.", "sort_options غير مدعوم.")),
  row("FT-13", "Autocomplete", "input", "PARTIAL", "controls/autocomplete.js:3", "LinkInput over df.options", l("No get_query (server query).", "لا get_query (استعلام الخادم).")),
  row("FT-14", "Link", "integration", "PARTIAL", "controls/link.js:10", "FrappeLinkField → LinkInput (search_link / validate_link / get_link_title — server calls SIMULATED in the showcase)", l("No Advanced Search (link.js:165-174, 347-360); no filter description (link.js:309-320); values of translated DocTypes are not translated (link.js:111-116).", "لا بحث متقدّم (link.js:165-174, 347-360)؛ ولا وصف للمرشّحات (link.js:309-320)؛ ولا ترجمة لقيم أنواع المستندات المترجمة (link.js:111-116).")),
  row("FT-15", "Dynamic Link", "integration", "PARTIAL", "controls/dynamic_link.js:1", "FrappeDynamicLinkField → LinkInput (target = doc[options] — server calls SIMULATED in the showcase)", l("The Link gaps (FT-14); a Single DocType target is not refused (dynamic_link.js:26-28).", "نواقص Link ‏(FT-14)؛ ولا يُرفض نوع مستند مفرد كهدف (dynamic_link.js:26-28).")),
  row("FT-16", "Check", "input", "COMPLETE", "controls/check.js:1", "Checkbox", NONE),
  row("FT-17", "Int", "input", "COMPLETE", "controls/int.js:1", "NumberInput (int)", NONE),
  row("FT-18", "Long Int", "input", "COMPLETE", "controls/int.js:45", "NumberInput (int)", l("Not a DocField option (code-defined metas only).", "ليس خياراً في DocField (للبيانات الوصفية المعرّفة برمجياً فقط)."), { docfieldOption: false }),
  row("FT-19", "Float", "input", "PARTIAL", "controls/float.js:1", "NumberInput (float)", l("With options (a currency field) Desk formats the input in that currency's number format (float.js:15-20); the DS always uses the system format.", "مع الخيارات (حقل عملة) يُنسّق ديسك الإدخال بتنسيق أرقام تلك العملة (float.js:15-20)؛ والنظام يستخدم تنسيق النظام دائماً.")),
  row("FT-20", "Currency", "input", "PARTIAL", "controls/currency.js:1", "NumberInput (currency)", l("Edit format ignores the field's currency.", "تنسيق التحرير يتجاهل عملة الحقل.")),
  row("FT-21", "Percent", "input", "COMPLETE", "controls/float.js:28", "NumberInput (percent)", NONE),
  row("FT-22", "Rating", "input", "COMPLETE", "controls/rating.js:1", "Rating (stored 0…1)", NONE),
  row("FT-23", "Duration", "input", "COMPLETE", "controls/duration.js:1", "DurationInput (seconds)", NONE),
  row("FT-24", "Date", "input", "PARTIAL", "controls/date.js:1", "DateField", l("No typed entry (a calendar button only) and a value cannot be cleared; no 't' = today key; options JSON ignored.", "لا إدخال بالكتابة (زر تقويم فقط) ولا يمكن مسح القيمة؛ ولا مفتاح ‎t‎ لتاريخ اليوم؛ وخيارات JSON مُتجاهَلة.")),
  row("FT-25", "Datetime", "input", "PARTIAL", "controls/datetime.js:1", "DateTimeField", l("No typed entry and a value cannot be cleared; no user ↔ system time-zone conversion while editing; seconds dropped.", "لا إدخال بالكتابة ولا يمكن مسح القيمة؛ ولا تحويل بين منطقة المستخدم ومنطقة النظام عند التحرير؛ وتُسقط الثواني.")),
  row("FT-26", "Time", "input", "PARTIAL", "controls/time.js:1", "TimeInput", l("No 't' = now key.", "لا مفتاح ‎t‎ للوقت الحالي.")),
  row("FT-27", "Phone", "integration", "PARTIAL", "controls/phone.js:4", "FrappeField (type=tel)", l("No country picker; Desk stores +isd-number and the server checks it.", "لا منتقي للدولة؛ ديسك يحفظ ‎+isd-number‎ والخادم يتحقّق منه.")),
  row("FT-28", "Color", "input", "PARTIAL", "controls/color.js:3", "ColorInput (#RRGGBB)", l("No picker popover; no swatch when read-only.", "لا نافذة منتقي؛ ولا عيّنة لون عند القراءة فقط.")),
  row("FT-29", "Attach", "integration", "COMPLETE", "controls/attach.js:1", "FrappeAttachField → AttachInput + AttachDialog (upload_file — server calls SIMULATED in the showcase)", l("No Google Drive; script-set df.options upload options are ignored (attach.js:89-91).", "لا Google Drive؛ وتُتجاهل خيارات الرفع df.options التي تضبطها البرامج النصية (attach.js:89-91).")),
  row("FT-30", "Attach Image", "integration", "COMPLETE", "controls/attach_image.js:1", "FrappeAttachField (image/* only — server calls SIMULATED in the showcase)", l("As Attach (FT-29).", "كما في Attach ‏(FT-29).")),
  row("FT-31", "Image", "display", "COMPLETE", "controls/image.js:1", "<img> from doc[options]", l("Empty: no missing-image placeholder (image.js:16-20).", "عند الفراغ: لا عنصر بديل للصورة المفقودة (image.js:16-20).")),
  row("FT-32", "Signature", "integration", "COMPLETE", "controls/signature.js:1", "SignatureInput (P36e)", l("Canvas drawing → PNG data URL as Desk stores it; Undo / Clear; image when read-only.", "رسم على لوحة ← رابط بيانات PNG كما يحفظه ديسك؛ تراجع / مسح؛ صورة عند القراءة فقط.")),
  row("FT-33", "Barcode", "integration", "PARTIAL", "controls/barcode.js:3", "BarcodeInput (P36e, display only)", l("Shows the stored SVG (sanitised) and its value, and clears it. Generating a barcode from typed text needs JsBarcode (not installed; owner decision).", "يعرض صورة SVG المحفوظة (بعد التعقيم) وقيمتها ويمسحها. توليد باركود من نص مكتوب يحتاج إلى JsBarcode (غير مثبَّت؛ قرار المالك).")),
  row("FT-34", "Geolocation", "integration", "PARTIAL", "controls/geolocation.js:3", "GeolocationInput (P36e, display only)", l("Lists the stored GeoJSON features; invalid GeoJSON is reported. Drawing on a map needs Leaflet + Leaflet.draw (not installed; owner decision).", "يسرد عناصر GeoJSON المحفوظة؛ ويبلّغ عن GeoJSON غير الصالح. الرسم على خريطة يحتاج إلى Leaflet وLeaflet.draw (غير مثبَّتة؛ قرار المالك).")),
  row("FT-35", "Icon", "input", "PARTIAL", "controls/icon.js:3", "IconInput / FrappeIconField (P36e)", l("Picker over Desk's icon names; glyphs only where the page carries Desk's icon sprite.", "منتقٍ لأسماء أيقونات ديسك؛ تظهر الرموز فقط حيث تحمل الصفحة رموز ديسك.")),
  row("FT-36", "Table", "composite", "PARTIAL", "controls/table.js:3", "FrappeChildTable → DataGrid", l("No paste from a spreadsheet (table.js:19-117); no drag reorder; no grid Download / Upload (P35 A-form G4, G9).", "لا لصق من جدول بيانات (table.js:19-117)؛ ولا إعادة ترتيب بالسحب؛ ولا تنزيل / رفع للجدول (P35 A-form G4, G9).")),
  row("FT-37", "Table MultiSelect", "composite", "PARTIAL", "controls/table_multiselect.js:1", "FrappeTableMultiSelect → TagInput (search_link / validate_link — server calls SIMULATED in the showcase)", l("No 'Create a new' / Advanced Search entries (ControlLink list, link.js:323-360); the field's link_filters / filters are not applied.", "لا عناصر «إنشاء جديد» / البحث المتقدّم (قائمة ControlLink، link.js:323-360)؛ ولا تُطبَّق link_filters / filters الخاصة بالحقل.")),
  row("FT-38", "Section Break", "layout", "COMPLETE", "layout.js:182", "buildLayout / FrappeFormView", l("Cosmetic: no hide_border; the collapsed state is not remembered (section.js:13-19).", "شكلي: لا hide_border؛ ولا تُحفظ حالة الطيّ (section.js:13-19).")),
  row("FT-39", "Column Break", "layout", "PARTIAL", "layout.js:185", "buildLayout / FrappeFormView", l("The column's label and description are not rendered (column.js:22-36).", "لا يُعرض عنوان العمود ولا وصفه (column.js:22-36).")),
  row("FT-40", "Tab Break", "layout", "COMPLETE", "layout.js:188", "buildLayout / FrappeFormView", l("show_dashboard is not honoured: Connections is a separate tab.", "لا يُطبَّق show_dashboard: الروابط تبويب مستقل.")),
  row("FT-41", "Fold", "layout", "PARTIAL", "layout.js:175", "treated as a Section Break", l("No “Show more details” fold.", "لا طيّ «إظهار المزيد من التفاصيل».")),
  row("FT-42", "Heading", "display", "COMPLETE", "controls/heading.js:1", "<h4>", NONE),
  row("FT-43", "HTML", "display", "PARTIAL", "controls/html.js:1", "sanitized df.options", l("Script-written content ($wrapper.html) has no equivalent.", "لا مقابل للمحتوى الذي تكتبه البرامج النصية ($wrapper.html).")),
  row("FT-44", "Button", "display", "PARTIAL", "controls/button.js:1", "Button → onButtonClick / form events", l("options → run_doc_method not wired.", "options ← run_doc_method غير موصول.")),
  row("FT-45", "Page Break", "layout", "n/a", "layout.js:178", "treated as a Section Break", l("Not a DocField option (web forms / print).", "ليس خياراً في DocField (نماذج الويب / الطباعة)."), { docfieldOption: false }),
];

/** DocField.fieldtype options, verbatim from core/doctype/docfield/docfield.json:108 (Frappe v15.110.0). */
export const DOCFIELD_FIELDTYPE_OPTIONS = "Autocomplete\nAttach\nAttach Image\nBarcode\nButton\nCheck\nCode\nColor\nColumn Break\nCurrency\nData\nDate\nDatetime\nDuration\nDynamic Link\nFloat\nFold\nGeolocation\nHeading\nHTML\nHTML Editor\nIcon\nImage\nInt\nJSON\nLink\nLong Text\nMarkdown Editor\nPassword\nPercent\nPhone\nRead Only\nRating\nSection Break\nSelect\nSignature\nSmall Text\nTab Break\nTable\nTable MultiSelect\nText\nText Editor\nTime".split("\n");
/** frappe/model/__init__.py:80 */
export const DATA_FIELD_OPTIONS = ["Email", "Name", "Phone", "URL", "Barcode", "IBAN"];

export const rowLabel = (r: FieldTypeRow) => (r.dataOption ? `${r.fieldtype} (${r.dataOption})` : r.fieldtype);

/** A DocField + values to inspect one type in every state. `label` is translated through the provider (Desk __()). */
export interface FieldSample {
  df: Partial<FrappeDocField>;
  label: L;
  filled: unknown;
  /** A value the control flags (Desk's soft validation), when there is one. */
  invalid?: unknown;
  /** A server-style message for the "validation error" state. */
  serverError: L;
  /** Needs the simulated server (search / upload). */
  simulated?: boolean;
}

const ERR_MISSING = (label: L) => l(`Error: Value missing for FT Demo: ${label.en}`, `خطأ: قيمة مفقودة لـ FT Demo: ${label.ar}`);

const S = (df: Partial<FrappeDocField>, label: L, filled: unknown, more: Partial<FieldSample> = {}): FieldSample =>
  ({ df, label, filled, serverError: ERR_MISSING(label), ...more });

/** Samples by row id (value types and display types; layout types are shown in a form). */
export const SAMPLES: Record<string, FieldSample> = {
  "FT-01": S({ fieldtype: "Data", placeholder: "e.g. Acme Travel" }, l("Customer name", "اسم العميل"), "Acme Travel"),
  "FT-01a": S({ fieldtype: "Data", options: "Email" }, l("Email", "البريد الإلكتروني"), "sara@example.com, omar@example.com", { invalid: "sara@", serverError: l("sara@ is not a valid Email Address", "‏sara@ ليس عنوان بريد إلكتروني صالحاً") }),
  "FT-01b": S({ fieldtype: "Data", options: "Name" }, l("Contact person", "الشخص المسؤول"), "Sara Al-Otaibi", { serverError: l("Sara#1 is not a valid Name", "‏Sara#1 ليس اسماً صالحاً") }),
  "FT-01c": S({ fieldtype: "Data", options: "Phone" }, l("Mobile", "الجوال"), "+966 50 123 4567", { invalid: "call me", serverError: l("call me is not a valid Phone Number", "‏call me ليس رقم هاتف صالحاً") }),
  "FT-01d": S({ fieldtype: "Data", options: "URL" }, l("Website", "الموقع الإلكتروني"), "https://example.com", { invalid: "example dot com", serverError: l("'example dot com' is not a valid URL", "‏'example dot com' ليس رابطاً صالحاً") }),
  "FT-01e": S({ fieldtype: "Data", options: "Barcode" }, l("Item barcode", "باركود الصنف"), "6281000000001"),
  "FT-01f": S({ fieldtype: "Data", options: "IBAN" }, l("IBAN", "رقم الآيبان"), "SA0380000000608010167519", { serverError: l("IBAN number SA00 is invalid", "رقم الآيبان SA00 غير صالح") }),
  "FT-02": S({ fieldtype: "Small Text" }, l("Notes", "ملاحظات"), "Prefers morning calls.\nArabic speaker."),
  "FT-03": S({ fieldtype: "Text" }, l("Description", "الوصف"), "Corporate account since 2021.\nTwo offices."),
  "FT-04": S({ fieldtype: "Long Text" }, l("History", "السجل"), "Line 1\nLine 2\nLine 3"),
  "FT-05": S({ fieldtype: "Text Editor" }, l("Proposal", "العرض"), "<p><strong>Scope:</strong> three trips a quarter.</p>"),
  "FT-06": S({ fieldtype: "Markdown Editor" }, l("Readme", "الملف التعريفي"), "# Title\n\n- item one\n- item two"),
  "FT-07": S({ fieldtype: "HTML Editor" }, l("Email template", "قالب البريد"), "<p>Hello {{ first_name }}</p>"),
  "FT-08": S({ fieldtype: "Code", options: "Python" }, l("Script", "النص البرمجي"), "def total(rows):\n    return sum(r.qty for r in rows)"),
  "FT-09": S({ fieldtype: "JSON" }, l("Settings", "الإعدادات"), '{"channel": "email", "retries": 3}'),
  "FT-10": S({ fieldtype: "Password" }, l("API secret", "السر البرمجي"), "*****"),
  "FT-11": S({ fieldtype: "Read Only" }, l("Full name", "الاسم الكامل"), "Sara Al-Otaibi"),
  "FT-12": S({ fieldtype: "Select", options: "\nOpen\nReplied\nClosed" }, l("Status", "الحالة"), "Replied", { serverError: l('Status cannot be "Legacy". It should be one of "", "Open", "Replied", "Closed"', 'الحالة لا يمكن أن تكون "Legacy". يجب أن تكون إحدى: "", "Open", "Replied", "Closed"') }),
  "FT-13": S({ fieldtype: "Autocomplete", options: "Email\nPhone\nWalk-in\nReferral" }, l("Source", "المصدر"), "Referral"),
  "FT-14": S({ fieldtype: "Link", options: "User" }, l("Account manager", "مدير الحساب"), "lina@example.com", { simulated: true, serverError: l("Could not find Account manager: ghost@example.com", "تعذّر العثور على مدير الحساب: ghost@example.com") }),
  "FT-15": S({ fieldtype: "Dynamic Link", options: "reference_doctype" }, l("Reference", "المرجع"), "lina@example.com", { simulated: true }),
  "FT-16": S({ fieldtype: "Check" }, l("Do not contact", "عدم التواصل"), 1),
  "FT-17": S({ fieldtype: "Int" }, l("Employees", "عدد الموظفين"), 42, { serverError: l("Value cannot be negative for FT Demo: Employees", "لا يمكن أن تكون القيمة سالبة لـ FT Demo: عدد الموظفين") }),
  "FT-18": S({ fieldtype: "Long Int" }, l("Big counter", "عدّاد كبير"), 9007199254740),
  "FT-19": S({ fieldtype: "Float", precision: "3" }, l("Weight (kg)", "الوزن (كغ)"), 12.375),
  "FT-20": S({ fieldtype: "Currency" }, l("Annual revenue", "الإيراد السنوي"), 1250000.5),
  "FT-21": S({ fieldtype: "Percent" }, l("Probability", "الاحتمال"), 62.5),
  "FT-22": S({ fieldtype: "Rating", options: "5" }, l("Satisfaction", "الرضا"), 0.7),
  "FT-23": S({ fieldtype: "Duration" }, l("Call length", "مدة المكالمة"), 5430),
  "FT-24": S({ fieldtype: "Date" }, l("Next follow-up", "المتابعة التالية"), "2026-11-20"),
  "FT-25": S({ fieldtype: "Datetime" }, l("Meeting at", "موعد الاجتماع"), "2026-11-20 10:30:00"),
  "FT-26": S({ fieldtype: "Time" }, l("Best time to call", "أفضل وقت للاتصال"), "16:45:00"),
  "FT-27": S({ fieldtype: "Phone" }, l("Phone", "الهاتف"), "+966-512345678", { serverError: l("Phone Number 0512 set in field phone is not valid.", "رقم الهاتف 0512 في الحقل phone غير صالح.") }),
  "FT-28": S({ fieldtype: "Color" }, l("Tag colour", "لون الوسم"), "#1E88E5"),
  "FT-29": S({ fieldtype: "Attach" }, l("Contract", "العقد"), "/files/contract.pdf", { simulated: true }),
  "FT-30": S({ fieldtype: "Attach Image" }, l("Logo", "الشعار"), "/files/company-logo.png", { simulated: true }),
  "FT-31": S({ fieldtype: "Image", options: "logo" }, l("Logo preview", "معاينة الشعار"), null),
  "FT-32": S({ fieldtype: "Signature" }, l("Signature", "التوقيع"), "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  "FT-33": S({ fieldtype: "Barcode" }, l("Barcode", "الباركود"), '<svg data-barcode-value="6281000000001">…</svg>'),
  "FT-34": S({ fieldtype: "Geolocation" }, l("Location", "الموقع"), '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[46.67,24.71]}}]}'),
  "FT-35": S({ fieldtype: "Icon" }, l("Icon", "الأيقونة"), "folder-normal"),
  "FT-42": S({ fieldtype: "Heading" }, l("Billing details", "تفاصيل الفوترة"), null),
  "FT-43": S({ fieldtype: "HTML", options: "<p><b>Note:</b> prices exclude VAT.</p>" }, l("Notice", "ملاحظة"), null),
  "FT-44": S({ fieldtype: "Button" }, l("Recalculate", "إعادة الحساب"), null),
};

/** The Arabic translations the provider gets in Arabic (Desk's __() dictionary): labels and Select options. */
export function arabicTranslations(): Record<string, string> {
  const out: Record<string, string> = { Open: "مفتوح", Replied: "تم الرد", Closed: "مغلق", Email: "البريد", Phone: "الهاتف", "Walk-in": "زيارة", Referral: "إحالة", "Reference type": "نوع المرجع", User: "مستخدم", Contact: "جهة اتصال" };
  for (const s of Object.values(SAMPLES)) out[s.label.en] = s.label.ar;
  return out;
}
