import type * as React from "react";

/** Semantic tone → design-system token colour. Frappe's indicator colours are mapped onto these by the wrapper. */
export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

export interface RecordUser { id: string; name: string; image?: string | null }

export type TimelineKind =
  | "comment" | "change" | "assignment" | "attachment" | "state" | "created" | "modified" | "info" | "like"
  | "communication" | "custom";

/** One before/after line of a field-change entry (a child-table row change carries `row`). */
export interface TimelineChange { label: string; before?: string; after?: string; row?: number }

export interface TimelineItem {
  id: string;
  kind: TimelineKind;
  /** Epoch ms. */
  at: number;
  /** Display name of whoever did it (already resolved, or "You"). */
  actor?: string;
  actorId?: string;
  /** One plain-text line (everything except comments). */
  summary?: string;
  /** Comment body: HTML (sanitised on render) when `bodyFormat` is "html" (default), else plain text. */
  body?: string;
  bodyFormat?: "html" | "text";
  /** Expandable detail lines for a field-change entry. */
  changes?: TimelineChange[];
  /** The author may edit / delete this entry (comments only) — decided by the caller, never inferred here. */
  canEdit?: boolean;
  canDelete?: boolean;
  /** Optional link target for the entry (e.g. the attachment). */
  href?: string;
  icon?: React.ReactNode;
}

export interface Assignee { id: string; name: string; image?: string | null; description?: string }
export interface AssignDetails { description?: string; date?: string; priority?: "Low" | "Medium" | "High" }
export interface MentionOption { id: string; label: string; isGroup?: boolean }
export interface UserOption { id: string; label: string; image?: string | null; description?: string }

/** P35 (G7): how a lifecycle state relates to the record. `skipped` = never reached on this record's path (a Lost deal's
 *  "Won"); `failed` = the path ended or stopped here unsuccessfully. */
export type LifecycleStep = "past" | "current" | "future" | "skipped" | "failed";

export interface LifecycleStateItem {
  id: string; label: string; tone?: Tone;
  /** Who moved the record INTO this state, and when (epoch ms). Shown under past states (and the current one with `showCurrentEntry`). */
  by?: string; at?: number;
  /** P35 (G7): explicit step state; overrides the position-based one (before `current` = past, after = future). */
  step?: LifecycleStep;
}
export interface LifecycleActionItem {
  id: string;
  label: string;
  tone?: Tone;
  /** `true` = default confirmation text; a string = the confirmation body. Omit for no confirmation. */
  confirm?: boolean | string;
  disabled?: boolean;
}
