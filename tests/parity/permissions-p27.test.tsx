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
import { cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { createFrappeClient, type FrappeTransport } from "../../src/frappe/client";
import { FrappeProvider } from "../../src/frappe/FrappeProvider";
import type { DocInfo, DocPerm, DocTypeMeta, FrappeDoc, MetaBundle } from "../../src/frappe/contract";
import { usePermissions } from "../../src/frappe/hooks";
import { canCancelDoctype } from "../../src/frappe/form/FrappeForm";
import {
  PERM_TYPES, buildDocPermissions, canExport, canImport, isAdministrator, isWorkflowReadOnly, permissionsKnown, type FrappeSession,
} from "../../src/frappe/services/permissions";
import { bulkMenu } from "../../src/frappe/list/bulk";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

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
