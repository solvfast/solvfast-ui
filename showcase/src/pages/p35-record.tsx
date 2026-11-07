/**
 * P35 record — the form "⋯" menu, form print, Connections and the e-mail composer on the SIMULATED site
 * (playground/src/demo/sim-site.ts, createFixtureTransport). Every server answer is the in-browser simulator's
 * (shapes from Frappe 15.110; src/frappe/testing/handlers/record.ts); permission decisions are its approximation.
 * P35 integration: FrappeForm renders the menu (FrappeRecordMenu in FrappeFormView's `menu` slot) and the Connections tab
 * (FrappeConnections in `extraTabs`) by default; the page passes only the host callbacks.
 */
import * as React from "react";
import { Button, Skeleton } from "@ui";
import {
  FrappeConnections, FrappeEmailComposer, FrappeForm, FrappeFormPrint, useDoc, useMetaBundle, type DocTypeMeta, type FrappeDoc,
} from "@ui/frappe";
import { TRAVEL, TRAVEL_COMPANION } from "../../../playground/src/demo/sim-site";
import { Example, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";
import { Picker, Readout, SessionBadge, SimProvider, SimulatedPermissionStrip, StatusStrip, sessionPermissions, useSimSite, type SessionKey } from "./frappe/shared";

const T = "2026-11-02 09:00:00.000000";
/** Travel Request with `allow_rename`, a print format and a dashboard: ToDos whose reference is this request
 *  (reference_name + the dynamic-link DocType field reference_type), as an app's `<doctype>_dashboard.py` would declare. */
const TRAVEL_P35: DocTypeMeta = {
  ...TRAVEL, allow_rename: 1,
  __print_formats: [{ name: "Travel Itinerary", print_format_type: "Jinja" }],
  __dashboard: { fieldname: "reference_name", dynamic_links: { reference_name: ["Travel Request", "reference_type"] }, non_standard_fieldnames: {}, internal_links: {}, transactions: [{ label: "Follow-up", items: ["ToDo"] }] },
};
const EMAIL_TEMPLATE: DocTypeMeta = {
  name: "Email Template", autoname: "Prompt", permissions: [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1 }, { role: "Desk User", permlevel: 0, read: 1 }],
  fields: [{ fieldname: "subject", fieldtype: "Data", label: "Subject" }, { fieldname: "response", fieldtype: "Text Editor", label: "Response" }],
};

function useRecordSite(session: SessionKey) {
  const site = useSimSite({ permissions: sessionPermissions(session) }, [session]);
  return React.useMemo(() => {
    const s = site.transport.store;
    s.meta["Travel Request"] = [TRAVEL_P35, TRAVEL_COMPANION];
    s.meta["Email Template"] = [EMAIL_TEMPLATE];
    const et = new Map<string, FrappeDoc>([["Trip confirmation", { doctype: "Email Template", name: "Trip confirmation", subject: "Your trip: {{ purpose }}", response: "<p>Your request {{ doc.name }} is confirmed.</p>" } as FrappeDoc]]);
    s.docs.set("Email Template", et);
    const todos = s.docs.get("ToDo")!;
    for (const [i, d] of ["Book the hotel", "Collect the per-diem"].entries()) {
      const name = `TD-TR-${i + 1}`;
      todos.set(name, { doctype: "ToDo", name, description: `<p>${d}</p>`, status: "Open", reference_type: "Travel Request", reference_name: "TR-0001", allocated_to: "sara@example.com", owner: "Administrator", modified: T, creation: T } as FrappeDoc);
    }
    return site;
  }, [site]);
}

function MenuNextToForm({ onLog }: { onLog: (s: string) => void }) {
  return (
    <FrappeForm doctype="Travel Request" name="TR-0001" guardUnload={false}
      menu={{
        onOpened: (d, via) => onLog(`${via === "duplicate" ? "Duplicate" : "New"} → ${d.name} opened in the form (unsaved; Save inserts it in the simulator)`),
        onRenamed: (n) => onLog(`onRenamed → ${n} (frappe.rename_doc, SIMULATED; the host routes to the new name)`),
        onDeleted: () => onLog("onDeleted → frappe.client.delete answered (SIMULATED; the host routes away)"),
        onCustomize: (href) => onLog(`onCustomize → ${href} (a Desk URL; not opened in the showcase)`),
        writeClipboard: async (text) => { onLog(`Copy to Clipboard → ${text.length} characters of JSON`); try { await navigator.clipboard?.writeText(text); } catch { /* the showcase may lack clipboard access */ } },
        emailProps: { onSent: (r) => onLog(`email.make → Communication ${r.name} recorded by the simulator (nothing was sent)`) },
        onReminderCreated: (r) => onLog(`create_new_reminder → Reminder ${r.name ?? ""} at ${r.remindAt} (stored by the simulator; nothing scheduled)`),
      }}
      connections={{ onOpenList: (d, f) => onLog(`onOpenList(${d}, ${JSON.stringify(f)})`), onNew: (d, f) => onLog(`onNew(${d}, ${JSON.stringify(f)})`) }} />
  );
}

function PrintAndEmail({ onLog }: { onLog: (s: string) => void }) {
  const tr = useTr();
  const bundle = useMetaBundle("Travel Request");
  const q = useDoc("Travel Request", "TR-0002");
  const [open, setOpen] = React.useState<null | "print" | "email">(null);
  if (!bundle.data || !q.data) return <Skeleton className="h-10 w-64" />;
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => setOpen("print")}>{tr(l("Print TR-0002", "طباعة TR-0002"))}</Button>
      <Button size="sm" variant="outline" onClick={() => setOpen("email")}>{tr(l("Email TR-0002", "مراسلة TR-0002"))}</Button>
      <FrappeFormPrint doc={q.data.doc} meta={bundle.data.meta} open={open === "print"} onOpenChange={(o) => setOpen(o ? "print" : null)} />
      <FrappeEmailComposer doc={q.data.doc} meta={bundle.data.meta} docinfo={q.data.docinfo} open={open === "email"} onOpenChange={(o) => setOpen(o ? "email" : null)}
        onSent={(r) => onLog(`email.make → Communication ${r.name} (SIMULATED: recorded, not sent)`)} />
    </div>
  );
}

export function RecordActionsPage() {
  const [session, setSession] = React.useState<SessionKey>("admin");
  const site = useRecordSite(session);
  const [log, setLog] = React.useState<string[]>([]);
  const onLog = React.useCallback((s: string) => setLog((x) => [s, ...x].slice(0, 8)), []);
  const userSite = useSimSite({}, []);
  return (
    <div className="space-y-12">
      <StatusStrip parts={[
        ["RecordMenu · RenameDialog · ConnectionsPanel · EmailComposer · PrintPreviewFrame · ReminderDialog", "generic"],
        ["FrappeRecordMenu · formMenuItems (toolbar.js rules)", "simulated"], ["FrappeFormPrint · get_html_and_style preview", "simulated"],
        ["FrappeConnections · get_open_count", "simulated"], ["FrappeEmailComposer · email.make · get_email_template", "simulated"], ["FrappeReminder · create_new_reminder", "simulated"],
      ]} note={l(
        "SIMULATED backend operations: rename, delete, the print preview (a labelled placeholder without values), connection counts, e-mail (recorded as a Communication, never sent) and reminders are answered by the in-browser simulator. The PDF and Full Page links point at a real site's URLs and do nothing here. Nothing on this page ran against a real Frappe site.",
        "عمليات خلفية محاكاة: إعادة التسمية والحذف ومعاينة الطباعة (عنصر نائب موسوم بلا قيم) وأعداد الارتباطات والبريد (يُسجَّل كـ Communication ولا يُرسل أبداً) والتذكيرات يجيب عنها المحاكي داخل المتصفّح. روابط PDF والصفحة الكاملة تشير إلى عناوين موقع حقيقي ولا تعمل هنا. لم يُشغَّل شيء في هذه الصفحة على موقع فرابيه حقيقي.")} />
      <Section title={l("The form's ⋯ menu and Connections tab", "قائمة ⋯ في النموذج وتبويب الارتباطات")}
        description={l("FrappeForm's default menu (FrappeRecordMenu) and Connections tab (FrappeConnections): Duplicate / New open the document in the form, Reload re-reads it, Undo / Redo follow the form's history, Links switches to the Connections tab. Switch the session: Data Entry has no delete / print / email right, Sales User is read-only — the menu follows Desk's toolbar.js rules and the simulated server still re-checks every action.",
          "القائمة الافتراضية في FrappeForm (FrappeRecordMenu) وتبويب الارتباطات (FrappeConnections): النسخ والجديد يفتحان المستند في النموذج، وإعادة التحميل تعيد قراءته، والتراجع والإعادة يتبعان سجلّ النموذج، والروابط تنتقل إلى تبويب الارتباطات. بدّل الجلسة: إدخال البيانات بلا حذف أو طباعة أو بريد، ومستخدم المبيعات للقراءة فقط — تتبع القائمة قواعد toolbar.js في ديسك والخادم المحاكى يعيد التحقق من كل إجراء.")}>
        <SimulatedPermissionStrip />
        <Picker legend={l("Session", "الجلسة")} value={session} onChange={(v) => { setSession(v); setLog([]); }}
          options={[{ value: "admin", label: l("System Manager", "مدير النظام") }, { value: "dataEntry", label: l("Data Entry", "إدخال البيانات") }, { value: "sales", label: l("Sales User", "مستخدم المبيعات") }]} />
        <SessionBadge session={session} />
        <Example code={`<FrappeForm doctype="Travel Request" name="TR-0001"
  menu={{ onOpened, onRenamed: goTo, onDeleted: back }}          // default ON; menu={false} removes it
  connections={{ onOpenList: openList, onNew: newLinked }} />    // default ON with a dashboard; connections={false}`}>
          <SimProvider site={site} key={session}><MenuNextToForm onLog={onLog} /></SimProvider>
        </Example>
        <Readout label="callbacks:">{log.length ? log.join("\n") : "—"}</Readout>
      </Section>
      <Section title={l("Print and e-mail on their own", "الطباعة والبريد منفردين")}
        description={l("FrappeFormPrint: Print Format, Letter Head, the server preview in a sandboxed frame, Print / Full Page / PDF links. FrappeEmailComposer: To / CC / BCC, Email Template (get_email_template), attachments, Attach Document Print.",
          "FrappeFormPrint: تنسيق الطباعة والترويسة ومعاينة الخادم في إطار معزول وروابط الطباعة والصفحة الكاملة و PDF. و FrappeEmailComposer: إلى ونسخة ونسخة مخفية وقالب البريد والمرفقات وإرفاق نسخة الطباعة.")}>
        <Example code={`<FrappeFormPrint doc={doc} meta={meta} open={open} onOpenChange={setOpen} settings={bootPrintSettings} />
<FrappeEmailComposer doc={doc} meta={meta} open={open} onOpenChange={setOpen} onSent={(r) => …} />`}>
          <SimProvider site={site} key={session}><PrintAndEmail onLog={onLog} /></SimProvider>
        </Example>
      </Section>
      <Section title={l("Connections from a recorded real dashboard (User)", "الارتباطات من لوحة حقيقية مسجّلة (User)")}
        description={l("The User meta recorded from Frappe 15.110 carries __dashboard (Profile, Logs, Settings, Activity, Integrations); the simulator counts its ToDos by allocated_to. Counts on a site are not permission-filtered (frappe.get_all) — pass canRead from boot as Desk does.",
          "بيانات User المسجّلة من فرابيه 15.110 تحمل __dashboard (الملف والسجلات والإعدادات والنشاط والتكاملات)؛ والمحاكي يعدّ مهامه عبر allocated_to. الأعداد على الموقع غير مفلترة بالأذونات (frappe.get_all) — مرّر canRead من boot كما يفعل ديسك.")}>
        <Example code={`<FrappeConnections meta={userMeta} doc={userDoc} canRead={(d) => boot.user.can_read.includes(d)} onOpenList={…} />`}>
          <SimProvider site={userSite}><UserConnections /></SimProvider>
        </Example>
      </Section>
    </div>
  );
}

function UserConnections() {
  const bundle = useMetaBundle("User");
  const q = useDoc("User", "sara@example.com");
  const [last, setLast] = React.useState("");
  if (!bundle.data || !q.data) return <Skeleton className="h-40 w-full" />;
  return (
    <div className="space-y-3">
      <FrappeConnections meta={bundle.data.meta} doc={q.data.doc} onOpenList={(d, f) => setLast(`onOpenList(${d}, ${JSON.stringify(f)})`)} />
      <Readout label="last:">{last || "—"}</Readout>
    </div>
  );
}
