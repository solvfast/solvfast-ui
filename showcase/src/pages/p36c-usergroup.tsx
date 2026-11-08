/**
 * P36c usergroup — Desk's "Assign To User Group" (Frappe 15.110 form/sidebar/assign_to.js:142-160, 191-197) in the form
 * sidebar's "Add to ToDo" dialog, on the SIMULATED site (createFixtureTransport + withSimulatedSidebar + userGroupFixture,
 * src/frappe/testing/handlers/sidebar.ts), and the Frappe-free AssignDialog `groups` source. Nothing here ran on a real site.
 */
import * as React from "react";
import { QueryClient } from "@tanstack/react-query";
import { AssignDialog, Button } from "@ui";
import { FrappeFormSidebar, FrappeProvider, createFrappeClient } from "@ui/frappe";
import { REAL_META, TRAVEL, TRAVEL_COMPANION, TRAVELS, userDocs, T } from "../../../playground/src/demo/sim-site";
import { createFixtureTransport } from "../../../src/frappe/testing";
import { userGroupFixture, withSimulatedSidebar } from "../../../src/frappe/testing/handlers/sidebar";
import { Example, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";
import { DEMO_USER_GROUPS } from "./frappe/user-groups-demo";
import { Picker, Readout, SessionBadge, SimulatedPermissionStrip, StatusStrip, sessionPermissions, SESSIONS, type SessionKey } from "./frappe/shared";

const METHODS = ["frappe.desk.search.search_link", "frappe.desk.reportview.get_list", "frappe.desk.form.assign_to.add"];
type Perms = "native" | "noDeskRead";

function useUserGroupSite(session: SessionKey, perms: Perms) {
  return React.useMemo(() => {
    const ug = userGroupFixture(DEMO_USER_GROUPS, { stamp: T, ...(perms === "noDeskRead" ? { permissions: [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1 }] } : {}) });
    const base = createFixtureTransport({
      meta: { ...REAL_META, "Travel Request": [TRAVEL, TRAVEL_COMPANION], ...ug.meta },
      docs: { User: userDocs, "Travel Request": TRAVELS, ...ug.docs },
    }, { permissions: sessionPermissions(session) });
    const transport = withSimulatedSidebar(base);
    return { transport, client: createFrappeClient({ transport, files: transport.files }), qc: new QueryClient({ defaultOptions: { queries: { retry: false } } }) };
  }, [session, perms]);
}

function RequestLog({ transport }: { transport: ReturnType<typeof useUserGroupSite>["transport"] }) {
  const [, tick] = React.useState(0);
  React.useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 600); return () => clearInterval(id); }, []);
  const rows = transport.store.calls.filter((c) => METHODS.includes(c.method)).slice(-6).reverse();
  return <Readout label="SIMULATED requests (newest first):">{rows.length ? rows.map((c) => `${c.method} ${JSON.stringify(c.args)}`).join("\n") : "—"}</Readout>;
}

const CORE_USERS = [{ id: "a@x.com", label: "Amal" }, { id: "b@x.com", label: "Badr" }, { id: "c@x.com", label: "Chadi" }, { id: "d@x.com", label: "دانة" }];
const CORE_GROUPS: Record<string, string[]> = { Support: ["a@x.com", "c@x.com"], "فريق المبيعات": ["b@x.com", "d@x.com"] };

export function UserGroupAssignPage() {
  const tr = useTr();
  const [session, setSession] = React.useState<SessionKey>("admin");
  const [perms, setPerms] = React.useState<Perms>("native");
  const site = useUserGroupSite(session, perms);
  const s = site.transport.store.session ?? SESSIONS[session];
  const [open, setOpen] = React.useState(false);
  const [last, setLast] = React.useState("—");
  return (
    <div className="space-y-12">
      <StatusStrip parts={[["AssignDialog groups", "generic"], ["FrappeAssignTo layout=sidebar · FrappeBulkActions dialog · userGroupSource", "simulated"]]} note={l(
        "SIMULATED backend operations: the User Group search, the members read (frappe.desk.reportview.get_list on User Group Member) and assign_to.add are answered by the in-browser simulator. Nothing on this page ran against a real Frappe site.",
        "عمليات خلفية محاكاة: البحث في مجموعات المستخدمين وقراءة الأعضاء (frappe.desk.reportview.get_list على User Group Member) و assign_to.add يجيب عنها المحاكي داخل المتصفّح. لم يُشغَّل شيء في هذه الصفحة على موقع فرابيه حقيقي.")} />
      <Section title={l("Assign To User Group in Add to ToDo", "الإسناد إلى مجموعة مستخدمين في «إضافة إلى المهام»")}
        description={l("Open Add to ToDo and pick a group: as in Desk, its members REPLACE the users to assign (Assign to me is unticked unless you are a member), at most 20 members are read, a duplicate row is listed once, an empty group empties the list. “No Desk User read” is a site whose User Group permissions were narrowed: the search is refused and the refusal is shown.",
          "افتح «إضافة إلى المهام» واختر مجموعة: كما في ديسك، يحلّ أعضاؤها محلّ المستخدمين المختارين (يُلغى «أسنِد إليّ» ما لم تكن عضوًا)، وتُقرأ 20 عضوًا كحدّ أقصى، ويظهر الصف المكرر مرة واحدة، والمجموعة الفارغة تُفرغ القائمة. «بلا قراءة لـ Desk User» موقع ضُيّقت فيه صلاحيات مجموعات المستخدمين: يُرفض البحث ويظهر الرفض.")}>
        <SimulatedPermissionStrip />
        <Picker legend={l("Session", "الجلسة")} value={session} onChange={setSession}
          options={[{ value: "admin", label: l("System Manager", "مدير النظام") }, { value: "sales", label: l("Sales User", "مستخدم المبيعات") }]} />
        <Picker legend={l("User Group permissions", "صلاحيات مجموعات المستخدمين")} value={perms} onChange={setPerms}
          options={[{ value: "native", label: l("Native (Desk User reads)", "الأصلية (Desk User يقرأ)") }, { value: "noDeskRead", label: l("No Desk User read", "بلا قراءة لـ Desk User") }]} />
        <SessionBadge session={session} />
        <Example code={`<FrappeFormSidebar doctype="Travel Request" name="TR-0001" sections={["assign"]} />
// the dialog's group field: FrappeAssignTo userGroups (default on in the sidebar layout)`}>
          <FrappeProvider key={`${session}-${perms}`} client={site.client} queryClient={site.qc} session={{ user: s.user, fullName: s.fullName, roles: s.roles }}>
            <div className="max-w-xs"><FrappeFormSidebar doctype="Travel Request" name="TR-0001" sections={["assign"]} /></div>
          </FrappeProvider>
        </Example>
        <RequestLog transport={site.transport} />
      </Section>
      <Section title={l("The Core slot, without Frappe", "المنفذ الأساسي بلا فرابيه")}
        description={l("AssignDialog takes a `groups` source: a search and a members read. Here the host keeps the groups in memory.",
          "يأخذ AssignDialog مصدر `groups`: بحثًا وقراءةً للأعضاء. هنا يحفظ المضيف المجموعات في الذاكرة.")}>
        <Example code={`<AssignDialog open onOpenChange searchUsers onAssign me details
  groups={{ search: async (txt) => groups.filter(…), members: async (g) => membersOf(g) }} />`}>
          <div className="space-y-2">
            <Button type="button" variant="outline" onClick={() => setOpen(true)}>{tr(l("Open Assign To", "افتح الإسناد"))}</Button>
            <AssignDialog open={open} onOpenChange={setOpen} details me={CORE_USERS[0]}
              searchUsers={async (q) => CORE_USERS.filter((u) => u.label.toLowerCase().includes(q.toLowerCase()))}
              onAssign={(users) => { setLast(users.map((u) => u.label).join(", ")); }}
              groups={{
                search: async (q) => Object.keys(CORE_GROUPS).filter((g) => g.toLowerCase().includes(q.toLowerCase())).map((value) => ({ value })),
                members: async (g) => (CORE_GROUPS[g] ?? []).map((id) => CORE_USERS.find((u) => u.id === id)!),
              }} />
            <Readout label={tr(l("Last assignment:", "آخر إسناد:"))}>{last}</Readout>
          </div>
        </Example>
      </Section>
    </div>
  );
}
