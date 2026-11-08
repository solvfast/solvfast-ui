/**
 * P36b search — the header's global search (Desk's awesome bar + Global Search dialog) on a SIMULATED site
 * (`createFixtureTransport`, the simulated `frappe.utils.global_search.search`). Nothing here is evidence of real-site
 * behaviour: the ranking, the index and the permissions are the simulator's approximation.
 */
import * as React from "react";
import { GlobalSearchBar, Navbar } from "@ui";
import { FrappeProvider, createFrappeClient, useFrappeGlobalSearch, type DeskSearchBoot, type DeskSearchTarget, type DocTypeMeta } from "@ui/frappe";
import { createFixtureTransport } from "../../../src/frappe/testing";
import { Example, Section } from "../doc/Doc";
import { l } from "../i18n";
import { Picker, Readout } from "./frappe/shared";

const SM: NonNullable<DocTypeMeta["permissions"]>[number] = { role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, report: 1 };
const META: Record<string, DocTypeMeta[]> = {
  Contact: [{ name: "Contact", image_field: "image", permissions: [SM, { role: "Sales User", permlevel: 0, read: 1 }], fields: [
    { fieldname: "first_name", fieldtype: "Data", label: "First Name", in_global_search: 1 },
    { fieldname: "company_name", fieldtype: "Data", label: "Company Name", in_global_search: 1 },
    { fieldname: "image", fieldtype: "Attach Image", label: "Image" },
  ] }],
  Note: [{ name: "Note", permissions: [SM], fields: [{ fieldname: "title", fieldtype: "Data", label: "Title", in_global_search: 1 }] }],
  ToDo: [{ name: "ToDo", permissions: [SM], fields: [{ fieldname: "description", fieldtype: "Text Editor", label: "Description", in_global_search: 1 }] }],
};
const DOCS = {
  Contact: Array.from({ length: 26 }, (_, i) => ({ doctype: "Contact", name: `Acme Person ${i + 1}`, first_name: `Person ${i + 1}`, company_name: "Acme Ltd", image: "" })),
  Note: [{ doctype: "Note", name: "NOTE-0001", title: "Acme kickoff memo" }],
  ToDo: [{ doctype: "ToDo", name: "TODO-0001", description: "<p>Call <b>Acme</b> about the renewal</p>" }],
};
const BOOT: DeskSearchBoot = {
  can_read: ["Contact", "Note", "ToDo", "Customer", "System Settings"], can_create: ["Contact", "Customer"], can_search: ["Contact", "Note", "ToDo", "Customer"],
  can_get_report: ["Contact", "Customer"], single_types: ["System Settings"], all_reports: { "Contact Ledger": { report_type: "Script Report" } },
  page_info: { "user-profile": { title: "User Profile" } }, allowed_workspaces: [{ name: "CRM" }],
};

type Who = "admin" | "sales";

function Search({ onNavigate }: { onNavigate: (url: string, t: DeskSearchTarget & { newTab: boolean }) => void }) {
  return <GlobalSearchBar {...useFrappeGlobalSearch({ boot: BOOT, onNavigate })} />;
}

export function P36bSearchPage() {
  const [who, setWho] = React.useState<Who>("admin");
  const [log, setLog] = React.useState<string[]>([]);
  const transport = React.useMemo(() => createFixtureTransport({ meta: META, docs: DOCS }, who === "sales" ? { permissions: { user: "sales@example.com", roles: ["Sales User"] } } : {}), [who]);
  const client = React.useMemo(() => createFrappeClient({ transport }), [transport]);
  const [calls, setCalls] = React.useState("");
  React.useEffect(() => {
    const id = window.setInterval(() => setCalls(JSON.stringify(transport.store.calls.filter((c) => c.method.includes("global_search")).slice(-3).map((c) => c.args))), 500);
    return () => window.clearInterval(id);
  }, [transport]);
  return (
    <Section
      title={l("Global search (SIMULATED)", "البحث الشامل (محاكاة)")}
      description={l(
        "Desk's awesome bar (rows from the boot lists, Ctrl/⌘+G, Enter, ↑/↓) and its Global Search dialog over the SIMULATED frappe.utils.global_search.search: All Results (4 per DocType + More), a DocType's list (20 + More from the server), loading, empty and error. The Sales User can read Contact only, so Note and ToDo rows disappear (the server filters by DocType).",
        "شريط البحث في ديسك (من قوائم الإقلاع، Ctrl/⌘+G، Enter، ↑/↓) ونافذة البحث الشامل على frappe.utils.global_search.search المحاكى: كل النتائج (4 لكل نوع + المزيد)، قائمة النوع (20 + المزيد من الخادم)، التحميل والفراغ والخطأ. مستخدم المبيعات يقرأ جهات الاتصال فقط، فتختفي الملاحظات والمهام (الخادم يرشّح حسب النوع).",
      )}
    >
      <Picker legend={l("Simulated user", "المستخدم المحاكى")} value={who} onChange={(v) => { setWho(v); setLog([]); }} options={[
        { value: "admin", label: l("Administrator", "المسؤول") }, { value: "sales", label: l("Sales User (Contact only)", "مستخدم المبيعات (جهات الاتصال فقط)") },
      ]} />
      <Example title={l("In the Navbar — try \"acme\", \"cont\", \"new cont\", \"acme in cont\"", "في الشريط العلوي — جرّب acme و cont و new cont")}>
        <FrappeProvider client={client} key={who}>
          <div className="rounded-xl border">
            <Navbar
              title="CRM"
              showLanguageToggle={false}
              search={{ slot: <Search onNavigate={(url, t) => setLog((x) => [`${t.newTab ? "new tab " : ""}${url}`, ...x].slice(0, 5))} /> }}
            />
          </div>
        </FrappeProvider>
        <Readout label="onNavigate:">{log.join("\n") || "—"}</Readout>
        <Readout label="global_search.search args:">{calls || "—"}</Readout>
      </Example>
    </Section>
  );
}
