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
import { Skeleton } from "../../primitives/skeleton";
import type { FrappeDoc } from "../contract";
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

export interface FrappeFormProps extends Omit<FrappeFormViewProps, "bundle" | "doc" | "docinfo" | "permissions" | "onSave" | "onCancelDoc"> {
  doctype: string;
  /** A saved document's name; omit (or pass a `new-…` name) for a new document. */
  name?: string;
  /** Defaults for a new document: route options, user defaults, typed name (`nameField`). */
  newDocDefaults?: DefaultsContext;
}

const isNewName = (name?: string) => !name || name.startsWith("new-");

function FormSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-7 w-1/3" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}
      </div>
    </div>
  );
}

export function FrappeForm({ doctype, name, newDocDefaults, ...rest }: FrappeFormProps) {
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
    <FrappeFormView
      {...rest}
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
      canCancelWithWorkflow={rest.canCancelWithWorkflow ?? (wf.workflow ? wf.standardActions.showCancel : undefined)}
      workflowActionsShown={rest.workflowActionsShown ?? (!doc.__unsaved && wf.transitions.length > 0)}
      alreadyAmended={rest.alreadyAmended ?? amended}
      toolbarExtra={(
        <>
          {wf.workflow && !doc.__islocal && session?.user && (
            <FrappeWorkflowActions doc={doc} user={session.user} roles={session.roles} onApplied={(d) => setSaved(d)} />
          )}
          {rest.toolbarExtra}
        </>
      )}
    />
  );
}
