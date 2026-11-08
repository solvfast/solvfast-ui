/**
 * The form's image (`meta.image_field`) — Desk's sidebar user image (Frappe 15.110 `form/sidebar/user_image.js`,
 * `form_sidebar.html:2-20`), drawn in the form header:
 * - the image, else the initials of the title (user_image.js:15-41);
 * - "Change" ▾ → "Upload" / "Remove" (Remove only with an image, :25, :39-40), offered on a SAVED document (the sidebar
 *   is hidden for a new one, form_sidebar.js:70-73) when the user may write the DocType and the image field is not
 *   `read_only` (form_sidebar.js:17-22, form_sidebar.html:8);
 * - "Upload" = the image field's own uploader restricted to `image/*` (`attach_doc_image` → attach.js:65-69), then as the
 *   field: value = file_url, docinfo re-read, form saved (attach.js:137-144);
 * - "Remove" = `remove_attachment_by_filename(value)` (remove_attach for the File of that URL, none → no request), then
 *   `set_value("")` and `frm.save()` (user_image.js:79-85) — no confirmation, as Desk.
 */
import { ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../../primitives/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../primitives/dropdown-menu";
import { useLocale } from "../../theme/ThemeProvider";
import type { DocInfo, FrappeDoc, FrappeDocField, MetaBundle } from "../contract";
import { useFrappeAttach } from "./FrappeAttachField";

export interface FrappeFormImageProps {
  bundle: MetaBundle;
  doc: FrappeDoc;
  /** The image field as the form resolves it (read_only overrides included). */
  df?: FrappeDocField;
  /** `frappe.model.can_write(doctype)` for this document. */
  canWrite: boolean;
  /** Initials shown without an image. */
  initials: string;
  /** Set the image field's value in the form. */
  setValue: (value: string) => void;
  /** `frm.save()`. */
  save: () => Promise<unknown>;
  /** `frm.get_docinfo()` (its attachments give the File to remove). */
  getDocInfo?: () => DocInfo | undefined;
}

export function FrappeFormImage({ bundle, doc, df, canWrite, initials, setValue, save, getDocInfo }: FrappeFormImageProps) {
  const { t } = useLocale();
  const field = String(bundle.meta.image_field ?? "");
  const value = String(doc[field] ?? "");
  const fieldDf: FrappeDocField = df ?? { fieldname: field, fieldtype: "Attach Image" };
  const a = useFrappeAttach({
    df: fieldDf, bundle, doctype: bundle.meta.name, docname: doc.name, imageOnly: true, getDocInfo,
    onUploaded: (url) => { setValue(url); void save(); },
  });
  const canChange = canWrite && !doc.__islocal && !Number(fieldDf.read_only ?? 0);
  const remove = async () => {
    a.setFailure(null);
    if (!(await a.removeByUrl(value))) return;
    setValue("");
    await save();
  };

  const avatar = (
    <Avatar className="size-10" data-form-image={value || undefined}>
      {value && <AvatarImage src={value} alt="" />}
      <AvatarFallback aria-hidden>{initials}</AvatarFallback>
    </Avatar>
  );
  if (!canChange) return avatar;
  return (
    <div className="flex items-center gap-1" data-form-image-menu="">
      {avatar}
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-0.5 rounded-md px-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {t("formImageChange")}<ChevronDown className="size-3" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => a.open()}>{t("formImageUpload")}</DropdownMenuItem>
          {value ? <DropdownMenuItem onSelect={() => void remove()}>{t("formImageRemove")}</DropdownMenuItem> : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {a.failure ? <span role="alert" className="text-xs text-destructive">{a.failure}</span> : null}
      {a.dialog}
    </div>
  );
}
