import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AssigneeGroup, type AssigneeGroupProps } from "../../record/AssigneeGroup";
import { Skeleton } from "../../primitives/skeleton";
import { useLocale } from "../../theme/ThemeProvider";
import type { AssignmentInfo, DocInfo, FrappeDoc } from "../contract";
import { invalidateDocInfo, requireClientMethod, useRecordClient, useRecordDocInfo, type RecordClient } from "./data";

export interface FrappeAssignToProps extends Pick<AssigneeGroupProps, "variant" | "maxVisible" | "heading" | "labels" | "className" | "single" | "withDetails"> {
  doc: FrappeDoc;
  user: string;
  /** Display name of the signed-in user (for “Assign to me”). */
  userFullName?: string;
  /** Provide docinfo when the page already loaded it; otherwise it is fetched (`get_docinfo`). */
  docinfo?: DocInfo;
  client?: RecordClient;
  /** Hide the add button (read-only page). Server stays the authority: any user who can READ the document may assign (assign_to.py:67). */
  canAssign?: boolean;
  /** `write` on the document. Desk shows remove only for the assignee or users with write (assign_to.js:358). */
  canWrite?: boolean;
  /** Only users shown by `searchUsers`; default: System Users that are enabled, through `search_link`. */
  searchUsers?: AssigneeGroupProps["searchUsers"];
  onChanged?: () => void;
}

/**
 * ToDo-based assignment. List from `docinfo.assignments` (uncapped); after add / remove the docinfo is re-fetched — the
 * 5-row list `assign_to.add` returns is never used as the source of truth (docs 14 A2). Unsaved documents cannot be assigned.
 */
export function FrappeAssignTo({ doc, user, userFullName, docinfo, client, canAssign = true, canWrite = false, searchUsers, onChanged, ...rest }: FrappeAssignToProps) {
  const { t } = useLocale();
  const c = useRecordClient(client);
  const qc = useQueryClient();
  const q = useRecordDocInfo(c, doc.__islocal ? undefined : doc.doctype, doc.name, docinfo);
  const info = q.data;
  const assignees = React.useMemo(
    () => (info?.assignments ?? []).filter((a: AssignmentInfo) => !!a.owner).map((a) => ({
      id: a.owner, name: info?.user_info?.[a.owner]?.fullname ?? a.owner, image: info?.user_info?.[a.owner]?.image ?? null, description: a.description,
    })),
    [info],
  );
  const search = React.useCallback(
    searchUsers ?? (async (txt: string) => (await c.searchLink("User", txt, { pageLength: 10, filters: { user_type: "System User", enabled: 1 } } as never)).map((r) => ({ id: r.value, label: r.label || r.value, description: r.description }))),
    [c, searchUsers],
  );
  if (q.isLoading) return <Skeleton className="h-7 w-24" />;
  const unsaved = !!doc.__islocal;
  return (
    <AssigneeGroup
      {...rest} assignees={assignees} searchUsers={search} loading={false}
      me={{ id: user, label: userFullName ?? user }}
      onAssign={canAssign && !unsaved ? async (users, details) => {
        await requireClientMethod(c, "addAssignment")(doc.doctype, doc.name, users.map((u) => u.id), details);
        invalidateDocInfo(qc, doc.doctype, doc.name); onChanged?.();
      } : undefined}
      onRemove={async (a) => {
        await requireClientMethod(c, "removeAssignment")(doc.doctype, doc.name, a.id);
        invalidateDocInfo(qc, doc.doctype, doc.name); onChanged?.();
      }}
      canRemove={(a) => a.id === user || canWrite}
      {...(unsaved ? { disabled: true, disabledReason: t("recSaveBeforeAssign") } : {})}
    />
  );
}
