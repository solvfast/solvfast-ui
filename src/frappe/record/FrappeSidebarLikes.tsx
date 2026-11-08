/**
 * FrappeSidebarLikes — the form sidebar's like heart, count and liked-by list (P36b social). Frappe 15.110
 * `form/templates/form_sidebar.html:142-149`, `form/sidebar/form_sidebar.js:57-61, 200-205, 237-251`, `ui/like.js`.
 *
 * - The state is the DOCUMENT's `_liked_by` (form_sidebar.js:242-250 reads `frm.doc._liked_by`, not docinfo), read from
 *   the package's shared document query (`useDoc` → `frappeKeys.doc`; the form seeds it, so nothing is fetched twice).
 *   Names / images come from `docinfo.user_info` (load.py:496 adds the like_logs owners) through the shared docinfo query.
 * - A click sends `toggle_like {doctype, name, add: "Yes" | "No"}` (like.js:12-24). NOT optimistic: the heart is
 *   disabled while the request runs and changes only after the server answered — then the cached document's
 *   `_liked_by` is rewritten in place (like.js:36-50, `modified` untouched) and docinfo is invalidated (`like_logs`).
 *   A failure leaves everything as it was (Desk's call is `quiet`, like.js:19; `onError` lets the host say something).
 * - Guests / no session user / `readOnly`: the heart is disabled; the count and the list stay.
 */
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LikedBy, type LikedByProps } from "../../record/LikedBy";
import { Skeleton } from "../../primitives/skeleton";
import type { DocInfo } from "../contract";
import { useFrappeSettings } from "../FrappeProvider";
import { useDoc } from "../hooks";
import { useRecordApi, useRecordDocInfo } from "./data";
import { TOGGLE_LIKE_METHOD, applyLikeToCaches, likedByOf, toggleLikeArgs } from "./like";

export interface FrappeSidebarLikesProps {
  doctype: string;
  name: string;
  /** The heart is disabled (the count and the liked-by list stay). */
  readOnly?: boolean;
  /** The page's docinfo when it has it (names of the likers). */
  docinfo?: DocInfo;
  /** A like / unlike failed (Desk is quiet; the heart keeps its state). */
  onError?: (error: unknown) => void;
  labels?: LikedByProps["labels"];
  className?: string;
}

const isNewName = (name?: string) => !name || name.startsWith("new-");

export function FrappeSidebarLikes({ doctype, name, readOnly, docinfo, onError, labels, className }: FrappeSidebarLikesProps) {
  const api = useRecordApi();
  const qc = useQueryClient();
  const { session } = useFrappeSettings();
  const unsaved = isNewName(name);
  const loaded = useDoc(unsaved ? undefined : doctype, unsaved ? undefined : name);
  const info = useRecordDocInfo(unsaved ? undefined : doctype, name, docinfo);
  const doc = loaded.data?.doc;
  const user = session?.user;
  const likedBy = React.useMemo(() => likedByOf(doc), [doc]);
  const userInfo = info.data?.user_info;
  const users = React.useMemo(() => likedBy.map((u) => ({ id: u, label: userInfo?.[u]?.fullname || u, image: userInfo?.[u]?.image ?? null })), [likedBy, userInfo]);

  if (unsaved) return null; // the sidebar is hidden for new documents (form_sidebar.js:69-71)
  if (!doc) return loaded.error ? <p role="alert" className="text-xs text-destructive">{loaded.error.message}</p> : <Skeleton className="h-7 w-14" />;
  const canLike = !readOnly && !!user && user !== "Guest";

  return (
    <LikedBy
      className={className} labels={labels} liked={!!user && likedBy.includes(user)} users={users} disabled={!canLike} onError={onError}
      onToggle={canLike ? async (next) => {
        await api.call(TOGGLE_LIKE_METHOD, toggleLikeArgs(doctype, name, next));
        await applyLikeToCaches(qc, doctype, name, user!, next);
      } : undefined}
    />
  );
}
