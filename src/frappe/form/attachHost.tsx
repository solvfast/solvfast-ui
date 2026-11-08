/**
 * The form an Attach / Attach Image control belongs to — Desk's `this.frm` in `form/controls/attach.js`. With a host
 * the control behaves as in a Desk form: after an upload the value is set and the FORM is saved (`frm.save()`, or
 * `frm.save("Update")` on a submitted document — attach.js:137-144); "Clear" removes the File through `remove_attach`
 * (looked up by URL in the form's docinfo) and saves (attach.js:36-46). Without a host (a control outside a form, as
 * Desk's controls without `frm`: dialogs, Quick Entry) the value is only set (attach.js:47-53).
 *
 * `FrappeFormView` is meant to provide it around its fields (see docs/components/forms.md "Attach Image");
 * an app that renders `FrappeField`s inside its own form can provide it itself.
 */
import * as React from "react";
import type { DocInfo, FrappeDoc } from "../contract";

export interface FrappeAttachHostValue {
  /** `frm.save(action)`: the form's own save pipeline (validate, mandatory, savedocs). */
  save(action: "Save" | "Update"): Promise<unknown>;
  /** The form's document as it is now (doctype, name, docstatus). */
  getDoc(): FrappeDoc;
  /** `frm.get_docinfo()` — its `attachments` give the File of a URL for "Clear" (attachments.js:199-210). */
  getDocInfo?(): DocInfo | undefined;
}

const AttachHostContext = React.createContext<FrappeAttachHostValue | null>(null);

/** Provide the form for the Attach controls below; `value={null}` cuts a nested part off its outer form. */
export function FrappeAttachHost({ value, children }: { value: FrappeAttachHostValue | null; children: React.ReactNode }) {
  return <AttachHostContext.Provider value={value}>{children}</AttachHostContext.Provider>;
}

export function useAttachHost(): FrappeAttachHostValue | null {
  return React.useContext(AttachHostContext);
}

/** Desk's save action after an attach change: "Update" on a submitted document, else "Save" (attach.js:45, 141). */
export const attachSaveAction = (doc: Pick<FrappeDoc, "docstatus"> | undefined): "Save" | "Update" => (Number(doc?.docstatus ?? 0) === 1 ? "Update" : "Save");
