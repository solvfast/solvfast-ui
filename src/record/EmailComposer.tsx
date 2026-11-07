/**
 * EmailComposer — Desk's "New Email" composer (views/communication.js) as a Frappe-free form: To / CC / BCC as pills
 * (TagInput; hand-typed addresses are checked with Desk's e-mail pattern, utils.js:470-473, and an invalid one is named
 * under the field), Subject (required, communication.js:116-119), Message (the package's RichTextEditor), an optional
 * Email Template picker ("Add Template" prepends the template to the message and replaces the subject; "Clear & Add
 * Template" clears the message first — communication.js:403-451) or the caller's own `templateSlot`, "Attach Document
 * Print" with a print format, the attachments checklist, "Send me a copy" and "Send Read Receipt".
 * Send is refused without any recipient (Desk: "Enter Email Recipient(s) in the To, CC, or BCC fields",
 * communication.js:786-789) or without a subject. While `onSend` runs the form is busy; a rejection is shown and the
 * draft is kept. Nothing is sent by this component — `onSend` does it.
 */
import * as React from "react";
import { Button } from "../primitives/button";
import { Checkbox } from "../primitives/checkbox";
import { Input } from "../primitives/input";
import { Label } from "../primitives/label";
import { RichTextEditor, htmlIsEmpty } from "../primitives/rich-text-editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../primitives/select";
import { TagInput } from "../fields/TagInput";
import type { SearchFn } from "../fields/autocomplete";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { errorText, fmt } from "./format";

export interface EmailAttachmentOption { id: string; label: string; url?: string }

export interface EmailDraft {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  /** HTML (sanitized by the editor). */
  message: string;
  /** Ids of the checked attachments. */
  attachments: string[];
  sendMeACopy: boolean;
  readReceipt: boolean;
  /** The template last applied, if any. */
  template?: string;
  attachPrint: boolean;
  printFormat?: string;
}

export interface EmailComposerProps {
  initial?: Partial<EmailDraft>;
  /** The record's files, offered as a checklist. */
  attachments?: EmailAttachmentOption[];
  /** Template names for the built-in picker (needs `loadTemplate`). */
  templates?: string[];
  /** Resolve a template for this record → `{ subject, message }`. */
  loadTemplate?: (name: string) => Promise<{ subject?: string; message?: string }>;
  /** A custom template picker rendered instead of the built-in one. */
  templateSlot?: React.ReactNode;
  /** Print formats: shows "Attach Document Print" and a format select. */
  printFormats?: string[];
  /** Recipient suggestions (contacts). Hand-typed addresses are always accepted when valid. */
  searchRecipients?: SearchFn;
  onSend: (draft: EmailDraft) => Promise<unknown> | void;
  onDiscard?: () => void;
  /** Disable sending (e.g. no e-mail right) with a reason shown above the actions. */
  disabledReason?: string;
  className?: string;
}

/** Desk's e-mail pattern (utils.js:470-473, from emailregex.com). "Name <addr>" is checked on the address. */
const EMAIL_RE = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
export function isValidEmail(value: string): boolean {
  const v = value.trim();
  const m = /<([^<>]+)>\s*$/.exec(v);
  return EMAIL_RE.test(m ? m[1].trim() : v);
}

type ListKey = "to" | "cc" | "bcc";

export function EmailComposer({
  initial, attachments = [], templates, loadTemplate, templateSlot, printFormats, searchRecipients, onSend, onDiscard, disabledReason, className,
}: EmailComposerProps) {
  const { t } = useLocale();
  const id = React.useId();
  const [draft, setDraft] = React.useState<EmailDraft>(() => ({
    to: [], cc: [], bcc: [], subject: "", message: "", attachments: [], sendMeACopy: false, readReceipt: false, attachPrint: !!printFormats?.length,
    printFormat: printFormats?.[0], ...initial,
  }));
  const [invalid, setInvalid] = React.useState<Partial<Record<ListKey, string>>>({});
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [template, setTemplate] = React.useState(initial?.template ?? "");
  const [templateBusy, setTemplateBusy] = React.useState(false);
  const [templateError, setTemplateError] = React.useState("");
  const set = <K extends keyof EmailDraft>(k: K, v: EmailDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const validator = (k: ListKey) => (v: string) => {
    if (isValidEmail(v)) { setInvalid((s) => ({ ...s, [k]: undefined })); return v.trim(); }
    setInvalid((s) => ({ ...s, [k]: fmt(t("r35InvalidEmail"), v) }));
    return null;
  };

  const applyTemplate = async (clear: boolean) => {
    if (!template || !loadTemplate) return;
    setTemplateError(""); setTemplateBusy(true);
    try {
      const r = await loadTemplate(template);
      setDraft((d) => ({
        ...d, template,
        subject: r.subject ?? d.subject,
        message: `${r.message ?? ""}${clear || htmlIsEmpty(d.message) ? "" : `<br>${d.message}`}`,
      }));
    } catch (e) { setTemplateError(`${t("r35TemplateFailed")} ${errorText(e)}`.trim()); }
    finally { setTemplateBusy(false); }
  };

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    if (!draft.to.length && !draft.cc.length && !draft.bcc.length) { setError(t("r35NeedRecipient")); return; }
    if (!draft.subject.trim()) { setError(t("r35NeedSubject")); return; }
    setBusy(true);
    try { await onSend(draft); }
    catch (err) { setError(errorText(err) || "Error"); }
    finally { setBusy(false); }
  };

  const recipients = (k: ListKey, label: string) => (
    <div className="space-y-1">
      <Label id={`${id}-${k}-l`} htmlFor={`${id}-${k}`}>{label}</Label>
      <TagInput id={`${id}-${k}`} aria-labelledby={`${id}-${k}-l`} aria-describedby={invalid[k] ? `${id}-${k}-e` : undefined} value={draft[k]}
        onChange={(v) => set(k, v)} search={searchRecipients} allowCreate validate={validator(k)} invalid={!!invalid[k]} disabled={busy}
        placeholder={k === "to" ? t("r35RecipientsHint") : undefined} />
      {invalid[k] && <p id={`${id}-${k}-e`} role="alert" className="text-xs text-destructive">{invalid[k]}</p>}
    </div>
  );

  return (
    <form className={cn("grid gap-4", className)} onSubmit={(e) => void send(e)} aria-busy={busy || undefined}>
      {recipients("to", t("r35To"))}
      <div className="grid gap-4 sm:grid-cols-2">
        {recipients("cc", t("r35Cc"))}
        {recipients("bcc", t("r35Bcc"))}
      </div>
      {templateSlot ?? (templates && loadTemplate ? (
        <div className="space-y-1">
          <Label htmlFor={`${id}-tpl`}>{t("r35Template")}</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={template || "__none__"} onValueChange={(v) => setTemplate(v === "__none__" ? "" : v)} disabled={busy}>
              <SelectTrigger id={`${id}-tpl`} className="w-56" aria-label={t("r35Template")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("r35NoTemplate")}</SelectItem>
                {templates.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" size="sm" variant="outline" disabled={!template || templateBusy || busy} loading={templateBusy} onClick={() => void applyTemplate(false)}>{t("r35AddTemplate")}</Button>
            <Button type="button" size="sm" variant="outline" disabled={!template || templateBusy || busy} onClick={() => void applyTemplate(true)}>{t("r35ClearAddTemplate")}</Button>
          </div>
          {templateError && <p role="alert" className="text-xs text-destructive">{templateError}</p>}
        </div>
      ) : null)}
      <div className="space-y-1">
        <Label htmlFor={`${id}-subject`}>{t("r35Subject")}</Label>
        <Input id={`${id}-subject`} value={draft.subject} onChange={(e) => set("subject", e.target.value)} aria-required="true" disabled={busy} />
      </div>
      <div className="space-y-1">
        <Label id={`${id}-msg-l`}>{t("r35Message")}</Label>
        <RichTextEditor value={draft.message} onChange={(html) => set("message", html)} ariaLabel={t("r35Message")} disabled={busy} minHeight="10rem" />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Checkbox id={`${id}-copy`} checked={draft.sendMeACopy} onCheckedChange={(v) => set("sendMeACopy", v === true)} disabled={busy} />
          <Label htmlFor={`${id}-copy`} className="font-normal">{t("r35SendMeCopy")}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id={`${id}-receipt`} checked={draft.readReceipt} onCheckedChange={(v) => set("readReceipt", v === true)} disabled={busy} />
          <Label htmlFor={`${id}-receipt`} className="font-normal">{t("r35ReadReceipt")}</Label>
        </div>
        {printFormats?.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <Checkbox id={`${id}-print`} checked={draft.attachPrint} onCheckedChange={(v) => set("attachPrint", v === true)} disabled={busy} />
            <Label htmlFor={`${id}-print`} className="font-normal">{t("r35AttachPrint")}</Label>
            {draft.attachPrint && (
              <Select value={draft.printFormat} onValueChange={(v) => set("printFormat", v)} disabled={busy}>
                <SelectTrigger className="h-8 w-44" aria-label={t("r35SelectPrintFormat")}><SelectValue /></SelectTrigger>
                <SelectContent>{printFormats.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
        ) : null}
      </div>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">{t("r35Attachments")}</legend>
        {attachments.length ? (
          <ul className="grid gap-1 sm:grid-cols-2">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <Checkbox id={`${id}-att-${a.id}`} checked={draft.attachments.includes(a.id)} disabled={busy}
                  onCheckedChange={(v) => set("attachments", v === true ? [...draft.attachments, a.id] : draft.attachments.filter((x) => x !== a.id))} />
                <Label htmlFor={`${id}-att-${a.id}`} className="truncate font-normal" title={a.label}>{a.label}</Label>
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-muted-foreground">{t("r35NoAttachments")}</p>}
      </fieldset>
      {disabledReason && <p role="note" className="text-sm text-muted-foreground">{disabledReason}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {onDiscard && <Button type="button" variant="outline" onClick={onDiscard} disabled={busy}>{t("r35Discard")}</Button>}
        <Button type="submit" loading={busy} disabled={!!disabledReason}>{busy ? t("r35Sending") : t("r35Send")}</Button>
      </div>
    </form>
  );
}
