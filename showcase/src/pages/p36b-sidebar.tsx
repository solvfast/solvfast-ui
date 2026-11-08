/**
 * P36b sidebar — Desk's Form Sidebar (Frappe 15.110 form/sidebar/*.js, form_sidebar.html) on the SIMULATED site:
 * Assigned To, Attachments (upload / Library / Link / remove), Tags, the Share / Likes / Comments slots, created /
 * modified. Every server answer is the in-browser simulator's (createFixtureTransport + withSimulatedSidebar,
 * src/frappe/testing/handlers/sidebar.ts); permission decisions are its approximation. Nothing here ran on a real site.
 */
import * as React from "react";
import { QueryClient } from "@tanstack/react-query";
import { Badge, FormSidebar, AttachmentList, TagList } from "@ui";
import { FrappeFormSidebar, FrappeProvider, createFrappeClient, type FrappeDoc } from "@ui/frappe";
import { REAL_META, TRAVEL, TRAVEL_COMPANION, TRAVELS, userDocs, T } from "../../../playground/src/demo/sim-site";
import { createFixtureTransport } from "../../../src/frappe/testing";
import { withSimulatedSidebar } from "../../../src/frappe/testing/handlers/sidebar";
import { Example, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";
import { Picker, Readout, SessionBadge, SimulatedPermissionStrip, StatusStrip, sessionPermissions, SESSIONS, type SessionKey } from "./frappe/shared";

const SIDEBAR_METHODS = ["upload_file", "frappe.desk.form.utils.remove_attach", "frappe.core.api.file.get_files_by_search_text", "frappe.desk.doctype.tag.tag.add_tag",
  "frappe.desk.doctype.tag.tag.remove_tag", "frappe.desk.doctype.tag.tag.get_tags", "frappe.desk.form.assign_to.add", "frappe.desk.form.assign_to.remove",
  "frappe.desk.form.assign_to.close", "frappe.desk.form.load.getdoc", "frappe.desk.form.load.get_docinfo"];

function useSidebarSite(session: SessionKey) {
  return React.useMemo(() => {
    const base = createFixtureTransport({
      meta: { ...REAL_META, "Travel Request": [{ ...TRAVEL, max_attachments: 6 }, TRAVEL_COMPANION] },
      docs: {
        User: userDocs, ToDo: [],
        "Travel Request": TRAVELS.map((d) => (d.name === "TR-0001" ? { ...d, _user_tags: ",offsite,finance" } : d)),
        File: [
          { doctype: "File", name: "FILE-001", file_name: "itinerary.pdf", file_url: "/private/files/itinerary.pdf", is_private: 1, attached_to_doctype: "Travel Request", attached_to_name: "TR-0001", owner: "Administrator", modified: T, creation: T },
          { doctype: "File", name: "FILE-002", file_name: "hotel-quote.xlsx", file_url: "/files/hotel-quote.xlsx", is_private: 0, attached_to_doctype: "Travel Request", attached_to_name: "TR-0001", owner: "Administrator", modified: T, creation: T },
          { doctype: "File", name: "FILE-LIB", file_name: "travel-policy-2026.pdf", file_url: "/files/travel-policy-2026.pdf", is_private: 0, owner: "Administrator", modified: T, creation: T },
        ] as FrappeDoc[],
        Tag: ["offsite", "finance", "visa", "urgent", "عاجل"].map((name) => ({ doctype: "Tag", name, modified: T, creation: T })) as FrappeDoc[],
      },
    }, { permissions: sessionPermissions(session) });
    const transport = withSimulatedSidebar(base);
    void transport("frappe.desk.form.assign_to.add", { doctype: "Travel Request", name: "TR-0001", assign_to: JSON.stringify(["khaled@example.com"]), description: "Book the hotel" }).catch(() => {});
    return { transport, client: createFrappeClient({ transport, files: transport.files }), qc: new QueryClient({ defaultOptions: { queries: { retry: false } } }) };
  }, [session]);
}

function RequestLog({ transport }: { transport: ReturnType<typeof useSidebarSite>["transport"] }) {
  const [, tick] = React.useState(0);
  React.useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 600); return () => clearInterval(id); }, []);
  const rows = transport.store.calls.filter((c) => SIDEBAR_METHODS.includes(c.method)).slice(-8).reverse();
  return <Readout label="SIMULATED requests (newest first):">{rows.length ? rows.map((c) => `${c.method} ${JSON.stringify(c.args)}`).join("\n") : "—"}</Readout>;
}

function Slot({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-dashed border-border px-2 py-1.5 text-[11px] text-muted-foreground">{children}</div>;
}

export function FormSidebarPage() {
  const tr = useTr();
  const [session, setSession] = React.useState<SessionKey>("admin");
  const site = useSidebarSite(session);
  const s = site.transport.store.session ?? SESSIONS[session];
  const [tags, setTags] = React.useState(["design", "تصميم"]);
  return (
    <div className="space-y-12">
      <StatusStrip parts={[
        ["FormSidebar · SidebarSection · AttachmentList · AttachDialog · TagList", "generic"],
        ["FrappeFormSidebar · FrappeAssignTo layout=sidebar · FrappeAttachments · FrappeDocTags", "simulated"],
      ]} note={l(
        "SIMULATED backend operations: assignments, uploads (only the File row is kept — no bytes), library / link attachments, removals and tags are answered by the in-browser simulator. Nothing on this page ran against a real Frappe site.",
        "عمليات خلفية محاكاة: الإسنادات والرفع (يُحفظ صف File فقط بلا محتوى) والإرفاق من المكتبة أو الرابط والحذف والوسوم يجيب عنها المحاكي داخل المتصفّح. لم يُشغَّل شيء في هذه الصفحة على موقع فرابيه حقيقي.")} />
      <Section title={l("Form Sidebar on a Travel Request", "الشريط الجانبي لنموذج طلب السفر")}
        description={l("Desk's order: Assigned To → Attachments → Tags → Share → likes · comments → last edited / created. Switch the session: Data Entry may write (attach, tag, remove); Sales User only reads — no Attach, no tag editing, no removal of other people's assignments, and the simulated server refuses those requests anyway. Share, Likes and Comments are slots filled by the social workstream.",
          "ترتيب ديسك: مُسنَد إلى ← المرفقات ← الوسوم ← المشاركة ← الإعجابات · التعليقات ← آخر تعديل / الإنشاء. بدّل الجلسة: إدخال البيانات يملك الكتابة (إرفاق ووسم وحذف)؛ ومستخدم المبيعات للقراءة فقط — لا إرفاق ولا تعديل للوسوم ولا إزالة لإسنادات الآخرين، والخادم المحاكى يرفض تلك الطلبات على أي حال. المشاركة والإعجابات والتعليقات منافذ يملؤها مسار العمل الاجتماعي.")}>
        <SimulatedPermissionStrip />
        <Picker legend={l("Session", "الجلسة")} value={session} onChange={setSession}
          options={[{ value: "admin", label: l("System Manager", "مدير النظام") }, { value: "dataEntry", label: l("Data Entry", "إدخال البيانات") }, { value: "sales", label: l("Sales User", "مستخدم المبيعات") }]} />
        <SessionBadge session={session} />
        <Example code={`<FrappeFormSidebar doctype="Travel Request" name="TR-0001"
  share={<FrappeSidebarShare … />} likes={<FrappeSidebarLikes … />} comments={<FrappeComments … />} />`}>
          <FrappeProvider key={session} client={site.client} queryClient={site.qc} session={{ user: s.user, fullName: s.fullName, roles: s.roles }}>
            <div className="max-w-xs">
              <FrappeFormSidebar doctype="Travel Request" name="TR-0001"
                share={<Slot>{tr(l("Share — slot (social workstream)", "المشاركة — منفذ (مسار العمل الاجتماعي)"))}</Slot>}
                likes={<Badge variant="outline">♥ {tr(l("slot", "منفذ"))}</Badge>}
                comments={<Slot>{tr(l("Comments — slot (social workstream)", "التعليقات — منفذ (مسار العمل الاجتماعي)"))}</Slot>} />
            </div>
          </FrappeProvider>
        </Example>
        <RequestLog transport={site.transport} />
      </Section>
      <Section title={l("The Core parts, without Frappe", "الأجزاء الأساسية بلا فرابيه")}
        description={l("FormSidebar lays out what the host passes, in Desk's order; AttachmentList and TagList are the sections' bodies. Here the host keeps everything in memory.",
          "يرتّب FormSidebar ما يمرّره المضيف بترتيب ديسك؛ و AttachmentList و TagList هما محتوى الأقسام. هنا يحفظ المضيف كل شيء في الذاكرة.")}>
        <Example code={`<FormSidebar attachments={<AttachmentList items={files} />} tags={<TagList tags={tags} onAdd={…} onRemove={…} />} commentCount={2}
  created={{ name: "Sara Q", at }} modified={{ name: "Omar Q", isYou: true, at }} />`}>
          <div className="max-w-xs">
            <FormSidebar
              attachments={<AttachmentList items={[{ id: "1", fileName: "brief.pdf", fileUrl: "#", isPrivate: true }, { id: "2", fileName: "مخطط.png", fileUrl: "#", isPrivate: false }]} />}
              tags={<TagList tags={tags} adding onAdd={async (t) => setTags((x) => [...x, t])} onRemove={async (t) => setTags((x) => x.filter((y) => y !== t))} />}
              commentCount={2} created={{ name: "Sara Q", at: Date.now() - 3 * 86400000 }} modified={{ name: "Omar Q", isYou: true, at: Date.now() - 2 * 3600000 }} />
          </div>
        </Example>
      </Section>
    </div>
  );
}
