/**
 * The Frappe side of the e-mail composer (Frappe 15.110):
 *  - send: `frappe.core.doctype.communication.email.make` (communication/email.py:27-112): `has_permission(doctype,
 *    doc=name, ptype="email", throw=True)`, then a Communication is inserted (sent / medium Email, reference = the
 *    document) and — with `send_email` — queued for sending; the answer is `{ name, emails_not_sent_to }` (:200).
 *    Desk's arguments (views/communication.js:801-824): recipients / cc / bcc as the MultiSelect's comma-separated
 *    text, subject, content, doctype, name, send_email: 1, print_html, send_me_a_copy, print_format, sender,
 *    sender_full_name, email_template, attachments (File names), read_receipt, print_letterhead, send_after,
 *    print_language, in_reply_to.
 *  - Email Template: `frappe.email.doctype.email_template.email_template.get_email_template(template_name, doc)`
 *    (email_template.py:50-55) → `{ subject, message }` rendered with Jinja against the document.
 *  - defaults (form.js:1286-1295 `email_doc`): subject "{DocType}: {name}", To = `doc.email || doc.email_id ||
 *    doc.contact_email`, "Attach Document Print" checked.
 */
import type { EmailDraft } from "../../record/EmailComposer";
import type { FrappeDoc } from "../contract";

export const EMAIL_MAKE_METHOD = "frappe.core.doctype.communication.email.make";
export const EMAIL_TEMPLATE_METHOD = "frappe.email.doctype.email_template.email_template.get_email_template";

/** The arguments Desk sends to `email.make` for a draft (communication.js:801-824). */
export function emailMakeArgs(doc: FrappeDoc, d: EmailDraft): Record<string, unknown> {
  return {
    recipients: d.to.join(", "),
    cc: d.cc.join(", "),
    bcc: d.bcc.join(", "),
    subject: d.subject,
    content: d.message,
    doctype: doc.doctype,
    name: doc.name,
    send_email: 1,
    send_me_a_copy: d.sendMeACopy ? 1 : 0,
    // communication.js:791-794: without "Attach Document Print" neither print_html nor print_format is sent
    print_format: d.attachPrint && d.printFormat ? d.printFormat : null,
    email_template: d.template || null,
    attachments: JSON.stringify(d.attachments),
    read_receipt: d.readReceipt ? 1 : 0,
    print_letterhead: 1,
    send_after: null,
    in_reply_to: null,
  };
}

/** form.js:1286-1295. */
export function emailDefaults(doc: FrappeDoc): Partial<EmailDraft> {
  const to = [doc.email, doc.email_id, doc.contact_email].find((v) => typeof v === "string" && v.trim()) as string | undefined;
  return { subject: `${doc.doctype}: ${doc.name}`, to: to ? [to.trim()] : [] };
}
