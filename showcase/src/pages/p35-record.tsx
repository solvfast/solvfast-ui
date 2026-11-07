/**
 * P35 record — the form "⋯" menu, form print, Connections and the e-mail composer on the SIMULATED site
 * (playground/src/demo/sim-site.ts, createFixtureTransport). Every server answer is the in-browser simulator's
 * (shapes from Frappe 15.110; src/frappe/testing/handlers/record.ts); permission decisions are its approximation.
 * The wiring next to the form uses FrappeForm's existing `toolbarExtra` slot and a tab strip around it — the dedicated
 * `menu` / `extraTabs` slots of FrappeFormView belong to another workstream; FrappeFormView itself is not edited.
 */
import * as React from "react";
import { Badge, Button, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@ui";
import {
  FrappeConnections, FrappeEmailComposer, FrappeForm, FrappeFormPrint, FrappeRecordMenu, useDoc, useMetaBundle, type DocTypeMeta, type FrappeDoc,
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
  const tr = useTr();
  const bundle = useMetaBundle("Travel Request");
  const q = useDoc("Travel Request", "TR-0001");
  const [dirty, setDirty] = React.useState(false);
  const [tab, setTab] = React.useState("form");
  if (q.error) return <Badge variant="destructive">{q.error.message}</Badge>;
  if (!bundle.data || !q.data) return <Skeleton className="h-64 w-full" />;
  const doc = q.data.doc;
  const menu = (
    <FrappeRecordMenu
      bundle={bundle.data} doc={doc} docinfo={q.data.docinfo} dirty={dirty}
      onShowConnections={() => setTab("connections")}
      onDuplicate={(copy) => onLog(`onDuplicate → local copy ${copy.name} (not saved; FrappeFormView cannot open an in-memory copy yet — WS1)`)}
      onRenamed={(n) => onLog(`onRenamed → ${n} (frappe.rename_doc, SIMULATED)`)}
      onDeleted={() => onLog("onDeleted → frappe.client.delete answered (SIMULATED)")}
      onReload={async () => { await q.refetch(); onLog("onReload → getdoc re-read"); }}
      onNew={() => onLog("onNew → the host routes to a new Travel Request")}
      onCustomize={(href) => onLog(`onCustomize → ${href} (a Desk URL; not opened in the showcase)`)}
      writeClipboard={async (text) => { onLog(`Copy to Clipboard → ${text.length} characters of JSON`); try { await navigator.clipboard?.writeText(text); } catch { /* the showcase may lack clipboard access */ } }}
      emailProps={{ onSent: (r) => onLog(`email.make → Communication ${r.name} recorded by the simulator (nothing was sent)`) }}
      onReminderCreated={(r) => onLog(`create_new_reminder → Reminder ${r.name ?? ""} at ${r.remindAt} (stored by the simulator; nothing scheduled)`)}
    />
  );
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="form">{tr(l("Form", "النموذج"))}</TabsTrigger>
        <TabsTrigger value="connections">{tr(l("Connections", "الارتباطات"))}</TabsTrigger>
      </TabsList>
      <TabsContent value="form">
        <FrappeForm doctype="Travel Request" name="TR-0001" guardUnload={false} toolbarExtra={menu} onDirtyChange={setDirty} />
      </TabsContent>
      <TabsContent value="connections">
        <FrappeConnections meta={bundle.data.meta} doc={doc}
          onOpenList={(d, f) => onLog(`onOpenList(${d}, ${JSON.stringify(f)})`)} onNew={(d, f) => onLog(`onNew(${d}, ${JSON.stringify(f)})`)} />
      </TabsContent>
    </Tabs>
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
      <Section title={l("Form ⋯ menu next to the form, and a Connections tab", "قائمة ⋯ بجوار النموذج وتبويب الارتباطات")}
        description={l("FrappeRecordMenu in FrappeForm's toolbarExtra slot; FrappeConnections in a tab around the form. Switch the session: Data Entry has no delete / print / email right, Sales User is read-only — the menu follows Desk's toolbar.js rules and the simulated server still re-checks every action.",
          "FrappeRecordMenu في خانة toolbarExtra من FrappeForm؛ و FrappeConnections في تبويب حول النموذج. بدّل الجلسة: إدخال البيانات بلا حذف أو طباعة أو بريد، ومستخدم المبيعات للقراءة فقط — تتبع القائمة قواعد toolbar.js في ديسك والخادم المحاكى يعيد التحقق من كل إجراء.")}>
        <SimulatedPermissionStrip />
        <Picker legend={l("Session", "الجلسة")} value={session} onChange={(v) => { setSession(v); setLog([]); }}
          options={[{ value: "admin", label: l("System Manager", "مدير النظام") }, { value: "dataEntry", label: l("Data Entry", "إدخال البيانات") }, { value: "sales", label: l("Sales User", "مستخدم المبيعات") }]} />
        <SessionBadge session={session} />
        <Example code={`<FrappeForm doctype="Travel Request" name="TR-0001" toolbarExtra={
  <FrappeRecordMenu bundle={bundle} doc={doc} dirty={dirty} onShowConnections={() => setTab("connections")}
    onDuplicate={openCopy} onRenamed={goTo} onDeleted={back} onReload={refetch} onNew={newDoc} />} />
<FrappeConnections meta={bundle.meta} doc={doc} onOpenList={openList} onNew={newLinked} />`}>
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
