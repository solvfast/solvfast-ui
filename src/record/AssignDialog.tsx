/**
 * AssignDialog — Desk's "Assign To" dialog as a DS Dialog (JS/form/sidebar/assign_to.js:87-240, list bulk mode
 * bulk_operations.js:225-241): "Assign to me", the users to assign (searched through a callback, several unless `single`),
 * "Complete By", "Priority", "Comment", for one or many records. Frappe-free: the host performs the assignment
 * (`FrappeListView` sends `assign_to.add_multiple`; an app with its own model, e.g. one assignee per record, its own call).
 *
 * Truthful by construction: the detail fields are shown only when the host can store them (`details`); `existing` lists the
 * current assignees of the selection (read-only) so the user sees what the action changes.
 *
 * P36c: `groups` adds Desk's "Assign To User Group" (assign_to.js:142-160, 191-197): a Link-style search of groups; picking
 * one REPLACES the users to assign with the group's members, exactly as Desk's `set_value("assign_to", members)` does.
 */
import * as React from "react";
import { Check, X } from "lucide-react";
import { cn } from "../lib/cn";
import { Avatar, AvatarFallback, AvatarImage } from "../primitives/avatar";
import { Button } from "../primitives/button";
import { Checkbox } from "../primitives/checkbox";
import { DateField } from "../primitives/date-time-field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../primitives/dialog";
import { Input } from "../primitives/input";
import { Label } from "../primitives/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../primitives/select";
import { Skeleton } from "../primitives/skeleton";
import { Textarea } from "../primitives/textarea";
import { useLocale } from "../theme/ThemeProvider";
import { LinkInput } from "../fields/LinkInput";
import type { SearchFn, Suggestion } from "../fields/autocomplete";
import { fmt, initials } from "./format";
import type { AssignDetails, Assignee, UserOption } from "./types";
import { useAsyncOptions } from "./useAsyncOptions";

export interface AssignDialogLabels {
  title?: string; forCount?: string; toMe?: string; users?: string; search?: string; noMatches?: string; current?: string; none?: string;
  description?: string; due?: string; priority?: string; priorityDefault?: string; low?: string; medium?: string; high?: string;
  confirm?: string; cancel?: string; singleHint?: string; remove?: string; clearDate?: string;
}

export interface AssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchUsers: (query: string) => Promise<UserOption[]>;
  /** Performs the assignment; a rejection keeps the dialog open with the error. */
  onAssign: (users: UserOption[], details: AssignDetails) => void | Promise<unknown>;
  /** The signed-in user, for "Assign to me" (also offered with `single`: it picks the user as the one assignee). */
  me?: UserOption;
  /** One assignee per record (the chosen user replaces the current one; a hint says so). */
  single?: boolean;
  /** Number of records the assignment applies to (subtitle "{n} records selected"). */
  count?: number;
  /** Current assignees of the selection, shown read-only. */
  existing?: Assignee[];
  /** Desk's Complete By / Priority / Comment. `true` = all three; an object picks them. Default: none. */
  details?: boolean | { description?: boolean; date?: boolean; priority?: boolean };
  labels?: AssignDialogLabels;
  /** Extra content under the fields (e.g. a note about what the host stores). */
  note?: React.ReactNode;
  /** P36b: the detail fields' values when the dialog opens (Desk fills "Comment" with the document's title field,
   *  assign_to.js:161-167). */
  defaultDetails?: AssignDetails;
  /** Priority offers only the ToDo's own Low / Medium / High (no "Default" row), Medium unless `defaultDetails` says
   *  otherwise. */
  threePriorities?: boolean;
  /** P36c: offer Desk's "Assign To User Group" (hidden with `single`). Frappe-free: the host searches its groups and expands
   *  one into its members. */
  groups?: AssignGroupSource;
}

/**
 * P36c: where the "Assign To User Group" field finds groups and their members. Desk (assign_to.js:142-160): picking a group
 * unticks "Assign to me" and sets the users to assign to the group's members — the earlier choice is REPLACED, not merged;
 * clearing the group leaves the list as it is; a failed read leaves it as it is too (the error is shown).
 */
export interface AssignGroupSource {
  /** Search the groups (Desk: a Link field, `search_link`). */
  search: SearchFn;
  /** The group's members, in order. A rejection is shown under the field and the users to assign are kept. */
  members: (group: string) => Promise<UserOption[]>;
  /** Field label. Default: the `sbAssignGroup` chrome string ("Assign To User Group"). */
  label?: string;
  placeholder?: string;
  /** Search debounce (ms). Default 500, as Desk's Link control. */
  debounceMs?: number;
}

/** Members with duplicates dropped (first wins — a DS choice: Desk's pills keep a repeated row that is not the last one,
 *  multiselect_pills.js:54-75); a member whose label is only its id borrows a known label. */
export function uniqueMembers(members: UserOption[], known: UserOption[] = []): UserOption[] {
  const seen = new Set<string>();
  const out: UserOption[] = [];
  for (const m of members) {
    if (!m?.id || seen.has(m.id)) continue;
    seen.add(m.id);
    const k = m.label && m.label !== m.id ? undefined : known.find((x) => x.id === m.id && x.label && x.label !== x.id);
    out.push(k ? { ...m, label: k.label, image: m.image ?? k.image } : m);
  }
  return out;
}

const DEFAULT_PRIORITY = "__default";

function UserAvatar({ name, image, className }: { name: string; image?: string | null; className?: string }) {
  return (
    <Avatar aria-hidden className={cn("h-6 w-6 text-[10px]", className)}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

export function AssignDialog({ open, onOpenChange, searchUsers, onAssign, me, single, count, existing, details, labels, note, defaultDetails, threePriorities, groups }: AssignDialogProps) {
  const { t } = useLocale();
  const L = {
    title: labels?.title ?? t("recAssignTitle"), forCount: labels?.forCount ?? t("recAssignForCount"), toMe: labels?.toMe ?? t("recAssignToMe"),
    users: labels?.users ?? t("recAssignUsers"), search: labels?.search ?? t("recAssignSearch"), noMatches: labels?.noMatches ?? t("recMentionNoResults"),
    current: labels?.current ?? t("recAssignCurrent"), none: labels?.none ?? t("recAssignNone"), description: labels?.description ?? t("recAssignDescription"),
    due: labels?.due ?? t("recAssignDue"), priority: labels?.priority ?? t("recAssignPriority"), priorityDefault: labels?.priorityDefault ?? t("recAssignPriorityDefault"),
    low: labels?.low ?? t("recPriorityLow"), medium: labels?.medium ?? t("recPriorityMedium"), high: labels?.high ?? t("recPriorityHigh"),
    confirm: labels?.confirm ?? t("recAssignConfirm"), cancel: labels?.cancel ?? t("recCancel"), singleHint: labels?.singleHint ?? t("recAssignSingleHint"),
    remove: labels?.remove ?? t("recRemoveAssignee"), clearDate: labels?.clearDate ?? t("recAssignClearDate"),
  };
  const show = details === true ? { description: true, date: true, priority: true } : details ? details : {};
  const [q, setQ] = React.useState("");
  const [picked, setPicked] = React.useState<UserOption[]>([]);
  const [d, setD] = React.useState<AssignDetails>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const { options, loading, error: searchError } = useAsyncOptions(searchUsers, q, open);
  const id = React.useId();
  // P36c: "Assign To User Group"
  const [group, setGroup] = React.useState<{ value: string; label?: string } | null>(null);
  const [groupBusy, setGroupBusy] = React.useState(false);
  const [groupMsg, setGroupMsg] = React.useState<{ error: boolean; text: string } | null>(null);
  const groupReq = React.useRef(0);

  React.useEffect(() => {
    if (!open) { setQ(""); setPicked([]); setD({}); setError(""); setBusy(false); setGroup(null); setGroupBusy(false); setGroupMsg(null); groupReq.current += 1; }
    else if (defaultDetails) setD(defaultDetails);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // a refused group search (Desk: the 403's "Not permitted" message, request.js:149-177) is shown under the field too
  const searchGroups = React.useCallback<SearchFn>(async (txt) => {
    if (!groups) return [];
    try { const r = await groups.search(txt); setGroupMsg((m) => (m?.error ? null : m)); return r; }
    catch (e) { setGroupMsg({ error: true, text: e instanceof Error ? e.message : String(e) }); throw e; }
  }, [groups]);

  // Desk's `user_group_list` (assign_to.js:142-160): runs on a CHANGED group only (a Link's onchange); an emptied group
  // changes nothing; otherwise the members (User Group Member rows) replace the users to assign.
  const pickGroup = (value: string | null, s?: Suggestion) => {
    if ((value ?? null) === (group?.value ?? null)) return;
    if (!value) { setGroup(null); setGroupMsg(null); groupReq.current += 1; setGroupBusy(false); return; }
    const label = s?.label || value;
    setGroup({ value, label });
    if (!groups) return;
    const req = ++groupReq.current;
    setGroupBusy(true); setGroupMsg(null);
    groups.members(value).then(
      (ms) => {
        if (req !== groupReq.current) return;
        const list = uniqueMembers(ms ?? [], [...picked, ...options, ...(me ? [me] : [])]);
        setPicked(list);
        setGroupMsg({ error: false, text: list.length ? fmt(t("sbAssignGroupMembers"), label, list.length) : fmt(t("sbAssignGroupEmpty"), label) });
      },
      (e) => { if (req === groupReq.current) setGroupMsg({ error: true, text: e instanceof Error ? e.message : String(e) }); },
    ).finally(() => { if (req === groupReq.current) setGroupBusy(false); });
  };

  const isPicked = (u: UserOption) => picked.some((x) => x.id === u.id);
  const toggle = (u: UserOption) => setPicked((p) => (p.some((x) => x.id === u.id) ? p.filter((x) => x.id !== u.id) : single ? [u] : [...p, u]));
  const submit = async () => {
    if (!picked.length) return;
    setBusy(true); setError("");
    try { await onAssign(picked, d); onOpenChange(false); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="sf-assign-dialog">
        <DialogHeader>
          <DialogTitle>{L.title}</DialogTitle>
          <DialogDescription>{count !== undefined ? L.forCount.replace("{n}", String(count)) : null}{single ? <>{count !== undefined ? " · " : ""}{L.singleHint}</> : null}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {me ? (
            // Desk's "Assign to me" (assign_to.js:132-141, 170-177): adds (or, with one assignee, sets) the session user
            <div className="flex items-center gap-2">
              <Checkbox id={`${id}-me`} checked={isPicked(me)} onCheckedChange={() => toggle(me)} />
              <Label htmlFor={`${id}-me`} className="cursor-pointer font-normal">{L.toMe}</Label>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor={`${id}-q`}>{L.users}</Label>
            {picked.length ? (
              <div className="flex flex-wrap gap-1.5" aria-label={L.users}>
                {picked.map((u) => (
                  <span key={u.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 py-0.5 pe-1 ps-1 text-xs">
                    <UserAvatar name={u.label} image={u.image} className="h-5 w-5" />{u.label}
                    <button type="button" className="rounded-full p-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={L.remove.replace("{0}", u.label)} onClick={() => toggle(u)}><X className="h-3 w-3" aria-hidden /></button>
                  </span>
                ))}
              </div>
            ) : null}
            <Input id={`${id}-q`} value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.search} aria-label={L.search} className="h-8" />
            <div role="listbox" aria-multiselectable={!single} aria-label={L.users} className="max-h-44 space-y-0.5 overflow-auto rounded-md border border-border p-1">
              {loading ? <Skeleton className="h-8 w-full" /> : null}
              {!loading && searchError ? <p role="alert" className="px-2 py-2 text-xs text-destructive">{searchError}</p> : null}
              {!loading && !searchError && options.length === 0 ? <p className="px-2 py-2 text-center text-xs text-muted-foreground">{L.noMatches}</p> : null}
              {!loading && options.map((u) => {
                const sel = isPicked(u);
                return (
                  <div key={u.id} role="option" aria-selected={sel} tabIndex={0} onClick={() => toggle(u)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(u); } }}
                    className={cn("flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none hover:bg-accent focus-visible:bg-accent", sel && "bg-accent/60")}>
                    <UserAvatar name={u.label} image={u.image} />
                    <span className="flex-1 truncate">{u.label}</span>
                    {u.description ? <span className="truncate text-xs text-muted-foreground">{u.description}</span> : null}
                    {sel ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
                  </div>
                );
              })}
            </div>
          </div>

          {groups && !single ? (
            // Desk's "Assign To User Group" Link field (assign_to.js:191-197), after "Assign To"
            <div className="space-y-1" data-testid="sf-assign-group">
              <Label htmlFor={`${id}-group`}>{groups.label ?? t("sbAssignGroup")}</Label>
              <LinkInput id={`${id}-group`} value={group?.value ?? null} displayValue={group?.label ?? null} search={searchGroups}
                onChange={pickGroup} onCommitText={() => { /* not a listed group: discarded (Desk's link validation clears it) */ }}
                debounceMs={groups.debounceMs} busy={groupBusy} placeholder={groups.placeholder ?? t("sbAssignGroupSearch")}
                aria-describedby={groupMsg ? `${id}-group-msg` : undefined} />
              {groupMsg ? (
                <p id={`${id}-group-msg`} role={groupMsg.error ? "alert" : "status"}
                  className={cn("text-xs", groupMsg.error ? "text-destructive" : "text-muted-foreground")}>{groupMsg.text}</p>
              ) : null}
            </div>
          ) : null}

          {show.date || show.priority ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {show.date ? (
                <div className="min-w-0 space-y-1">
                  <Label htmlFor={`${id}-due`}>{L.due}</Label>
                  <div className="flex items-center gap-1">
                    <DateField id={`${id}-due`} value={d.date ?? ""} onChange={(v) => setD((x) => ({ ...x, date: v || undefined }))} className="min-w-0 flex-1" />
                    {d.date ? <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={L.clearDate} onClick={() => setD((x) => ({ ...x, date: undefined }))}><X className="h-3.5 w-3.5" aria-hidden /></Button> : null}
                  </div>
                </div>
              ) : null}
              {show.priority ? (
                <div className="min-w-0 space-y-1">
                  <Label htmlFor={`${id}-priority`}>{L.priority}</Label>
                  <Select value={d.priority ?? (threePriorities ? "Medium" : DEFAULT_PRIORITY)} onValueChange={(v) => setD((x) => ({ ...x, priority: v === DEFAULT_PRIORITY ? undefined : (v as AssignDetails["priority"]) }))}>
                    <SelectTrigger id={`${id}-priority`} className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {threePriorities ? null : <SelectItem value={DEFAULT_PRIORITY}>{L.priorityDefault}</SelectItem>}
                      <SelectItem value="Low">{L.low}</SelectItem>
                      <SelectItem value="Medium">{L.medium}</SelectItem>
                      <SelectItem value="High">{L.high}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}
          {show.description ? (
            <div className="space-y-1">
              <Label htmlFor={`${id}-comment`}>{L.description}</Label>
              <Textarea id={`${id}-comment`} rows={2} value={d.description ?? ""} onChange={(e) => setD((x) => ({ ...x, description: e.target.value }))} />
            </div>
          ) : null}

          {existing ? (
            <div className="space-y-1.5" data-testid="sf-assign-existing">
              <p className="text-xs font-medium text-muted-foreground">{L.current}</p>
              {existing.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {existing.map((a) => (
                    <li key={a.id} className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 py-0.5 pe-2 ps-1 text-xs">
                      <UserAvatar name={a.name} image={a.image} className="h-5 w-5" />{a.name}{a.description ? <span className="text-muted-foreground">· {a.description}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-muted-foreground">{L.none}</p>}
            </div>
          ) : null}
          {note}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{L.cancel}</Button>
          <Button type="button" disabled={!picked.length || busy} loading={busy} onClick={() => void submit()}>{L.confirm}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
