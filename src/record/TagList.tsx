/**
 * TagList — a record's tags as Desk's form sidebar shows them (Frappe 15.110 `ui/tags.js`, `ui/tag_editor.js`): coloured
 * pills with a remove "×", and — while `adding` — a text box that suggests existing tags as you type (`search`) and adds
 * the typed text on Enter or when the box loses focus (tags.js:32-53: keypress Enter / focusout → add; blur →
 * deactivate). Blank and duplicate tags are dropped (:69-77). Frappe-free: the host stores the change (`onAdd` /
 * `onRemove`) and passes the server's list back as `tags`; while a request runs its pill is shown dimmed, and a refused
 * request is undone on screen with the server's message.
 */
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../lib/cn";
import { TagInput } from "../fields/TagInput";
import type { SearchFn } from "../fields/autocomplete";
import { useLocale } from "../theme/ThemeProvider";
import { errorText, fmt } from "./format";

export interface TagListProps {
  /** The stored tags, in display order. */
  tags: string[];
  /** Show the entry box (the section's "+" turns it on; it turns itself off when it loses focus). */
  adding?: boolean;
  onAddingChange?: (adding: boolean) => void;
  onAdd?: (tag: string) => Promise<unknown>;
  onRemove?: (tag: string) => Promise<unknown>;
  /** Offer remove buttons (default: when `onRemove` is given). */
  canRemove?: boolean;
  /** Existing tags for the typed text. */
  search?: SearchFn;
  /** Clean the typed text before it is stored (Desk: `frappe.utils.xss_sanitise`, tags.js:35). */
  sanitize?: (text: string) => string;
  /** Text when there are no tags. Null hides it. */
  empty?: React.ReactNode;
  className?: string;
}

/** A stable hue per tag, like Desk's coloured data pills (`frappe.get_data_pill(…, colored=true)`). */
const hue = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

export function TagList({ tags, adding, onAddingChange, onAdd, onRemove, canRemove, search, sanitize, empty, className }: TagListProps) {
  const { t } = useLocale();
  const [adds, setAdds] = React.useState<Record<string, "busy" | "done">>({});
  const [removes, setRemoves] = React.useState<Record<string, "busy" | "done">>({});
  const [error, setError] = React.useState("");
  const wrap = React.useRef<HTMLDivElement>(null);
  const removable = canRemove ?? !!onRemove;

  // a new list from the server answers for every finished request: drop their marks (running ones stay)
  const busyOnly = (m: Record<string, "busy" | "done">) => Object.fromEntries(Object.entries(m).filter(([, v]) => v === "busy"));
  React.useEffect(() => { setAdds(busyOnly); setRemoves(busyOnly); }, [tags]);

  const shown = React.useMemo(() => [...tags, ...Object.keys(adds).filter((k) => !tags.includes(k))].filter((k) => !(removes[k] === "done" && !tags.includes(k))), [tags, adds, removes]);

  const add = async (raw: string) => {
    const tag = (sanitize ? sanitize(raw) : raw).trim();
    if (!tag || !onAdd || tags.includes(tag) || adds[tag]) return;
    setError(""); setAdds((a) => ({ ...a, [tag]: "busy" }));
    try { await onAdd(tag); setAdds((a) => ({ ...a, [tag]: "done" })); }
    catch (e) { setAdds((a) => { const { [tag]: _x, ...rest } = a; void _x; return rest; }); setError(errorText(e) || t("attachFailed")); }
  };
  const remove = async (tag: string) => {
    if (!onRemove) return;
    setError(""); setRemoves((r) => ({ ...r, [tag]: "busy" }));
    try { await onRemove(tag); setRemoves((r) => ({ ...r, [tag]: "done" })); }
    catch (e) { setRemoves((r) => { const { [tag]: _x, ...rest } = r; void _x; return rest; }); setError(errorText(e) || t("attachFailed")); }
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {adding ? (
        <div ref={wrap} onBlur={() => setTimeout(() => { if (wrap.current && !wrap.current.contains(document.activeElement)) onAddingChange?.(false); }, 0)}
          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onAddingChange?.(false); } }}>
          <TagInput value={[]} exclude={shown} onChange={(next) => { const v = next[next.length - 1]; if (v) void add(v); }}
            search={search} allowCreate autoFocus aria-label={t("sbTagInput")} placeholder={t("sbTagInput")} />
        </div>
      ) : null}
      {shown.length === 0 ? (empty === null || adding ? null : <p className="text-xs text-muted-foreground">{empty ?? t("sbTagNone")}</p>) : (
        <ul className="flex flex-wrap gap-1" aria-label={t("sbTags")}>
          {shown.map((tag) => {
            const busy = adds[tag] === "busy" || removes[tag] === "busy";
            return (
              <li key={tag} data-tag={tag} aria-busy={busy || undefined}
                style={{ ["--tag-h" as string]: String(hue(tag)) }}
                className={cn("inline-flex max-w-full items-center gap-1 rounded-full bg-[hsl(var(--tag-h)_70%_92%)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--tag-h)_45%_28%)] dark:bg-[hsl(var(--tag-h)_35%_22%)] dark:text-[hsl(var(--tag-h)_70%_85%)]", busy && "opacity-60")}>
                <span className="truncate" dir="auto">{tag}</span>
                {removable && onRemove && !adds[tag] ? (
                  <button type="button" disabled={busy} onClick={() => void remove(tag)} aria-label={fmt(t("sbTagRemove"), tag)}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 dark:hover:bg-white/10">
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
