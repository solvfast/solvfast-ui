/**
 * FileDropzone — a Core file picker (P35 G14): click, keyboard (Enter / Space) or drag-and-drop; `accept`, `maxSize`,
 * `maxFiles`, `multiple`; validation messages; a list of the chosen files with a preview and remove.
 *
 * Purely client-side: it never uploads. The host gets the accepted `File`s through `onChange` (the whole list) and
 * `onFilesAdded` (just the files of one pick / drop — the place to start an upload). Server-side Attach for a Frappe
 * DocType stays `FrappeAttachField` (/frappe). Value is controlled (`value`) or internal when `value` is omitted.
 */
import * as React from "react";
import { FileText, Upload, X } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { FIELD_INVALID, interpolate } from "./FieldShell";

export type FileRejectionReason = "type" | "size" | "count";
export interface FileRejection { file: File; reason: FileRejectionReason; message: string }

export interface FileDropzoneLabels {
  /** The prompt in the zone. */
  prompt?: string;
  /** The prompt while files are dragged over the zone. */
  dropActive?: string;
  /** Remove button label; `{name}` is the file name. */
  remove?: string;
  /** Accessible name of the chosen-file list. */
  list?: string;
}

export interface FileDropzoneProps {
  /** The chosen files (controlled). Omit to let the zone keep its own list. */
  value?: File[];
  /** The whole list after a pick, drop or remove. */
  onChange?: (files: File[]) => void;
  /** Only the files accepted from one pick / drop (e.g. start their upload). */
  onFilesAdded?: (files: File[]) => void;
  /** Files refused by `accept` / `maxSize` / `maxFiles` (also shown under the zone). */
  onReject?: (rejections: FileRejection[]) => void;
  /** Same syntax as `<input accept>`: extensions and MIME types, `image/*` wildcards (".pdf,image/*"). */
  accept?: string;
  /** Allow several files. Without it a new pick replaces the chosen file. */
  multiple?: boolean;
  /** Largest file size in bytes. */
  maxSize?: number;
  /** Most files in the list (with `multiple`). */
  maxFiles?: number;
  disabled?: boolean;
  invalid?: boolean;
  /** Show the chosen-file list (default true). Turn off when the host renders its own (e.g. with upload progress). */
  showList?: boolean;
  /** Thumbnails for image files in the list (default true). */
  preview?: boolean;
  /** Smaller, single-line zone. */
  compact?: boolean;
  labels?: FileDropzoneLabels;
  /** Custom content inside the zone (replaces icon + prompt + hint). */
  children?: React.ReactNode;
  id?: string;
  name?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

/** Does `file` match an `accept` string (".pdf,image/*,application/json")? Empty accept → true. */
export function fileMatchesAccept(file: { name: string; type: string }, accept?: string): boolean {
  const tokens = (accept ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (!tokens.length) return true;
  const name = file.name.toLowerCase(); const type = (file.type || "").toLowerCase();
  return tokens.some((t) => (t.startsWith(".") ? name.endsWith(t) : t.endsWith("/*") ? type.startsWith(t.slice(0, -1)) : type === t));
}

const UNITS = ["B", "KB", "MB", "GB"] as const;
/** "1.5 MB" / "١٫٥ م.ب" — binary units (1 KB = 1024 B), at most one decimal. */
export function formatFileSize(bytes: number, language: "en" | "ar" = "en"): string {
  let v = Math.max(0, bytes); let u = 0;
  while (v >= 1024 && u < UNITS.length - 1) { v /= 1024; u++; }
  const n = new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: u === 0 ? 0 : 1 }).format(v);
  const unit = language === "ar" ? (["بايت", "ك.ب", "م.ب", "ج.ب"] as const)[u] : UNITS[u];
  return `${n} ${unit}`;
}

const sameFile = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

/** Split picked files into accepted / rejected against the rules and the files already chosen. Messages are built by
 *  the caller (`message` is left empty here). Exported for hosts that validate their own input. */
export function validateFiles(
  picked: File[], current: File[],
  rules: { accept?: string; maxSize?: number; maxFiles?: number; multiple?: boolean },
): { accepted: File[]; rejected: Array<{ file: File; reason: FileRejectionReason }> } {
  const accepted: File[] = []; const rejected: Array<{ file: File; reason: FileRejectionReason }> = [];
  const limit = rules.multiple ? rules.maxFiles ?? Infinity : 1;
  const base = rules.multiple ? current : [];
  for (const f of picked) {
    if (!fileMatchesAccept(f, rules.accept)) { rejected.push({ file: f, reason: "type" }); continue; }
    if (rules.maxSize != null && f.size > rules.maxSize) { rejected.push({ file: f, reason: "size" }); continue; }
    if (base.some((c) => sameFile(c, f)) || accepted.some((c) => sameFile(c, f))) continue; // the same file twice: ignored
    if (base.length + accepted.length >= limit) { rejected.push({ file: f, reason: "count" }); continue; }
    accepted.push(f);
  }
  return { accepted, rejected };
}

function FileRow({ file, preview, removeLabel, onRemove, disabled }: { file: File; preview: boolean; removeLabel: string; onRemove: () => void; disabled?: boolean }) {
  const { language } = useLocale();
  const isImage = preview && file.type.startsWith("image/");
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!isImage || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return;
    const u = URL.createObjectURL(file); setUrl(u);
    return () => { URL.revokeObjectURL?.(u); };
  }, [file, isImage]);
  return (
    <li className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-sm" data-file-row="">
      {url ? <img src={url} alt="" className="h-8 w-8 shrink-0 rounded object-cover" /> : (
        <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground"><FileText className="h-4 w-4" /></span>
      )}
      <span className="min-w-0 flex-1">
        <bdi className="block truncate font-medium text-foreground">{file.name}</bdi>
        <span className="block text-xs text-muted-foreground">{formatFileSize(file.size, language)}</span>
      </span>
      <button type="button" onClick={onRemove} disabled={disabled} aria-label={removeLabel} title={removeLabel}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </li>
  );
}

export const FileDropzone = React.forwardRef<HTMLDivElement, FileDropzoneProps>(function FileDropzone(
  {
    value, onChange, onFilesAdded, onReject, accept, multiple, maxSize, maxFiles, disabled, invalid, showList = true, preview = true,
    compact, labels, children, id, name, className, ...aria
  },
  ref,
) {
  const { t, language } = useLocale();
  const uid = React.useId();
  const hintId = `${id ?? uid}-hint`;
  const errId = `${id ?? uid}-errors`;
  const input = React.useRef<HTMLInputElement>(null);
  const [own, setOwn] = React.useState<File[]>([]);
  const files = value ?? own;
  const [dragging, setDragging] = React.useState(false);
  const [errors, setErrors] = React.useState<FileRejection[]>([]);
  const depth = React.useRef(0);

  const commit = (next: File[]) => { if (value === undefined) setOwn(next); onChange?.(next); };
  const message = (r: { file: File; reason: FileRejectionReason }) => interpolate(
    t(r.reason === "type" ? "coreFileRejectType" : r.reason === "size" ? "coreFileRejectSize" : "coreFileRejectCount"),
    { name: r.file.name, size: maxSize != null ? formatFileSize(maxSize, language) : "", max: maxFiles ?? 1 },
  );
  const add = (list: FileList | File[] | null | undefined) => {
    if (disabled || !list) return;
    let picked = Array.from(list);
    if (!multiple && picked.length > 1) picked = picked.slice(0, 1); // one file: the first of a multi-drop
    const { accepted, rejected } = validateFiles(picked, files, { accept, maxSize, maxFiles, multiple });
    const rej = rejected.map((r) => ({ ...r, message: message(r) }));
    setErrors(rej);
    if (rej.length) onReject?.(rej);
    if (accepted.length) {
      commit(multiple ? [...files, ...accepted] : accepted);
      onFilesAdded?.(accepted);
    }
  };
  const remove = (f: File) => { setErrors([]); commit(files.filter((x) => x !== f)); };
  const browse = () => { if (!disabled) input.current?.click(); };

  const hint = [accept ? interpolate(t("coreFileAccepted"), { types: accept.split(",").map((s) => s.trim()).filter(Boolean).join(", ") }) : "",
    maxSize != null ? interpolate(t("coreFileMaxSize"), { size: formatFileSize(maxSize, language) }) : ""].filter(Boolean).join(" · ");
  const prompt = dragging ? labels?.dropActive ?? t("coreFileDropActive") : labels?.prompt ?? t(multiple ? "coreFileDropPrompt" : "coreFileDropPromptSingle");
  const describedBy = [aria["aria-describedby"], hint ? hintId : "", errors.length ? errId : ""].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("min-w-0 space-y-2", className)} data-sf-file-dropzone="">
      <div
        ref={ref}
        id={id}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-invalid={invalid || undefined}
        aria-label={aria["aria-label"] ?? prompt}
        aria-describedby={describedBy}
        data-dragging={dragging || undefined}
        onClick={browse}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); browse(); } }}
        onDragEnter={(e) => { if (disabled) return; e.preventDefault(); depth.current++; setDragging(true); }}
        onDragOver={(e) => { if (disabled) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; }}
        onDragLeave={() => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); depth.current = 0; setDragging(false); add(e.dataTransfer?.files); }}
        className={cn(
          "flex w-full cursor-pointer rounded-lg border border-dashed border-border bg-muted/30 text-center transition-colors",
          "hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          compact ? "items-center justify-center gap-2 px-3 py-2 text-sm" : "flex-col items-center justify-center gap-1.5 px-4 py-6",
          dragging && "border-primary bg-primary/5",
          invalid && FIELD_INVALID,
          disabled && "cursor-not-allowed opacity-50 hover:border-border hover:bg-muted/30",
        )}
      >
        {children ?? (
          <>
            <Upload className={cn("shrink-0 text-muted-foreground", compact ? "h-4 w-4" : "h-6 w-6")} aria-hidden />
            <span className="text-sm font-medium text-foreground">{prompt}</span>
            {hint && !compact ? <span id={hintId} className="text-xs text-muted-foreground">{hint}</span> : null}
          </>
        )}
        {hint && (compact || children) ? <span id={hintId} className="sr-only">{hint}</span> : null}
      </div>
      <input
        ref={input} type="file" name={name} accept={accept} multiple={multiple} disabled={disabled}
        tabIndex={-1} aria-hidden className="hidden" data-file-input=""
        onChange={(e) => { add(e.target.files); e.target.value = ""; }}
      />
      {errors.length ? (
        <ul id={errId} role="alert" className="space-y-0.5 text-xs font-medium text-destructive">
          {errors.map((r, i) => <li key={i}>{r.message}</li>)}
        </ul>
      ) : null}
      {showList && files.length ? (
        <ul aria-label={labels?.list ?? t("coreFileList")} className="space-y-1.5">
          {files.map((f, i) => (
            <FileRow key={`${f.name}-${f.size}-${f.lastModified}-${i}`} file={f} preview={preview} disabled={disabled}
              removeLabel={interpolate(labels?.remove ?? t("coreFileRemove"), { name: f.name })} onRemove={() => remove(f)} />
          ))}
        </ul>
      ) : null}
    </div>
  );
});
