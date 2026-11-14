/**
 * BulkTagsDialog — add tags to, or remove tags from, every selected record (0.8.0-dev.9, L-03), Frappe-free.
 *
 * - `mode="add"`: the package `TagInput` (pills with ×; Enter or comma adds a typed tag; `suggestions` — a list or a
 *   search — are offered as you type). Apply is disabled until a tag is chosen.
 * - `mode="remove"`: the tags the selection carries (`existing`, e.g. from `countTags`), each a checkbox reading
 *   "tag · n" (n = selected records with it). When the selection has no tags the dialog says so and Apply is disabled
 *   with that reason.
 *
 * `onApply(tags)` gets the chosen tags. A returned promise keeps the dialog busy; it closes on resolve and shows the
 * error on reject.
 */
import * as React from "react";
import { Alert, AlertDescription } from "../../primitives/alert";
import { Button } from "../../primitives/button";
import { Checkbox } from "../../primitives/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../primitives/dialog";
import { TagInput } from "../../fields/TagInput";
import { cn } from "../../lib/cn";
import { loc, type Localized } from "../../lib/localized";
import { useLocale } from "../../theme/ThemeProvider";

export interface BulkTagCount { tag: string; count: number }

/** The tags of the selected records with how many records carry each, sorted by tag (for `existing`). */
export function countTags(tagLists: ReadonlyArray<ReadonlyArray<string> | null | undefined>): BulkTagCount[] {
  const m = new Map<string, number>();
  for (const list of tagLists) for (const t of new Set(list ?? [])) if (t) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([tag, count]) => ({ tag, count }));
}

export type BulkTagsLabelKey = "title" | "description" | "tags" | "placeholder" | "none" | "apply" | "cancel";

export interface BulkTagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "remove";
  /** Selected records (fills `{n}`). */
  count: number;
  /** Remove mode: the selection's tags and counts. */
  existing?: BulkTagCount[];
  /** Add mode: tag suggestions — a list (filtered by the typed text) or a search. */
  suggestions?: ((q: string) => Promise<string[]> | string[]) | string[];
  onApply: (tags: string[]) => void | Promise<void>;
  /** `{n}` in a label is the count. */
  labels?: Partial<Record<BulkTagsLabelKey, Localized>>;
}

export function BulkTagsDialog({ open, onOpenChange, mode, count, existing, suggestions, onApply, labels }: BulkTagsDialogProps) {
  const { t, language } = useLocale();
  const uid = React.useId();
  const n = String(count);
  const L = (k: BulkTagsLabelKey, fallback: string) => (labels?.[k] != null ? loc(labels[k], language) : fallback).replace(/\{n\}/g, n);
  const [tags, setTags] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => { if (open) { setTags([]); setError(""); setBusy(false); } }, [open, mode]);

  const latest = React.useRef(suggestions);
  latest.current = suggestions;
  const search = React.useCallback(async (q: string) => {
    const s = latest.current;
    const list = typeof s === "function" ? await s(q) : (s ?? []).filter((x) => x.toLowerCase().includes(q.trim().toLowerCase()));
    return list.map((value) => ({ value }));
  }, []);

  const removable = (existing ?? []).filter((e) => e.count > 0);
  const none = mode === "remove" && !removable.length;
  const noneText = L("none", t("btgNone"));
  const toggle = (tag: string, on: boolean) => setTags((ts) => (on ? (ts.includes(tag) ? ts : [...ts, tag]) : ts.filter((x) => x !== tag)));

  const apply = async () => {
    if (!tags.length || busy) return;
    setError("");
    let result: void | Promise<void>;
    try { result = onApply(tags); } catch (e) { setError(e instanceof Error && e.message ? e.message : t("btgFailed")); return; }
    if (result && typeof (result as Promise<void>).then === "function") {
      setBusy(true);
      try { await result; } catch (e) { setBusy(false); setError(e instanceof Error && e.message ? e.message : t("btgFailed")); return; }
      setBusy(false);
    }
    onOpenChange(false);
  };

  const tagsLabel = L("tags", mode === "add" ? t("btgAddLabel") : t("btgRemoveLabel"));
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent data-bulk-tags-dialog={mode}>
        <DialogHeader>
          <DialogTitle>{L("title", mode === "add" ? t("btgAddTitle") : t("btgRemoveTitle"))}</DialogTitle>
          <DialogDescription>{L("description", t("btgDescription"))}</DialogDescription>
        </DialogHeader>
        {mode === "add" ? (
          <div className="space-y-1.5 text-sm">
            <span id={`${uid}-tags`} className="block text-xs font-semibold">{tagsLabel}</span>
            <TagInput aria-labelledby={`${uid}-tags`} value={tags} onChange={setTags} allowCreate search={suggestions ? search : undefined} debounceMs={0}
              placeholder={L("placeholder", t("btgPlaceholder"))} disabled={busy} />
          </div>
        ) : none ? (
          <p id={`${uid}-none`} className="text-sm text-muted-foreground" role="status" data-bulk-tags-none="">{noneText}</p>
        ) : (
          <fieldset className="space-y-2" aria-busy={busy || undefined}>
            <legend className="mb-1 text-xs font-semibold">{tagsLabel}</legend>
            <div className="flex flex-wrap gap-2">
              {removable.map(({ tag, count: c }) => {
                const id = `${uid}-tag-${tag}`;
                const on = tags.includes(tag);
                return (
                  <label key={tag} htmlFor={id} data-tag={tag}
                    className={cn("inline-flex cursor-pointer items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium",
                      on ? "border-destructive/40 bg-destructive/10" : "border-border")}>
                    <Checkbox id={id} checked={on} disabled={busy} onCheckedChange={(v) => toggle(tag, v === true)} />
                    <span className={on ? "line-through" : undefined}>{tag}</span>
                    <span className="text-muted-foreground">· {c}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>{L("cancel", t("btgCancel"))}</Button>
          <Button type="button" disabled={!tags.length || none} loading={busy} title={none ? noneText : undefined}
            aria-describedby={none ? `${uid}-none` : undefined} onClick={() => void apply()}>{L("apply", t("btgApply"))}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
