/**
 * AttachDialog — Desk's file uploader dialog as used by the form sidebar's "+" (Frappe 15.110
 * `file_uploader/FileUploader.vue`, opened by `form/sidebar/attachments.js:237-260`), Frappe-free:
 * - "My Device": pick or drop files (FileDropzone), each private by default unless `defaultPrivate` is false
 *   (`private: !make_attachments_public`, FileUploader.vue:443), a per-file private / public switch and "Set all
 *   private / public" (:386-400); at most `maxFiles` files (Desk's `restrictions.max_number_of_files`). "Upload" sends
 *   them ONE AFTER ANOTHER (`frappe.run_serially`, :533) through the host's `onUpload`; each row shows waiting /
 *   uploading / uploaded / failed with the server's message (:600-650). The dialog closes when every file succeeded
 *   (:607-612); a failed file stays listed with its error, uploaded ones are not sent again.
 * - "Library" (with `searchLibrary` + `onAttachExisting`): search existing files and attach the chosen one (:536-546).
 * - "Link" (with `onAttachLink`): attach a web link (:547-559).
 * No percentage is shown: the host's upload reports completion only (a fetch upload has no progress events).
 * P36b attachimage (FilePreview.vue, ImageCropper.vue, ui/capture.js — the same uploader the sidebar and the Attach
 * controls open): each row shows a thumbnail of an image (FilePreview.vue:4-7, 150-159) and, for a public file, Desk's
 * warning (:70-80); "Optimize" per image (not SVG) when the host can send it (`allowOptimize`; default on above 200 KB,
 * FileUploader.vue:428-434; FilePreview.vue:23-29, 120-129) — passed to `onUpload` as `{ optimize }`; "Crop" for a
 * JPEG / PNG not yet sent (FilePreview.vue:51-56, 133-140 → `ImageCropper`); a "Camera" source where the browser has
 * one (FileUploader.vue:130-151, 337-339 → `CameraCapture`); the drop zone hides once `maxFiles` files are listed
 * (FileUploader.vue:10, 447-455).
 */
import * as React from "react";
import { Check, Crop, FileText, Loader2, Lock, LockOpen, X } from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "../primitives/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../primitives/dialog";
import { Input } from "../primitives/input";
import { Label } from "../primitives/label";
import { Skeleton } from "../primitives/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../primitives/tabs";
import { FileDropzone, formatFileSize } from "../fields/FileDropzone";
import { useLocale } from "../theme/ThemeProvider";
import { errorText, fmt } from "./format";
import { useAsyncOptions } from "./useAsyncOptions";
import { ImageCropper, type CropBox } from "../fields/ImageCropper";
import { CameraCapture, cameraSupported } from "../fields/CameraCapture";

export interface LibraryFile { id: string; fileName: string; fileUrl: string }
type Status = "queued" | "uploading" | "done" | "failed";
interface Row { key: number; file: File; isPrivate: boolean; optimize: boolean; status: Status; error?: string; original?: File; box?: CropBox | null }

/** FileUploader.vue:428-434 — an image (not SVG) above 200 KB starts with "Optimize" on. */
export function defaultOptimize(file: Pick<File, "type" | "size">): boolean {
  return file.type.startsWith("image") && !file.type.includes("svg") && file.size / 1024 > 200;
}
/** FilePreview.vue:120-129 — "Optimize" is offered for an image that is not SVG. */
export const canOptimize = (file: Pick<File, "type">) => file.type.startsWith("image") && file.type !== "image/svg+xml";
/** FilePreview.vue:133-140 — "Crop" for JPEG / PNG. */
export const canCrop = (file: Pick<File, "type">) => file.type === "image/jpeg" || file.type === "image/png";

function Thumb({ file }: { file: File }) {
  const [src, setSrc] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!file.type.startsWith("image")) return;
    let live = true;
    const r = new FileReader();
    r.onload = () => { if (live) setSrc(String(r.result)); };
    r.readAsDataURL(file);
    return () => { live = false; };
  }, [file]);
  return src
    ? <img src={src} alt={file.name} className="h-9 w-9 shrink-0 rounded object-cover" data-upload-thumb="" />
    : <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />;
}

export interface AttachDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Upload one file; resolve when the server stored it, reject with its message otherwise. `optimize`: the row's
   *  "Optimize" (always false without `allowOptimize`). */
  onUpload: (file: File, isPrivate: boolean, opts: { optimize: boolean }) => Promise<unknown>;
  /** New files start private (Desk: unless the DocType says `make_attachments_public`). Default true. */
  defaultPrivate?: boolean;
  /** Show the per-file private switch (Desk `allow_toggle_private`, default true). */
  allowTogglePrivate?: boolean;
  /** Most files in one go (Desk: max_attachments − current). */
  maxFiles?: number;
  accept?: string;
  maxSize?: number;
  /** "Library": search the existing files. Both this and `onAttachExisting` are needed for the tab. */
  searchLibrary?: (text: string) => Promise<LibraryFile[]>;
  onAttachExisting?: (file: LibraryFile) => Promise<unknown>;
  /** "Link": attach a web link. */
  onAttachLink?: (url: string) => Promise<unknown>;
  /** Text under the title (e.g. how many more files can be attached). */
  note?: React.ReactNode;
  /** Show Desk's per-image "Optimize" switch (the host sends `optimize` to upload_file). Default false. */
  allowOptimize?: boolean;
  /** "Crop" for JPEG / PNG rows (Desk default on). Default true. */
  allowCrop?: boolean;
  /** A fixed crop aspect ratio (Desk `restrictions.crop_image_aspect_ratio`). */
  cropAspectRatio?: number;
  /** The "Camera" source where the browser has one (Desk default on). Default true. */
  allowCamera?: boolean;
}

const isUrl = (v: string) => /^(https?:)?\/\//i.test(v) || v.startsWith("/");

export function AttachDialog({
  open, onOpenChange, onUpload, defaultPrivate = true, allowTogglePrivate = true, maxFiles, accept, maxSize, searchLibrary, onAttachExisting, onAttachLink, note,
  allowOptimize = false, allowCrop = true, cropAspectRatio, allowCamera = true,
}: AttachDialogProps) {
  const { t, language } = useLocale();
  const [tab, setTab] = React.useState("device");
  const [rows, setRows] = React.useState<Row[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [q, setQ] = React.useState("");
  const [picked, setPicked] = React.useState<LibraryFile | null>(null);
  const [url, setUrl] = React.useState("");
  const [cropping, setCropping] = React.useState<number | null>(null);
  const keyRef = React.useRef(0);
  const camera = allowCamera && cameraSupported() && (!accept || accept.split(",").some((a) => /image|\.png/i.test(a)));
  const library = !!searchLibrary && !!onAttachExisting;
  const searchFn = React.useCallback(async (text: string) => (text.trim() && searchLibrary ? searchLibrary(text) : []), [searchLibrary]);
  const lib = useAsyncOptions(searchFn, q, open && tab === "library");

  React.useEffect(() => {
    if (!open) { setRows([]); setBusy(false); setError(""); setQ(""); setPicked(null); setUrl(""); setTab("device"); setCropping(null); }
  }, [open]);

  const remaining = maxFiles == null ? undefined : Math.max(0, maxFiles);
  const setRow = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const allPrivate = rows.length > 0 && rows.every((r) => r.isPrivate);

  const uploadAll = async () => {
    setBusy(true); setError("");
    let ok = true;
    for (const r of rows) {
      if (r.status === "done") continue;
      setRow(r.key, { status: "uploading", error: undefined });
      try { await onUpload(r.file, r.isPrivate, { optimize: allowOptimize && canOptimize(r.file) && r.optimize }); setRow(r.key, { status: "done" }); }
      catch (e) { ok = false; setRow(r.key, { status: "failed", error: errorText(e) || t("attachFailed") }); }
    }
    setBusy(false);
    if (ok) onOpenChange(false);
  };
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError("");
    try { await fn(); onOpenChange(false); } catch (e) { setError(errorText(e) || t("attachFailed")); } finally { setBusy(false); }
  };
  const submit = () => {
    if (tab === "library") { if (picked && onAttachExisting) void run(() => onAttachExisting(picked)); return; }
    if (tab === "link") {
      const v = url.trim();
      if (!isUrl(v)) { setError(t("sbAttachUrlInvalid")); return; }
      if (onAttachLink) void run(() => onAttachLink(v));
      return;
    }
    void uploadAll();
  };
  const canSubmit = !busy && (tab === "library" ? !!picked : tab === "link" ? !!url.trim() : rows.some((r) => r.status !== "done"));

  const addFiles = (files: File[]) => setRows((rs) => [...rs, ...files.map((file) => ({ key: ++keyRef.current, file, isPrivate: defaultPrivate, optimize: defaultOptimize(file), status: "queued" as Status }))]);
  const full = remaining != null && rows.length >= remaining;
  const device = (
    <div className="space-y-2">
      {remaining !== 0 && !full ? (
        <FileDropzone multiple={remaining !== 1} maxFiles={remaining} accept={accept} maxSize={maxSize} showList={false} disabled={busy}
          value={rows.map((r) => r.file)}
          onFilesAdded={addFiles} />
      ) : null}
      {rows.length ? (
        <>
          {allowTogglePrivate && rows.length > 1 ? (
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" disabled={busy}
                onClick={() => setRows((rs) => rs.map((r) => (r.status === "done" ? r : { ...r, isPrivate: !allPrivate })))}>
                {allPrivate ? t("sbAttachSetAllPublic") : t("sbAttachSetAllPrivate")}
              </Button>
            </div>
          ) : null}
          <ul className="max-h-60 space-y-1.5 overflow-auto" aria-label={t("sbAttachDevice")}>
            {rows.map((r) => (
              <li key={r.key} data-upload-row={r.file.name} data-status={r.status} className="rounded-md border border-border px-2 py-1.5 text-xs">
                <div className="flex min-w-0 items-start gap-2">
                <Thumb file={r.file} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium" dir="auto" title={r.file.name}>{r.file.name}</p>
                  <p className={cn("text-[11px]", r.status === "failed" ? "text-destructive" : "text-muted-foreground")} role={r.status === "failed" ? "alert" : undefined} aria-live="polite">
                    {formatFileSize(r.file.size, language)} · {r.status === "queued" ? t("sbAttachQueued") : r.status === "uploading" ? t("sbAttachUploading") : r.status === "done" ? t("sbAttachUploaded") : fmt(t("sbAttachFailedFile"), r.error ?? "")}
                  </p>
                  {allowOptimize && canOptimize(r.file) && r.status === "queued" ? (
                    <label className="mt-1 inline-flex cursor-pointer items-center gap-1 text-[11px]">
                      <input type="checkbox" checked={r.optimize} disabled={busy} onChange={() => setRow(r.key, { optimize: !r.optimize })} className="h-3 w-3 accent-[hsl(var(--primary))]"
                        aria-label={`${r.file.name}: ${t("formUpOptimize")}`} />
                      <span aria-hidden>{t("formUpOptimize")}</span>
                    </label>
                  ) : null}
                </div>
                {allowCrop && canCrop(r.file) && r.status === "queued" ? (
                  <button type="button" disabled={busy} onClick={() => setCropping(r.key)} aria-label={fmt(t("formUpCropFile"), r.file.name)}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                    <Crop className="h-3.5 w-3.5" aria-hidden />
                  </button>
                ) : null}
                {r.status === "uploading" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden /> : null}
                {r.status === "done" ? <Check className="h-4 w-4 shrink-0 text-success" aria-hidden /> : null}
                {allowTogglePrivate && r.status !== "done" ? (
                  <button type="button" disabled={busy} aria-pressed={r.isPrivate} onClick={() => setRow(r.key, { isPrivate: !r.isPrivate })}
                    aria-label={`${r.file.name}: ${t("sbAttachPrivate")}`} title={r.isPrivate ? t("sbAttachPrivate") : t("sbAttachPublic")}
                    className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                    {r.isPrivate ? <Lock className="h-3 w-3" aria-hidden /> : <LockOpen className="h-3 w-3" aria-hidden />}
                    <span aria-hidden>{r.isPrivate ? t("sbAttachPrivate") : t("sbAttachPublic")}</span>
                  </button>
                ) : null}
                {r.status !== "done" && r.status !== "uploading" ? (
                  <button type="button" disabled={busy} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={fmt(t("sbAttachRemove"), r.file.name)}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                ) : null}
                </div>
                {!r.isPrivate && r.status === "queued" ? <p className="mt-1 rounded bg-warning/15 px-1.5 py-1 text-[11px] text-foreground" data-public-warning="">{t("formUpPublicWarning")}</p> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );

  const libraryPane = (
    <div className="space-y-2">
      <Input value={q} onChange={(e) => { setQ(e.target.value); setPicked(null); }} placeholder={t("sbAttachLibrarySearch")} aria-label={t("sbAttachLibrarySearch")} className="h-8 text-sm" />
      <div role="listbox" aria-label={t("sbAttachLibrary")} className="max-h-56 space-y-0.5 overflow-auto">
        {!q.trim() ? <p className="px-1 py-2 text-xs text-muted-foreground">{t("sbAttachLibraryHint")}</p>
          : lib.loading ? <Skeleton className="h-8 w-full" />
          : lib.error ? <p role="alert" className="px-1 py-2 text-xs text-destructive">{lib.error}</p>
          : lib.options.length === 0 ? <p className="px-1 py-2 text-xs text-muted-foreground">{t("sbAttachLibraryEmpty")}</p>
          : lib.options.map((f) => (
            <div key={f.id} role="option" aria-selected={picked?.id === f.id} tabIndex={0} onClick={() => setPicked(f)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPicked(f); } }}
              className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", picked?.id === f.id ? "bg-accent" : "hover:bg-muted")}>
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate" dir="auto">{f.fileName}</span>
              {picked?.id === f.id ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
            </div>
          ))}
      </div>
    </div>
  );

  const linkPane = (
    <div className="space-y-1.5">
      <Label htmlFor="sf-attach-url" className="text-xs">{t("sbAttachUrl")}</Label>
      <Input id="sf-attach-url" dir="ltr" inputMode="url" value={url} onChange={(e) => { setUrl(e.target.value); setError(""); }} placeholder="https://" className="h-8 text-sm" />
    </div>
  );

  const cropRow = cropping != null ? rows.find((r) => r.key === cropping) : undefined;
  const tabs = library || onAttachLink || camera;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("sbAttachTitle")}</DialogTitle>
          {note ? <DialogDescription>{note}</DialogDescription> : null}
        </DialogHeader>
        {cropRow ? (
          <ImageCropper file={cropRow.original ?? cropRow.file} initialBox={cropRow.box} aspectRatio={cropAspectRatio}
            onBack={() => setCropping(null)}
            onCrop={(file, box) => { setRow(cropRow.key, { file, original: cropRow.original ?? cropRow.file, box }); setCropping(null); }} />
        ) : tabs ? (
          <Tabs value={tab} onValueChange={(v) => { if (!busy) { setTab(v); setError(""); } }}>
            <TabsList>
              <TabsTrigger value="device">{t("sbAttachDevice")}</TabsTrigger>
              {library ? <TabsTrigger value="library">{t("sbAttachLibrary")}</TabsTrigger> : null}
              {onAttachLink ? <TabsTrigger value="link">{t("sbAttachLink")}</TabsTrigger> : null}
              {camera ? <TabsTrigger value="camera">{t("formUpCamera")}</TabsTrigger> : null}
            </TabsList>
            <TabsContent value="device" className="pt-2">{device}</TabsContent>
            {library ? <TabsContent value="library" className="pt-2">{libraryPane}</TabsContent> : null}
            {onAttachLink ? <TabsContent value="link" className="pt-2">{linkPane}</TabsContent> : null}
            {camera ? (
              <TabsContent value="camera" className="pt-2">
                {tab === "camera" ? <CameraCapture onSubmit={(files) => { addFiles(remaining != null ? files.slice(0, Math.max(0, remaining - rows.length)) : files); setTab("device"); }} /> : null}
              </TabsContent>
            ) : null}
          </Tabs>
        ) : device}
        {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
        {cropRow ? null : <DialogFooter>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>{t("recCancel")}</Button>
          <Button type="button" disabled={!canSubmit} aria-busy={busy || undefined} onClick={submit}>
            {busy ? <Loader2 className="me-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}{t("sbAttachUpload")}
          </Button>
        </DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
