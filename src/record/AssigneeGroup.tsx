import * as React from "react";
import { Check, Plus, X } from "lucide-react";
import { cn } from "../lib/cn";
import { Avatar, AvatarFallback, AvatarImage } from "../primitives/avatar";
import { Button } from "../primitives/button";
import { Checkbox } from "../primitives/checkbox";
import { DateField } from "../primitives/date-time-field";
import { Input } from "../primitives/input";
import { Label } from "../primitives/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../primitives/select";
import { Textarea } from "../primitives/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";
import { Skeleton } from "../primitives/skeleton";
import { useLocale } from "../theme/ThemeProvider";
import { fmt, initials } from "./format";
import type { AssignDetails, Assignee, UserOption } from "./types";
import { useAsyncOptions } from "./useAsyncOptions";

export interface AssignLabels {
  assignedTo?: string; none?: string; add?: string; search?: string; toMe?: string; confirm?: string; description?: string; due?: string;
  priority?: string; low?: string; medium?: string; high?: string; remove?: string; noMatches?: string; cancel?: string;
  /** Helper under "Complete by" / "Priority" and the "no priority chosen" option. */
  dueHint?: string; priorityHint?: string; priorityDefault?: string; clearDate?: string;
}
const useAssignLabels = (l?: AssignLabels) => {
  const { t } = useLocale();
  return {
    assignedTo: l?.assignedTo ?? t("recAssignedTo"), none: l?.none ?? t("recAssignNone"), add: l?.add ?? t("recAssignAdd"),
    search: l?.search ?? t("recAssignSearch"), toMe: l?.toMe ?? t("recAssignToMe"), confirm: l?.confirm ?? t("recAssignConfirm"),
    description: l?.description ?? t("recAssignDescription"), due: l?.due ?? t("recAssignDue"), priority: l?.priority ?? t("recAssignPriority"),
    low: l?.low ?? t("recPriorityLow"), medium: l?.medium ?? t("recPriorityMedium"), high: l?.high ?? t("recPriorityHigh"),
    remove: l?.remove ?? t("recRemoveAssignee"), noMatches: l?.noMatches ?? t("recMentionNoResults"), cancel: l?.cancel ?? t("recCancel"),
    dueHint: l?.dueHint ?? t("recAssignDueHint"), priorityHint: l?.priorityHint ?? t("recAssignPriorityHint"),
    priorityDefault: l?.priorityDefault ?? t("recAssignPriorityDefault"), clearDate: l?.clearDate ?? t("recAssignClearDate"),
  };
};

function UserAvatar({ name, image, className }: { name: string; image?: string | null; className?: string }) {
  return (
    <Avatar aria-hidden className={cn("h-7 w-7 text-[10px]", className)}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

export interface AssignPickerProps {
  searchUsers: (query: string) => Promise<UserOption[]>;
  onAssign: (users: UserOption[], details: AssignDetails) => void | Promise<unknown>;
  /** Users already assigned — shown ticked and not selectable twice (the server would report them as duplicates). */
  exclude?: string[];
  /** The signed-in user, for “Assign to me”. */
  me?: UserOption;
  /** One user only (the CRM’s single Assignee). */
  single?: boolean;
  /** Show the comment / due date / priority fields of Desk’s dialog. */
  withDetails?: boolean;
  labels?: AssignLabels;
  trigger?: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string;
}

/** Popover to choose users (searched through a callback) and assign them. */
/** Radix Select needs a non-empty value for "nothing chosen": that option sends no `priority` (the server's default). */
const DEFAULT_PRIORITY = "__default";

export function AssignPicker({ searchUsers, onAssign, exclude = [], me, single, withDetails, labels, trigger, disabled, disabledReason }: AssignPickerProps) {
  const L = useAssignLabels(labels);
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [picked, setPicked] = React.useState<UserOption[]>([]);
  const [active, setActive] = React.useState(0);
  const [details, setDetails] = React.useState<AssignDetails>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const { options, loading, error: searchError } = useAsyncOptions(searchUsers, q, open);
  const listId = React.useId();
  const fieldId = React.useId();

  React.useEffect(() => { if (!open) { setQ(""); setPicked([]); setDetails({}); setError(""); setActive(0); } }, [open]);
  React.useEffect(() => { setActive(0); }, [options]);

  const toggle = (u: UserOption) => {
    if (exclude.includes(u.id)) return;
    setPicked((p) => (p.some((x) => x.id === u.id) ? p.filter((x) => x.id !== u.id) : single ? [u] : [...p, u]));
  };
  const submit = async (users: UserOption[] = picked) => {
    if (!users.length) return;
    setSubmitting(true); setError("");
    try { await onAssign(users, details); setOpen(false); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSubmitting(false); }
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (options[active]) toggle(options[active]); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-full" disabled={disabled} title={disabled ? disabledReason : L.add} aria-label={L.add}>
            <Plus aria-hidden />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("space-y-2 p-2", withDetails ? "w-80" : "w-72")}>
        <Input
          autoFocus role="combobox" aria-expanded aria-controls={listId} aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
          value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder={L.search} aria-label={L.search}
          className="h-8 text-xs"
        />
        {me && !single && !exclude.includes(me.id) ? (
          <div className="flex items-center gap-2 px-1">
            <Checkbox id={`${fieldId}-me`} checked={picked.some((x) => x.id === me.id)} onCheckedChange={() => toggle(me)} />
            <Label htmlFor={`${fieldId}-me`} className="cursor-pointer text-xs font-normal">{L.toMe}</Label>
          </div>
        ) : null}
        <div id={listId} role="listbox" aria-multiselectable={!single} className="max-h-44 space-y-0.5 overflow-auto">
          {loading ? <Skeleton className="h-8 w-full" /> : null}
          {!loading && searchError ? <p role="alert" className="px-2 py-2 text-xs text-destructive">{searchError}</p> : null}
          {!loading && !searchError && options.length === 0 ? <p className="px-2 py-2 text-center text-xs text-muted-foreground">{L.noMatches}</p> : null}
          {!loading && options.map((u, i) => {
            const sel = picked.some((x) => x.id === u.id); const taken = exclude.includes(u.id);
            return (
              <div key={u.id} id={`${listId}-${i}`} role="option" aria-selected={sel} aria-disabled={taken || undefined}
                onMouseEnter={() => setActive(i)} onClick={() => toggle(u)}
                className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs", i === active && "bg-accent", taken && "opacity-50")}>
                <UserAvatar name={u.label} image={u.image} className="h-5 w-5" />
                <span className="flex-1 truncate">{u.label}</span>
                {sel || taken ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
              </div>
            );
          })}
        </div>
        {withDetails ? (
          // Desk's Assign To dialog (form/sidebar/assign_to.js:50-90): "Complete By" (Date → the ToDo's `date`), "Priority"
          // (Low / Medium / High → the ToDo's `priority`), "Comment" (→ `description`). Left empty, nothing is sent and the
          // server uses today and Medium (desk/form/assign_to.py:73-90: `args.get("date", nowdate())`, `args.get("priority", "Medium")`).
          <div className="space-y-2.5 border-t border-border pt-2.5 text-xs">
            <div className="space-y-1">
              <Label htmlFor={`${fieldId}-comment`} className="text-xs">{L.description}</Label>
              <Textarea id={`${fieldId}-comment`} rows={2} value={details.description ?? ""} className="min-h-0 text-xs"
                onChange={(e) => setDetails((d) => ({ ...d, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0 space-y-1">
                <Label htmlFor={`${fieldId}-due`} className="text-xs">{L.due}</Label>
                <div className="flex items-center gap-1">
                  <DateField id={`${fieldId}-due`} value={details.date ?? ""} onChange={(v) => setDetails((d) => ({ ...d, date: v || undefined }))}
                    className="min-w-0 flex-1 [&>button]:h-8 [&>button]:text-xs" />
                  {details.date ? (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={L.clearDate} title={L.clearDate}
                      onClick={() => setDetails((d) => ({ ...d, date: undefined }))}><X className="h-3.5 w-3.5" aria-hidden /></Button>
                  ) : null}
                </div>
                <p id={`${fieldId}-due-hint`} className="text-[11px] leading-tight text-muted-foreground">{L.dueHint}</p>
              </div>
              <div className="min-w-0 space-y-1">
                <Label htmlFor={`${fieldId}-priority`} className="text-xs">{L.priority}</Label>
                <Select value={details.priority ?? DEFAULT_PRIORITY}
                  onValueChange={(v) => setDetails((d) => ({ ...d, priority: v === DEFAULT_PRIORITY ? undefined : (v as AssignDetails["priority"]) }))}>
                  <SelectTrigger id={`${fieldId}-priority`} className="h-8 text-xs" aria-describedby={`${fieldId}-priority-hint`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT_PRIORITY}>{L.priorityDefault}</SelectItem>
                    <SelectItem value="Low">{L.low}</SelectItem>
                    <SelectItem value="Medium">{L.medium}</SelectItem>
                    <SelectItem value="High">{L.high}</SelectItem>
                  </SelectContent>
                </Select>
                <p id={`${fieldId}-priority-hint`} className="text-[11px] leading-tight text-muted-foreground">{L.priorityHint}</p>
              </div>
            </div>
          </div>
        ) : null}
        {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>{L.cancel}</Button>
          <Button type="button" size="sm" disabled={!picked.length || submitting} onClick={() => void submit()}>{L.confirm}</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export interface AssigneeGroupProps extends Omit<AssignPickerProps, "exclude" | "trigger" | "onAssign"> {
  assignees: Assignee[];
  onAssign?: AssignPickerProps["onAssign"];
  onRemove?: (assignee: Assignee) => void | Promise<unknown>;
  /** Per-assignee gate (Desk: the assignee themself or a user with write). Default: none removable. */
  canRemove?: (assignee: Assignee) => boolean;
  /** `avatars` (stacked, Desk-like) or `list` (one named row each, the CRM rail). */
  variant?: "avatars" | "list";
  maxVisible?: number;
  /** The group is loading its data. */
  loading?: boolean;
  /** Replaces the heading ("Assigned to" → "Assignee"). */
  heading?: string;
  className?: string;
}

/** The people a record is assigned to, with add / remove. All permission decisions come from props. */
export function AssigneeGroup({
  assignees, onAssign, onRemove, canRemove, variant = "avatars", maxVisible = 4, loading, heading, className, searchUsers, labels, ...picker
}: AssigneeGroupProps) {
  const L = useAssignLabels(labels);
  const [removing, setRemoving] = React.useState<string>("");
  const [error, setError] = React.useState("");
  const remove = async (a: Assignee) => {
    if (!onRemove) return;
    setRemoving(a.id); setError("");
    try { await onRemove(a); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setRemoving(""); }
  };
  const { t } = useLocale();
  const picker_ = onAssign ? (
    <AssignPicker {...picker} labels={labels} searchUsers={searchUsers} onAssign={onAssign} exclude={assignees.map((a) => a.id)} />
  ) : null;

  return (
    <section className={cn("space-y-2", className)} aria-label={heading ?? L.assignedTo} aria-busy={loading || undefined}>
      <h3 className="text-xs font-medium text-muted-foreground">{heading ?? L.assignedTo}</h3>
      {loading ? <Skeleton className="h-7 w-24" /> : assignees.length === 0 ? (
        <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{L.none}</span>{picker_}</div>
      ) : variant === "list" ? (
        <ul className="space-y-1.5">
          {assignees.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-xs" title={a.description}>
              <UserAvatar name={a.name} image={a.image} />
              <span className="flex-1 truncate font-medium text-foreground">{a.name}</span>
              {canRemove?.(a) ? (
                <button type="button" disabled={removing === a.id} onClick={() => void remove(a)} aria-label={fmt(L.remove, a.name)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
          {picker_ ? <li>{picker_}</li> : null}
        </ul>
      ) : (
        <div className="flex items-center">
          <ul className="flex items-center -space-x-2 rtl:space-x-reverse">
            {assignees.slice(0, maxVisible).map((a) => (
              <li key={a.id} className="group relative" title={a.name}>
                <UserAvatar name={a.name} image={a.image} className="ring-2 ring-background" />
                {canRemove?.(a) ? (
                  <button type="button" disabled={removing === a.id} onClick={() => void remove(a)} aria-label={fmt(L.remove, a.name)}
                    className="absolute -end-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground focus-visible:flex group-hover:flex group-focus-within:flex">
                    <X className="h-2.5 w-2.5" aria-hidden />
                  </button>
                ) : null}
              </li>
            ))}
            {assignees.length > maxVisible ? (
              <li className="z-0 flex h-7 min-w-7 items-center justify-center rounded-full bg-muted px-1 text-[10px] ring-2 ring-background"
                title={assignees.slice(maxVisible).map((a) => a.name).join(", ")}>{fmt(t("recMoreCount"), assignees.length - maxVisible)}</li>
            ) : null}
          </ul>
          {picker_ ? <span className="ms-2">{picker_}</span> : null}
        </div>
      )}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </section>
  );
}
