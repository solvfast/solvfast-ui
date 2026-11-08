/**
 * FrappeSidebarShare — the form sidebar's "Share" section (P36b social): the shared-with avatars from `docinfo.shared`
 * and Desk's share dialog, persisted through `frappe.share.*` (share.ts). Frappe 15.110 `form/sidebar/share.js`,
 * `form/templates/form_sidebar.html:105-118`, `form/templates/set_sharing.html`.
 *
 * - The avatars read `docinfo.shared` (load.py:129 `get_docshares` — the DocShare rows; `[]` without read) through the
 *   package's shared docinfo query (`useRecordDocInfo` → `useDocInfo`, key `frappeKeys.docinfo`), so the form, its
 *   timeline and this section stay in step. Hidden when the document is not shared (share.js:29-32).
 * - "+" opens the dialog (share.js:42-70): the rows are (re)read with `get_users`; every change is a server call and the
 *   row shows the server's answer (share.js:142-200), never a guess; after each change the docinfo is invalidated
 *   (`applyDocInfoChange`; Desk reloads it when the dialog closes after a change, share.js:64-67) so the sidebar and
 *   the permissions follow.
 * - Who may change anything: `frappe.model.can_share` (model.js:462-473) = `frm.perm[0].share` (the `share` right from
 *   the roles, or a DocShare with share=1 — usePermissions) and not `sharingDisabled` (unless Administrator). Without it
 *   the dialog opens read-only (share.js:96-99). Write / Submit can only be granted with those rights (set_sharing.html).
 *   The server decides in the end (share.py:216-244, docshare.py:57-69); its refusal is shown in the dialog.
 * - New (unsaved) documents: no "+" (share.js:16-18).
 */
import * as React from "react";
import { Plus, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "../../lib/cn";
import { Skeleton } from "../../primitives/skeleton";
import { ShareDialog, SharedAvatars, type ShareDialogLabels, type ShareEntry, type ShareRight, type ShareRights } from "../../record/ShareDialog";
import type { UserOption } from "../../record/types";
import { useLocale } from "../../theme/ThemeProvider";
import type { DocInfo } from "../contract";
import { useFrappeSettings } from "../FrappeProvider";
import { useDoc, usePermissions } from "../hooks";
import { applyDocInfoChange } from "../services/cache";
import { useRecordApi, useRecordDocInfo, useRecordMeta } from "./data";
import {
  SHARE_ADD_METHOD, SHARE_GET_USERS_METHOD, SHARE_SET_PERMISSION_METHOD, canShareDocument, mergeShareAnswer, setPermissionArgs, shareAddArgs, shareEntries,
  shareRows, type DocShareRow,
} from "./share";

export interface FrappeSidebarShareProps {
  doctype: string;
  name: string;
  /** No changes from this page (the dialog still opens, read-only, as for a user without the share right). */
  readOnly?: boolean;
  /** The page's docinfo when it has it (otherwise the shared docinfo query is used). */
  docinfo?: DocInfo;
  /** System Settings "Disable Document Sharing" (`sys_defaults.disable_document_sharing`, model.js:463-467). */
  sharingDisabled?: boolean;
  /** Replace the user search of the add row (default: System Users other than you, share.js:103-117). */
  searchUsers?: (query: string) => Promise<UserOption[]>;
  /** Avatars before "+n" (Desk: 5). */
  maxAvatars?: number;
  /** Render the "Share" heading row with the "+" button (default true). */
  heading?: boolean;
  labels?: ShareDialogLabels & { heading?: string; open?: string };
  className?: string;
}

const isNewName = (name?: string) => !name || name.startsWith("new-");

export function FrappeSidebarShare({ doctype, name, readOnly, docinfo, sharingDisabled, searchUsers, maxAvatars = 5, heading = true, labels, className }: FrappeSidebarShareProps) {
  const { t } = useLocale();
  const api = useRecordApi();
  const qc = useQueryClient();
  const { session } = useFrappeSettings();
  const unsaved = isNewName(name);
  const info = useRecordDocInfo(unsaved ? undefined : doctype, name, docinfo);
  const loaded = useDoc(unsaved ? undefined : doctype, unsaved ? undefined : name);
  const meta = useRecordMeta(doctype);
  const perms = usePermissions(meta.data, loaded.data?.doc, info.data);
  const canShare = !readOnly && !unsaved && canShareDocument({ share: perms.can("share"), user: session?.user, sharingDisabled });
  const canGrant = { write: perms.can("write"), submit: perms.can("submit") };

  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<DocShareRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState("");
  const seq = React.useRef(0);

  const show = React.useCallback(async () => {
    setOpen(true); setLoading(true); setLoadError("");
    const id = ++seq.current;
    try {
      const res = await api.call(SHARE_GET_USERS_METHOD, { doctype, name });
      if (id === seq.current) setRows(shareRows(res.message));
    } catch (e) {
      if (id === seq.current) setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [api, doctype, name]);

  const userInfo = info.data?.user_info;
  const entries = React.useMemo(() => shareEntries(rows, userInfo), [rows, userInfo]);

  const onAdd = async (user: string, rights: ShareRights) => {
    const res = await api.call(SHARE_ADD_METHOD, shareAddArgs(doctype, name, user, rights));
    setRows((r) => mergeShareAnswer(r, { user }, (res.message as DocShareRow | undefined) ?? null, "add"));
    await applyDocInfoChange(qc, doctype, name);
  };
  const onSetRight = async (entry: ShareEntry, right: ShareRight, value: boolean) => {
    const res = await api.call(SHARE_SET_PERMISSION_METHOD, setPermissionArgs(doctype, name, entry, right, value));
    setRows((r) => mergeShareAnswer(r, entry, (res.message as DocShareRow | undefined) ?? null, "set"));
    await applyDocInfoChange(qc, doctype, name);
  };

  const me = session?.user;
  const search = React.useCallback(
    searchUsers ?? (async (txt: string): Promise<UserOption[]> => {
      // share.js:110-113: Link to User, `user_type` System User, not the session user
      const filters: Record<string, unknown> = { user_type: "System User", ...(me ? { name: ["!=", me] } : {}) };
      return (await api.searchLink("User", txt, { pageLength: 10, filters })).map((r) => ({ id: r.value, label: r.label || r.value, description: r.description }));
    }),
    [api, searchUsers, me],
  );

  const shared = shareRows(info.data?.shared);
  const avatars = shared.filter((s) => s.user && !(s.everyone === 1 || s.everyone === true)).map((s) => ({
    id: String(s.user), label: userInfo?.[String(s.user)]?.fullname || String(s.user), image: userInfo?.[String(s.user)]?.image ?? null,
  }));
  const everyone = shared.some((s) => s.everyone === 1 || s.everyone === true);
  const headingText = labels?.heading ?? t("socShare");

  return (
    <div className={cn("space-y-1.5", className)} data-sf-sidebar-share="">
      {heading ? (
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Users className="h-3.5 w-3.5" aria-hidden />{headingText}</span>
          {!unsaved ? (
            <button type="button" onClick={() => void show()} aria-label={labels?.open ?? t("socShareOpen")} title={labels?.open ?? t("socShareOpen")}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
      {info.isLoading ? <Skeleton className="h-6 w-24" /> : info.error ? <p role="alert" className="text-xs text-destructive">{info.error.message}</p> : (
        <SharedAvatars users={avatars} everyone={everyone} max={maxAvatars} onOpen={unsaved ? undefined : () => void show()} />
      )}
      {!unsaved ? (
        <ShareDialog
          open={open} onOpenChange={(o) => { setOpen(o); if (!o) seq.current++; }} docName={name} entries={entries} loading={loading}
          error={loadError || undefined} canShare={canShare} canGrant={canGrant} searchUsers={search}
          onAdd={canShare ? onAdd : undefined} onSetRight={canShare ? onSetRight : undefined} labels={labels}
        />
      ) : null}
    </div>
  );
}
