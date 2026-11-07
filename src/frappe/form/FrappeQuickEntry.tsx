/**
 * FrappeQuickEntry — Desk's Quick Entry dialog (public/js/frappe/form/quick_entry.js) over FrappeFormView:
 *  - eligibility and fields: `quickEntryFields(meta)` (quick_entry.js:59-110); the dialog is a FrappeFormView with
 *    `fieldFilter` = those fields, so dependencies, defaults, Link validation / fetch, formEvents and the mandatory check
 *    behave as in the full form;
 *  - the new document: `newDoc` with the session user and the given `defaults` (e.g. `nameField` = the text typed in a
 *    Link, Desk's `name_field`);
 *  - Save: the form's own pipeline, saved through `useSaveDoc` (savedocs, the package's mutation). Desk's Quick Entry
 *    inserts through `frappe.client.save` instead (quick_entry.js:176-182) — the server-side insert is the same
 *    `doc.save()`; the response shape differs, the package uses its one save path. Ctrl/⌘+S saves (the dialog's form is
 *    the topmost one). Desk then offers Submit for a submittable DocType (:186-196) — not reproduced: open the full form.
 *  - "Edit Full Form" (`render_edit_in_full_page_link`): `onOpenFullForm(doc as typed so far)`;
 *  - not eligible: `onOpenFullForm(new doc)` is called and the dialog closes (Desk routes to the full form, :43-52);
 *    without `onOpenFullForm` the dialog shows the whole form instead.
 * Permissions: the inner form gets `usePermissions` — without `create` there is no Save (rule 9).
 */
import * as React from "react";
import { useLocale } from "../../theme/ThemeProvider";
import { Button } from "../../primitives/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../primitives/dialog";
import { interpolate } from "../../fields/FieldShell";
import type { FrappeDoc } from "../contract";
import { useFrappeSettings } from "../FrappeProvider";
import { useMetaBundle } from "../hooks/useDoc";
import { useSaveDoc } from "../hooks/useDocMutations";
import { usePermissions } from "../hooks/usePermissions";
import { FrappeErrorState } from "../feedback/FrappeErrorState";
import { newDoc, type DefaultsContext } from "./model/defaults";
import { quickEntryFields } from "./model/quickEntry";
import { FrappeFormView } from "./FrappeFormView";
import type { FormController } from "./events";
import { FrappeFormServices, useFormServices, type CreateNewRequest } from "./services";
import { FormSkeleton } from "./FormSkeleton";

export interface FrappeQuickEntryProps {
  doctype: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** New-document defaults (`nameField`, `routeOptions`, `userDefaults` …); the session user is added. */
  defaults?: DefaultsContext;
  /** The server's saved document. */
  onCreated: (doc: FrappeDoc) => void;
  /** "Edit Full Form" and the not-eligible fallback: the document as typed so far (unsaved, `__islocal`). */
  onOpenFullForm?: (doc: FrappeDoc) => void;
}

export function FrappeQuickEntry({ doctype, open, onOpenChange, defaults, onCreated, onOpenFullForm }: FrappeQuickEntryProps) {
  const { t } = useLocale();
  const { session } = useFrappeSettings();
  const s = useFormServices();
  const meta = useMetaBundle(open ? doctype : undefined);
  const bundle = meta.data;
  const [doc, setDoc] = React.useState<FrappeDoc | null>(null);
  const [busy, setBusy] = React.useState(false);
  const ctrl = React.useRef<FormController | null>(null);
  const save = useSaveDoc();
  const qe = React.useMemo(() => (bundle ? quickEntryFields(bundle.meta) : null), [bundle]);
  const names = React.useMemo(() => new Set(qe?.fields.map((f) => f.fieldname)), [qe]);
  const permissions = usePermissions(bundle, doc ?? undefined);
  const canSave = !!permissions.can?.("create", 0);
  const [nested, nestedHost] = useQuickEntryHost(onOpenFullForm ? (d) => onOpenFullForm(d) : undefined);

  // a fresh document per opening
  React.useEffect(() => {
    if (!open) { setDoc(null); return; }
    if (bundle && !doc) setDoc(newDoc(bundle, { user: session?.user, userFullname: session?.fullName, ...defaults }));
  }, [open, bundle, doc, session, defaults]);
  // not eligible: Desk opens the full form (quick_entry.js:43-52)
  React.useEffect(() => {
    if (open && qe && !qe.eligible && doc && onOpenFullForm) { onOpenFullForm(doc); onOpenChange(false); }
  }, [open, qe, doc, onOpenFullForm, onOpenChange]);

  const title = interpolate(t("formNewDoc"), { doctype: s.translate(bundle, doctype) });
  const filtered = !!qe?.eligible;
  const run = async () => {
    if (!ctrl.current || busy) return;
    setBusy(true);
    try { await ctrl.current.save("Save"); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" data-quick-entry={doctype}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>
        {meta.isError ? <FrappeErrorState error={meta.error} compact onRetry={() => void meta.refetch()} />
          : !bundle || !doc || (qe && !qe.eligible && onOpenFullForm) ? <FormSkeleton />
            : (
              <FrappeFormServices value={nested}>
                <FrappeFormView
                  bundle={bundle}
                  doc={doc}
                  permissions={permissions}
                  hideToolbar
                  guardUnload={false}
                  controllerRef={ctrl}
                  defaults={{ user: session?.user, ...defaults }}
                  fieldFilter={filtered ? (df) => names.has(df.fieldname) : undefined}
                  onSave={async (d, action) => save.mutateAsync({ doc: d, action })}
                  onSaved={(saved) => { onCreated(saved); onOpenChange(false); }}
                />
                {nestedHost}
              </FrappeFormServices>
            )}
        <DialogFooter className="gap-2 sm:justify-between">
          {onOpenFullForm && bundle && doc
            ? <Button type="button" variant="ghost" onClick={() => { onOpenFullForm(ctrl.current?.doc ?? doc); onOpenChange(false); }}>{t("formEditFullForm")}</Button>
            : <span />}
          <Button type="button" disabled={!bundle || !doc || !canSave} loading={busy} onClick={() => void run()}>{t("formSave")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The Quick Entry host a form gives its Link fields: services with `quickEntry` (when the app supplies no `onCreateNew`)
 * and the dialog element to render. `onCreated` writes the new name back into the Link (Desk `update_calling_link`).
 */
export function useQuickEntryHost(onOpenFullForm?: (doc: FrappeDoc) => void): [{ quickEntry: (req: CreateNewRequest) => void }, React.ReactNode] {
  const [req, setReq] = React.useState<CreateNewRequest | null>(null);
  const value = React.useMemo(() => ({ quickEntry: (r: CreateNewRequest) => setReq(r) }), []);
  const defaults = React.useMemo<DefaultsContext | undefined>(() => (req?.typed ? { nameField: req.typed } : undefined), [req]);
  const host = req ? (
    <FrappeQuickEntry
      key={`${req.doctype}:${req.df.fieldname}`}
      doctype={req.doctype}
      open
      onOpenChange={(o) => { if (!o) setReq(null); }}
      defaults={defaults}
      onCreated={(d) => req.setValue(d.name)}
      onOpenFullForm={onOpenFullForm}
    />
  ) : null;
  return [value, host];
}
