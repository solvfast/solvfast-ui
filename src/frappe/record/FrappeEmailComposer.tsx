/**
 * FrappeEmailComposer — Desk's "New Email" on a document (views/communication.js) as a dialog over the Core
 * `EmailComposer`: defaults from the document (email.ts `emailDefaults`), the document's attachments (docinfo
 * `attachments`, by File name as Desk sends them, communication.js:652-656, 699-704), Email Templates (the names from
 * `frappe.client.get_list("Email Template")` unless `templates` is given; applied with `get_email_template`), "Attach
 * Document Print" with the DocType's print formats. Send → `email.make` (email.ts), then the document's docinfo is
 * invalidated so the timeline re-reads its communications (Desk reloads the form, communication.js:840-842); the
 * server's `emails_not_sent_to` is reported. Without the e-mail right the composer refuses to send (Desk:
 * communication.js:796-799) — the server checks it too.
 */
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../primitives/dialog";
import { EmailComposer, type EmailDraft } from "../../record/EmailComposer";
import type { SearchFn } from "../../fields/autocomplete";
import { fmt } from "../../record/format";
import { useLocale } from "../../theme/ThemeProvider";
import type { DocInfo, DocTypeMeta, FrappeDoc } from "../contract";
import { useFrappeApi } from "../FrappeProvider";
import { applyDocInfoChange } from "../services/cache";
import { printFormatOptions, type PrintSettingsInput } from "../list/print";
import { EMAIL_MAKE_METHOD, EMAIL_TEMPLATE_METHOD, emailDefaults, emailMakeArgs } from "./email";
import { useRecordDocInfo } from "./data";

export interface FrappeEmailComposerProps {
  doc: FrappeDoc;
  /** For the print formats ("Attach Document Print"). Without it the option is not offered. */
  meta?: DocTypeMeta;
  /** docinfo (attachments); default: `useDocInfo`. */
  docinfo?: DocInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Override the defaults (subject, To, message …). */
  initial?: Partial<EmailDraft>;
  /** Email Template names. Default: read from the server (`frappe.client.get_list("Email Template")`); [] = no picker. */
  templates?: string[];
  /** Recipient suggestions (e.g. contacts). */
  searchRecipients?: SearchFn;
  /** `usePermissions().can("email")`; false → sending refused with Desk's message. */
  canEmail?: boolean;
  printSettings?: PrintSettingsInput;
  /** After the server accepted the e-mail. */
  onSent?: (result: { name: string; emailsNotSentTo: string }) => void;
}

export function FrappeEmailComposer({ doc, meta, docinfo, open, onOpenChange, initial, templates, searchRecipients, canEmail, printSettings, onSent }: FrappeEmailComposerProps) {
  const { t } = useLocale();
  const api = useFrappeApi();
  const qc = useQueryClient();
  const info = useRecordDocInfo(open && !doc.__islocal ? doc.doctype : undefined, doc.name, docinfo);
  const [names, setNames] = React.useState<string[] | undefined>(templates);
  const [notice, setNotice] = React.useState("");
  React.useEffect(() => {
    if (!open || templates) { setNames(templates); return; }
    let live = true;
    api.getList<{ name: string }>("Email Template", { fields: ["name"], limit_page_length: 0 })
      .then((rows) => { if (live) setNames(rows.map((r) => r.name)); })
      .catch(() => { if (live) setNames([]); });
    return () => { live = false; };
  }, [open, templates, api]);
  React.useEffect(() => { if (open) setNotice(""); }, [open]);

  const attachments = (info.data?.attachments ?? []).filter((a) => a.file_name).map((a) => ({ id: a.name, label: a.file_name, url: a.file_url }));
  const formats = meta ? printFormatOptions(meta, printSettings) : undefined;
  const loadTemplate = async (name: string) => {
    const res = await api.call(EMAIL_TEMPLATE_METHOD, { template_name: name, doc: JSON.stringify(doc) });
    const m = (res.message ?? {}) as { subject?: unknown; message?: unknown };
    return { subject: typeof m.subject === "string" ? m.subject : undefined, message: typeof m.message === "string" ? m.message : "" };
  };
  const send = async (d: EmailDraft) => {
    const res = await api.call(EMAIL_MAKE_METHOD, emailMakeArgs(doc, d));
    const m = (res.message ?? {}) as { name?: unknown; emails_not_sent_to?: unknown };
    await applyDocInfoChange(qc, doc.doctype, doc.name);
    const result = { name: String(m.name ?? ""), emailsNotSentTo: String(m.emails_not_sent_to ?? "") };
    onSent?.(result);
    if (result.emailsNotSentTo) setNotice(fmt(t("r35NotSentTo"), result.emailsNotSentTo));
    else onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("r35EmailTitle")}</DialogTitle>
          <DialogDescription>{doc.doctype} · {doc.name}</DialogDescription>
        </DialogHeader>
        {notice ? <p role="status" className="text-sm">{notice}</p> : (
          open && <EmailComposer
            key={`${doc.doctype}/${doc.name}`}
            initial={{ ...emailDefaults(doc), attachPrint: !!formats?.length, printFormat: formats?.[0], ...initial }}
            attachments={attachments}
            templates={names?.length ? names : undefined}
            loadTemplate={names?.length ? loadTemplate : undefined}
            printFormats={formats}
            searchRecipients={searchRecipients}
            disabledReason={canEmail === false ? t("r35EmailNotAllowed") : undefined}
            onSend={send}
            onDiscard={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
