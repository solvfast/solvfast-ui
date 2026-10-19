import { useState } from "react";
import { Pencil } from "lucide-react";

/** Click-to-edit title used in page headers (task, bug…). Enter/blur saves, Esc cancels. */
export function EditableTitle({ value, canEdit, onSave }: { value: string; canEdit: boolean; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const commit = () => { const v = draft.trim(); if (v && v !== value) onSave(v); setEditing(false); };
  if (!canEdit) return <span className="truncate">{value}</span>;
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(value); setEditing(true); }}
        className="group inline-flex max-w-full items-center gap-1.5 truncate text-start hover:text-primary"
        title={value}
      >
        <span className="truncate">{value}</span>
        <Pencil className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } else if (e.key === "Escape") setEditing(false); }}
      className="w-full min-w-0 rounded-md border border-input bg-background px-2 py-0.5 text-lg font-semibold outline-none focus:ring-1 focus:ring-ring"
    />
  );
}
