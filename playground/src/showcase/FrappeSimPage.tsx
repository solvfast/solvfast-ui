/**
 * Stage B visual matrix page (A6): the 0.4.0 Frappe components over the SIMULATED backend (`createFixtureTransport`) with
 * the REAL 15.110 metadata (tests/fixtures/real-15.110). Everything on it is Simulated; nothing is evidence of Frappe behaviour.
 * `?view=frappe-sim&c=<scenario>`; direction override `&dir=ltr|rtl` (host direction different from the UI language).
 * Playground only.
 */
import * as React from "react";
import { QueryClient } from "@tanstack/react-query";
import { useLocale } from "@ui";
import {
  FrappeAssignTo, FrappeForm, FrappeListView, FrappeProvider, FrappeTimeline, FrappeWorkflowActions, createFrappeClient, toFrappeError,
  type DocPerm, type DocTypeMeta, type FrappeDoc, type WorkflowInfo,
} from "@ui/frappe";
import { createFixtureTransport, type FixtureHandler } from "../../../src/frappe/testing";
import todoEn from "../../../tests/fixtures/real-15.110/todo.en.json";
import userEn from "../../../tests/fixtures/real-15.110/user.en.json";
import contactEn from "../../../tests/fixtures/real-15.110/contact.en.json";

const docsOf = (x: unknown) => (x as { docs: DocTypeMeta[] }).docs;
const SM: DocPerm = { role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1, amend: 1, select: 1, report: 1, export: 1, print: 1, email: 1, share: 1 };
const MEMO: DocTypeMeta = {
  name: "Approval Memo", is_submittable: 1, autoname: "hash", title_field: "title", track_changes: 1, permissions: [SM],
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title", reqd: 1, in_list_view: 1 },
    { fieldname: "amount", fieldtype: "Currency", label: "Amount", in_list_view: 1 },
    { fieldname: "notes", fieldtype: "Small Text", label: "Notes", allow_on_submit: 1 },
    { fieldname: "workflow_state", fieldtype: "Link", label: "Workflow State", options: "Workflow State", hidden: 1 },
    { fieldname: "amended_from", fieldtype: "Link", label: "Amended From", options: "Approval Memo", read_only: 1, no_copy: 1 },
  ],
};
const WF: WorkflowInfo = {
  name: "Approval Flow", document_type: "Approval Memo", workflow_state_field: "workflow_state",
  states: [
    { state: "Draft", doc_status: "0", allow_edit: "System Manager", style: "Warning" },
    { state: "Pending", doc_status: "0", allow_edit: "System Manager", style: "Primary" },
    { state: "Approved", doc_status: "1", allow_edit: "System Manager", style: "Success" },
  ],
  transitions: [
    { state: "Draft", action: "Request Approval", next_state: "Pending", allowed: "System Manager", allow_self_approval: 1 },
    { state: "Pending", action: "Approve", next_state: "Approved", allowed: "System Manager", allow_self_approval: 1 },
    { state: "Pending", action: "Reject", next_state: "Draft", allowed: "System Manager", allow_self_approval: 1 },
  ],
};
const T = "2026-11-02 09:00:00.000000";
const users = ["sara@example.com", "khaled@example.com", "omar@example.com", "lina@example.com"];
const TASKS = ["Confirm hotel block for the Riyadh offsite", "Review visa documents for the Jeddah team", "Call the airline about group fares", "Update the corporate travel policy", "Approve expense report", "Prepare the quarterly booking summary", "Renew the travel insurance contract", "Collect passport copies", "Send the itinerary to the client", "Follow up on the refund", "Book meeting rooms for the workshop", "Renew the long Arabic-English mixed title: مراجعة العقد with Acme-Corp-INTL-00012 before the end of the quarter"];
const todos = (n: number): FrappeDoc[] => Array.from({ length: n }, (_, i) => ({
  doctype: "ToDo", name: `TD-${String(i + 1).padStart(4, "0")}`, description: `<p>${TASKS[i % TASKS.length]}</p>`, status: ["Open", "Closed", "Cancelled"][i % 3], priority: ["High", "Medium", "Low"][i % 3],
  date: `2026-11-${String((i % 27) + 1).padStart(2, "0")}`, allocated_to: users[i % 4], assigned_by: users[(i + 1) % 4], owner: users[i % 4], modified: `2026-11-02 ${String(8 + (i % 10)).padStart(2, "0")}:00:00.000000`, creation: T, _assign: JSON.stringify([users[i % 4]]),
})) as FrappeDoc[];
const userDocs = users.map((u) => ({ doctype: "User", name: u, email: u, full_name: u.split("@")[0].replace(/^./, (c) => c.toUpperCase()) + " Q", first_name: u.split("@")[0], enabled: 1, user_type: "System User" })) as FrappeDoc[];

const CONTACT: FrappeDoc = {
  doctype: "Contact", name: "Sara Al-Otaibi", first_name: "Sara", last_name: "Al-Otaibi", full_name: "Sara Al-Otaibi", company_name: "Acme Travel", designation: "Operations Manager", status: "Passive",
  email_id: "sara@example.com", owner: "Administrator", modified: T, creation: T, docstatus: 0,
  email_ids: [{ doctype: "Contact Email", name: "ce1", idx: 1, email_id: "sara@example.com", is_primary: 1, parent: "Sara Al-Otaibi", parentfield: "email_ids", parenttype: "Contact" }, { doctype: "Contact Email", name: "ce2", idx: 2, email_id: "sara.alotaibi@very-long-company-domain-name.example.com", is_primary: 0, parent: "Sara Al-Otaibi", parentfield: "email_ids", parenttype: "Contact" }],
  phone_nos: [{ doctype: "Contact Phone", name: "cp1", idx: 1, phone: "+966 50 123 4567", is_primary_phone: 1, parent: "Sara Al-Otaibi", parentfield: "phone_nos", parenttype: "Contact" }],
  links: [{ doctype: "Dynamic Link", name: "dl1", idx: 1, link_doctype: "User", link_name: "sara@example.com", parent: "Sara Al-Otaibi", parentfield: "links", parenttype: "Contact" }],
} as FrappeDoc;

const fail = (status: number, exc_type: string, message: string): FixtureHandler => () => { throw toFrappeError(status, { exc_type, _server_messages: JSON.stringify([JSON.stringify({ message, indicator: "red" })]) }); };

export function FrappeSimPage() {
  const params = new URLSearchParams(location.search);
  const c = params.get("c") ?? "form-contact";
  const dir = params.get("dir");
  const { isRTL } = useLocale();
  React.useEffect(() => { if (dir) document.documentElement.dir = dir; }, [dir]);
  const [ready, setReady] = React.useState(false);
  const env = React.useMemo(() => {
    const handlers: Record<string, FixtureHandler> = {};
    if (c === "form-error") handlers["frappe.desk.form.load.getdoc"] = fail(403, "PermissionError", "Insufficient Permission for Contact Sara Al-Otaibi");
    if (c === "form-save-error") handlers["frappe.desk.form.save.savedocs"] = fail(417, "TimestampMismatchError", "Error: Document has been modified after you have opened it. Please refresh to get the latest document.");
    if (c === "list-error") handlers["frappe.desk.reportview.get"] = fail(403, "PermissionError", "You do not have permission to read ToDo");
    const latency = c === "form-loading" || c === "list-loading" ? 3_600_000 : 0;
    const transport = createFixtureTransport({
      meta: { ToDo: docsOf(todoEn), User: docsOf(userEn), Contact: docsOf(contactEn), "Approval Memo": [MEMO] },
      workflows: { "Approval Memo": WF },
      docs: {
        User: userDocs, ToDo: c === "list-empty" ? [] : todos(45), Contact: [CONTACT],
        "Approval Memo": [
          { doctype: "Approval Memo", name: "AM-1", title: "Annual travel budget", amount: 12500, workflow_state: "Pending", docstatus: 0, owner: "Administrator", modified: T, creation: T },
          { doctype: "Approval Memo", name: "AM-2", title: "Hotel block deposit", amount: 3400, notes: "Paid by card", workflow_state: "Approved", docstatus: 1, owner: "Administrator", modified: T, creation: T },
        ] as FrappeDoc[],
      },
      latency,
    }, { handlers, roles: ["System Manager", "All"] });
    const client = createFrappeClient({ transport });
    return { transport, client, qc: new QueryClient({ defaultOptions: { queries: { retry: false } } }) };
  }, [c]);

  // history for the timeline: comments, an assignment and two saves (Version rows)
  React.useEffect(() => {
    if (c !== "timeline" && c !== "workflow") { setReady(true); return; }
    void (async () => {
      const t = env.transport;
      const dt = c === "timeline" ? "ToDo" : "Approval Memo";
      const nm = c === "timeline" ? "TD-0001" : "AM-1";
      await t("frappe.desk.form.utils.add_comment", { reference_doctype: dt, reference_name: nm, content: "<p>Please confirm before Thursday - المراجعة مطلوبة</p>", comment_email: "Administrator", comment_by: "Administrator" });
      await t("frappe.desk.form.assign_to.add", { doctype: dt, name: nm, assign_to: JSON.stringify(["khaled@example.com"]) });
      const cur = (await t("frappe.desk.form.load.getdoc", { doctype: dt, name: nm })).docs![0] as FrappeDoc;
      const edit = c === "timeline" ? { status: "Closed", priority: "Low" } : { title: "Annual travel budget 2027", amount: 14000 };
      await t("frappe.desk.form.save.savedocs", { doc: JSON.stringify({ ...cur, ...edit }), action: "Save" });
      setReady(true);
    })();
  }, [env, c]);
  if (!ready) return <p className="p-6">…</p>;

  const wrap = (node: React.ReactNode) => (
    <FrappeProvider client={env.client} queryClient={env.qc} session={{ user: "Administrator", fullName: "Administrator", roles: ["System Manager", "All"] }}>
      <div className="p-6 md:p-8" data-scenario={c} data-isrtl={String(isRTL)}>{node}</div>
    </FrappeProvider>
  );
  switch (c) {
    case "form-contact": case "form-error": case "form-loading": case "form-save-error": return wrap(<FrappeForm doctype="Contact" name="Sara Al-Otaibi" />);
    case "form-new": return wrap(<FrappeForm doctype="ToDo" />);
    case "form-todo": return wrap(<FrappeForm doctype="ToDo" name="TD-0002" />);
    case "form-readonly": return wrap(<FrappeForm doctype="Approval Memo" name="AM-2" />);
    case "form-workflow": return wrap(<FrappeForm doctype="Approval Memo" name="AM-1" />);
    case "list": case "list-empty": case "list-error": case "list-loading": return wrap(
      <FrappeListView doctype="ToDo" selectable bulk={{ permissions: { read: true, write: true, delete: true, submit: false, cancel: false, create: true } as never }} storage={null} />,
    );
    case "timeline": case "workflow": {
      const dt = c === "timeline" ? "ToDo" : "Approval Memo";
      const d = (c === "timeline" ? todos(1)[0] : { doctype: "Approval Memo", name: "AM-1", title: "Annual travel budget", workflow_state: "Pending", docstatus: 0, owner: "Administrator", modified: T, creation: T }) as FrappeDoc;
      return wrap(
        <div className="mx-auto grid max-w-3xl gap-6">
          {c === "workflow" && <FrappeWorkflowActions doc={d} user="Administrator" roles={["System Manager"]} />}
          <FrappeAssignTo doc={{ ...d, doctype: dt }} user="Administrator" canAssign canWrite />
          <FrappeTimeline doc={{ ...d, doctype: dt }} user="Administrator" isSystemManager canDeleteComment />
        </div>,
      );
    }
    default: return wrap(<p>unknown scenario {c}</p>);
  }
}
