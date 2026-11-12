import * as React from "react";
import { UserPlus } from "lucide-react";
import { AssigneeGroup, type AssigneeGroupProps } from "../../record/AssigneeGroup";
import { AssignDialog } from "../../record/AssignDialog";
import { SidebarSection } from "../../record/SidebarSection";
import { Skeleton } from "../../primitives/skeleton";
import { useLocale } from "../../theme/ThemeProvider";
import type { AssignmentInfo, DocInfo, FrappeDoc, MetaBundle } from "../contract";
import { useDocAction } from "../hooks";
import { useRecordApi, useRecordDocInfo } from "./data";
import { useFormSidebarActions } from "./useFormSidebarActions";
import { userGroupSource } from "./userGroups";

export interface FrappeAssignToProps extends Pick<AssigneeGroupProps, "variant" | "maxVisible" | "heading" | "labels" | "className" | "single" | "withDetails"> {
  doc: FrappeDoc;
  user: string;
  /** Display name of the signed-in user (for “Assign to me”). */
  userFullName?: string;
  /** Provide docinfo when the page already loaded it; otherwise it is fetched (`get_docinfo`). */
  docinfo?: DocInfo;
  /** Hide the add button (read-only page). Server stays the authority: any user who can READ the document may assign (assign_to.py:67). */
  canAssign?: boolean;
  /** `write` on the document. Desk shows remove only for the assignee or users with write (assign_to.js:358). */
  canWrite?: boolean;
  /** Only users shown by `searchUsers`; default: System Users that are enabled, through `search_link`. */
  searchUsers?: AssigneeGroupProps["searchUsers"];
  onChanged?: () => void;
  /**
   * P36b: "sidebar" = Desk's form-sidebar section (form_sidebar.html:43-56, assign_to.js): an "Assigned To" row whose
   * "+" opens the "Add to ToDo" dialog (Assign to me, several users, Complete By, Priority, Comment — prefilled with the
   * title field, assign_to.js:94-241), then one row per assignee with "Done" for the session user's own assignment
   * (`assign_to.close`, :344-356) and remove for the assignee or a user with write (:358-370). Default "group" (unchanged).
   */
  layout?: "group" | "sidebar";
  /** P36b: offer "Done" on the session user's own assignment (default: on in the sidebar layout). */
  allowComplete?: boolean;
  /** P36b: the meta, for the title field that prefills the dialog's Comment (sidebar layout). */
  bundle?: MetaBundle;
  /** P36c: Desk's "Assign To User Group" in the sidebar's "Add to ToDo" dialog (assign_to.js:142-160, 191-197): a User Group
   *  Link whose members replace the users to assign. Default on in the sidebar layout (as Desk); `false` hides it. */
  userGroups?: boolean;
  /** Sidebar layout: the dialog's Comment when it opens, instead of the title field (e.g. the deployment's ToDo text). */
  comment?: string;
  /** Sidebar layout: Priority offers only Low / Medium / High, Medium preselected (`AssignDialog.threePriorities`). */
  threePriorities?: boolean;
}

/**
 * ToDo-based assignment. List from `docinfo.assignments` (uncapped); after add / remove the docinfo is re-fetched — the
 * 5-row list `assign_to.add` returns is never used as the source of truth (docs 14 A2). Unsaved documents cannot be assigned.
 */
export function FrappeAssignTo({ doc, user, userFullName, docinfo, canAssign = true, canWrite = false, searchUsers, onChanged, layout = "group", allowComplete, bundle, userGroups = true, comment, threePriorities, ...rest }: FrappeAssignToProps) {
  const { t } = useLocale();
  const c = useRecordApi();
  const actions = useDocAction();
  const sidebarActions = useFormSidebarActions();
  const [dialog, setDialog] = React.useState(false);
  const q = useRecordDocInfo(doc.__islocal ? undefined : doc.doctype, doc.name, docinfo);
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
  const complete = allowComplete ?? layout === "sidebar";
  const groups = React.useMemo(
    () => (userGroups ? userGroupSource(c, { userLabel: (u) => info?.user_info?.[u]?.fullname }) : undefined),
    [c, userGroups, info],
  );
  if (layout === "sidebar") {
    if (doc.__islocal) return null; // assign_to.js:13-16
    const titleField = bundle?.meta.title_field;
    const title = titleField && doc[titleField] != null ? String(doc[titleField]) : "";
    const assign = async (users: { id: string }[], details: { description?: string; date?: string; priority?: "Low" | "Medium" | "High" }) => {
      await actions.assign.mutateAsync({ doctype: doc.doctype, name: doc.name, users: users.map((u) => u.id), ...details });
      onChanged?.();
    };
    return (
      <SidebarSection id="assign" label={rest.heading ?? t("sbAssignedTo")} icon={UserPlus} busy={q.isLoading} className={rest.className}
        action={canAssign ? { label: t("sbAssignAdd"), onClick: () => setDialog(true) } : undefined}>
        {q.isLoading ? <Skeleton className="h-7 w-24" /> : q.error && !info ? (
          <p role="alert" className="text-xs text-destructive">{q.error.message || t("sbLoadFailed")}</p>
        ) : (
          <AssigneeGroup assignees={assignees} searchUsers={search} variant="list" hideHeading heading={rest.heading ?? t("sbAssignedTo")} labels={rest.labels}
            onRemove={async (a) => { await actions.unassign.mutateAsync({ doctype: doc.doctype, name: doc.name, user: a.id }); onChanged?.(); }}
            canRemove={(a) => a.id === user || canWrite}
            onComplete={complete ? async (a) => { await sidebarActions.closeAssignment.mutateAsync({ doctype: doc.doctype, name: doc.name, user: a.id }); onChanged?.(); } : undefined}
            canComplete={(a) => a.id === user} />
        )}
        {canAssign ? (
          <AssignDialog open={dialog} onOpenChange={setDialog} searchUsers={search} onAssign={assign} me={{ id: user, label: userFullName ?? user }}
            existing={assignees} details={rest.withDetails ?? true} labels={{ title: t("sbAssignAdd") }}
            defaultDetails={comment || title ? { description: comment || title } : undefined} threePriorities={threePriorities} groups={groups} />
        ) : null}
      </SidebarSection>
    );
  }
  if (q.isLoading) return <Skeleton className="h-7 w-24" />;
  const unsaved = !!doc.__islocal;
  return (
    <AssigneeGroup
      {...rest} assignees={assignees} searchUsers={search} loading={false}
      me={{ id: user, label: userFullName ?? user }}
      onAssign={canAssign && !unsaved ? async (users, details) => {
        // useDocAction().assign invalidates docinfo + list; the <=5 row answer of assign_to.add is never used as the list
        await actions.assign.mutateAsync({ doctype: doc.doctype, name: doc.name, users: users.map((u) => u.id), ...details });
        onChanged?.();
      } : undefined}
      onRemove={async (a) => {
        await actions.unassign.mutateAsync({ doctype: doc.doctype, name: doc.name, user: a.id });
        onChanged?.();
      }}
      canRemove={(a) => a.id === user || canWrite}
      {...(allowComplete ? { onComplete: async (a: { id: string }) => { await sidebarActions.closeAssignment.mutateAsync({ doctype: doc.doctype, name: doc.name, user: a.id }); onChanged?.(); }, canComplete: (a: { id: string }) => a.id === user } : {})}
      {...(unsaved ? { disabled: true, disabledReason: t("recSaveBeforeAssign") } : {})}
    />
  );
}
