/**
 * Likes (P36b social) — Frappe 15.110 `frappe/desk/like.py` and `public/js/frappe/ui/like.js`. No React, no network.
 *
 * `toggle_like(doctype, name, add)` (like.py:15-27): `add` "Yes" adds the session user to the document's `_liked_by`
 * (JSON list) and writes a "Like" comment ("Liked", :89-91); anything else removes the user and deletes their Like
 * comments (:68-86). `_liked_by` is written with `update_modified=False` (:55-58) — the document's `modified` does not
 * change. Only logged-in users (Guest → 403); no document permission is checked by the method itself.
 */
import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { frappeKeys, type FrappeDoc } from "../contract";
import { applyDocInfoChange } from "../services/cache";

export const TOGGLE_LIKE_METHOD = "frappe.desk.like.toggle_like";

/** `frappe.ui.get_liked_by(doc)` (like.js:8-10): the parsed `_liked_by` list ([] when empty or not a list). */
export function likedByOf(doc: object | undefined | null): string[] {
  const raw = (doc as { _liked_by?: unknown } | null | undefined)?._liked_by;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw !== "string" || !raw) return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
}

/** The request Desk sends (like.js:17-24). */
export function toggleLikeArgs(doctype: string, name: string, like: boolean): Record<string, unknown> {
  return { doctype, name, add: like ? "Yes" : "No" };
}

/** `_liked_by` after a confirmed toggle, as like.js:36-50 rewrites `locals`. */
export function nextLikedBy(current: string[], user: string, like: boolean): string[] {
  const rest = current.filter((u) => u !== user);
  return like ? (current.includes(user) ? current : [...current, user]) : rest;
}

/**
 * After the server confirmed: the cached document's `_liked_by` (no reload, `modified` untouched — Desk patches
 * `locals`, like.js:36-50), the cached rows of this DocType's lists (as FrappeListView does), and `docinfo`
 * invalidated (the Like comment lands in `like_logs`; Desk gets it by the `docinfo_update` realtime event, comment.py:78-97).
 */
export async function applyLikeToCaches(qc: QueryClient, doctype: string, name: string, user: string, like: boolean): Promise<void> {
  qc.setQueryData<FrappeDoc>(frappeKeys.doc(doctype, name), (d) => (d ? { ...d, _liked_by: JSON.stringify(nextLikedBy(likedByOf(d), user, like)) } : d));
  qc.setQueriesData<InfiniteData<{ rows: Record<string, unknown>[] }>>({ queryKey: ["sf-frappe", "list", doctype] }, (data) => {
    if (!data || !Array.isArray((data as { pages?: unknown }).pages)) return data;
    return {
      ...data,
      pages: data.pages.map((p) => (p && Array.isArray(p.rows) ? { ...p, rows: p.rows.map((r) => (String(r?.name) === name && "_liked_by" in r ? { ...r, _liked_by: JSON.stringify(nextLikedBy(likedByOf(r), user, like)) } : r)) } : p)),
    };
  });
  await applyDocInfoChange(qc, doctype, name);
}
