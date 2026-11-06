/**
 * Core Export & Import — the Design System's Export Data dialog and Data Import tool WITHOUT a Frappe server: a
 * non-Frappe adapter over this page's demo rows. Export writes a real CSV in the browser; Import reads the file you
 * choose (CSV here), maps, validates and flags duplicates; one example cannot run the import (and says why), the other
 * "imports" into this page's memory to show progress and the result. The Frappe versions (the same views, every step
 * on the server) are on Frappe layer → Import & export.
 */
import * as React from "react";
import { Download, FileUp } from "lucide-react";
import {
  Button, DataImportDialog, ExportDialog, buildCsv, parseCsv, saveBlob,
  type DataImportAdapter, type ExportGroup, type ExportRequest, type ImportField,
} from "@ui";
import { Example, Props, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";

interface Contact { id: string; name: string; email: string; city: string; stage: string }
const CONTACTS: Contact[] = [
  { id: "C-001", name: "Huda Saleh", email: "huda@example.com", city: "Riyadh", stage: "Lead" },
  { id: "C-002", name: "Omar Khalid", email: "omar@example.com", city: "Jeddah", stage: "Customer" },
  { id: "C-003", name: "Lina Fares", email: "lina@example.com", city: "Dammam", stage: "Lead" },
  { id: "C-004", name: "Sami Nasser", email: "sami@example.com", city: "Riyadh", stage: "Prospect" },
  { id: "C-005", name: "Mona Adel", email: "mona@example.com", city: "Khobar", stage: "Customer" },
  { id: "C-006", name: "Yousef Ali", email: "yousef@example.com", city: "Riyadh", stage: "Lead" },
];
const STAGES = ["Lead", "Prospect", "Customer"];
type Key = keyof Contact;
const FIELDS: { key: Key; en: string; ar: string; mandatory?: boolean }[] = [
  { key: "id", en: "ID", ar: "المعرّف" }, { key: "name", en: "Full Name", ar: "الاسم الكامل", mandatory: true },
  { key: "email", en: "Email", ar: "البريد الإلكتروني", mandatory: true }, { key: "city", en: "City", ar: "المدينة" }, { key: "stage", en: "Stage", ar: "المرحلة" },
];

const DEMO_CSV = "Full Name,Email,City,Stage,Notes\nRana Hamad,rana@example.com,Riyadh,Lead,met at expo\n,no-name@example.com,Jeddah,Lead,\nOmar K.,omar@example.com,Jeddah,Customer,already a contact\nTariq Z.,tariq@,Abha,Prospect,\nNoura B.,noura@example.com,Taif,VIP,\nRana H.,RANA@example.com,Riyadh,Lead,second row for Rana\n";

function useDemo(language: "en" | "ar") {
  const groups = React.useMemo<ExportGroup[]>(() => [{
    key: "Contact", label: language === "ar" ? "جهات الاتصال" : "Contacts", reqd: true,
    fields: FIELDS.map((f) => ({ fieldname: f.key, label: f[language], reqd: !!f.mandatory, mandatory: !!f.mandatory })),
  }], [language]);
  const writeCsv = React.useCallback((req: ExportRequest, rows: Contact[]) => {
    const keys = req.fields.Contact as Key[];
    const header = keys.map((k) => FIELDS.find((f) => f.key === k)![language]);
    const data = req.records === "blank_template" ? [] : (req.records === "5_records" ? rows.slice(0, 5) : rows).map((r) => keys.map((k) => r[k]));
    saveBlob(new Blob([buildCsv(header, data)], { type: "text/csv;charset=utf-8" }), `contacts-${req.records}.csv`);
  }, [language]);
  const importFields = React.useMemo<ImportField[]>(() => FIELDS.filter((f) => f.key !== "id").map((f) => ({
    key: f.key, label: f[language], mandatory: f.mandatory, aliases: [f.en, f.ar],
    validate: f.key === "email" ? (v) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? null : language === "ar" ? "بريد إلكتروني غير صالح" : "Not a valid email address")
      : f.key === "stage" ? (v) => (STAGES.includes(v) ? null : `${language === "ar" ? "يجب أن تكون القيمة إحدى" : "Value must be one of"} ${STAGES.join(", ")}`) : undefined,
  })), [language]);
  return { groups, writeCsv, importFields };
}

export function CoreIoPage() {
  const tr = useTr();
  const language = tr(l("en", "ar")) as "en" | "ar";
  const { groups, writeCsv, importFields } = useDemo(language);
  const [exportOpen, setExportOpen] = React.useState<null | "list" | "selection">(null);
  const [importOpen, setImportOpen] = React.useState<null | "unavailable" | "memory">(null);
  const [rows, setRows] = React.useState<Contact[]>(CONTACTS);
  const filtered = rows.filter((r) => r.city === "Riyadh");
  const selected = rows.slice(0, 2);

  const base: DataImportAdapter = {
    fields: importFields,
    accept: ".csv",
    parse: async (file) => { const [headers = [], ...body] = parseCsv(await file.text()); return { headers, rows: body }; },
    duplicates: { identity: (r) => r.email?.toLowerCase() || null, existing: (id) => { const c = rows.find((x) => x.email.toLowerCase() === id); return c ? `${c.name} (${c.id})` : null; } },
    template: { groups, onExport: (req) => writeCsv(req, rows), description: tr(l("Contacts", "جهات الاتصال")) },
  };
  const unavailable: DataImportAdapter = { ...base, runUnavailable: tr(l("this demo has no backend to write to.", "هذا العرض بلا خادم يكتب إليه.")) };
  const memory: DataImportAdapter = {
    ...base,
    run: async ({ rows: ready }, onProgress) => {
      const added: Contact[] = [];
      for (let i = 0; i < ready.length; i++) {
        await new Promise((r) => setTimeout(r, 250));
        const v = ready[i].values;
        added.push({ id: `C-${String(rows.length + added.length + 1).padStart(3, "0")}`, name: v.name, email: v.email, city: v.city ?? "", stage: v.stage ?? "Lead" });
        onProgress(i + 1, ready.length);
      }
      setRows((r) => [...r, ...added]);
      return { success: added.length, failed: 0 };
    },
  };

  return (
    <div className="space-y-12">
      <Section title={l("Export Data — ExportDialog", "تصدير البيانات — ExportDialog")} description={l(
        "The Design System's Export Data dialog from the core entry: File Type, Export Type (All / Filtered — or Selected (n) — / 5 Records / Blank Template), the field groups with each field's label, key and (Mandatory), Select All / Select Mandatory / Unselect All, the validation, loading and error states. Data in, a selection out: here the page writes a real CSV from its own rows. FrappeExportDialog renders this same dialog and asks the Frappe server for the file.",
        "حوار تصدير البيانات في نظام التصميم من المدخل الأساسي: نوع الملف ونوع التصدير (الكل / المصفّاة — أو المحددة (n) — / 5 سجلات / قالب فارغ) ومجموعات الحقول مع تسمية كل حقل ومفتاحه و(إلزامي) وتحديد الكل / تحديد الإلزامي / إلغاء تحديد الكل وحالات التحقق والتحميل والخطأ. بيانات تدخل واختيار يخرج: هنا تكتب الصفحة ملف CSV حقيقياً من صفوفها. يعرض FrappeExportDialog الحوار نفسه ويطلب الملف من خادم فرابيه.")}>
        <Example code={`<ExportDialog
  open={open} onOpenChange={setOpen}
  groups={[{ key: "Contact", label: "Contacts", reqd: true, fields }]}
  description="Contacts"
  counts={{ all: rows.length, by_filter: filtered.length }}
  selectedCount={selection.length}       // "Selected Records (n)"
  lockMandatory                          // mandatory fields are always exported
  onExport={async ({ fileType, records, fields }) => writeFile(…)}
/>`}>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setExportOpen("list")}><Download className="size-4" />{tr(l(`Export the list (${rows.length} records, ${filtered.length} in Riyadh)`, `تصدير القائمة (${rows.length} سجلات، ${filtered.length} في الرياض)`))}</Button>
            <Button variant="outline" onClick={() => setExportOpen("selection")}><Download className="size-4" />{tr(l("Export 2 selected", "تصدير سجلين محددين"))}</Button>
          </div>
          <ExportDialog
            open={exportOpen !== null}
            onOpenChange={(o) => { if (!o) setExportOpen(null); }}
            groups={groups}
            description={tr(l("Contacts", "جهات الاتصال"))}
            counts={{ all: rows.length, by_filter: filtered.length }}
            selectedCount={exportOpen === "selection" ? selected.length : undefined}
            lockMandatory
            defaultSelection={{ Contact: ["city"] }}
            onExport={(req) => writeCsv(req, req.records === "all" || req.records === "5_records" ? rows : exportOpen === "selection" ? selected : filtered)}
          />
        </Example>
        <Props rows={[
          ["groups", "ExportGroup[]", l("Field groups: the main entity first (its selection gates Export), then child tables.", "مجموعات الحقول: الكيان الرئيسي أولاً (اختياره شرط للتصدير) ثم الجداول الفرعية.")],
          ["onExport", "(req) => Promise", l("Write the file; resolve → closed, reject → the error in the dialog.", "اكتب الملف؛ النجاح يغلق الحوار والرفض يعرض الخطأ فيه.")],
          ["selectedCount / counts", "number / {all, by_filter}", l("\"Selected Records (n)\"; counts after All / Filtered.", "«السجلات المحددة (n)»؛ الأعداد بعد الكل / المصفّاة.")],
          ["lockMandatory / defaultSelection", "boolean / Record", l("Mandatory fields always exported; extra fields pre-checked.", "الحقول الإلزامية تُصدَّر دائماً؛ حقول إضافية محددة مسبقاً.")],
          ["recordOptions / fileTypes", "ExportRecords[] / ExportFileType[]", l("What is offered (default: all four; Excel and CSV).", "ما يُعرض (الافتراضي: الأربعة؛ Excel و CSV).")],
        ]} />
      </Section>

      <Section title={l("Data Import — DataImportDialog", "استيراد البيانات — DataImportDialog")} description={l(
        "The Data Import tool's steps (Upload → Preview → Import → Result) behind an adapter: parse the file, the fields (mandatory, per-value checks), duplicates against existing records and within the file, and the run — or `runUnavailable: reason`, which keeps Start Import disabled and says why. Download the demo file and try both: one has no backend (nothing is imported), the other adds the ready rows to this page's memory.",
        "خطوات أداة الاستيراد (الرفع ← المعاينة ← الاستيراد ← النتيجة) خلف محوّل: قراءة الملف والحقول (الإلزامية وفحص القيم) والمكررات مقارنة بالسجلات الموجودة وداخل الملف والتشغيل — أو ‎`runUnavailable: reason`‎ الذي يُبقي «بدء الاستيراد» معطلاً ويذكر السبب. نزّل الملف التجريبي وجرّب الاثنين: الأول بلا خادم (لا يُستورد شيء) والثاني يضيف الصفوف الجاهزة إلى ذاكرة هذه الصفحة.")}>
        <Example code={`const adapter: DataImportAdapter = {
  fields: [{ key: "email", label: "Email", mandatory: true, validate: (v) => isEmail(v) ? null : "Not a valid email" }, …],
  parse: async (file) => { const [headers, ...rows] = parseCsv(await file.text()); return { headers, rows }; },
  duplicates: { identity: (r) => r.email?.toLowerCase(), existing: (id) => byEmail.get(id)?.name },
  runUnavailable: "importing needs the backend",   // or run: async ({ rows }, onProgress) => ({ success, failed })
  template: { groups, onExport: writeTemplate },
};
<DataImportDialog adapter={adapter} description="Contacts" open={open} onOpenChange={setOpen} />`}>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => saveBlob(new Blob(["﻿" + DEMO_CSV], { type: "text/csv" }), "contacts-demo.csv")}><Download className="size-4" />{tr(l("Download the demo file", "تنزيل الملف التجريبي"))}</Button>
            <Button variant="outline" onClick={() => setImportOpen("unavailable")}><FileUp className="size-4" />{tr(l("Import (no backend)", "استيراد (بلا خادم)"))}</Button>
            <Button variant="outline" onClick={() => setImportOpen("memory")}><FileUp className="size-4" />{tr(l("Import into this page", "استيراد إلى هذه الصفحة"))}</Button>
          </div>
          <p className="text-sm text-muted-foreground">{tr(l(`This page holds ${rows.length} contacts.`, `تحتوي هذه الصفحة على ${rows.length} جهة اتصال.`))}</p>
          {importOpen === "unavailable" && <DataImportDialog adapter={unavailable} description={tr(l("Contacts", "جهات الاتصال"))} open onOpenChange={(o) => { if (!o) setImportOpen(null); }} />}
          {importOpen === "memory" && <DataImportDialog adapter={memory} description={tr(l("Contacts", "جهات الاتصال"))} open onOpenChange={(o) => { if (!o) setImportOpen(null); }} />}
        </Example>
        <Example title={l("Inline (no dialog)", "ضمن الصفحة (بلا حوار)")}>
          <DataImportDialog adapter={unavailable} description={tr(l("Contacts", "جهات الاتصال"))} />
        </Example>
      </Section>
    </div>
  );
}
