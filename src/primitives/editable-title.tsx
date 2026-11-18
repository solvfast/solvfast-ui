// From Solvfast PMO frontend/src/components/layouts/EditableTitle.tsx (pristine copy + sha256 in upstream/pmo/) — see
// VENDORED.md. Same behaviour and classes; the input uses the package's field look (sf-field-fill) and has an accessible
// name (PMO's had none); `ariaLabel` overrides the default "Edit title" message.
import * as React from "react";
import { Pencil } from "lucide-react";
import { useLocale } from "../theme/ThemeProvider";
import { cn } from "../lib/cn";

export interface EditableTitleProps {
  value: string;
  /** false renders the plain title. */
  canEdit: boolean;
  /** Called with the trimmed text when it is non-empty and changed. Run 1 (A-42): a returned promise keeps the field
   *  busy until it settles; a rejection shows its message and puts the old title back. */
  onSave: (value: string) => void | Promise<unknown>;
  /** Names the text box while editing (default: the "editTitle" message — "Edit title" / "تعديل العنوان"). */
  ariaLabel?: string;
  /** Run 1 (A-42): classes for the title (button / text). */
  className?: string;
}

/** Click-to-edit title for page headers (task, bug…). Enter or leaving the field saves, Esc cancels. */
export function EditableTitle({ value, canEdit, onSave, ariaLabel, className }: EditableTitleProps) {
  const { t } = useLocale();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  // Once saved (Enter) or cancelled (Esc), a blur fired while the input goes away must not save (again).
  const closed = React.useRef(false);
  const commit = () => {
    if (closed.current) return;
    closed.current = true;
    const v = draft.trim();
    setEditing(false);
    if (!v || v === value) return;
    setError("");
    const r = onSave(v);
    if (r && typeof (r as Promise<unknown>).then === "function") {
      setPending(v);
      (r as Promise<unknown>).then(() => setPending(null), (e: unknown) => { setPending(null); setError(e instanceof Error ? e.message : String(e) || t("titleSaveFailed")); });
    }
  };
  const errorEl = error ? <span role="alert" className="ms-2 text-xs font-normal text-destructive">{error}</span> : null;
  if (!canEdit) return <span className={cn("truncate", className)}>{value}</span>;
  if (pending !== null) {
    // the new title while the save runs (busy); it goes back to `value` if the save fails
    return <span className={cn("truncate opacity-70", className)} aria-busy="true" data-title-pending="">{pending}</span>;
  }
  if (!editing) {
    return (
      <>
      <button
        type="button"
        onClick={() => { setDraft(value); closed.current = false; setEditing(true); }}
        className={cn("group inline-flex max-w-full items-center gap-1.5 truncate rounded-sm text-start hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
        title={value}
      >
        <span className="truncate">{value}</span>
        <Pencil className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60" aria-hidden />
      </button>
      {errorEl}
      </>
    );
  }
  return (
    <input
      autoFocus
      aria-label={ariaLabel ?? t("editTitle")}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } else if (e.key === "Escape") { closed.current = true; setEditing(false); } }}
      className="sf-field-fill w-full min-w-0 rounded-md px-2 py-0.5 text-lg font-semibold outline-none focus-visible:outline-none"
    />
  );
}
