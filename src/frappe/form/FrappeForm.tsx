/**
 * FrappeForm — `<FrappeForm doctype name />`: FrappeFormView over the foundation hooks (CONTRACT §2):
 * `useMetaBundle` (getdoctype), `useDoc` (getdoc + docinfo), `usePermissions` (Desk's frm.perm, display ladder),
 * `useSaveDoc` (savedocs; cache rules), `useDocAction().cancel` (desk.form.save.cancel).
 * Without `name` (or with a `new-…` name) it opens a new document with Desk's defaults (session user from the
 * FrappeProvider). Loading → skeleton; failure → FrappeErrorState with retry.
 */
import * as React from "react";
import { Skeleton } from "../../primitives/skeleton";
import type { FrappeDoc } from "../contract";
import { useFrappeSettings } from "../FrappeProvider";
import { useDoc, useMetaBundle } from "../hooks/useDoc";
import { useDocAction, useSaveDoc } from "../hooks/useDocMutations";
import { usePermissions } from "../hooks/usePermissions";
import { FrappeErrorState } from "../feedback/FrappeErrorState";
import { newDoc, type DefaultsContext } from "./model/defaults";
import { FrappeFormView, type FrappeFormViewProps } from "./FrappeFormView";

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
        const wf = permissions.workflow;
        const r = await cancel.mutateAsync({ doctype, name: d.name, ...(wf ? { workflowStateField: wf.workflow_state_field } : {}) });
        setSaved(r);
        return r;
      }}
    />
  );
}
