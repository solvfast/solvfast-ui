/**
 * Attach / Attach Image — Desk's attach control (Frappe 15.110 `form/controls/attach.js`, `attach_image.js`), minimal:
 * an "Attach" button opens the file picker, the file goes to `upload_file` through the client's `uploadFile` (multipart,
 * the same fields as Desk's FileUploader), and the field's value becomes the returned `file_url`. While uploading the
 * button is disabled and says so; a refusal (write on the document, size, type) is shown under the field and the value
 * is unchanged. With a value: a link to the file (Attach Image: a preview) and "Clear".
 *
 * As Desk: attached to the document (`doctype` / `docname` / `fieldname`) once it exists; private unless the field
 * (`make_attachment_public`) or the DocType (`make_attachments_public`) says public; Attach Image accepts `image/*`.
 * Deliberate subset: no library / link / camera sources, one file; the form's own Save persists the value (Desk saves the
 * form after the upload and deletes the File on Clear).
 */
import * as React from "react";
import { Paperclip, X } from "lucide-react";
import { Button } from "../../primitives/button";
import { cn } from "../../lib/cn";
import { useLocale } from "../../theme/ThemeProvider";
import { useFrappeApi } from "../FrappeProvider";
import type { FrappeDocField, MetaBundle } from "../contract";

export interface FrappeAttachFieldProps {
  id: string;
  df: FrappeDocField;
  value: string | null;
  onChange: (value: string | null) => void;
  /** The document (for `attached_to_*`); a new (unsaved) document uploads an unattached file, as Desk. */
  doctype?: string;
  docname?: string;
  bundle?: MetaBundle;
  disabled?: boolean;
  invalid?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
}

const isNewName = (name?: string) => !name || name.startsWith("new-");

export function FrappeAttachField({ id, df, value, onChange, doctype, docname, bundle, disabled, invalid, ...aria }: FrappeAttachFieldProps) {
  const { t } = useLocale();
  const api = useFrappeApi();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  const isImage = df.fieldtype === "Attach Image";
  const isPublic = !!Number(df.make_attachment_public ?? 0) || !!Number((bundle?.meta as Record<string, unknown> | undefined)?.make_attachments_public ?? 0);

  const upload = async (file: File) => {
    setBusy(true); setFailure(null);
    try {
      const attach = !isNewName(docname) && doctype ? { doctype, docname, fieldname: df.fieldname } : {};
      const doc = await api.uploadFile(file, file.name, { ...attach, isPrivate: !isPublic });
      const url = typeof doc?.file_url === "string" ? doc.file_url : null;
      if (!url) throw new Error("upload_file returned no file_url");
      onChange(url);
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "";
      setFailure(msg ? `${t("attachFailed")} ${msg}` : t("attachFailed"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const errId = `${id}-attach-msg`;
  const describedBy = [aria["aria-describedby"], failure ? errId : undefined].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-2" data-attach-field="">
      <input ref={input} type="file" className="hidden" tabIndex={-1} aria-hidden accept={isImage ? "image/*" : undefined}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} data-testid={`${id}-file`} />
      {value ? (
        <div className="flex flex-wrap items-center gap-2">
          {isImage && <img src={value} alt="" className="h-16 w-16 rounded-md border border-border object-cover" />}
          <a href={value} target="_blank" rel="noreferrer" dir="ltr" className="min-w-0 truncate text-sm text-primary underline-offset-2 hover:underline">
            {decodeURIComponent(value.split("/").pop() || value)}
          </a>
          {!disabled && (
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={() => { setFailure(null); onChange(null); }}>
              <X className="h-3.5 w-3.5" aria-hidden /> {t("attachClear")}
            </Button>
          )}
        </div>
      ) : (
        // named "<field label> <action>" (e.g. "Image Attach"): the field's label (FieldShell `${id}-label`) + the button text
        <Button type="button" variant="outline" size="sm" className={cn("gap-1.5", invalid && "border-destructive")} disabled={disabled || busy}
          aria-busy={busy || undefined} aria-invalid={invalid || undefined} aria-describedby={describedBy}
          {...(aria["aria-label"] ? { "aria-label": `${aria["aria-label"]} ${busy ? t("attachUploading") : t("attach")}` } : { "aria-labelledby": `${id}-label ${id}-attach-text` })}
          onClick={() => input.current?.click()}>
          <Paperclip className="h-3.5 w-3.5" aria-hidden /> <span id={`${id}-attach-text`}>{busy ? t("attachUploading") : t("attach")}</span>
        </Button>
      )}
      {failure && <p id={errId} role="alert" className="text-xs text-destructive">{failure}</p>}
    </div>
  );
}
