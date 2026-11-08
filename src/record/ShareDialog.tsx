/**
 * ShareDialog + SharedAvatars — Frappe Desk's "Share" sidebar section and dialog, Frappe-free (P36b social).
 *
 * Native behaviour reproduced (Frappe 15.110 `public/js/frappe/form/sidebar/share.js`, `form/templates/set_sharing.html`,
 * `form/templates/form_sidebar.html:105-118`):
 * - the dialog lists the "Everyone" row FIRST (always, with its rights or none), then one row per shared user, with the
 *   four rights Desk has — Can Read / Can Write / Can Submit / Can Share (set_sharing.html:2-43); nothing else is offered;
 * - every checkbox is applied at once (share.js:157-202 `set_permission`); the row is disabled while the server works and
 *   shows what the HOST passes back afterwards (no optimistic flip — a refusal leaves the box as it was and shows the
 *   server's message); un-ticking "Can Read" is how Desk removes a share (share.py:111-120 deletes the row);
 * - without the right to share (`canShare` false — Desk: `frappe.model.can_share`, model.js:462-473) every checkbox is
 *   disabled and the "Share this document with" row is not rendered (share.js:92-99, set_sharing.html:45);
 * - "Can Write" / "Can Submit" are disabled when the user lacks those rights on the document (`canGrant`, Desk's
 *   `frm.perm[0].write / .submit`, set_sharing.html:17,22,36,38,60,63); "Can Read" and "Can Share" never are;
 * - the add row: a user + the four boxes + "Add" (share.js:119-156); Desk's read box there has no effect (the server
 *   always adds read, share.py:44-45) — it is kept, as Desk shows it.
 * - SharedAvatars: up to 5 overlapping avatars of the shared users, hidden when there are none, a click opens the
 *   dialog (share.js:27-40).
 * Deliberate deviations: user rows show the display name with the user id under it (Desk shows the id only); an
 * "Everyone" pill in SharedAvatars (Desk passes a null user to its avatar group — "REDESIGN-TODO", share.js:39); a hint
 * explains why the boxes are disabled; the row being saved is disabled until the answer (Desk leaves it clickable).
 */
import * as React from "react";
import { Globe2, Plus } from "lucide-react";
import { cn } from "../lib/cn";
import { Avatar, AvatarFallback, AvatarImage } from "../primitives/avatar";
import { Button } from "../primitives/button";
import { Checkbox } from "../primitives/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../primitives/dialog";
import { SearchCombobox, type ComboOption } from "../primitives/search-combobox";
import { Skeleton } from "../primitives/skeleton";
import { useLocale } from "../theme/ThemeProvider";
import { errorText, fmt, initials } from "./format";
import type { UserOption } from "./types";

/** The four rights a DocShare row carries (core/doctype/docshare/docshare.json; share.py:43-49). */
export type ShareRight = "read" | "write" | "submit" | "share";
export const SHARE_RIGHTS: readonly ShareRight[] = ["read", "write", "submit", "share"];

/** One share row as the dialog shows it (a DocShare row: `user`, or `everyone`). */
export interface ShareEntry {
  /** Stable key (the DocShare name). */
  id: string;
  /** The user id; null for the everyone row. */
  user: string | null;
  everyone?: boolean;
  read?: boolean;
  write?: boolean;
  submit?: boolean;
  share?: boolean;
  /** Display name (default: the user id). */
  label?: string;
  image?: string | null;
}

export type ShareRights = Record<ShareRight, boolean>;

export interface ShareDialogLabels {
  title?: string; user?: string; read?: string; write?: string; submit?: string; share?: string; everyone?: string; shareWith?: string;
  search?: string; pick?: string; noMatches?: string; add?: string; loading?: string; noRight?: string;
}

export interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The document name for the default title "Share {0} with". */
  docName?: string;
  /** The shared rows (user rows and, when there is one, the everyone row). */
  entries: ShareEntry[];
  loading?: boolean;
  /** A load error (rendered instead of the list). */
  error?: React.ReactNode;
  /** The user may share (Desk `frappe.model.can_share`). False → every box disabled, no add row. */
  canShare: boolean;
  /** Rights the user holds on the document and may therefore grant: write / submit columns (Desk `frm.perm[0]`). */
  canGrant?: Partial<Record<"write" | "submit", boolean>>;
  /** User search for the add row (Desk: Link to User, System Users other than the session user). */
  searchUsers?: (query: string) => Promise<UserOption[]>;
  /** Add (or re-add) a user with the ticked rights. Reject to keep the dialog as it was and show the message. */
  onAdd?: (user: string, rights: ShareRights) => Promise<unknown>;
  /** Set one right of a row (the everyone row has `user: null`). Reject to keep the box as it was. */
  onSetRight?: (entry: ShareEntry, right: ShareRight, value: boolean) => Promise<unknown>;
  labels?: ShareDialogLabels;
  className?: string;
}

function UserAvatar({ name, image, className }: { name: string; image?: string | null; className?: string }) {
  return (
    <Avatar aria-hidden className={cn("h-6 w-6 text-[10px]", className)}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

const ADD = "\u0000add";
const NONE: ShareRights = { read: false, write: false, submit: false, share: false };

export function ShareDialog({ open, onOpenChange, docName, entries, loading, error, canShare, canGrant, searchUsers, onAdd, onSetRight, labels, className }: ShareDialogProps) {
  const { t } = useLocale();
  const L = {
    title: labels?.title ?? fmt(t("socShareTitle"), docName ?? ""), user: labels?.user ?? t("socShareUser"),
    read: labels?.read ?? t("socCanRead"), write: labels?.write ?? t("socCanWrite"), submit: labels?.submit ?? t("socCanSubmit"), share: labels?.share ?? t("socCanShare"),
    everyone: labels?.everyone ?? t("socEveryone"), shareWith: labels?.shareWith ?? t("socShareWith"), search: labels?.search ?? t("socShareSearch"),
    pick: labels?.pick ?? t("socSharePick"), noMatches: labels?.noMatches ?? t("socShareNoMatches"), add: labels?.add ?? t("socShareAddButton"),
    loading: labels?.loading ?? t("socShareLoading"), noRight: labels?.noRight ?? t("socShareNoRight"),
  };
  const head: Record<ShareRight, string> = { read: L.read, write: L.write, submit: L.submit, share: L.share };
  // rows with a request in flight (Desk disables nothing; here only the row being saved, so its box cannot be clicked twice)
  const [pending, setPending] = React.useState<ReadonlySet<string>>(new Set());
  const mark = (key: string, on: boolean) => setPending((p) => { const n = new Set(p); if (on) n.add(key); else n.delete(key); return n; });
  const [err, setErr] = React.useState("");
  const [user, setUser] = React.useState("");
  const [rights, setRights] = React.useState<ShareRights>(NONE);
  React.useEffect(() => { if (!open) { setPending(new Set()); setErr(""); setUser(""); setRights(NONE); } }, [open]);

  const everyone: ShareEntry = entries.find((e) => e.everyone) ?? { id: "__everyone", user: null, everyone: true };
  const users = entries.filter((e) => !e.everyone);
  const enabled = (right: ShareRight) => canShare && (right === "write" || right === "submit" ? !!canGrant?.[right] : true);

  const set = async (entry: ShareEntry, right: ShareRight, value: boolean) => {
    if (!onSetRight || pending.has(entry.id)) return;
    mark(entry.id, true); setErr("");
    try { await onSetRight(entry, right, value); } catch (e) { setErr(errorText(e) || "Error"); } finally { mark(entry.id, false); }
  };
  const add = async () => {
    if (!onAdd || !user || pending.has(ADD)) return;
    mark(ADD, true); setErr("");
    try { await onAdd(user, rights); setUser(""); setRights(NONE); } catch (e) { setErr(errorText(e) || "Error"); } finally { mark(ADD, false); }
  };
  const search = React.useCallback(async (q: string): Promise<ComboOption[]> => (searchUsers ? (await searchUsers(q)).map((u) => ({ value: u.id, label: u.label, description: u.description ?? (u.label !== u.id ? u.id : undefined) })) : []), [searchUsers]);

  const grid = "grid grid-cols-[minmax(0,1fr)_repeat(4,3.75rem)] items-center gap-x-1 sm:grid-cols-[minmax(0,1fr)_repeat(4,5.5rem)]";
  const header = (first: string) => (
    <div className={cn(grid, "pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground")} aria-hidden>
      <span>{first}</span>{SHARE_RIGHTS.map((r) => <span key={r} className="text-center leading-tight">{head[r]}</span>)}
    </div>
  );
  const row = (entry: ShareEntry, name: React.ReactNode, who: string) => (
    <div key={entry.id} role="group" aria-label={who} data-share-row={entry.everyone ? "everyone" : entry.user ?? ""} aria-busy={pending.has(entry.id) || undefined}
      className={cn(grid, "border-t border-border py-1.5")}>
      <div className="min-w-0">{name}</div>
      {SHARE_RIGHTS.map((r) => (
        <span key={r} className="flex justify-center">
          <Checkbox checked={!!entry[r]} disabled={!enabled(r) || !onSetRight || pending.has(entry.id)}
            aria-label={fmt(t("socShareRightFor"), who, head[r])} onCheckedChange={(v) => void set(entry, r, v === true)} />
        </span>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-2xl", className)} data-testid="sf-share-dialog">
        <DialogHeader>
          <DialogTitle>{L.title}</DialogTitle>
          <DialogDescription className={canShare ? "sr-only" : undefined}>{canShare ? L.shareWith : L.noRight}</DialogDescription>
        </DialogHeader>
        {error ? <div role="alert" className="text-sm text-destructive">{error}</div> : loading ? (
          <div role="status" aria-label={L.loading} className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
        ) : (
          <div className="space-y-4 text-sm">
            <div>
              {header(L.user)}
              {row(everyone, <span className="inline-flex items-center gap-2 font-semibold"><Globe2 className="h-4 w-4 text-muted-foreground" aria-hidden />{L.everyone}</span>, L.everyone)}
              {users.map((e) => {
                const label = e.label || e.user || "";
                return row(e, (
                  <span className="flex min-w-0 items-center gap-2">
                    <UserAvatar name={label} image={e.image} />
                    <span className="min-w-0"><bdi className="block truncate">{label}</bdi>{label !== e.user && e.user ? <bdi className="block truncate text-xs text-muted-foreground">{e.user}</bdi> : null}</span>
                  </span>
                ), label);
              })}
            </div>
            {canShare && onAdd ? (
              <div className="border-t border-border pt-3">
                {header(L.shareWith)}
                <div className={cn(grid, "py-1.5")}>
                  <SearchCombobox value={user || undefined} onSelect={setUser} search={search} placeholder={L.pick} searchPlaceholder={L.search} emptyText={L.noMatches}
                    aria-label={L.shareWith} variant="field" disabled={pending.has(ADD)} className="min-w-0" />
                  {SHARE_RIGHTS.map((r) => (
                    <span key={r} className="flex justify-center">
                      <Checkbox checked={rights[r]} disabled={!enabled(r) || pending.has(ADD)} aria-label={fmt(t("socShareRightFor"), L.shareWith, head[r])}
                        onCheckedChange={(v) => setRights((x) => ({ ...x, [r]: v === true }))} />
                    </span>
                  ))}
                </div>
                <Button type="button" size="sm" className="mt-2" disabled={!user || pending.has(ADD)} onClick={() => void add()}>
                  <Plus className="h-3.5 w-3.5" aria-hidden />{L.add}
                </Button>
              </div>
            ) : null}
            {err ? <p role="alert" className="text-xs text-destructive">{err}</p> : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export interface SharedAvatarsProps {
  users: Array<{ id: string; label: string; image?: string | null }>;
  /** The document is shared with everyone. */
  everyone?: boolean;
  /** Avatars shown before "+n" (Desk: 5). */
  max?: number;
  /** Opens the share dialog. */
  onOpen?: () => void;
  className?: string;
}

/** The sidebar's "shared with" avatars (share.js:27-40). Renders nothing when the document is not shared. */
export function SharedAvatars({ users, everyone, max = 5, onOpen, className }: SharedAvatarsProps) {
  const { t } = useLocale();
  if (!users.length && !everyone) return null;
  const shown = users.slice(0, max);
  const names = users.map((u) => u.label).join(", ");
  const label = [everyone ? t("socSharedEveryone") : "", users.length ? fmt(t("socSharedWith"), names) : ""].filter(Boolean).join(" · ");
  const body = (
    <>
      {everyone ? <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"><Globe2 className="h-3 w-3" aria-hidden />{t("socEveryone")}</span> : null}
      {shown.length ? (
        <span className="flex -space-x-1.5 rtl:space-x-reverse">
          {shown.map((u) => <UserAvatar key={u.id} name={u.label} image={u.image} className="ring-2 ring-background" />)}
        </span>
      ) : null}
      {users.length > max ? <span className="text-xs text-muted-foreground">{fmt(t("socShareMore"), users.length - max)}</span> : null}
    </>
  );
  return onOpen ? (
    <button type="button" onClick={onOpen} aria-label={label} title={label}
      className={cn("inline-flex items-center gap-1.5 rounded-md p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>{body}</button>
  ) : <span role="img" aria-label={label} title={label} className={cn("inline-flex items-center gap-1.5", className)}>{body}</span>;
}
