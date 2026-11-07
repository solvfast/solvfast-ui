/**
 * P35 list workstream — FrappeListView on a SIMULATED site (`createFixtureTransport`): workflow state in the indicator,
 * Assigned To / Tags grouping and filters, the group-by sidebar with server counts (SIMULATED `get_group_by_count` /
 * `get_sidebar_stats`), "Add {DocType}" gated by the create right, Desk's page lengths, "Select all matching", saved
 * filters with Is Global, the System-Manager menu entries and List Settings (SIMULATED `save_listview_settings`), plus
 * the Core card layout. Nothing here is evidence of real-site behaviour.
 */
import * as React from "react";
import { QueryClient } from "@tanstack/react-query";
import { Badge, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, ListView, type ColumnDef } from "@ui";
import { FrappeListView, FrappeProvider, createFrappeClient } from "@ui/frappe";
import { createFixtureTransport } from "../../../src/frappe/testing";
import { Example, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";
import { Picker, Readout } from "./frappe/shared";

const MEMO = {
  name: "Memo", autoname: "format:MEMO-{###}", title_field: "title", sort_field: "modified", sort_order: "desc",
  permissions: [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, export: 1, print: 1 }, { role: "Reader", permlevel: 0, read: 1 }],
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title", in_list_view: 1, reqd: 1 },
    { fieldname: "status", fieldtype: "Select", label: "Status", options: "Open\nClosed", in_list_view: 1, in_standard_filter: 1 },
    { fieldname: "amount", fieldtype: "Currency", label: "Amount" },
    { fieldname: "reviewer", fieldtype: "Link", label: "Reviewer", options: "User" },
    { fieldname: "workflow_state", fieldtype: "Link", label: "Workflow State", options: "Workflow State" },
  ],
};
const WF = {
  name: "Memo Approval", document_type: "Memo", workflow_state_field: "workflow_state", override_status: 0,
  states: [
    { state: "Pending", doc_status: "0", allow_edit: "System Manager", style: "Warning" },
    { state: "Approved", doc_status: "0", allow_edit: "System Manager", style: "Success" },
  ],
  transitions: [{ state: "Pending", action: "Approve", next_state: "Approved", allowed: "System Manager" }],
};
const USERS = [
  { doctype: "User", name: "ann@example.com", email: "ann@example.com", full_name: "Ann Lee", user_type: "System User", enabled: 1 },
  { doctype: "User", name: "bob@example.com", email: "bob@example.com", full_name: "Bob Ray", user_type: "System User", enabled: 1 },
  { doctype: "User", name: "Administrator", email: "admin@example.com", full_name: "Administrator", user_type: "System User", enabled: 1 },
];
const TAGS = ["", ",urgent", ",vip", ",urgent,vip"];
function createSite() {
  const memos = Array.from({ length: 64 }, (_, i) => ({
    doctype: "Memo", name: `MEMO-${String(i + 1).padStart(3, "0")}`, title: `Memo ${i + 1}`, status: i % 3 ? "Open" : "Closed", amount: (i + 1) * 25,
    owner: i % 2 ? "ann@example.com" : "bob@example.com", workflow_state: i % 4 ? "Pending" : "Approved", _user_tags: TAGS[i % 4],
    modified: `2026-10-${String((i % 28) + 1).padStart(2, "0")} 10:00:00.000000`,
  }));
  const todos = memos.slice(0, 20).map((m, i) => ({ doctype: "ToDo", name: `TD-${i + 1}`, status: "Open", allocated_to: i % 3 ? "ann@example.com" : "bob@example.com", reference_type: "Memo", reference_name: m.name, description: "Review" }));
  const transport = createFixtureTransport({
    meta: {
      Memo: [MEMO],
      ToDo: [{ name: "ToDo", autoname: "hash", permissions: [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1 }], fields: [
        { fieldname: "status", fieldtype: "Select", label: "Status", options: "Open\nClosed\nCancelled" },
        { fieldname: "allocated_to", fieldtype: "Link", label: "Allocated To", options: "User" },
        { fieldname: "description", fieldtype: "Text Editor", label: "Description" },
        { fieldname: "reference_type", fieldtype: "Link", label: "Reference Type", options: "DocType" },
        { fieldname: "reference_name", fieldtype: "Dynamic Link", label: "Reference Name", options: "reference_type" },
      ] }],
    },
    docs: { Memo: memos, ToDo: todos, User: USERS },
    workflows: { Memo: WF },
    user: "Administrator",
  } as never);
  return { transport, client: createFrappeClient({ transport, files: transport.files }), qc: new QueryClient({ defaultOptions: { queries: { retry: false } } }) };
}

const SESSION: Record<"admin" | "reader", { user: string; fullName: string; roles: string[] }> = {
  admin: { user: "Administrator", fullName: "Administrator", roles: ["System Manager"] },
  reader: { user: "ann@example.com", fullName: "Ann Lee", roles: ["Reader"] },
};

function NewMemoDialog({ open, onOpenChange, onCreated, client }: { open: boolean; onOpenChange(o: boolean): void; onCreated(doc: Record<string, unknown>): void; client: ReturnType<typeof createFrappeClient> }) {
  const [title, setTitle] = React.useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Memo (SIMULATED stand-in for a Quick Entry)</DialogTitle></DialogHeader>
        <Input aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <DialogFooter>
          <Button disabled={!title.trim()} onClick={async () => {
            const res = await client.call("frappe.client.insert", { doc: JSON.stringify({ doctype: "Memo", title: title.trim(), status: "Open", workflow_state: "Pending" }) });
            setTitle(""); onCreated((res.message ?? {}) as Record<string, unknown>);
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function P35ListPage() {
  const tr = useTr();
  const [session, setSession] = React.useState<keyof typeof SESSION>("admin");
  const [log, setLog] = React.useState<string[]>([]);
  const site = React.useMemo(createSite, [session]);
  const push = (s: string) => setLog((p) => [s, ...p].slice(0, 8));
  return (
    <div className="space-y-12">
      <Section title={l("Desk list features on a SIMULATED Memo site", "ميزات قائمة ديسك على موقع Memo محاكى")}
        description={l("Every server call below is answered by the in-page simulator (createFixtureTransport) — get_group_by_count, get_sidebar_stats and save_listview_settings are SIMULATED handlers that reproduce Frappe 15.110's response shapes. Nothing is verified on a real site.", "كل استدعاء للخادم هنا يجيب عنه المحاكي داخل الصفحة — get_group_by_count و get_sidebar_stats و save_listview_settings معالِجات محاكاة تعيد أشكال استجابات فرابيه 15.110. لا شيء مُتحقَّق منه على موقع حقيقي.")}>
        <div className="flex flex-wrap items-center gap-3">
          <Picker legend={l("Session", "الجلسة")} value={session} onChange={setSession} options={[
            { value: "admin", label: l("System Manager", "مدير النظام") }, { value: "reader", label: l("Reader (read only: no Add, no admin menu, no Is Global)", "قارئ (قراءة فقط)") },
          ]} />
          <Badge variant="warning">SIMULATED</Badge>
        </div>
        <Example className="p-0" code={`<FrappeListView doctype="Memo"
  sidebar                                  // Assigned To / Created By counts + tag stats, "Toggle Sidebar"
  groupByFields={["_assign", "_user_tags", "owner", "status"]}
  rowMeta                                  // indicator (workflow state from the DocType), tags, assignees
  create={{ render: (p) => <MyQuickEntry {...p} /> }}   // "Add Memo" only with the create right
  selectionMode="header" bulk={{}} selectAllMatching
  serverStorage={{ user }}                 // saved filters (Is Global for System Managers), page size
  onNavigate={(url) => router.push(url)} />  // User Permissions, Role Permissions Manager, Customize`}>
          <FrappeProvider client={site.client} queryClient={site.qc} session={SESSION[session]} key={session}>
            <div className="px-4 py-4 md:px-6">
              <FrappeListView doctype="Memo" sidebar groupByFields={["_assign", "_user_tags", "owner", "status"]} rowMeta like={false}
                create={{ render: (p) => <NewMemoDialog {...p} client={site.client} onCreated={(d) => { push(`created ${String(d.name ?? "")} → list reloaded`); p.onCreated(d); }} /> }}
                selectionMode="header" bulk={{}} selectAllMatching serverStorage={{ user: SESSION[session].user }}
                onNavigate={(url, entry) => push(`navigate (${entry}): ${url}`)} />
            </div>
          </FrappeProvider>
        </Example>
        <Readout label="events →">{log.length ? log.join("\n") : "—"}</Readout>
        <p className="text-xs text-muted-foreground">{tr(l("Try: click a name under Assigned To; Toggle Sidebar and List Settings in the ⋯ menu; 100 / 500 in the pager; check the page, then \"Select all … matching\" — only Export can act on all matching records (by the list's filters); every other Frappe bulk method takes document names.", "جرّب: انقر اسماً تحت «المُسند إليه»؛ «إظهار الشريط الجانبي» و«إعدادات القائمة» في القائمة ⋯؛ 100 / 500 في أسفل القائمة؛ حدّد الصفحة ثم «تحديد كل السجلات المطابقة» — التصدير وحده يعمل على كل السجلات المطابقة."))}</p>
      </Section>
      <CardsDemo />
    </div>
  );
}

type Row = { id: string; title: string; status: string; owner: string };
const ROWS: Row[] = Array.from({ length: 8 }, (_, i) => ({ id: `r${i + 1}`, title: `Task ${i + 1}`, status: i % 2 ? "Open" : "Done", owner: i % 3 ? "Ann" : "Bob" }));
const COLS: ColumnDef<Row>[] = [
  { key: "title", label: { en: "Title", ar: "العنوان" }, type: "text", mobile: "primary" },
  { key: "status", label: { en: "Status", ar: "الحالة" }, type: "select", options: [{ value: "Open", label: "Open" }, { value: "Done", label: "Done" }] },
  { key: "owner", label: { en: "Owner", ar: "المالك" }, type: "text" },
  { key: "id", label: "ID", mobile: false },
];
function CardsDemo() {
  const [layout, setLayout] = React.useState<"cards" | "auto" | "table">("cards");
  return (
    <Section title={l("Card layout for phones (Core ListView)", "تخطيط البطاقات للهواتف")} description={l("layout=\"cards\" draws one card per row (ColumnDef.mobile picks the title and hides columns); \"auto\" switches below 768 px. Selection, row click and groups work in both.", "layout=\"cards\" يرسم بطاقة لكل صف؛ \"auto\" يبدّل تحت 768 بكسل.")}>
      <Picker legend={l("Layout", "التخطيط")} value={layout} onChange={setLayout} options={[{ value: "cards", label: l("cards", "بطاقات") }, { value: "auto", label: l("auto", "تلقائي") }, { value: "table", label: l("table", "جدول") }]} />
      <Example code={`<ListView rows={rows} columns={columns} rowKey={(r) => r.id} layout="${layout}" selectable selectionMode="header" />`}>
        <div className="max-w-sm"><ListView<Row> rows={ROWS} columns={COLS} rowKey={(r) => r.id} layout={layout} selectable selectionMode="header" storage={null} pageSizes={[5, 20]} /></div>
      </Example>
    </Section>
  );
}
