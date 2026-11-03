/**
 * The SIMULATED Frappe site the playground (`FrappeSimPage`) and the showcase ("Frappe layer" group) share: real 15.110
 * metadata for ToDo / User / Contact (tests/fixtures/real-15.110), two authored demo DocTypes (Approval Memo with a
 * workflow; Travel Request with depends_on, a Table MultiSelect, a permlevel-1 field and role rows), demo documents, the
 * scenario failure handlers (403 / 417 / latency), a fake realtime port and the seven PERMISSION SCENARIOS (the
 * simulator's opt-in server-side permission model). Everything here runs in the browser through
 * `createFixtureTransport`; nothing is evidence of Frappe behaviour — permission decisions included: they are the
 * simulator's approximation of the Frappe server. Playground / showcase only.
 */
import { QueryClient } from "@tanstack/react-query";
import { createFrappeClient, DOWNLOAD_TEMPLATE_METHOD, FrappeError, toFrappeError, type DocPerm, type DocTypeMeta, type DownloadedFile, type FrappeDoc, type FrappeFilesTransport, type RealtimeEvent, type RealtimePort, type WorkflowInfo } from "@ui/frappe";
import { createFixtureTransport, simScenario, type FixtureHandler, type FixtureTransport, type SimScenarioName, type SimulatedPermissions } from "../../../src/frappe/testing";
import todoEn from "../../../tests/fixtures/real-15.110/todo.en.json";
import userEn from "../../../tests/fixtures/real-15.110/user.en.json";
import contactEn from "../../../tests/fixtures/real-15.110/contact.en.json";

const docsOf = (x: unknown) => (x as { docs: DocTypeMeta[] }).docs;
/** Real Frappe 15.110 `getdoctype` payloads (the fixtures the Frappe tests use). */
export const REAL_META = { ToDo: docsOf(todoEn), User: docsOf(userEn), Contact: docsOf(contactEn) };

export const SM: DocPerm = { role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1, amend: 1, select: 1, report: 1, export: 1, import: 1, print: 1, email: 1, share: 1 };

/** Approval Memo — a submittable DocType with a three-state workflow (authored demo meta). */
export const MEMO: DocTypeMeta = {
  name: "Approval Memo", is_submittable: 1, autoname: "hash", title_field: "title", track_changes: 1, permissions: [SM],
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title", reqd: 1, in_list_view: 1 },
    { fieldname: "amount", fieldtype: "Currency", label: "Amount", in_list_view: 1 },
    { fieldname: "notes", fieldtype: "Small Text", label: "Notes", allow_on_submit: 1 },
    { fieldname: "workflow_state", fieldtype: "Link", label: "Workflow State", options: "Workflow State", hidden: 1 },
    { fieldname: "amended_from", fieldtype: "Link", label: "Amended From", options: "Approval Memo", read_only: 1, no_copy: 1 },
  ],
};
export const WF: WorkflowInfo = {
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

/**
 * Travel Request — an authored demo DocType for the forms and permissions sections: `depends_on` /
 * `mandatory_depends_on` (visa country), a Table MultiSelect (companions → User), a permlevel-1 field (internal notes),
 * `allow_import`, and role rows that differ per role (System Manager full; Sales User read-only; Data Entry
 * read/write/create + import; Exporter read + export).
 */
export const TRAVEL_ROLES = ["System Manager", "Sales User", "Data Entry", "Exporter"] as const;
export const TRAVEL: DocTypeMeta = {
  name: "Travel Request", autoname: "hash", title_field: "purpose", track_changes: 1, allow_import: 1, editable_grid: 1,
  permissions: [
    SM,
    { role: "System Manager", permlevel: 1, read: 1, write: 1 },
    { role: "Sales User", permlevel: 0, read: 1, report: 1, print: 1, email: 1, select: 1 },
    { role: "Data Entry", permlevel: 0, read: 1, write: 1, create: 1, import: 1, report: 1, select: 1 },
    { role: "Exporter", permlevel: 0, read: 1, export: 1, report: 1, select: 1 },
  ],
  fields: [
    { fieldname: "purpose", fieldtype: "Data", label: "Purpose", reqd: 1, in_list_view: 1, in_standard_filter: 1 },
    { fieldname: "traveller", fieldtype: "Link", label: "Lead traveller", options: "User", reqd: 1, in_list_view: 1, in_standard_filter: 1 },
    { fieldname: "destination", fieldtype: "Select", label: "Destination", options: "\nRiyadh\nJeddah\nDubai\nLondon", in_list_view: 1, in_standard_filter: 1 },
    { fieldname: "column_break_1", fieldtype: "Column Break" },
    { fieldname: "depart_on", fieldtype: "Date", label: "Departure", in_list_view: 1 },
    { fieldname: "budget", fieldtype: "Currency", label: "Budget" },
    { fieldname: "needs_visa", fieldtype: "Check", label: "Needs a visa" },
    { fieldname: "visa_country", fieldtype: "Data", label: "Visa country", depends_on: "eval:doc.needs_visa", mandatory_depends_on: "eval:doc.needs_visa", description: "Shown only while \"Needs a visa\" is ticked (depends_on); then required (mandatory_depends_on)." },
    { fieldname: "section_team", fieldtype: "Section Break", label: "Team" },
    { fieldname: "companions", fieldtype: "Table MultiSelect", label: "Companions", options: "Travel Companion" },
    { fieldname: "section_internal", fieldtype: "Section Break", label: "Internal" },
    { fieldname: "internal_notes", fieldtype: "Small Text", label: "Internal notes", permlevel: 1, description: "permlevel 1: readable and writable by System Manager only." },
  ],
};
export const TRAVEL_COMPANION: DocTypeMeta = {
  name: "Travel Companion", istable: 1, fields: [{ fieldname: "user", fieldtype: "Link", label: "User", options: "User", in_list_view: 1, reqd: 1 }],
};

export const T = "2026-11-02 09:00:00.000000";
export const USERS = ["sara@example.com", "khaled@example.com", "omar@example.com", "lina@example.com"];
export const TASKS = ["Confirm hotel block for the Riyadh offsite", "Review visa documents for the Jeddah team", "Call the airline about group fares", "Update the corporate travel policy", "Approve expense report", "Prepare the quarterly booking summary", "Renew the travel insurance contract", "Collect passport copies", "Send the itinerary to the client", "Follow up on the refund", "Book meeting rooms for the workshop", "Renew the long Arabic-English mixed title: مراجعة العقد with Acme-Corp-INTL-00012 before the end of the quarter"];
export const todos = (n: number): FrappeDoc[] => Array.from({ length: n }, (_, i) => ({
  doctype: "ToDo", name: `TD-${String(i + 1).padStart(4, "0")}`, description: `<p>${TASKS[i % TASKS.length]}</p>`, status: ["Open", "Closed", "Cancelled"][i % 3], priority: ["High", "Medium", "Low"][i % 3],
  date: `2026-11-${String((i % 27) + 1).padStart(2, "0")}`, allocated_to: USERS[i % 4], assigned_by: USERS[(i + 1) % 4], owner: USERS[i % 4], modified: `2026-11-02 ${String(8 + (i % 10)).padStart(2, "0")}:00:00.000000`, creation: T, _assign: JSON.stringify([USERS[i % 4]]),
})) as FrappeDoc[];
/** A demo user with no role assigned (the "unknown roles" permission scenario). Not in USERS: no ToDo is allocated to her. */
export const NEW_USER = "noor@example.com";
export const userDocs = [...USERS, NEW_USER].map((u) => ({ doctype: "User", name: u, email: u, full_name: u.split("@")[0].replace(/^./, (c) => c.toUpperCase()) + " Q", first_name: u.split("@")[0], enabled: 1, user_type: "System User" })) as FrappeDoc[];

export const CONTACT: FrappeDoc = {
  doctype: "Contact", name: "Sara Al-Otaibi", first_name: "Sara", last_name: "Al-Otaibi", full_name: "Sara Al-Otaibi", company_name: "Acme Travel", designation: "Operations Manager", status: "Passive",
  email_id: "sara@example.com", owner: "Administrator", modified: T, creation: T, docstatus: 0,
  email_ids: [{ doctype: "Contact Email", name: "ce1", idx: 1, email_id: "sara@example.com", is_primary: 1, parent: "Sara Al-Otaibi", parentfield: "email_ids", parenttype: "Contact" }, { doctype: "Contact Email", name: "ce2", idx: 2, email_id: "sara.alotaibi@very-long-company-domain-name.example.com", is_primary: 0, parent: "Sara Al-Otaibi", parentfield: "email_ids", parenttype: "Contact" }],
  phone_nos: [{ doctype: "Contact Phone", name: "cp1", idx: 1, phone: "+966 50 123 4567", is_primary_phone: 1, parent: "Sara Al-Otaibi", parentfield: "phone_nos", parenttype: "Contact" }],
  links: [{ doctype: "Dynamic Link", name: "dl1", idx: 1, link_doctype: "User", link_name: "sara@example.com", parent: "Sara Al-Otaibi", parentfield: "links", parenttype: "Contact" }],
} as FrappeDoc;

export const MEMOS: FrappeDoc[] = [
  { doctype: "Approval Memo", name: "AM-1", title: "Annual travel budget", amount: 12500, workflow_state: "Pending", docstatus: 0, owner: "Administrator", modified: T, creation: T },
  { doctype: "Approval Memo", name: "AM-2", title: "Hotel block deposit", amount: 3400, notes: "Paid by card", workflow_state: "Approved", docstatus: 1, owner: "Administrator", modified: T, creation: T },
  { doctype: "Approval Memo", name: "AM-3", title: "Workshop catering", amount: 900, workflow_state: "Draft", docstatus: 0, owner: "Administrator", modified: T, creation: T },
] as FrappeDoc[];

export const TRAVELS: FrappeDoc[] = [
  { doctype: "Travel Request", name: "TR-0001", purpose: "Riyadh offsite", traveller: "sara@example.com", destination: "Riyadh", depart_on: "2026-11-20", budget: 4200, needs_visa: 0, internal_notes: "Approved by finance on 1 Nov.", owner: "Administrator", modified: T, creation: T, docstatus: 0,
    companions: [{ doctype: "Travel Companion", name: "tc1", idx: 1, user: "khaled@example.com", parent: "TR-0001", parentfield: "companions", parenttype: "Travel Request" }] },
  { doctype: "Travel Request", name: "TR-0002", purpose: "زيارة العميل في جدة — Acme Travel", traveller: "lina@example.com", destination: "Jeddah", depart_on: "2026-12-03", budget: 1800, needs_visa: 0, owner: "Administrator", modified: T, creation: T, docstatus: 0, companions: [] },
  { doctype: "Travel Request", name: "TR-0003", purpose: "London trade fair", traveller: "omar@example.com", destination: "London", depart_on: "2027-01-12", budget: 9800, needs_visa: 1, visa_country: "United Kingdom", owner: "Administrator", modified: T, creation: T, docstatus: 0, companions: [] },
] as FrappeDoc[];

/** A handler that fails like the HTTP transport would: Frappe's error body through `toFrappeError`. */
export const fail = (status: number, exc_type: string, message: string): FixtureHandler => () => { throw toFrappeError(status, { exc_type, _server_messages: JSON.stringify([JSON.stringify({ message, indicator: "red" })]) }); };

/** Named failure handlers the scenarios reuse (403 on load / list, 417 timestamp mismatch on save). */
export const SCENARIO_HANDLERS = {
  "form-error": { "frappe.desk.form.load.getdoc": fail(403, "PermissionError", "Insufficient Permission for Contact Sara Al-Otaibi") },
  "form-save-error": { "frappe.desk.form.save.savedocs": fail(417, "TimestampMismatchError", "Error: Document has been modified after you have opened it. Please refresh to get the latest document.") },
  "list-error": { "frappe.desk.reportview.get": fail(403, "PermissionError", "You do not have permission to read ToDo") },
} satisfies Record<string, Record<string, FixtureHandler>>;

/** A `RealtimePort` fed by a button instead of a socket (the package's realtime layer is a skeleton: matrix row 13). */
export interface FakeRealtime extends RealtimePort { emit(e: RealtimeEvent): void; listeners(): number }
export function createFakeRealtime(): FakeRealtime {
  const subs = new Set<{ doctype: string; name?: string; cb: (e: RealtimeEvent) => void }>();
  const add = (s: { doctype: string; name?: string; cb: (e: RealtimeEvent) => void }) => { subs.add(s); return () => { subs.delete(s); }; };
  return {
    subscribeDoc: (doctype, name, cb) => add({ doctype, name, cb }),
    subscribeDoctype: (doctype, cb) => add({ doctype, cb }),
    emit: (e) => { for (const s of subs) if (!e.doctype || s.doctype === e.doctype) if (!s.name || s.name === e.name) s.cb(e); },
    listeners: () => subs.size,
  };
}

/** One recorded file-transport call (what the package would POST to the site). */
export interface FileCall { kind: "download" | "upload"; method: string; args: Record<string, unknown>; at: number; outcome: string }

/**
 * A SIMULATED file transport (`createFrappeClient({ files })`): it records every `download` / `upload` the package asks
 * for and never contacts a server. `mode` "refuse" answers the 403 a site returns for a user without the right;
 * "respond" hands the request to the simulator's own file server (`server`, i.e. `transport.files`: permission-checked
 * when the site simulates permissions, and answering a text file labelled SIMULATED with the column labels and the
 * request — never document values); without `server` it resolves a tiny text file that says it is a simulated response;
 * "none" (the default for every section but Import & export) refuses with a labelled 417 so nothing is ever handed to
 * the browser.
 */
export function simulatedFiles(mode: "none" | "refuse" | "respond", onCall?: (c: FileCall) => void, server?: FrappeFilesTransport): FrappeFilesTransport {
  const record = (c: FileCall) => { onCall?.(c); return c; };
  const refuse = (status: number, exc_type: string, message: string) => toFrappeError(status, { exc_type, _server_messages: JSON.stringify([JSON.stringify({ message, indicator: "red" })]) });
  return {
    async download(method, args) {
      if (mode === "refuse") { record({ kind: "download", method, args, at: Date.now(), outcome: "403 PermissionError (simulated server refusal)" }); throw refuse(403, "PermissionError", "Not permitted to export Travel Request"); }
      if (mode === "none") { record({ kind: "download", method, args, at: Date.now(), outcome: "417 — no file server in the showcase" }); throw refuse(417, "ValidationError", "SIMULATED showcase: the file server is not simulated in this section; see Import & export."); }
      if (server) {
        try {
          const file = await server.download(method, args);
          record({ kind: "download", method, args, at: Date.now(), outcome: `200 — simulated ${file.filename} (${file.blob.size} bytes; labels and request only)` });
          return file;
        } catch (e) {
          const err = e instanceof FrappeError ? e : undefined;
          record({ kind: "download", method, args, at: Date.now(), outcome: `${err?.status ?? "?"} ${err?.excType ?? ""} — ${err?.message ?? String(e)} (simulated server decision)` });
          throw e;
        }
      }
      const text = `SIMULATED RESPONSE — NOT AN EXPORT.\nThe showcase has no server; on a site ${method} would stream the CSV/XLSX built server-side.\nRequest: ${JSON.stringify(args)}\n`;
      const file: DownloadedFile = { blob: new Blob([text], { type: "text/plain" }), filename: "SIMULATED-not-an-export.txt", contentType: "text/plain" };
      record({ kind: "download", method, args, at: Date.now(), outcome: `200 — simulated ${file.filename} (${text.length} bytes)` });
      return file;
    },
    async upload(file, filename, opts) {
      if (server && mode === "respond") {
        try {
          const doc = await server.upload(file, filename, opts);
          record({ kind: "upload", method: "upload_file", args: { filename, ...opts }, at: Date.now(), outcome: `200 — kept in the simulator's memory as ${String(doc.file_url)} (simulated server)` });
          return doc;
        } catch (e) {
          const err = e instanceof FrappeError ? e : undefined;
          record({ kind: "upload", method: "upload_file", args: { filename, ...opts }, at: Date.now(), outcome: `${err?.status ?? "?"} ${err?.excType ?? ""} — ${err?.message ?? String(e)} (simulated server decision)` });
          throw e;
        }
      }
      record({ kind: "upload", method: "upload_file", args: { filename, ...opts }, at: Date.now(), outcome: "417 — uploads are not simulated (an import would write to the site)" });
      throw refuse(417, "ValidationError", "SIMULATED showcase: uploads are not simulated; an import writes to the site.");
    },
  };
}

export interface SimSiteOptions {
  /** The file transport (download / upload). Default: `simulatedFiles(fileMode ?? "none", onFileCall, transport.files)`. */
  files?: FrappeFilesTransport;
  /** With no `files`: how the showcase's file transport answers (see `simulatedFiles`); "respond" goes through the
   *  simulator's own file server (permission-checked with `permissions`). */
  fileMode?: "none" | "refuse" | "respond";
  onFileCall?: (c: FileCall) => void;
  /** Extra / overriding methods (e.g. one of `SCENARIO_HANDLERS`). */
  handlers?: Record<string, FixtureHandler>;
  /** The simulated session's roles (workflow transitions are filtered by them). Ignored with `permissions`. */
  roles?: string[];
  user?: string;
  /**
   * SIMULATED server-side permissions (`createFixtureTransport(…, { permissions })`): the simulator then evaluates every
   * call from the DocPerm rows × the session's roles, User Permissions and shares — 403s, filtered rows, stripped
   * permlevel values. `site.transport.store.session` is the matching client session. Omitted: every right (as before).
   */
  permissions?: SimulatedPermissions;
  /** The simulated Data Import job: "dry-run" (default — rows checked and logged, nothing written) or "insert" (the
   *  simulator plays the server and inserts valid rows into its own memory; labelled in the log). */
  dataImport?: "dry-run" | "insert";
  /** Artificial latency (ms); a huge value keeps "loading" on screen. */
  latency?: number;
  /** Number of demo ToDos (default 45; 0 = empty list). */
  todoCount?: number;
}
export interface SimSite {
  transport: FixtureTransport;
  client: ReturnType<typeof createFrappeClient>;
  qc: QueryClient;
  realtime: FakeRealtime;
  /** Seed activity on a document (two comments, an assignment, one edit → Version rows) for the timeline / stepper demos. */
  seedHistory(doctype: string, name: string, edit: Record<string, unknown>): Promise<void>;
  /** Insert one more demo ToDo straight into the store (for the realtime demo) and return its name. */
  addTodo(): string;
}

/** One simulated site: fresh in-memory data, a client over the fixture transport, and its own React Query cache. */
export function createSimSite(o: SimSiteOptions = {}): SimSite {
  const transport = createFixtureTransport({
    meta: { ...REAL_META, "Approval Memo": [MEMO], "Travel Request": [TRAVEL, TRAVEL_COMPANION] },
    workflows: { "Approval Memo": WF },
    docs: { User: userDocs, ToDo: todos(o.todoCount ?? 45), Contact: [CONTACT], "Approval Memo": MEMOS, "Travel Request": TRAVELS },
    latency: o.latency ?? 0,
    user: o.user ?? "Administrator",
  }, { handlers: o.handlers ?? {}, roles: o.roles ?? ["System Manager", "All"], permissions: o.permissions, dataImport: o.dataImport });
  const client = createFrappeClient({ transport, files: o.files ?? simulatedFiles(o.fileMode ?? "none", o.onFileCall, transport.files) });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let extra = 0;
  return {
    transport, client, qc, realtime: createFakeRealtime(),
    async seedHistory(doctype, name, edit) {
      await transport("frappe.desk.form.utils.add_comment", { reference_doctype: doctype, reference_name: name, content: "<p>Please confirm before Thursday - المراجعة مطلوبة</p>", comment_email: "Administrator", comment_by: "Administrator" });
      await transport("frappe.desk.form.assign_to.add", { doctype, name, assign_to: JSON.stringify(["khaled@example.com"]) });
      const cur = (await transport("frappe.desk.form.load.getdoc", { doctype, name })).docs![0] as FrappeDoc;
      await transport("frappe.desk.form.save.savedocs", { doc: JSON.stringify({ ...cur, ...edit }), action: "Save" });
      await transport("frappe.desk.form.utils.add_comment", { reference_doctype: doctype, reference_name: name, content: "<p>Updated after the call with <span class=\"mention\" data-id=\"sara@example.com\">@Sara Q</span>.</p>", comment_email: "khaled@example.com", comment_by: "Khaled Q" });
    },
    addTodo() {
      extra += 1;
      const name = `TD-RT-${String(extra).padStart(3, "0")}`;
      const now = new Date();
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}.000000`;
      transport.store.docs.get("ToDo")?.set(name, { doctype: "ToDo", name, description: `<p>Server event #${extra}: new task pushed by another user</p>`, status: "Open", priority: "High", date: "2026-11-30", allocated_to: USERS[extra % 4], owner: "Administrator", modified: stamp, creation: stamp, _assign: JSON.stringify([USERS[extra % 4]]) } as FrappeDoc);
      return name;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Permission scenarios — SIMULATED server-side permission decisions (createFixtureTransport's `permissions` option)
// ---------------------------------------------------------------------------------------------------------------------

export interface PermissionScenario {
  key: SimScenarioName;
  /** What the simulated SERVER evaluates (and, via `store.session`, what the client is told). */
  permissions: SimulatedPermissions;
  /** The saved document the scenario opens. */
  focus: { doctype: string; name: string };
}

/**
 * The seven scenarios over Travel Request's role rows (TRAVEL above): System Manager (everything + permlevel 1), Sales
 * User (read), Data Entry (read / write / create / import), and roles the DocType has no row for. SIMULATED.
 */
export const PERMISSION_SCENARIOS: Record<SimScenarioName, PermissionScenario> = {
  administrator: { key: "administrator", permissions: simScenario.administrator(), focus: { doctype: "Travel Request", name: "TR-0001" } },
  "full-access": { key: "full-access", permissions: simScenario.fullAccess("sara@example.com", ["System Manager"]), focus: { doctype: "Travel Request", name: "TR-0001" } },
  "read-only": { key: "read-only", permissions: simScenario.readOnly("lina@example.com", ["Sales User"]), focus: { doctype: "Travel Request", name: "TR-0001" } },
  "restricted-doctype": { key: "restricted-doctype", permissions: simScenario.restrictedDoctype("khaled@example.com", ["Purchase User"]), focus: { doctype: "Travel Request", name: "TR-0001" } },
  "restricted-fields": { key: "restricted-fields", permissions: simScenario.restrictedFields("omar@example.com", ["Data Entry"]), focus: { doctype: "Travel Request", name: "TR-0001" } },
  "user-permissions": {
    key: "user-permissions",
    permissions: simScenario.userPermissions("omar@example.com", ["Data Entry"], [{ allow: "User", for_value: "omar@example.com", applicable_for: "Travel Request" }],
      { shares: [{ share_doctype: "Travel Request", share_name: "TR-0002", user: "omar@example.com", read: 1, owner: "Administrator" }] }),
    focus: { doctype: "Travel Request", name: "TR-0003" },
  },
  "unknown-roles": { key: "unknown-roles", permissions: simScenario.unknownRoles(NEW_USER, { fullName: "Noor Q" }), focus: { doctype: "Travel Request", name: "TR-0001" } },
};

/** One answer of the simulated server to a probe call. */
export interface ProbeLine { call: string; status: number; outcome: string }

/**
 * Ask a THROWAWAY simulated site (same scenario, fresh data) a fixed set of questions and report what its permission
 * model answered — so the page shows the server-side decisions without mutating the site on screen. SIMULATED.
 */
export async function probeServer(sc: PermissionScenario): Promise<ProbeLine[]> {
  const site = createSimSite({ permissions: sc.permissions, todoCount: 6 });
  const t = site.transport;
  const out: ProbeLine[] = [];
  const run = async (call: string, fn: () => Promise<string>) => {
    try { out.push({ call, status: 200, outcome: await fn() }); } catch (e) {
      const err = e instanceof FrappeError ? e : undefined;
      const text = [err?.message ?? String(e), ...(err?.messages ?? []).map((m) => m.message)].map((x) => x.replace(/<br\s*\/?>/gi, " · ").replace(/<[^>]+>/g, "").trim()).filter((x, i, a) => x && a.indexOf(x) === i);
      out.push({ call, status: err?.status ?? 0, outcome: `${err?.excType ?? "Error"}: ${text.join(" — ")}` });
    }
  };
  const { doctype, name } = sc.focus;
  await run(`getdoctype ${doctype}`, async () => "meta loaded — getdoctype has no permission check (load.py:62-79)");
  await run(`getdoc ${doctype} ${name}`, async () => {
    const r = await t("frappe.desk.form.load.getdoc", { doctype, name });
    const d = r.docs![0] as FrappeDoc;
    const info = r.docinfo as { permissions: Record<string, unknown>; shared: { user?: string; read?: number; write?: number }[] };
    const rights = ["read", "write", "create", "delete"].map((k) => `${k} ${info.permissions[k] ?? "–"}`).join(", ");
    const shared = info.shared.length ? `; docinfo.shared: ${info.shared.map((x) => `${x.user} (read ${x.read}, write ${x.write})`).join(", ")}` : "";
    return `internal_notes ${"internal_notes" in d ? "present" : "absent (permlevel 1 stripped)"}; docinfo.permissions: ${rights}${shared}`;
  });
  await run("reportview.get Travel Request [name, purpose, internal_notes]", async () => {
    const r = (await t("frappe.desk.reportview.get", { doctype: "Travel Request", fields: JSON.stringify(["name", "purpose", "internal_notes"]), order_by: "name asc" })).message as { keys: string[]; values: unknown[][] } | [];
    if (Array.isArray(r)) return "0 rows";
    return `${r.values.length} row(s): ${r.values.map((v) => v[0]).join(", ")} · keys: ${r.keys.join(", ")}`;
  });
  await run(`savedocs ${name} (no change)`, async () => {
    const stored = t.store.docs.get(doctype)!.get(name)!;
    await t("frappe.desk.form.save.savedocs", { doc: JSON.stringify(stored), action: "Save" });
    return "saved";
  });
  await run("savedocs a new Travel Request", async () => {
    const traveller = sc.permissions.user === "Administrator" ? "sara@example.com" : sc.permissions.user;
    const r = await t("frappe.desk.form.save.savedocs", { doc: JSON.stringify({ doctype: "Travel Request", name: "new-travel-request-1", __islocal: 1, purpose: "Probe trip", traveller }), action: "Save" });
    return `created ${String((r.docs![0] as FrappeDoc).name)}`;
  });
  await run("frappe.client.delete Travel Request TR-0002", async () => { await t("frappe.client.delete", { doctype: "Travel Request", name: "TR-0002" }); return "deleted"; });
  await run("getdoc Approval Memo AM-1", async () => { await t("frappe.desk.form.load.getdoc", { doctype: "Approval Memo", name: "AM-1" }); return "opened"; });
  await run("download_template Travel Request (export)", async () => {
    const f = await t.files.download(DOWNLOAD_TEMPLATE_METHOD, { doctype: "Travel Request", file_type: "CSV", export_records: "all", export_fields: JSON.stringify({ "Travel Request": ["name", "purpose"] }), export_filters: null });
    return `${f.filename} — labels and request only, no values`;
  });
  return out;
}

