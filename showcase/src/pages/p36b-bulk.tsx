/**
 * P36b bulk — Desk's bulk Submit / Cancel on the checked records of the List AND Report views, on a SIMULATED site
 * (in-browser simulator: `bulkDemoBackend` + `bulkUpdateHandler`, src/frappe/testing/handlers/list.ts, which follows
 * bulk_update.py:51-114). The server evaluates the session's permissions per document. Nothing here talks to a real site.
 */
import * as React from "react";
import { QueryClient } from "@tanstack/react-query";
import { Badge, Button, type ListViewType } from "@ui";
import { FrappeError, FrappeProvider, FrappeViews, createFrappeClient, type FrappeBulkOptions } from "@ui/frappe";
import { createFixtureTransport, type FixtureTransport } from "../../../src/frappe/testing";
import { BULK_UPDATE_METHOD, bulkDemoBackend, bulkUpdateHandler } from "../../../src/frappe/testing/handlers/list";
import { Example, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";
import { Picker, Readout } from "./frappe/shared";

type Role = "manager" | "submitter" | "user" | "workflow";
const ROLES: Record<Role, string[]> = { manager: ["Accounts Manager"], submitter: ["Submitter"], user: ["Accounts User"], workflow: ["Accounts Manager"] };

function createSite(role: Role) {
  // eslint-disable-next-line prefer-const
  let transport: FixtureTransport;
  transport = createFixtureTransport(bulkDemoBackend({ workflow: role === "workflow" }), {
    permissions: { user: "accounts@example.com", roles: ROLES[role] },
    handlers: { [BULK_UPDATE_METHOD]: bulkUpdateHandler(() => transport) },
  });
  return { transport, client: createFrappeClient({ transport }), qc: new QueryClient({ defaultOptions: { queries: { retry: false } } }) };
}

export function P36bBulkPage() {
  const tr = useTr();
  const [role, setRole] = React.useState<Role>("manager");
  const [view, setView] = React.useState<ListViewType>("report");
  const [round, setRound] = React.useState(0);
  const [log, setLog] = React.useState<string[]>([]);
  const site = React.useMemo(() => createSite(role), [role, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const session = site.transport.store.session!;
  const push = (s: string) => setLog((p) => [s, ...p].slice(0, 10));
  const bulk: FrappeBulkOptions = {
    onDone: (kind, outcome, names, action) => push(`${action ?? kind} → ${BULK_UPDATE_METHOD.split(".").pop()}(${names.length} names): ${outcome.queued ? "queued (no answer)" : outcome.failed.length ? `failed: ${outcome.failed.join(", ")}` : "failed: []"}`),
    onError: (e, kind) => push(`${kind} refused: ${e instanceof FrappeError ? `${e.status} ${e.excType ?? ""} ${e.message}` : String(e)}`),
  };
  return (
    <div className="space-y-12">
      <Section title={l("Bulk Submit / Cancel in the List and Report views (SIMULATED)", "الإرسال والإلغاء الجماعي في عرضي القائمة والتقرير (محاكاة)")}
        description={l("Desk's Report view extends the List view and keeps its Actions menu (report_view.js:9), so both offer Submit and Cancel for a submittable DocType — only with the submit / cancel right and never under an active Workflow (list_view.js:2108-2120). Every checked name is sent; the server submits drafts only and cancels submitted documents only, and answers the names it could not process. The selection is cleared only when every document went through; the list then reloads from the server. 20 names or more are queued by the server. INV-0007 / INV-0014 miss their mandatory customer; INV-0005 is linked from a submitted payment.", "يرث عرض التقرير في ديسك عرض القائمة ويحتفظ بقائمة الإجراءات، فيعرض كلاهما الإرسال والإلغاء لنوع مستند قابل للإرسال — فقط مع صلاحية الإرسال / الإلغاء وليس أثناء سير عمل نشط. تُرسَل كل الأسماء المحدّدة؛ يرسل الخادم المسودات فقط ويلغي المستندات المُرسَلة فقط، ويعيد أسماء ما تعذّرت معالجته. لا يُلغى التحديد إلا إذا نجحت كل المستندات؛ ثم تُعاد القائمة من الخادم. عشرون اسماً أو أكثر يضعها الخادم في قائمة الانتظار.")}>
        <div className="flex flex-wrap items-center gap-3">
          <Picker legend={l("Session", "الجلسة")} value={role} onChange={(v) => { setRole(v); setLog([]); }} options={[
            { value: "manager", label: l("Accounts Manager (submit + cancel)", "مدير الحسابات (إرسال + إلغاء)") },
            { value: "submitter", label: l("Submitter (no cancel)", "مُرسِل (بلا إلغاء)") },
            { value: "user", label: l("Accounts User (neither)", "مستخدم الحسابات (لا هذا ولا ذاك)") },
            { value: "workflow", label: l("Workflow active", "سير عمل نشط") },
          ]} />
          <Button size="sm" variant="outline" onClick={() => { setRound((r) => r + 1); setLog([]); }}>{tr(l("Reset data", "إعادة البيانات"))}</Button>
          <Badge variant="warning">SIMULATED</Badge>
        </div>
        <Example className="p-0" code={`<FrappeViews doctype="Demo Invoice" view={view} onViewChange={setView}
  bulk={{ onDone: (kind, outcome, names) => log(kind, outcome.failed, outcome.queued) }} />`}>
          <FrappeProvider client={site.client} queryClient={site.qc} session={{ user: session.user, fullName: session.fullName, roles: session.roles }} key={`${role}:${round}`}>
            <div className="px-4 py-4 md:px-6">
              <FrappeViews doctype="Demo Invoice" view={view} onViewChange={setView} bulk={bulk} list={{ rowMeta: false, like: false }} />
            </div>
          </FrappeProvider>
        </Example>
        <Readout label="server →">{log.length ? log.join("\n") : "—"}</Readout>
      </Section>
    </div>
  );
}
