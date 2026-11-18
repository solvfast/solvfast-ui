/**
 * The form builder's field types: name, description, icon, group and the properties each type takes (its
 * capabilities — which property sections the inspector shows). The default registry is the SOLV FAST Field Library's
 * (28 types). An app narrows it (`pickFieldTypes`), extends it, or rewords it by passing its own list.
 */
import {
  AlignLeft, Barcode, Calculator, Calendar, CalendarClock, CheckSquare, ChevronDown, Circle, Clock, DollarSign, FileUp,
  Hash, Heading, Image as ImageIcon, Link2, ListChecks, Mail, MapPin, Palette, PenLine, Percent, Phone, Pilcrow, Sigma,
  Star, Table2, Timer, Type, type LucideIcon,
} from "lucide-react";
import type { Localized } from "../../lib/localized";
import type { FormFieldTypeKey } from "./model";

/** Which property sections and controls a type takes. */
export interface FieldTypeCaps {
  /** Description / helper text. */
  description: boolean;
  placeholder: boolean;
  /** The Required switch. */
  required: boolean;
  /** A default value (its control follows the type). */
  defaultValue: boolean;
  unique: boolean;
  maxLength: boolean;
  /** Min and max value. */
  minMax: boolean;
  /** Options (choice types). */
  choices: boolean;
  /** "Links to" + "Limit the records shown". */
  linkTarget: boolean;
  /** Auto-fill from a record link on the form. */
  autofill: boolean;
  /** `full`: show / required / read-only when; `show`: show when only. */
  conditions: "full" | "show";
  /** `full`: every display switch; `hidden`: only Hidden. */
  display: "full" | "hidden";
  /** May be a table column. */
  tableColumn: boolean;
}

export interface FormFieldTypeInfo {
  key: FormFieldTypeKey;
  label: Localized;
  description: Localized;
  icon: LucideIcon;
  /** The picker group (`FORM_FIELD_GROUPS` id). */
  group: string;
  caps: FieldTypeCaps;
  /** Offered only when the builder runs with `advancedFieldTypes` (structured types). */
  advanced?: boolean;
}

export interface FormFieldGroup { id: string; label: Localized }
export const FORM_FIELD_GROUPS: readonly FormFieldGroup[] = [
  { id: "text", label: { en: "Text", ar: "نص" } },
  { id: "choice", label: { en: "Choice", ar: "اختيار" } },
  { id: "numbers", label: { en: "Numbers", ar: "أرقام" } },
  { id: "datetime", label: { en: "Date & time", ar: "التاريخ والوقت" } },
  { id: "contact", label: { en: "Contact", ar: "التواصل" } },
  { id: "files", label: { en: "Files", ar: "الملفات" } },
  { id: "relational", label: { en: "Relational", ar: "علائقي" } },
  { id: "layout", label: { en: "Layout", ar: "التخطيط" } },
  { id: "structured", label: { en: "Structured", ar: "مركّبة" } },
];

const caps = (o: Partial<FieldTypeCaps> = {}): FieldTypeCaps => ({
  description: true, placeholder: false, required: true, defaultValue: false, unique: false, maxLength: false, minMax: false,
  choices: false, linkTarget: false, autofill: false, conditions: "full", display: "full", tableColumn: true, ...o,
});
const t = (key: FormFieldTypeKey, en: string, ar: string, descEn: string, descAr: string, icon: LucideIcon, group: string, c: FieldTypeCaps, advanced?: boolean): FormFieldTypeInfo =>
  ({ key, label: { en, ar }, description: { en: descEn, ar: descAr }, icon, group, caps: c, ...(advanced ? { advanced } : {}) });

/** Every field type, in picker order within its group. */
export const FORM_FIELD_TYPES: readonly FormFieldTypeInfo[] = [
  t("text", "Text Input", "إدخال نصي", "Short single-line text.", "سطر نص قصير.", Type, "text", caps({ placeholder: true, defaultValue: true, unique: true, maxLength: true, autofill: true })),
  t("long_text", "Long Text", "نص طويل", "Multi-line paragraph text.", "نص متعدد الأسطر.", AlignLeft, "text", caps({ placeholder: true, defaultValue: true, maxLength: true, autofill: true })),
  t("rich_text", "Rich Text", "نص منسّق", "Formatted text with headings, lists, and links.", "نص منسّق بعناوين وقوائم وروابط.", Pilcrow, "text", caps({ defaultValue: true, autofill: true, tableColumn: false })),
  t("dropdown", "Dropdown", "قائمة منسدلة", "Select one option.", "اختر قيمة واحدة.", ChevronDown, "choice", caps({ defaultValue: true, choices: true, autofill: true })),
  t("radio", "Radio Buttons", "أزرار اختيار", "Pick exactly one option.", "اختر خياراً واحداً.", Circle, "choice", caps({ defaultValue: true, choices: true, autofill: true })),
  t("multi_select", "Multi Select", "اختيار متعدد", "Select multiple options.", "اختر عدة قيم.", ListChecks, "choice", caps({ defaultValue: true, choices: true, autofill: true })),
  t("checkbox", "Checkbox", "مربع تأكيد", "Single confirmation box.", "مربع تأكيد واحد.", CheckSquare, "choice", caps({ required: false, defaultValue: true, autofill: true })),
  t("rating", "Rating", "تقييم", "Star rating input.", "إدخال تقييم بالنجوم.", Star, "choice", caps({ defaultValue: true })),
  t("color", "Color", "لون", "Pick a color.", "اختر لوناً.", Palette, "choice", caps({ defaultValue: true, tableColumn: false })),
  t("number", "Number", "رقم", "Whole number.", "رقم صحيح.", Hash, "numbers", caps({ placeholder: true, defaultValue: true, unique: true, minMax: true, autofill: true })),
  t("decimal", "Decimal", "رقم عشري", "Number with decimals.", "رقم بكسور عشرية.", Calculator, "numbers", caps({ placeholder: true, defaultValue: true, unique: true, minMax: true, autofill: true })),
  t("currency", "Currency", "عملة", "Money amount.", "مبلغ مالي.", DollarSign, "numbers", caps({ placeholder: true, defaultValue: true, minMax: true, autofill: true })),
  t("percent", "Percent", "نسبة مئوية", "Percentage value.", "قيمة نسبة مئوية.", Percent, "numbers", caps({ placeholder: true, defaultValue: true, minMax: true, autofill: true })),
  t("duration", "Duration", "مدة", "A length of time.", "مدة زمنية.", Timer, "numbers", caps({ defaultValue: true, minMax: true, autofill: true })),
  t("date", "Date", "تاريخ", "Pick a date.", "اختر تاريخاً.", Calendar, "datetime", caps({ defaultValue: true, autofill: true })),
  t("datetime", "Date & Time", "تاريخ ووقت", "Pick a date and time.", "اختر تاريخاً ووقتاً.", CalendarClock, "datetime", caps({ defaultValue: true, autofill: true })),
  t("time", "Time", "وقت", "Pick a time.", "اختر وقتاً.", Clock, "datetime", caps({ defaultValue: true, autofill: true })),
  t("email", "Email", "بريد إلكتروني", "Email address.", "عنوان بريد إلكتروني.", Mail, "contact", caps({ placeholder: true, defaultValue: true, unique: true, autofill: true })),
  t("phone", "Phone", "هاتف", "Phone number.", "رقم هاتف.", Phone, "contact", caps({ placeholder: true, defaultValue: true, unique: true, autofill: true })),
  t("file_upload", "File Upload", "رفع ملف", "Upload a file (PDF, docs…).", "رفع ملف (PDF، مستندات…).", FileUp, "files", caps({ tableColumn: false })),
  t("image_upload", "Image Upload", "رفع صورة", "Upload an image.", "رفع صورة.", ImageIcon, "files", caps({ tableColumn: false })),
  t("signature", "Signature", "توقيع", "Draw a signature.", "ارسم توقيعاً.", PenLine, "files", caps({ tableColumn: false })),
  t("record_link", "Record Link", "ربط سجل", "Let the user pick a record from another object.", "اختيار سجل من كائن آخر.", Link2, "relational", caps({ placeholder: true, defaultValue: true, unique: true, linkTarget: true, autofill: true })),
  t("map_location", "Map Location", "موقع على الخريطة", "Pick a location on a map.", "اختر موقعاً على الخريطة.", MapPin, "relational", caps({ tableColumn: false })),
  t("barcode", "Barcode", "باركود", "Scan or enter a barcode.", "امسح أو أدخل باركود.", Barcode, "relational", caps({ unique: true, autofill: true, tableColumn: false })),
  t("heading", "Heading", "عنوان قسم", "A section heading inside the form.", "عنوان قسم داخل النموذج.", Heading, "layout", caps({ description: false, required: false, conditions: "show", display: "hidden", tableColumn: false })),
  t("table", "Table", "جدول", "A grid of rows and columns; rows added by the user or filled from a source.", "شبكة من الصفوف والأعمدة؛ تُضاف الصفوف يدوياً أو تُملأ من مصدر.", Table2, "structured", caps(), true),
  t("display_value", "Display Value", "قيمة معروضة", "A read-only value shown from a calculated source.", "قيمة للقراءة فقط تُعرض من مصدر محسوب.", Sigma, "structured", caps({ required: false, conditions: "show" }), true),
];

/** The registry entry for a type (the list given, else the default registry). */
export const fieldTypeInfo = (key: string, types: readonly FormFieldTypeInfo[] = FORM_FIELD_TYPES): FormFieldTypeInfo | undefined =>
  types.find((x) => x.key === key) ?? FORM_FIELD_TYPES.find((x) => x.key === key);

/** A subset of the default registry, in its order. */
export const pickFieldTypes = (keys: readonly FormFieldTypeKey[]): FormFieldTypeInfo[] => FORM_FIELD_TYPES.filter((x) => keys.includes(x.key));

/** Types a table column may take: one nesting level — a nested table's columns cannot be tables. */
const COLUMN_ORDER: readonly FormFieldTypeKey[] = [
  "text", "long_text", "dropdown", "multi_select", "radio", "checkbox", "rating", "number", "decimal", "currency", "percent",
  "duration", "date", "datetime", "time", "email", "phone", "record_link", "display_value",
];
export const tableColumnTypes = (depth: 0 | 1, types: readonly FormFieldTypeInfo[] = FORM_FIELD_TYPES): FormFieldTypeKey[] => {
  const allowed = types.filter((x) => x.caps.tableColumn && x.key !== "table").map((x) => x.key);
  const base = [...COLUMN_ORDER.filter((k) => allowed.includes(k)), ...allowed.filter((k) => !COLUMN_ORDER.includes(k))];
  return depth === 0 && types.some((x) => x.key === "table") ? [...base, "table"] : base;
};
