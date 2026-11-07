/**
 * FrappeRecordMenu — Desk's form "⋯" menu for a Frappe document: `formMenuItems` (formMenu.ts, toolbar.js rules)
 * rendered by the Core `RecordMenu`, wired to the server through the package's own hooks:
 *  - Duplicate → `copyDoc(bundle, doc)` (form/model/copy.ts, Desk create_new.js copy_doc) → `onDuplicate(copy)`;
 *    nothing is saved until the host saves the copy.
 *  - Copy to Clipboard → `JSON.stringify(doc)` (toolbar.js:424-431).
 *  - Rename → Core `RenameDialog` → `useDocAction().rename` (`frappe.rename_doc(doctype, old, new, merge)`, model.js:733-779)
 *    → `onRenamed(newName)`.
 *  - Delete → confirm "Permanently delete {title}?" (model.js:703-729) → `useDocAction().remove` (`frappe.client.delete`)
 *    → `onDeleted()`. A refusal (no delete right, submitted) is shown under the menu.
 *  - Reload → `onReload()` (asks first when `dirty`). New → `onNew()`. Links → `onShowConnections()`.
 *  - Print / Email / Remind Me → the package's FrappeFormPrint / FrappeEmailComposer / FrappeReminder dialogs, unless
 *    the host passes `onPrint` / `onEmail` / `onRemind`.
 *  - Customize → `onCustomize(href)` (default: navigate to the Desk URL), System Manager / Administrator only.
 *  - Undo / Redo → the host's `undo` state and callbacks.
 * `exclude` drops entries by id; `extra` appends the host's own items (Core `RecordMenuItem`).
 * Rights: `permissions.can` (default `usePermissions(bundle, doc, docinfo)`) — a client mirror; the server decides.
 */
import * as React from "react";
import { RecordMenu, type RecordMenuItem } from "../../record/RecordMenu";
import { RenameDialog } from "../../record/RenameDialog";
import { fmt } from "../../record/format";
import { useLocale } from "../../theme/ThemeProvider";
import type { Messages } from "../../theme/messages";
import type { DocInfo, FrappeDoc, MetaBundle, PermType } from "../contract";
import { useFrappeSettings } from "../FrappeProvider";
import { copyDoc } from "../form/model/copy";
import { useDocAction } from "../hooks/useDocMutations";
import { usePermissions } from "../hooks/usePermissions";
import type { PrintSettingsInput } from "../list/print";
import { useRecordDocInfo } from "./data";
import { customizeHref, formMenuItems, type FormMenuId } from "./formMenu";
import { FrappeEmailComposer, type FrappeEmailComposerProps } from "./FrappeEmailComposer";
import { FrappeFormPrint, type FrappeFormPrintProps } from "./FrappeFormPrint";
import { FrappeReminder } from "./FrappeReminder";

export interface FrappeRecordMenuProps {
  bundle: MetaBundle;
  /** The document as the form holds it (Copy to Clipboard / Duplicate use it; Delete / Rename use its name). */
  doc: FrappeDoc;
  docinfo?: DocInfo;
  /** The form has unsaved changes (Reload asks first; Print warns). */
  dirty?: boolean;
  /** Rights. Default: `usePermissions(bundle, doc, docinfo)`. */
  permissions?: { can(ptype: PermType): boolean };
  printSettings?: PrintSettingsInput;
  onDuplicate?: (copy: FrappeDoc) => void;
  onRenamed?: (newName: string) => void;
  onDeleted?: () => void;
  onReload?: () => unknown;
  onNew?: () => void;
  /** Jump to the Connections tab. Without it "Links" is not offered. */
  onShowConnections?: () => void;
  /** Replace the built-in dialogs. */
  onPrint?: () => void;
  onEmail?: () => void;
  onRemind?: () => void;
  /** Customize target (Desk URL, see `customizeHref`). Default: `window.location.assign(deskUrl + href)`. */
  onCustomize?: (href: string) => void;
  /** Desk origin for Customize and the print links. Default "". */
  deskUrl?: string;
  undo?: { canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void };
  exclude?: FormMenuId[] | string[];
  extra?: RecordMenuItem[];
  /** After Copy to Clipboard. */
  onCopied?: (text: string) => void;
  /** Clipboard writer (default `navigator.clipboard.writeText`). */
  writeClipboard?: (text: string) => Promise<void>;
  /** Passed to the built-in print dialog. */
  printProps?: Partial<Pick<FrappeFormPrintProps, "pdf" | "dir" | "baseUrl">>;
  /** Passed to the built-in e-mail composer. */
  emailProps?: Partial<Pick<FrappeEmailComposerProps, "templates" | "searchRecipients" | "initial" | "onSent">>;
  /** After a reminder was created. */
  onReminderCreated?: (r: { remindAt: string; name?: string }) => void;
  className?: string;
}

const LABEL: Record<FormMenuId, keyof Messages> = {
  print: "r35Print", email: "r35Email", links: "r35Links", duplicate: "r35Duplicate", copy: "r35CopyToClipboard", rename: "r35Rename",
  reload: "r35Reload", delete: "r35Delete", remind: "r35RemindMe", undo: "r35Undo", redo: "r35Redo", customize: "r35Customize", new: "r35New",
};

export function FrappeRecordMenu(props: FrappeRecordMenuProps) {
  const { bundle, doc, dirty, printSettings, exclude, extra, className } = props;
  const { t } = useLocale();
  const meta = bundle.meta;
  const { session } = useFrappeSettings();
  const actions = useDocAction();
  const info = useRecordDocInfo(doc.__islocal ? undefined : doc.doctype, doc.name, props.docinfo);
  const own = usePermissions(bundle, doc, info.data);
  const can = props.permissions?.can ?? own.can;
  const [dialog, setDialog] = React.useState<null | "rename" | "print" | "email" | "remind">(null);
  const [notice, setNotice] = React.useState("");
  const roles = session?.user === "Administrator" ? [...(session.roles ?? []), "Administrator"] : session?.roles;

  const entries = formMenuItems({
    meta, doc, can, dirty, printSettings, roles, exclude,
    undo: props.undo ? { canUndo: props.undo.canUndo, canRedo: props.undo.canRedo } : undefined,
    has: { links: !!props.onShowConnections, duplicate: !!props.onDuplicate, reload: !!props.onReload, new: !!props.onNew },
  });

  const titleValue = meta.title_field ? doc[meta.title_field] : undefined;
  const deleteTitle = meta.autoname === "hash" && titleValue ? `${String(titleValue)} (${doc.name})` : doc.name;
  const writeClipboard = props.writeClipboard ?? ((text: string) => navigator.clipboard.writeText(text));

  const run: Record<FormMenuId, () => unknown> = {
    print: () => (props.onPrint ? props.onPrint() : setDialog("print")),
    email: () => (props.onEmail ? props.onEmail() : setDialog("email")),
    links: () => props.onShowConnections?.(),
    duplicate: () => props.onDuplicate?.(copyDoc(bundle, doc, { user: session?.user })),
    copy: async () => {
      const text = JSON.stringify(doc);
      try { await writeClipboard(text); } catch { throw new Error(t("r35CopyFailed")); }
      setNotice(t("r35Copied")); props.onCopied?.(text);
    },
    rename: () => setDialog("rename"),
    reload: () => props.onReload?.(),
    delete: async () => {
      await actions.remove.mutateAsync({ doctype: doc.doctype, name: doc.name });
      setNotice(fmt(t("r35Deleted"), doc.name)); props.onDeleted?.();
    },
    remind: () => (props.onRemind ? props.onRemind() : setDialog("remind")),
    undo: () => props.undo?.onUndo(),
    redo: () => props.undo?.onRedo(),
    customize: () => {
      const href = customizeHref(meta);
      if (props.onCustomize) props.onCustomize(href); else window.location.assign(`${props.deskUrl ?? ""}${href}`);
    },
    new: () => props.onNew?.(),
  };

  const items: RecordMenuItem[] = [
    ...entries.map((e): RecordMenuItem => ({
      id: e.id, group: e.group, shortcut: e.shortcut, destructive: e.destructive, disabled: e.disabled,
      label: e.id === "new" ? fmt(t("r35New"), meta.name) : t(LABEL[e.id]),
      confirm: !e.confirm ? undefined
        : e.id === "delete" ? { title: fmt(t("r35DeleteConfirm"), deleteTitle), body: t("r35ConfirmBody"), confirmLabel: t("r35Delete") }
        : e.id === "reload" ? { body: t("r35ReloadDirty"), confirmLabel: t("r35Reload") } : true,
      onSelect: () => { setNotice(""); return run[e.id]() as void | Promise<unknown>; },
    })),
    ...(extra ?? []).map((x) => ({ group: "extra", ...x })),
  ];

  const autonameField = typeof meta.autoname === "string" && meta.autoname.startsWith("field:") ? meta.autoname.slice(6) : "";
  const autonameLabel = autonameField ? meta.fields.find((f) => f.fieldname === autonameField)?.label : undefined;

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        {notice && <span role="status" className="text-xs text-muted-foreground">{notice}</span>}
        <RecordMenu items={items} />
      </div>
      <RenameDialog
        open={dialog === "rename"} onOpenChange={(o) => setDialog(o ? "rename" : null)} name={doc.name}
        nameLabel={autonameLabel ? fmt(t("r35New"), autonameLabel) : undefined}
        onRename={async ({ newName, merge }) => {
          const next = await actions.rename.mutateAsync({ doctype: doc.doctype, name: doc.name, newName, merge });
          setNotice(fmt(t("r35Renamed"), next || newName)); props.onRenamed?.(next || newName);
        }}
      />
      {dialog === "print" && (
        <FrappeFormPrint doc={doc} meta={meta} open onOpenChange={(o) => setDialog(o ? "print" : null)} settings={printSettings} dirty={dirty}
          canPrint={can("print")} baseUrl={props.printProps?.baseUrl ?? props.deskUrl} pdf={props.printProps?.pdf} dir={props.printProps?.dir} />
      )}
      {dialog === "email" && (
        <FrappeEmailComposer doc={doc} meta={meta} docinfo={info.data} open onOpenChange={(o) => setDialog(o ? "email" : null)} canEmail={can("email")}
          printSettings={printSettings} {...props.emailProps} />
      )}
      {dialog === "remind" && (
        <FrappeReminder doc={doc} open onOpenChange={(o) => setDialog(o ? "remind" : null)} onCreated={(r) => { setNotice(fmt(t("r35ReminderSet"), r.remindAt)); props.onReminderCreated?.(r); }} />
      )}
    </div>
  );
}
