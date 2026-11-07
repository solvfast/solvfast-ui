/**
 * FrappeForm — `<FrappeForm doctype name />`: FrappeFormView over the foundation hooks (CONTRACT §2):
 * `useMetaBundle` (getdoctype), `useDoc` (getdoc + docinfo), `usePermissions` (Desk's frm.perm, display ladder),
 * `useSaveDoc` (savedocs; cache rules), `useDocAction().cancel` (desk.form.save.cancel).
 * Without `name` (or with a `new-…` name) it opens a new document with Desk's defaults (session user from the
 * FrappeProvider). Loading → skeleton; failure → FrappeErrorState with retry.
 * Workflow (A4's record layer): the state badge, `canCancelDocument`, and — for a saved clean document with
 * transitions for the user — FrappeWorkflowActions in the toolbar replacing Save / Submit / Cancel (toolbar.js:593,
 * 668-699). Cancel posts the workflow state field and its current value (save.js:48-52). Cancel pre-flight:
 * `get_submitted_linked_docs` / `cancel_all_linked_docs`; Amend is disabled when `is_document_amended`.
 */
import * as React from "react";
import { isAdministrator, rolePermissions } from "../services/permissions";
import type { DocTypeMeta, FrappeDoc } from "../contract";
import { useFrappeSettings } from "../FrappeProvider";
import { useDoc, useMetaBundle } from "../hooks/useDoc";
import { useDocAction, useSaveDoc } from "../hooks/useDocMutations";
import { usePermissions } from "../hooks/usePermissions";
import { FrappeErrorState } from "../feedback/FrappeErrorState";
import { useFrappeApi } from "../FrappeProvider";
import { useWorkflow } from "../record/useWorkflow";
import { FrappeWorkflowActions } from "../record/FrappeWorkflowActions";
import { newDoc, type DefaultsContext } from "./model/defaults";
import { FrappeFormView, type FrappeFormViewProps, type LinkedDoc } from "./FrappeFormView";
import type { FormController } from "./events";
import { FrappeFormServices } from "./services";
import { useQuickEntryHost } from "./FrappeQuickEntry";

export interface FrappeFormProps extends Omit<FrappeFormViewProps, "bundle" | "doc" | "docinfo" | "permissions" | "onSave" | "onCancelDoc"> {
  doctype: string;
  /** A saved document's name; omit (or pass a `new-…` name) for a new document. */
  name?: string;
  /** Defaults for a new document: route options, user defaults (`userDefaults` — e.g. `readFrappeBoot().userDefaults`),
   *  typed name (`nameField`). */
  newDocDefaults?: DefaultsContext;
  /** Quick Entry's "Edit Full Form" / a not-eligible target (P35): route to the full form with this unsaved document. */
  onOpenFullForm?: (doc: FrappeDoc) => void;
}

const isNewName = (name?: string) => !name || name.startsWith("new-");

type SessionLike = { user?: string; roles?: string[] } | undefined;

/**
 * Desk `frappe.model.can_cancel(doctype)` (model.js:400-402): the DocType is in boot `can_cancel`, which the server
 * builds from the user's roles × the DocType's level-0 permission rows (utils/user.py:149-150 over `get_valid_perms`).
 * The Administrator USER (keyed on the user name — `isAdministrator` from services, P3-6): true for every DocType, with or
 * without a role list — `cancel_all_linked_docs` → `linked_doc.cancel()` is never refused to it (permissions.py:107-109;
 * Desk's boot list would name only DocTypes with some cancel row, since its roles are every Role, :506-507 — the server
 * is the authority). The "Administrator" ROLE on another user is just a role (its rows): the server never reports it for
 * anyone else (automatic role, permissions.py:37, excluded from `Has Role` at :515). Without roles: unknown (undefined),
 * and the form then offers no "Cancel All" (rule 9, P3-1).
 */
export function canCancelDoctype(meta: DocTypeMeta, session: SessionLike): boolean | undefined {
  if (isAdministrator(session)) return true;
  if (!session?.roles) return undefined;
  return !!rolePermissions(meta.permissions, session.roles).levels[0]?.cancel;
}

export { FormSkeleton } from "./FormSkeleton";
import { FormSkeleton } from "./FormSkeleton";

export function FrappeForm({ doctype, name, newDocDefaults, onOpenFullForm, ...rest }: FrappeFormProps) {
  const { session } = useFrappeSettings();
  const meta = useMetaBundle(doctype);
  const creating = isNewName(name);
  const loaded = useDoc(doctype, creating ? undefined : name);
  const save = useSaveDoc();
  const { cancel } = useDocAction();
  const bundle = meta.data;
  const [fresh, setFresh] = React.useState<FrappeDoc | null>(null);
  React.useEffect(() => {
    if (creating && bundle && !fresh) {
      setFresh(newDoc(bundle, { user: session?.user, userFullname: session?.fullName, ...newDocDefaults }));
    }
  }, [creating, bundle, fresh, session, newDocDefaults]);
  const [saved, setSaved] = React.useState<FrappeDoc | null>(null);
  const doc = saved && (!loaded.data || saved.modified !== loaded.data.doc.modified) ? saved : loaded.data?.doc ?? fresh;
  const permissions = usePermissions(bundle, doc ?? undefined, loaded.data?.docinfo);
  const api = useFrappeApi();
  const wf = useWorkflow({ doc: doc ?? undefined, user: session?.user ?? "", roles: session?.roles, enabled: !!doc });
  // "Create a new X" on a quick-entry eligible target opens FrappeQuickEntry (unless the app handles onCreateNew)
  const [quickEntry, quickEntryHost] = useQuickEntryHost(onOpenFullForm);
  const innerCtrl = React.useRef<FormController | null>(null);
  const ctrlRef = rest.controllerRef ?? innerCtrl;
  // after_workflow_action runs once the view holds the server's document (child effects run before this one)
  const [afterWf, setAfterWf] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!afterWf) return;
    const frm = ctrlRef.current;
    setAfterWf(null);
    if (!frm) return;
    frm.selectedWorkflowAction = null;
    void frm.trigger("after_workflow_action");
  }, [afterWf]); // eslint-disable-line react-hooks/exhaustive-deps
  const [amended, setAmended] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    setAmended(false);
    if (doc && doc.docstatus === 2 && !doc.__islocal) {
      void api.call("frappe.client.is_document_amended", { doctype, docname: doc.name })
        .then((r) => { if (live) setAmended(!!r.message); }, () => {});
    }
    return () => { live = false; };
  }, [api, doctype, doc?.name, doc?.docstatus]); // eslint-disable-line react-hooks/exhaustive-deps

  if (meta.isError) return <FrappeErrorState error={meta.error} onRetry={() => void meta.refetch()} />;
  if (!creating && loaded.isError) return <FrappeErrorState error={loaded.error} onRetry={() => void loaded.refetch()} />;
  if (!bundle || !doc) return <FormSkeleton />;

  return (
    <FrappeFormServices value={quickEntry}>
    <FrappeFormView
      {...rest}
      controllerRef={ctrlRef}
      bundle={bundle}
      doc={doc}
      docinfo={loaded.data?.docinfo}
      permissions={permissions}
      defaults={{ user: session?.user, ...rest.defaults }}
      onSave={async (d, action) => { const r = await save.mutateAsync({ doc: d, action }); setSaved(r); return r; }}
      onCancelDoc={async (d) => {
        const w = permissions.workflow;
        const state = w ? d[w.workflow_state_field] : undefined;
        const r = await cancel.mutateAsync({ doctype, name: d.name, ...(w ? { workflowStateField: w.workflow_state_field, ...(typeof state === "string" && state ? { workflowState: state } : {}) } : {}) });
        setSaved(r);
        return r;
      }}
      onReload={creating ? undefined : async () => {
        const r = await loaded.refetch();
        const data = r.data as unknown as (FrappeDoc & { doc?: FrappeDoc }) | undefined;
        setSaved(null);
        return data?.doc ?? data;
      }}
      getSubmittedLinkedDocs={async (d) => {
        const r = await api.call("frappe.desk.form.linked_with.get_submitted_linked_docs", { doctype, name: d.name });
        const m = (r.message ?? {}) as { docs?: LinkedDoc[]; count?: number };
        return { docs: m.docs ?? [], count: Number(m.count) || 0 };
      }}
      cancelAllLinkedDocs={async (docs) => { await api.call("frappe.desk.form.linked_with.cancel_all_linked_docs", { docs: JSON.stringify(docs) }); }}
      canCancelAllLinked={session?.roles || isAdministrator(session) ? async (docs) => {
        const dts = [...new Set(docs.map((d) => d.doctype))];
        if (isAdministrator(session)) return true;
        const metas = await Promise.all(dts.map((dt) => api.getMetaBundle(dt)));
        return metas.every((b) => canCancelDoctype(b.meta, session));
      } : undefined}
      canCancelWithWorkflow={rest.canCancelWithWorkflow ?? (wf.workflow ? wf.standardActions.showCancel : undefined)}
      // R2-F4 / R3-F2: for a saved, clean document of a DocType that HAS a workflow (known from its meta at once), keep
      // Save / Cancel hidden until both the workflow definition and the user's transitions are known — no flash. A failed
      // load gives the standard buttons back.
      // The workflow actions are rendered only for a known session user (below): without one, nothing replaces Save /
      // Cancel, so they are not hidden (P2-3).
      workflowActionsShown={rest.workflowActionsShown ?? (
        !!session?.user && !doc.__unsaved && !doc.__islocal && !!permissions.workflow && !wf.error && (wf.isLoading || !wf.workflow || wf.transitions.length > 0)
      )}
      alreadyAmended={rest.alreadyAmended ?? amended}
      toolbarExtra={(
        <>
          {wf.workflow && !doc.__islocal && session?.user && (
            <FrappeWorkflowActions doc={doc} user={session.user} roles={session.roles} onApplied={(d) => setSaved(d)}
              // P35 F2 (form/workflow.js:96-121): check_mandatory (mandatory_depends_on included — the server never
              // checks it) → before_workflow_action with frm.selectedWorkflowAction → apply → after_workflow_action
              beforeApply={async (action) => {
                const frm = ctrlRef.current;
                if (!frm) return true;
                frm.selectedWorkflowAction = action;
                const ok = frm.checkMandatory() && (await frm.trigger("before_workflow_action"));
                if (!ok) frm.selectedWorkflowAction = null;
                return ok;
              }}
              afterApply={(action) => setAfterWf(action)} />
          )}
          {rest.toolbarExtra}
        </>
      )}
    />
    {quickEntryHost}
    </FrappeFormServices>
  );
}
