// From Solvfast PMO frontend/src/components/layouts/EditableTitle.tsx (pristine copy + sha256 in upstream/pmo/) — see
// VENDORED.md. Same behaviour and classes; the input uses the package's field look (sf-field-fill) and has an accessible
// name (PMO's had none); `ariaLabel` overrides the default "Edit title" message.
import * as React from "react";
import { Pencil } from "lucide-react";
import { useLocale } from "../theme/ThemeProvider";

export interface EditableTitleProps {
  value: string;
  /** false renders the plain title. */
  canEdit: boolean;
  /** Called with the trimmed text when it is non-empty and changed. */
  onSave: (value: string) => void;
  /** Names the text box while editing (default: the "editTitle" message — "Edit title" / "تعديل العنوان"). */
  ariaLabel?: string;
}

/** Click-to-edit title for page headers (task, bug…). Enter or leaving the field saves, Esc cancels. */
export function EditableTitle({ value, canEdit, onSave, ariaLabel }: EditableTitleProps) {
  const { t } = useLocale();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  // Once saved (Enter) or cancelled (Esc), a blur fired while the input goes away must not save (again).
  const closed = React.useRef(false);
  const commit = () => { if (closed.current) return; closed.current = true; const v = draft.trim(); if (v && v !== value) onSave(v); setEditing(false); };
  if (!canEdit) return <span className="truncate">{value}</span>;
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(value); closed.current = false; setEditing(true); }}
        className="group inline-flex max-w-full items-center gap-1.5 truncate rounded-sm text-start hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title={value}
      >
        <span className="truncate">{value}</span>
        <Pencil className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60" aria-hidden />
      </button>
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
      className="sf-field-fill w-full min-w-0 rounded-md px-2 py-0.5 text-lg font-semibold outline-none"
    />
  );
}
