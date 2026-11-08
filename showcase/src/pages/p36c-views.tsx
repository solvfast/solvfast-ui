/**
 * P36c views — Desk's Actions on the checked cards of the IMAGE view (owner decision 5), on a SIMULATED site (in-browser
 * simulator: `bulkDemoBackend` + `bulkUpdateHandler`, src/frappe/testing/handlers/list.ts, with an `image_field` added
 * here so the DocType offers the Image view). Desk's ImageView extends ListView (image_view.js:6) and keeps its check
 * events and card checkboxes (:17-21, :113), so checking a card swaps "Add {DocType}" for the List view's Actions menu.
 * The server evaluates the session's permissions per document. Nothing here talks to a real site.
 */
import * as React from "react";
import { QueryClient } from "@tanstack/react-query";
import { Badge, Button, type ListViewType } from "@ui";
import { FrappeError, FrappeProvider, FrappeViews, createFrappeClient, type FrappeBulkOptions } from "@ui/frappe";
import { createFixtureTransport, type FixtureTransport } from "../../../src/frappe/testing";
import { BULK_UPDATE_METHOD, bulkDemoBackend, bulkUpdateHandler } from "../../../src/frappe/testing/handlers/list";
import type { FixtureBackend } from "../../../src/frappe/contract";
import { Example, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";
import { Picker, Readout } from "./frappe/shared";

type Role = "manager" | "submitter" | "user" | "workflow";
const ROLES: Record<Role, string[]> = { manager: ["Accounts Manager"], submitter: ["Submitter"], user: ["Accounts User"], workflow: ["Accounts Manager"] };
const COLORS = ["#2563eb", "#16a34a", "#d97706", "#db2777", "#7c3aed", "#0891b2"];
/** A small inline picture per invoice (no network); every third invoice has none (the initials placeholder). */
const picture = (n: number) => (n % 3 === 2 ? null
  : `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="${COLORS[n % COLORS.length]}"/><circle cx="20" cy="16" r="7" fill="#fff" opacity=".8"/><rect x="9" y="26" width="22" height="6" rx="3" fill="#fff" opacity=".8"/></svg>`)}`);

/** `bulkDemoBackend` with an Attach Image field set as the DocType's `image_field` (so the Image view is available). */
function imageBackend(workflow: boolean): FixtureBackend {
  const b = bulkDemoBackend({ workflow }) as unknown as { meta: Record<string, Array<Record<string, unknown>>>; docs: Record<string, Array<Record<string, unknown>>> };
  const inv = b.meta["Demo Invoice"][0];
  inv.image_field = "photo";
  inv.fields = [...(inv.fields as unknown[]), { fieldname: "photo", fieldtype: "Attach Image", label: "Photo" }];
  b.docs["Demo Invoice"] = b.docs["Demo Invoice"].map((d, i) => ({ ...d, photo: picture(i + 1) }));
  return b as unknown as FixtureBackend;
}

function createSite(role: Role) {
  // eslint-disable-next-line prefer-const
  let transport: FixtureTransport;
  transport = createFixtureTransport(imageBackend(role === "workflow"), {
    permissions: { user: "accounts@example.com", roles: ROLES[role] },
    handlers: { [BULK_UPDATE_METHOD]: bulkUpdateHandler(() => transport) },
  });
  return { transport, client: createFrappeClient({ transport, files: transport.files }), qc: new QueryClient({ defaultOptions: { queries: { retry: false } } }) };
}

export function P36cViewsPage() {
  const tr = useTr();
  const [role, setRole] = React.useState<Role>("manager");
  const [view, setView] = React.useState<ListViewType>("image");
  const [round, setRound] = React.useState(0);
  const [log, setLog] = React.useState<string[]>([]);
  const site = React.useMemo(() => createSite(role), [role, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const session = site.transport.store.session!;
  const push = (s: string) => setLog((p) => [s, ...p].slice(0, 10));
  const bulk: FrappeBulkOptions = {
    onDone: (kind, outcome, names, action) => push(`${action ?? kind} (${names.length} documents): ${outcome.queued ? "queued (no answer)" : outcome.silent ? "no per-document answer" : outcome.failed.length ? `failed: ${outcome.failed.join(", ")}` : "failed: []"}`),
    onError: (e, kind) => push(`${kind} refused: ${e instanceof FrappeError ? `${e.status} ${e.excType ?? ""} ${e.message}` : String(e)}`),
  };
  const add = <Button size="sm" onClick={() => push("Add Demo Invoice (the host's primary action)")}>{tr(l("Add Demo Invoice", "إضافة فاتورة تجريبية"))}</Button>;
  return (
    <div className="space-y-12">
      <Section title={l("Actions in the Image view (SIMULATED)", "الإجراءات في عرض الصور (محاكاة)")}
        description={l("Desk's Image view is a List view (image_view.js:6) with a checkbox on every card (:113). Checking a card replaces “Add Demo Invoice” with the List view's Actions menu — the same items, rights, lifecycle rules and outcomes (Edit, Export, Assign To, Clear Assignment, Apply Assignment Rule, Add Tags, Print, Submit, Cancel, Delete, lifecycle actions). The strip above the cards shows the count, Clear and select-all (the List view's header; Desk's Image view has no header row). Submit / Cancel clear the selection only when every document went through. Customer 7 and 14 miss their mandatory customer; INV-0005 is linked from a submitted payment.", "عرض الصور في ديسك هو عرض قائمة مع مربع اختيار على كل بطاقة. عند تحديد بطاقة تحل قائمة الإجراءات محل «إضافة فاتورة تجريبية» — بالبنود والصلاحيات وقواعد دورة الحياة والنتائج نفسها التي في عرض القائمة. يعرض الشريط فوق البطاقات العدد والمسح وتحديد الكل. لا يُلغى التحديد بعد الإرسال / الإلغاء إلا إذا نجحت كل المستندات.")}>
        <div className="flex flex-wrap items-center gap-3">
          <Picker legend={l("Session", "الجلسة")} value={role} onChange={(v) => { setRole(v); setLog([]); }} options={[
            { value: "manager", label: l("Accounts Manager (submit + cancel)", "مدير الحسابات (إرسال + إلغاء)") },
            { value: "submitter", label: l("Submitter (no cancel)", "مُرسِل (بلا إلغاء)") },
            { value: "user", label: l("Accounts User (neither)", "مستخدم الحسابات (لا هذا ولا ذاك)") },
            { value: "workflow", label: l("Lifecycle active", "دورة حياة نشطة") },
          ]} />
          <Button size="sm" variant="outline" onClick={() => { setRound((r) => r + 1); setLog([]); }}>{tr(l("Reset data", "إعادة البيانات"))}</Button>
          <Badge variant="warning">SIMULATED</Badge>
        </div>
        <Example className="p-0" code={`<FrappeViews doctype="Demo Invoice" view={view} onViewChange={setView} bulk={bulk}
  image={{ primaryAction: <Button>Add Demo Invoice</Button> }} />`}>
          <FrappeProvider client={site.client} queryClient={site.qc} session={{ user: session.user, fullName: session.fullName, roles: session.roles }} key={`${role}:${round}`}>
            <div className="px-4 py-4 md:px-6">
              <FrappeViews doctype="Demo Invoice" view={view} onViewChange={setView} bulk={bulk} image={{ primaryAction: add }} list={{ rowMeta: false, like: false }} report={{ primaryAction: add }} />
            </div>
          </FrappeProvider>
        </Example>
        <Readout label="server →">{log.length ? log.join("\n") : "—"}</Readout>
      </Section>
    </div>
  );
}
