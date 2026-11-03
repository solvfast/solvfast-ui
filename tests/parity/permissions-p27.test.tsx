/**
 * Phase 27 — permission closure (P2-1, P2-3, P2-4, P3-1, P3-6). SIMULATED — test doubles; the server remains the authority.
 *
 * Nothing here talks to a Frappe site. DocPerm rows, `docinfo` and `get_transitions` answers are hand-written or come from
 * the in-memory simulator (`createFixtureTransport`); 403s are thrown by stub transports. What is asserted is the
 * PACKAGE's side of the contract: missing information denies (rule 9), the Administrator USER is treated the way the
 * Frappe 15.110 server treats it (with or without an explicit role list), a refusal arrives as a `FrappeError` of kind
 * "permission" with no optimistic state and no cache change, and a revoked right disappears on the next answer.
 * The only real-server evidence in the repo is `tests/real/sada-real.test.tsx` (two full-rights users + Guest).
 *
 * Native references (apps/frappe/frappe, 15.110):
 *  permissions.py :37 AUTOMATIC_ROLES (Administrator among them), :107-109 `has_permission` → True for the Administrator
 *  user, :273-275 `get_role_permissions` → `allow_everything()`, :506-507 `get_roles("Administrator")` = every Role,
 *  :515 automatic roles never read from Has Role, :599-605 `can_import`, :608-615 `can_export`;
 *  document.py :756 (no field stripping) / :788 (no permlevel reset) for the Administrator;
 *  core/doctype/data_import/data_import.py :64 (allow_import refused for everyone) before :71 (import right);
 *  model/workflow.py :52 read check, :64-67 role filter by `frappe.get_roles()`, :116 + :221-222 self-approval;
 *  public/js: model/model.js :400-402 can_cancel, :435 / :438 can_import, :446 can_export; form/workflow.js :103;
 *  model/workflow.js :53-70 is_read_only; form/form.js :925-951 Cancel All; utils/user.py :149-150, :245; desk.js :311.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { defaultMessages } from "../../src/theme/messages";
import { createFrappeClient, FrappeError, normalizeDocInfo, toMetaBundle, type FrappeResponse, type FrappeTransport } from "../../src/frappe/client";
import realSada from "../fixtures/real-15.110-sada/sada-real-responses.json";
import { FrappeProvider } from "../../src/frappe/FrappeProvider";
import { frappeKeys, type DocInfo, type DocPerm, type DocTypeMeta, type FrappeDoc, type MetaBundle, type WorkflowInfo, type WorkflowTransition } from "../../src/frappe/contract";
import { useDocAction, usePermissions } from "../../src/frappe/hooks";
import { FrappeForm, canCancelDoctype } from "../../src/frappe/form/FrappeForm";
import { FrappeFormView, type FormPermissions, type LinkedDoc } from "../../src/frappe/form/FrappeFormView";
import { formActions } from "../../src/frappe/form/model/actions";
import { createFixtureTransport, type FixtureHandler } from "../../src/frappe/testing";
import {
  PERM_TYPES, buildDocPermissions, canExport, canImport, isAdministrator, isWorkflowReadOnly, permissionsKnown, type FrappeSession,
} from "../../src/frappe/services/permissions";
import { bulkDelete, bulkMenu } from "../../src/frappe/list/bulk";
import { FrappeWorkflowActions } from "../../src/frappe/record/FrappeWorkflowActions";
import { useWorkflow } from "../../src/frappe/record/useWorkflow";
import { isReadOnlyState, transitionsKnown, visibleTransitions, workflowFromMeta } from "../../src/frappe/record/workflow";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const en = defaultMessages.en;

// ---- fixtures ---------------------------------------------------------------------------------------------------------

const ROWS: DocPerm[] = [
  { role: "Clerk", permlevel: 0, read: 1, write: 1, create: 1, submit: 1, cancel: 1, amend: 1, delete: 1, import: 1, export: 1 },
  { role: "Reader", permlevel: 0, read: 1 },
  { role: "Clerk", permlevel: 1, read: 1 },
];
const MEMO = (allow_import: 0 | 1 = 1, permissions: DocPerm[] = ROWS): DocTypeMeta => ({
  name: "Memo", is_submittable: 1, allow_import, autoname: "hash", title_field: "title",
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title" },
    { fieldname: "amount", fieldtype: "Currency", label: "Amount" },
    { fieldname: "margin", fieldtype: "Percent", label: "Margin", permlevel: 1 },
  ],
  permissions,
});
const bundleOf = (m: DocTypeMeta): MetaBundle => ({ meta: m, children: {}, fetchedAt: 0 } as unknown as MetaBundle);
const memo = (extra: Partial<FrappeDoc> = {}): FrappeDoc => ({ doctype: "Memo", name: "M-1", owner: "u@x", docstatus: 0, title: "Plan", amount: 5, margin: 2, modified: "2026-11-03 10:00:00.000000", ...extra });
const NEW_MEMO: FrappeDoc = { doctype: "Memo", name: "new-memo-1", __islocal: 1, docstatus: 0 };
const docinfo = (permissions: Record<string, 0 | 1>): DocInfo =>
  ({ permissions, shared: [], attachments: [], comments: [], versions: [], assignments: [], assignment_logs: [], views: [], communications: [], user_info: {} }) as unknown as DocInfo;

/** The three ways an app can describe the Administrator: no role list, the server's list (every Role, :506-507 — a few
 *  of them here), and a partial list an app might assemble. All three must give the same answers. */
const ADMIN_SESSIONS: [string, FrappeSession][] = [
  ["without a role list", { user: "Administrator" }],
  ["with the server's role list", { user: "Administrator", roles: ["Administrator", "System Manager", "Clerk", "Reader", "All", "Guest", "Desk User"] }],
  ["with a partial role list", { user: "Administrator", roles: ["Administrator"] }],
];

const noop: FrappeTransport = async () => ({});
/** A stub transport that answers 403 PermissionError (Frappe's `frappe.PermissionError` → HTTP 403) for `methods`. */
const deny = (methods: string[], otherwise: FrappeTransport = noop): FrappeTransport => async (method, args) => {
  if (methods.includes(method)) throw new FrappeError("User u@x does not have access to this document", 403, "PermissionError");
  return otherwise(method, args);
};
function harness(transport: FrappeTransport, session?: FrappeSession) {
  const client = createFrappeClient({ transport });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
      <QueryClientProvider client={qc}><FrappeProvider client={client} session={session}>{children}</FrappeProvider></QueryClientProvider>
    </ThemeProvider>
  );
  return { client, qc, wrapper };
}
const mount = (ui: React.ReactElement, transport: FrappeTransport = noop, session?: FrappeSession) => {
  const h = harness(transport, session);
  const Wrapper = h.wrapper;
  const utils = render(<Wrapper>{ui}</Wrapper>);
  return { ...h, ...utils, rerender: (n: React.ReactElement) => utils.rerender(<Wrapper>{n}</Wrapper>) };
};
const unknownNotice = () => document.querySelector('[data-permissions="unknown"]');
const button = (name: string) => screen.queryByRole("button", { name });
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

/** A simulated site (createFixtureTransport) with the Memo DocType, a workflow DocType and stubbed linked documents. */
const FLOW: DocTypeMeta = {
  name: "Flow Memo", is_submittable: 1, autoname: "hash", title_field: "title",
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title" },
    { fieldname: "workflow_state", fieldtype: "Link", label: "Workflow State", options: "Workflow State", hidden: 1 },
  ],
  permissions: [{ role: "Approver", permlevel: 0, read: 1, write: 1, submit: 1, cancel: 1 }],
};
const FLOW_WF: WorkflowInfo = {
  name: "Flow", document_type: "Flow Memo", workflow_state_field: "workflow_state",
  states: [
    { state: "Draft", doc_status: "0", allow_edit: "Approver", style: "Warning" },
    { state: "Approved", doc_status: "1", allow_edit: "Approver", style: "Success" },
    { state: "Rejected", doc_status: "0", allow_edit: "Approver", style: "Danger" },
  ],
  transitions: [
    { state: "Draft", action: "Approve", next_state: "Approved", allowed: "Approver", allow_self_approval: 0 },
    { state: "Draft", action: "Reject", next_state: "Rejected", allowed: "Approver", allow_self_approval: 1 },
  ],
};
const LINKED: LinkedDoc[] = [{ doctype: "Memo", name: "M-9", docstatus: 1 }];
function site(opts: { handlers?: Record<string, FixtureHandler>; roles?: string[]; docs?: Record<string, FrappeDoc[]> } = {}) {
  return createFixtureTransport({
    meta: { Memo: [MEMO(1)], "Flow Memo": [FLOW] },
    workflows: { "Flow Memo": FLOW_WF },
    docs: {
      Memo: [memo({ docstatus: 1 }), memo({ name: "M-9", docstatus: 1 })],
      "Flow Memo": [{ doctype: "Flow Memo", name: "F-1", title: "Flow plan", docstatus: 0, workflow_state: "Draft", owner: "author@x", modified: "2026-11-03 10:00:00.000000" }],
      ...opts.docs,
    },
  }, {
    roles: opts.roles,
    handlers: {
      "frappe.desk.form.linked_with.get_submitted_linked_docs": () => ({ message: { docs: LINKED, count: LINKED.length } }),
      "frappe.desk.form.linked_with.cancel_all_linked_docs": () => ({ message: null }),
      ...opts.handlers,
    },
  });
}

// ---- 1. Administrator: verified Frappe 15.110 behaviour (P2-4) ----------------------------------------------------------

describe("SIMULATED Administrator with and without an explicit role list (P2-4)", () => {
  for (const [label, session] of ADMIN_SESSIONS) {
    it(`${label}: every right at every permlevel, new and saved doc; known (permissions.py:107-109, :273-275; document.py:756, :788)`, () => {
      expect(isAdministrator(session)).toBe(true);
      for (const [doc, info] of [[NEW_MEMO, undefined], [memo(), docinfo({ read: 1 })], [undefined, undefined]] as const) {
        const levels = buildDocPermissions({ meta: MEMO(1), doc, docinfo: info, session });
        for (const right of PERM_TYPES) {
          expect(levels[0][right], `${right} @0`).toBe(true);
          expect(levels[1]?.[right], `${right} @1`).toBe(true);
        }
        expect(permissionsKnown({ doc, docinfo: info, session })).toBe(true);
      }
      const { wrapper } = harness(noop, session);
      const { result } = renderHook(() => usePermissions(bundleOf(MEMO(1)), memo(), docinfo({ read: 1 })), { wrapper });
      for (const right of PERM_TYPES) expect(result.current.can(right), right).toBe(true);
      expect(result.current.known).toBe(true);
    });

    it(`${label}: canImport = allow_import (model.js:435, data_import.py:64; System Manager among its roles, permissions.py:506-507 + :600)`, () => {
      const level0 = buildDocPermissions({ meta: MEMO(1), session })[0];
      expect(canImport(MEMO(1), session, level0)).toBe(true);
      expect(canImport(MEMO(0), session, level0)).toBe(false); // Data Import refuses allow_import 0 even for the Administrator
      expect(canImport(MEMO(1), session, undefined)).toBe(true); // no DocPerm row needed
      expect(canImport(undefined, session, level0)).toBe(false); // no meta → no allow_import → false
    });

    it(`${label}: canExport = true (permissions.py:609 "System Manager" in get_roles(); :273-275 allow_everything)`, () => {
      expect(canExport(session, buildDocPermissions({ meta: MEMO(1), session })[0])).toBe(true);
      expect(canExport(session, undefined)).toBe(true);
      // a DocType without any DocPerm row: still true (the server's can_export never consults rows for System Manager)
      expect(canExport(session, buildDocPermissions({ meta: MEMO(1, []), session })[0])).toBe(true);
    });

    it(`${label}: Cancel All for every DocType (canCancelDoctype; the server never refuses the Administrator, permissions.py:107-109)`, () => {
      expect(canCancelDoctype(MEMO(1), session)).toBe(true);
      expect(canCancelDoctype(MEMO(1, []), session)).toBe(true);
    });

    it(`${label}: bulk menu inputs give the full menu (usePermissions().can → bulkMenu)`, () => {
      const { wrapper } = harness(noop, session);
      const { result } = renderHook(() => usePermissions(bundleOf(MEMO(1))), { wrapper });
      const menu = (hasWorkflow: boolean) => bulkMenu({ permissions: (p) => result.current.can(p), isSubmittable: true, hasWorkflow, allowEdit: false, hasEditableFields: true });
      expect(menu(false)).toEqual(["edit", "submit", "cancel", "assign", "delete"]);
      expect(menu(true)).toEqual(["assign"]); // a workflow hides Edit / Submit / Cancel / Delete for everyone (list_view.js), Administrator included
    });

    it(`${label}: a saved workflow doc is never read-only for it (its roles hold every allow_edit role, model/workflow.js:65-68)`, () => {
      const wf = { name: "WF", document_type: "Memo", workflow_state_field: "workflow_state", states: [{ state: "Draft", doc_status: "0", allow_edit: "Approver" }], transitions: [] };
      expect(isWorkflowReadOnly(wf, memo({ workflow_state: "Draft" }), session.roles, session.user)).toBe(false);
    });
  }

  it("the session form and the role-list form of canImport / canExport agree for everyone else (rule 9 kept: no roles → false)", () => {
    const clerk0 = buildDocPermissions({ meta: MEMO(1), session: { user: "u@x", roles: ["Clerk"] } })[0];
    expect(canImport(MEMO(1), { user: "u@x", roles: ["Clerk"] }, clerk0)).toBe(canImport(MEMO(1), ["Clerk"], clerk0));
    expect(canImport(MEMO(1), { user: "u@x", roles: ["Clerk"] }, clerk0)).toBe(true);
    expect(canExport({ user: "u@x", roles: ["Reader"] }, { read: true })).toBe(false);
    // no roles: nothing, whatever level 0 claims
    expect(canImport(MEMO(1), { user: "u@x" }, { import: true })).toBe(false);
    expect(canExport({ user: "u@x" }, { export: true })).toBe(false);
    expect(canImport(MEMO(1), undefined, { import: true })).toBe(false);
    // the "Administrator" ROLE alone is never reported for another user (permissions.py:37, :515); its rows only
    const roleOnly = buildDocPermissions({ meta: MEMO(1), doc: NEW_MEMO, session: { user: "u@x", roles: ["Administrator"] } });
    expect(Object.values(roleOnly[0]).some(Boolean)).toBe(false);
    expect(canCancelDoctype(MEMO(1), { user: "u@x", roles: ["Administrator"] })).toBe(false);
  });
});

// ---- 2. missing permission information (P2-1, rule 9) -------------------------------------------------------------------

describe("SIMULATED missing permission information denies (P2-1)", () => {
  const view = (doc: FrappeDoc, extra: Partial<React.ComponentProps<typeof FrappeFormView>> = {}) => {
    const onSave = vi.fn(async (d: FrappeDoc) => d);
    const r = mount(<FrappeFormView bundle={bundleOf(MEMO(1))} doc={doc} onSave={onSave} onCancelDoc={async (d) => ({ ...d, docstatus: 2 })} {...extra} />);
    return { ...r, onSave };
  };

  it("FrappeFormView without `permissions`: read-only fields, the 'Read only' notice (data-permissions=unknown), no Save / Submit, Ctrl+S inert", async () => {
    const { container, onSave } = view(memo());
    const notice = unknownNotice();
    expect(notice?.textContent).toBe(en.formReadOnly);
    expect(notice?.getAttribute("role")).toBe("status");
    for (const a of [en.formSave, en.formSubmit, en.formUpdate, en.formCancelDoc, en.formAmend]) expect(button(a), a).toBeNull();
    expect(screen.queryAllByRole("textbox")).toEqual([]); // nothing editable
    expect(screen.getAllByText("Plan").length).toBeGreaterThan(1); // heading + the read-only field: what the app handed over is shown
    fireEvent.keyDown(container.firstElementChild!, { key: "s", ctrlKey: true });
    await tick();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("FrappeFormView without `permissions`: no Cancel on a submitted doc, no Amend on a cancelled one, no Save on a new one (before dev.31 all were offered)", () => {
    view(memo({ docstatus: 1 }));
    expect(button(en.formCancelDoc)).toBeNull();
    cleanup();
    view(memo({ docstatus: 2 }));
    expect(button(en.formAmend)).toBeNull();
    cleanup();
    view({ ...NEW_MEMO, title: "Draft plan" });
    expect(button(en.formSave)).toBeNull();
    expect(unknownNotice()).toBeTruthy();
  });

  it("rights given as `levels` only are read from level 0 (no `can`): Submit offered, no unknown notice", () => {
    const permissions: FormPermissions = { levels: [{ read: true, write: true, submit: true }] };
    view(memo(), { permissions });
    expect(button(en.formSubmit)).toBeTruthy();
    expect(unknownNotice()).toBeNull();
  });

  it("usePermissions without any session: nothing granted, known === false; a saved doc with server docinfo = exactly that level 0", () => {
    const { wrapper } = harness(noop, undefined);
    const { result: fresh } = renderHook(() => usePermissions(bundleOf(MEMO(1)), NEW_MEMO), { wrapper });
    for (const right of PERM_TYPES) expect(fresh.current.can(right), right).toBe(false);
    expect(fresh.current.known).toBe(false);
    const { result: bare } = renderHook(() => usePermissions(bundleOf(MEMO(1)), memo()), { wrapper });
    expect(bare.current.can("read")).toBe(false);
    expect(bare.current.known).toBe(false);
    const { result: served } = renderHook(() => usePermissions(bundleOf(MEMO(1)), memo(), docinfo({ read: 1, write: 1 })), { wrapper });
    expect(served.current.can("write")).toBe(true);
    expect(served.current.can("read", 1)).toBe(false);
    expect(served.current.known).toBe(true);
  });

  it("permission revoked after loading: a re-render with docinfo.permissions.write 0 removes Save (FrappeFormView over usePermissions)", () => {
    const plain = { ...MEMO(1), is_submittable: 0 } as DocTypeMeta;
    function Live({ info }: { info: DocInfo }) {
      const p = usePermissions(bundleOf(plain), memo(), info);
      return <FrappeFormView bundle={bundleOf(plain)} doc={memo()} docinfo={info} permissions={p} onSave={async (d) => d} />;
    }
    const r = mount(<Live info={docinfo({ read: 1, write: 1 })} />, noop, { user: "u@x", roles: ["Clerk"] });
    expect(button(en.formSave)).toBeTruthy();
    expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
    r.rerender(<Live info={docinfo({ read: 1, write: 0 })} />);
    expect(button(en.formSave)).toBeNull();
    expect(screen.queryAllByRole("textbox")).toEqual([]);
    expect(unknownNotice()).toBeNull(); // known AND denied — not "unknown"
  });
});

// ---- 3. unknown roles in the form (rule 9) -------------------------------------------------------------------------------

describe("SIMULATED unknown roles in FrappeForm", () => {
  it("a saved doc in a workflow without session.roles: read-only with the 'Read only' notice even though docinfo.permissions grants write", async () => {
    mount(<FrappeForm doctype="Flow Memo" name="F-1" />, site(), { user: "u@x" });
    expect(await screen.findByRole("heading", { name: "Flow plan" })).toBeTruthy();
    await tick();
    expect(unknownNotice()?.textContent).toBe(en.formReadOnly);
    expect(screen.queryAllByRole("textbox")).toEqual([]);
    expect(button(en.formSave)).toBeNull();
  });

  it("the same doc with the role that may edit the state: editable, no notice (Approve / Reject path kept)", async () => {
    mount(<FrappeForm doctype="Flow Memo" name="F-1" />, site(), { user: "u@x", roles: ["Approver"] });
    expect(await screen.findByRole("heading", { name: "Flow plan" })).toBeTruthy();
    await tick();
    expect(unknownNotice()).toBeNull();
    expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
  });

  it("bulk menu inputs without roles: empty (usePermissions().can for the DocType → bulkMenu)", () => {
    const { wrapper } = harness(noop, { user: "u@x" });
    const { result } = renderHook(() => usePermissions(bundleOf(MEMO(1))), { wrapper });
    expect(bulkMenu({ permissions: (p) => result.current.can(p), isSubmittable: true, hasWorkflow: false, allowEdit: true, hasEditableFields: true })).toEqual([]);
    expect(result.current.known).toBe(false);
  });
});

// ---- 4. Cancel All (P3-1) ------------------------------------------------------------------------------------------------

describe("SIMULATED Cancel All is offered only when the user may cancel every linked DocType (P3-1)", () => {
  const cancelRight: FormPermissions = { can: (p) => p === "read" || p === "cancel", known: true };
  const openDialog = async () => {
    fireEvent.click(screen.getByRole("button", { name: en.formCancelDoc }));
    return screen.findByRole("dialog");
  };
  const viewWith = (canCancelAllLinked?: FormPermissions["can"] | (() => boolean | undefined | Promise<boolean | undefined>)) => {
    const cancelAllLinkedDocs = vi.fn(async () => {});
    mount(<FrappeFormView bundle={bundleOf(MEMO(1))} doc={memo({ docstatus: 1 })} permissions={cancelRight} onSave={async (d) => d}
      onCancelDoc={async (d) => ({ ...d, docstatus: 2 })} getSubmittedLinkedDocs={async () => ({ docs: LINKED, count: 1 })}
      cancelAllLinkedDocs={cancelAllLinkedDocs} canCancelAllLinked={canCancelAllLinked as never} />);
    return { cancelAllLinkedDocs };
  };

  it("no canCancelAllLinked (unknown): no Cancel All; the explanation is marked data-permissions=unknown (before dev.31 it was offered)", async () => {
    viewWith(undefined);
    const dialog = await openDialog();
    expect(within(dialog).queryByRole("button", { name: en.formCancelAll })).toBeNull();
    const why = within(dialog).getByText(en.formNoCancelAllPermission);
    expect(why.getAttribute("data-permissions")).toBe("unknown");
  });

  it("canCancelAllLinked answering undefined: the same", async () => {
    viewWith(() => undefined);
    const dialog = await openDialog();
    expect(within(dialog).queryByRole("button", { name: en.formCancelAll })).toBeNull();
    expect(within(dialog).getByText(en.formNoCancelAllPermission).getAttribute("data-permissions")).toBe("unknown");
  });

  it("canCancelAllLinked answering false: Desk's explanation (form.js:928-930), data-permissions=denied", async () => {
    viewWith(() => false);
    const dialog = await openDialog();
    expect(within(dialog).queryByRole("button", { name: en.formCancelAll })).toBeNull();
    expect(within(dialog).getByText(en.formNoCancelAllPermission).getAttribute("data-permissions")).toBe("denied");
  });

  it("canCancelAllLinked answering true: Cancel All is offered and calls cancel_all_linked_docs", async () => {
    const { cancelAllLinkedDocs } = viewWith(async () => true);
    const dialog = await openDialog();
    expect(within(dialog).queryByText(en.formNoCancelAllPermission)).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: en.formCancelAll }));
    await tick();
    expect(cancelAllLinkedDocs).toHaveBeenCalledWith(LINKED);
  });

  it("FrappeForm without session.roles: Cancel (server docinfo grants it) but no Cancel All — canCancelDoctype is unknown", async () => {
    mount(<FrappeForm doctype="Memo" name="M-1" />, site(), { user: "u@x" });
    expect(await screen.findByRole("heading", { name: "Plan" })).toBeTruthy();
    const dialog = await openDialog();
    expect(within(dialog).queryByRole("button", { name: en.formCancelAll })).toBeNull();
    expect(within(dialog).getByText(en.formNoCancelAllPermission).getAttribute("data-permissions")).toBe("unknown");
  });

  for (const [label, session] of ADMIN_SESSIONS) {
    it(`FrappeForm for the Administrator ${label}: Cancel All is offered`, async () => {
      mount(<FrappeForm doctype="Memo" name="M-1" />, site(), session);
      expect(await screen.findByRole("heading", { name: "Plan" })).toBeTruthy();
      const dialog = await openDialog();
      expect(await within(dialog).findByRole("button", { name: en.formCancelAll })).toBeTruthy();
    });
  }

  it("FrappeForm with a role that cancels the linked DocType: offered; with a role that does not: Desk's explanation", async () => {
    mount(<FrappeForm doctype="Memo" name="M-1" />, site(), { user: "u@x", roles: ["Clerk"] });
    expect(await screen.findByRole("heading", { name: "Plan" })).toBeTruthy();
    expect(await within(await openDialog()).findByRole("button", { name: en.formCancelAll })).toBeTruthy();
    cleanup();
    // Reader has no cancel row; docinfo (simulated: full) still gives the Cancel button on the document itself
    mount(<FrappeForm doctype="Memo" name="M-1" />, site(), { user: "u@x", roles: ["Reader"] });
    expect(await screen.findByRole("heading", { name: "Plan" })).toBeTruthy();
    const dialog = await openDialog();
    expect(within(dialog).queryByRole("button", { name: en.formCancelAll })).toBeNull();
    expect((await within(dialog).findByText(en.formNoCancelAllPermission)).getAttribute("data-permissions")).toBe("denied");
  });
});

// ---- 5. workflow actions (P2-3; Administrator P2-4) ---------------------------------------------------------------------

describe("SIMULATED workflow actions: the server's get_transitions answer is authoritative; missing information denies (P2-3)", () => {
  const flowDoc = (extra: Partial<FrappeDoc> = {}): FrappeDoc => ({ doctype: "Flow Memo", name: "F-1", title: "Flow plan", docstatus: 0, workflow_state: "Draft", owner: "author@x", modified: "2026-11-03 10:00:00.000000", ...extra });
  const definition = FLOW_WF.transitions as WorkflowTransition[];
  const actionsOf = (ts: WorkflowTransition[]) => ts.map((t) => t.action);
  const openActions = async () => {
    const b = await screen.findByRole("button", { name: en.recActions });
    fireEvent.keyDown(b, { key: "Enter" });
  };

  it("pure: roles unknown and the list is NOT the server's (client-side, from the definition) → nothing, transitionsKnown false", () => {
    expect(visibleTransitions(definition, { user: "u@x", doc: flowDoc() })).toEqual([]);
    expect(transitionsKnown({ user: "u@x" })).toBe(false);
    // with roles the client may filter the definition itself (Desk form/workflow.js:103)
    expect(actionsOf(visibleTransitions(definition, { user: "u@x", doc: flowDoc(), roles: ["Approver"] }))).toEqual(["Approve", "Reject"]);
    expect(visibleTransitions(definition, { user: "u@x", doc: flowDoc(), roles: ["Clerk"] })).toEqual([]);
    expect(transitionsKnown({ user: "u@x", roles: ["Clerk"] })).toBe(true);
  });

  it("pure: the server's answer without roles is kept (model/workflow.py:64-67 filtered it); self-approval still applies (:221-222)", () => {
    expect(actionsOf(visibleTransitions(definition, { user: "u@x", doc: flowDoc(), fromServer: true }))).toEqual(["Approve", "Reject"]);
    expect(actionsOf(visibleTransitions(definition, { user: "author@x", doc: flowDoc(), fromServer: true }))).toEqual(["Reject"]);
    expect(transitionsKnown({ user: "u@x", fromServer: true })).toBe(true);
  });

  it("pure: user unknown → only allow_self_approval transitions (approval holds for anyone); transitionsKnown false", () => {
    expect(actionsOf(visibleTransitions(definition, { user: "", doc: flowDoc(), fromServer: true }))).toEqual(["Reject"]);
    expect(actionsOf(visibleTransitions(definition, { user: "", doc: flowDoc(), roles: ["Approver"] }))).toEqual(["Reject"]);
    expect(transitionsKnown({ user: "", roles: ["Approver"], fromServer: true })).toBe(false);
  });

  for (const [label, session] of ADMIN_SESSIONS) {
    it(`pure: the Administrator ${label} — every transition of the state, no self-approval block, never read-only (permissions.py:506-507; workflow.py:222)`, () => {
      const own = flowDoc({ owner: "Administrator" });
      for (const fromServer of [true, false]) {
        expect(actionsOf(visibleTransitions(definition, { user: "Administrator", doc: own, roles: session.roles, fromServer }))).toEqual(["Approve", "Reject"]);
      }
      expect(transitionsKnown({ user: "Administrator", roles: session.roles })).toBe(true);
      const wf = workflowFromMeta({ name: "Flow Memo", __workflow_docs: [{ doctype: "Workflow", ...FLOW_WF }] })!;
      expect(isReadOnlyState(wf, own, session.roles, "Administrator")).toBe(false);
    });
  }

  it("pure: workflow read-only state — roles unknown → read-only (rule 9; before dev.31 useWorkflow said false); allow_edit role → editable", () => {
    const wf = workflowFromMeta({ name: "Flow Memo", __workflow_docs: [{ doctype: "Workflow", ...FLOW_WF }] })!;
    expect(isReadOnlyState(wf, flowDoc(), undefined, "u@x")).toBe(true);
    expect(isReadOnlyState(wf, flowDoc(), ["Approver"], "u@x")).toBe(false);
    expect(isReadOnlyState(wf, flowDoc(), ["Clerk"], "u@x")).toBe(true);
    expect(isReadOnlyState(wf, { ...flowDoc(), __islocal: 1 }, undefined, "u@x")).toBe(false);
  });

  it("useWorkflow without roles over the simulator: the server's transitions are offered, readOnly true, transitionsKnown true", async () => {
    const { wrapper } = harness(site(), { user: "u@x" });
    const { result } = renderHook(() => useWorkflow({ doc: flowDoc(), user: "u@x" }), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(actionsOf(result.current.transitions)).toEqual(["Approve", "Reject"]);
    expect(result.current.readOnly).toBe(true);
    expect(result.current.transitionsKnown).toBe(true);
    // the server answering nothing for the user's roles (simulated: roles ["Clerk"]) → nothing offered, still known
    const other = harness(site({ roles: ["Clerk"] }), { user: "u@x" });
    const { result: none } = renderHook(() => useWorkflow({ doc: flowDoc(), user: "u@x" }), { wrapper: other.wrapper });
    await waitFor(() => expect(none.current.isLoading).toBe(false));
    expect(none.current.transitions).toEqual([]);
    expect(none.current.transitionsKnown).toBe(true);
  });

  it("FrappeWorkflowActions with an unknown user: only the self-approvable action, and a visible 'permissions unknown' state", async () => {
    mount(<FrappeWorkflowActions doc={flowDoc()} user="" />, site(), { user: "u@x" });
    const note = await waitFor(() => { const n = unknownNotice(); expect(n).toBeTruthy(); return n!; });
    expect(note.textContent).toBe(en.formReadOnly);
    await openActions();
    expect(await screen.findByRole("menuitem", { name: "Reject" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Approve" })).toBeNull();
  });

  it("get_transitions refused (403): no Actions, the state stays visible with the error — not an empty silence", async () => {
    mount(<FrappeWorkflowActions doc={flowDoc()} user="u@x" roles={["Approver"]} />, deny(["frappe.model.workflow.get_transitions"], site()), { user: "u@x", roles: ["Approver"] });
    expect(await screen.findByText(en.feErrPermission)).toBeTruthy();
    expect(screen.getByText("Draft")).toBeTruthy();
    expect(screen.queryByRole("button", { name: en.recActions })).toBeNull();
    expect(document.querySelector('[data-workflow-actions="unavailable"]')).toBeTruthy();
  });

  it("revocation: when get_transitions re-answers empty, the actions disappear", async () => {
    let answer: WorkflowTransition[] = definition;
    const r = mount(<FrappeWorkflowActions doc={flowDoc()} user="u@x" roles={["Approver"]} />, site({ handlers: { "frappe.model.workflow.get_transitions": () => ({ message: answer }) } }), { user: "u@x", roles: ["Approver"] });
    expect(await screen.findByRole("button", { name: en.recActions })).toBeTruthy();
    answer = [];
    await act(async () => { await r.qc.invalidateQueries({ queryKey: ["sf-frappe", "workflow-transitions"] }); });
    await waitFor(() => expect(screen.queryByRole("button", { name: en.recActions })).toBeNull());
    expect(screen.getByText("Draft")).toBeTruthy();
    expect(unknownNotice()).toBeNull(); // the server answered: nothing for you — known, not unknown
  });

  it("Approve path with known roles (FrappeForm): Actions → Approve → apply_workflow → Approved", async () => {
    const transport = site();
    mount(<FrappeForm doctype="Flow Memo" name="F-1" />, transport, { user: "approver@x", roles: ["Approver"] });
    expect(await screen.findByRole("heading", { name: "Flow plan" })).toBeTruthy();
    await openActions();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Approve" }));
    await waitFor(() => expect(transport.store.calls.some((c) => c.method === "frappe.model.workflow.apply_workflow")).toBe(true));
    expect(await screen.findAllByText("Approved")).toBeTruthy();
  });

  for (const [label, session] of ADMIN_SESSIONS) {
    it(`FrappeForm for the Administrator ${label}: Approve and Reject on a doc it owns, server roles notwithstanding`, async () => {
      // the simulated server lists only "Approver" transitions; the Administrator's partial role list must not filter them away
      mount(<FrappeForm doctype="Flow Memo" name="F-1" />, site({ docs: { "Flow Memo": [flowDoc({ owner: "Administrator" })] } }), session);
      expect(await screen.findByRole("heading", { name: "Flow plan" })).toBeTruthy();
      await openActions();
      expect(await screen.findByRole("menuitem", { name: "Approve" })).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: "Reject" })).toBeTruthy();
      expect(unknownNotice()).toBeNull();
    });
  }

  it("server-side refusal: 403 on apply_workflow → the error is shown, the doc and the cache are unchanged (no optimistic state)", async () => {
    const r = mount(<FrappeWorkflowActions doc={flowDoc()} user="u@x" roles={["Approver"]} />, deny(["frappe.model.workflow.apply_workflow"], site()), { user: "u@x", roles: ["Approver"] });
    r.qc.setQueryData(frappeKeys.doc("Flow Memo", "F-1"), flowDoc());
    await openActions();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Approve" }));
    expect((await screen.findByRole("alert")).textContent).toContain("does not have access");
    expect(screen.getByText("Draft")).toBeTruthy();
    expect(screen.queryByText("Approved")).toBeNull();
    expect((r.qc.getQueryData(frappeKeys.doc("Flow Memo", "F-1")) as FrappeDoc).workflow_state).toBe("Draft");
  });
});

// ---- 6. direct invocation of hidden actions ------------------------------------------------------------------------------

describe("SIMULATED direct invocation of hidden actions: the server refuses, the package surfaces kind 'permission' and changes nothing", () => {
  const seeded = (): FrappeDoc => ({ doctype: "Flow Memo", name: "F-1", docstatus: 0, workflow_state: "Draft", owner: "author@x", modified: "2026-11-03 10:00:00.000000" });

  it("useDocAction().applyWorkflow (no action was offered: roles unknown, user unknown) → 403 → FrappeError kind permission; cache untouched", async () => {
    const { qc, wrapper } = harness(deny(["frappe.model.workflow.apply_workflow"]), { user: "u@x" });
    qc.setQueryData(frappeKeys.doc("Flow Memo", "F-1"), seeded());
    const inv = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useDocAction(), { wrapper });
    let err: unknown;
    await act(async () => { try { await result.current.applyWorkflow.mutateAsync({ doc: seeded(), action: "Approve" }); } catch (e) { err = e; } });
    expect(err).toBeInstanceOf(FrappeError);
    expect((err as FrappeError).kind).toBe("permission");
    expect(qc.getQueryData(frappeKeys.doc("Flow Memo", "F-1"))).toEqual(seeded());
    expect(inv).not.toHaveBeenCalled();
  });

  it("api.saveDoc from a read-only form (no permissions known) → 403 → kind permission", async () => {
    const client = createFrappeClient({ transport: deny(["frappe.desk.form.save.savedocs"]) });
    await expect(client.saveDoc({ ...memo(), title: "edited", __unsaved: 1 }, "Save")).rejects.toMatchObject({ kind: "permission", status: 403 });
  });

  it("bulkDelete while the bulk menu is empty (roles unknown) → 403 → kind permission; nothing reported as deleted", async () => {
    const { wrapper } = harness(noop, { user: "u@x" });
    const { result } = renderHook(() => usePermissions(bundleOf(MEMO(1))), { wrapper });
    expect(bulkMenu({ permissions: (p) => result.current.can(p), isSubmittable: true, hasWorkflow: false, allowEdit: true, hasEditableFields: true })).not.toContain("delete");
    const client = createFrappeClient({ transport: deny(["frappe.desk.reportview.delete_items"]) });
    await expect(bulkDelete(client, "Memo", ["M-1", "M-2"])).rejects.toMatchObject({ kind: "permission" });
  });
});

// ---- 7. replayed from recorded REAL responses (Administrator) -----------------------------------------------------------

/**
 * REPLAYED — recorded real Frappe 15.110 responses (tests/fixtures/real-15.110-sada/, captured in-process as Administrator
 * inside one READ ONLY transaction; see tests/real/sada-real.test.tsx). Not a live session, no writes. What they show:
 * the server's `get_roles("Administrator")` list (it holds "System Manager" and "Administrator"), the server's
 * `get_doc_permissions` for the Administrator (every right; `submit` 0 and `import` 0 on these non-submittable,
 * allow_import 0 DocTypes — permissions.py:217-221), and a second full-rights user whose roles do NOT include
 * "Administrator" (permissions.py:515).
 */
describe("REPLAYED recorded real responses: the Administrator as the 15.110 server reported it (P2-4, P3-6)", () => {
  type Holder = { user: string; roles: string[]; doc_permissions: Record<string, Record<string, unknown>> };
  const R = realSada as unknown as Record<string, FrappeResponse>;
  const holders = R["permissions::sada-role-holders"] as unknown as Holder[];
  const admin = holders.find((h) => h.user === "Administrator")!;
  const other = holders.find((h) => h.user !== "Administrator")!;
  const bundle = toMetaBundle("Sada Post Type", R["getdoctype::Sada Post Type"]);
  const recordedDoc = (R["getdoc::Sada Post Type::post Type1"].docs as FrappeDoc[])[0];
  const recordedInfo = normalizeDocInfo(R["getdoc::Sada Post Type::post Type1"].docinfo);

  it("the recorded get_roles('Administrator') holds System Manager and Administrator; another full-rights user's roles never hold 'Administrator'", () => {
    expect(admin.roles).toContain("System Manager");
    expect(admin.roles).toContain("Administrator");
    expect(other.roles).toContain("System Manager");
    expect(other.roles).not.toContain("Administrator"); // automatic role, never read from Has Role (permissions.py:37, :515)
  });

  it("canImport / canExport: the session alone answers what the recorded role list answers", () => {
    const level0 = buildDocPermissions({ meta: bundle.meta, session: { user: "Administrator" } })[0];
    expect(canExport({ user: "Administrator" }, level0)).toBe(canExport(admin.roles, level0));
    expect(canExport({ user: "Administrator" }, level0)).toBe(true);
    expect(canImport(bundle.meta, { user: "Administrator" }, level0)).toBe(canImport(bundle.meta, admin.roles, level0));
    expect(canImport(bundle.meta, { user: "Administrator" }, level0)).toBe(false); // allow_import 0 on this DocType; recorded import: 0 agrees
  });

  for (const roles of [undefined, "recorded"] as const) {
    it(`usePermissions for the Administrator (${roles ? "recorded role list" : "no role list"}) grants every right the server granted; submit / import (0 on the server) lead to no action`, () => {
      const server = admin.doc_permissions["Sada Post Type"];
      const { wrapper } = harness(noop, { user: "Administrator", roles: roles ? admin.roles : undefined });
      const { result } = renderHook(() => usePermissions(bundle, recordedDoc, recordedInfo), { wrapper });
      for (const [right, v] of Object.entries(server)) if (v === 1) expect(result.current.can(right as never), right).toBe(true);
      expect(server.submit).toBe(0); expect(server.import).toBe(0);
      // the package grants by has_permission (:107-109), not by this docinfo; every action that uses submit / import also
      // checks is_submittable / allow_import, so nothing more is offered than the server's own answer allows
      const acts = formActions({ docstatus: 0, isNew: false, dirty: false, isSubmittable: !!bundle.meta.is_submittable, perms: { write: result.current.can("write"), create: result.current.can("create"), submit: result.current.can("submit"), cancel: result.current.can("cancel"), amend: result.current.can("amend") } });
      expect(acts.primary).not.toBe("Submit");
      expect(bulkMenu({ permissions: (p) => result.current.can(p), isSubmittable: !!bundle.meta.is_submittable, hasWorkflow: false, allowEdit: false, hasEditableFields: true })).not.toContain("submit");
      expect(canImport(bundle.meta, { user: "Administrator" }, result.current.levels[0])).toBe(false);
      expect(result.current.known).toBe(true);
    });
  }
});
