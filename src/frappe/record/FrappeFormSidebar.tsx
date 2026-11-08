/**
 * FrappeFormSidebar — Desk's form sidebar for any DocType (Frappe 15.110 `form/sidebar/form_sidebar.js`,
 * `form/templates/form_sidebar.html`) over the package client, laid out by the Core `FormSidebar` in Desk's order:
 * Assigned To → Attachments → Tags → Share → likes · comment count → "… last edited this" / "… created this" → comments.
 *
 * ONE docinfo: every section reads the shared `useDocInfo(doctype, name)` query (key `frappeKeys.docinfo`, seeded by
 * getdoc through `useDoc`) and every write ends in `applyDocInfoChange` — the sidebar, the timeline and any other
 * docinfo reader refresh together, as Desk's `frm.sidebar.reload_docinfo` / realtime `docinfo_update` do. The Share,
 * Likes and Comments parts are slots (`share`, `likes`, `comments`), drawn at Desk's positions.
 *
 * Desk hides the sidebar of an unsaved document (form_sidebar.js:71-74): nothing is rendered for one.
 */
import * as React from "react";
import { FormSidebar, type FormSidebarSectionId, type FormSidebarUserAction } from "../../record/FormSidebar";
import { useLocale } from "../../theme/ThemeProvider";
import { parseFrappeTime } from "./timeline";
import type { FrappeDoc, MetaBundle } from "../contract";
import { useFrappeSettings } from "../FrappeProvider";
import { useDoc, useDocInfo, useMetaBundle } from "../hooks";
import { usePermissions } from "../hooks/usePermissions";
import { FrappeAssignTo, type FrappeAssignToProps } from "./FrappeAssignTo";
import { FrappeAttachments, type FrappeAttachmentsProps } from "./FrappeAttachments";
import { FrappeDocTags } from "./FrappeDocTags";

export interface FrappeFormSidebarProps {
  doctype: string;
  name: string;
  /** The document / meta when the page has them (FrappeForm does); else read through `useDoc` / `useMetaBundle`. */
  doc?: FrappeDoc;
  bundle?: MetaBundle;
  /** No changes from the sidebar (every add / remove hidden); passed on to the slots' owners by the host. */
  readOnly?: boolean;
  /** Slots at Desk's positions: Share (after Tags), Likes (stats row), Comments (last). */
  share?: React.ReactNode;
  likes?: React.ReactNode;
  comments?: React.ReactNode;
  /** Which sections, in which order (Core `FORM_SIDEBAR_SECTIONS` by default). Desk's own rules still apply. */
  sections?: readonly FormSidebarSectionId[];
  /** Desk's `frm.sidebar.add_user_action` links (form_sidebar.js:186-193). */
  userActions?: FormSidebarUserAction[];
  /** The stats row's comment count click (default: scroll to the comments slot). */
  onCommentsClick?: () => void;
  onOpenFileList?: FrappeAttachmentsProps["onOpenFileList"];
  fileRecordHref?: FrappeAttachmentsProps["fileRecordHref"];
  /** Passed to the assignment section (user search, labels…). */
  assignProps?: Partial<Pick<FrappeAssignToProps, "searchUsers" | "labels" | "withDetails" | "onChanged">>;
  /** Clock for the relative times (tests). */
  now?: number;
  className?: string;
}

export function FrappeFormSidebar({
  doctype, name, doc: givenDoc, bundle: givenBundle, readOnly, share, likes, comments, sections, userActions, onCommentsClick, onOpenFileList, fileRecordHref,
  assignProps, now, className,
}: FrappeFormSidebarProps) {
  const { t } = useLocale();
  const { session } = useFrappeSettings();
  const unsaved = !!givenDoc?.__islocal;
  const docQ = useDoc(givenDoc || !name ? undefined : doctype, givenDoc ? undefined : name);
  const metaQ = useMetaBundle(givenBundle ? undefined : doctype);
  const doc = givenDoc ?? docQ.data?.doc;
  const bundle = givenBundle ?? metaQ.data;
  // with a given doc, the docinfo query runs on its own (a doc loaded by `useDoc` has seeded it — no second request)
  const infoQ = useDocInfo(givenDoc && !unsaved ? doctype : undefined, givenDoc ? name : undefined);
  const info = givenDoc ? infoQ.data : docQ.data?.docinfo;
  const perms = usePermissions(bundle, doc, info);
  const user = session?.user ?? "";

  if (unsaved || doc?.__islocal) return <FormSidebar hidden />;
  if (!doc || !bundle || !info) {
    const error = (givenDoc ? infoQ.error : docQ.error) ?? metaQ.error;
    if (error) {
      const retry = () => { void (givenDoc ? infoQ.refetch() : docQ.refetch()); if (metaQ.error) void metaQ.refetch(); };
      return <FormSidebar error={error.message || t("sbLoadFailed")} onRetry={retry} className={className} />;
    }
    return <FormSidebar loading className={className} />;
  }

  const who = (u?: unknown) => (typeof u === "string" && u ? info.user_info?.[u]?.fullname || u : "");
  const stamp = (u: unknown, at: unknown) => (typeof u === "string" && u ? { name: who(u), isYou: u === user, at: parseFrappeTime(typeof at === "string" ? at : undefined) || undefined } : undefined);
  return (
    <FormSidebar
      className={className} sections={sections} userActions={userActions} now={now}
      assign={
        <FrappeAssignTo layout="sidebar" doc={doc} bundle={bundle} user={user} userFullName={session?.fullName} canAssign={!readOnly} canWrite={!readOnly && perms.can("write")} {...assignProps} />
      }
      attachments={<FrappeAttachments doctype={doctype} name={doc.name} doc={doc} bundle={bundle} readOnly={readOnly} onOpenFileList={onOpenFileList} fileRecordHref={fileRecordHref} />}
      tags={<FrappeDocTags doctype={doctype} name={doc.name} doc={doc} bundle={bundle} readOnly={readOnly} />}
      share={share} likes={likes} comments={comments}
      commentCount={(info.comments ?? []).length} onCommentsClick={onCommentsClick}
      modified={stamp(doc.modified_by, doc.modified)} created={stamp(doc.owner, doc.creation)}
    />
  );
}
