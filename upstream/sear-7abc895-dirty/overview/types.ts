// Platform Overview Modules — the ONE canonical config contract.
//
// This file is the single source of truth for what an app passes to
// <AppOverview config={...} />. The widgets are PURE + PRESENTATIONAL: every
// number is pre-computed by the consuming app from its own live fixtures. The
// library never fetches, never aggregates — it renders exactly what config gives.
//
// Bindings are bilingual (…En / …Ar); the active language is resolved once by
// <AppOverview> (prop `lang`, falling back to the document direction) and threaded
// to every widget. All drill-downs are react-router paths (`to`) — NO popups.

import type React from 'react';

/** A lucide-react icon (or any icon accepting className + style). */
export type OverviewIcon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

export type Lang = 'ar' | 'en';

/** Header time-range window. Stock numbers ignore it; flow numbers are recomputed by the app. */
export type TimeRange = '7d' | '30d' | '90d' | 'all';

/**
 * Status-chip semantics (color is derived from the kind; see overviewShared.CHIP).
 *
 * KEEP (v1.2 legitimate — the only kinds app agents should still pass):
 *   connected      → teal    (channels / connectors OK)
 *   error          → red     (channels / connectors failed)
 *   working        → sky     ┐  Senaiy AI-delegation states — colors MUST match the
 *   needs-approval → violet  │  My Work "AI / Delegated" module
 *   sent-back      → flame   ┘  (working sky #25d0fe · needs-approval violet #512195 · sent-back flame #fe4e18)
 *
 * PHANTOM (kept in the union only so yet-unedited app pages still compile; app
 * agents STOP passing these in v1.2 — do NOT introduce new usages):
 *   healthy | at-risk | pending → teal / flame
 *   expired → amber · idle → grey · neutral → violet
 */
export type ChipKind =
  | 'connected' | 'error'
  | 'working' | 'needs-approval' | 'sent-back'
  // phantom (deprecated — retained for backward compatibility only)
  | 'healthy' | 'at-risk' | 'expired' | 'idle' | 'pending' | 'neutral';

/** A small colored status chip. `labelEn/Ar` override the default per-kind label. */
export interface ChipConfig {
  kind: ChipKind;
  labelEn?: string;
  labelAr?: string;
}

// ── Zone 1 — Stat cards (default) ─────────────────────────────────────────────
export interface StatCardConfig {
  icon: OverviewIcon;
  /** Usually a number (locale-formatted). Pass a string for pre-formatted values like "83%". */
  value: number | string;
  labelEn: string;
  labelAr: string;
  /** Whole-card drill-down (react-router path). */
  to: string;
  /** Tint of the icon square + delta chip. Defaults to brand violet. */
  color?: string;
  /** Marks a "flow" metric — only flow cards show a delta chip (and only if `delta` is given). */
  flow?: boolean;
  delta?: { value: number | string; dir: 'up' | 'down' };
}

export interface StatCardsZone {
  kind?: 'statCards';
  cards: StatCardConfig[];
}

// ── Zone 1 — Definitions grid variant (Sayr Studio) ───────────────────────────
export interface DefinitionEntryConfig {
  titleEn: string;
  titleAr: string;
  total: number;
  to: string;
  icon?: OverviewIcon;
  /** Tint of the icon square (RC3 — rotates the brand palette). Defaults to brand violet. */
  color?: string;
}

export interface DefinitionsGridZone {
  kind: 'definitionsGrid';
  items: DefinitionEntryConfig[];
}

export type Zone1Config = StatCardsZone | DefinitionsGridZone;

// ── Zone 2 LEFT — Breakdown card (one or two labeled bar groups) ──────────────
export interface BreakdownBar {
  labelEn: string;
  labelAr: string;
  count: number;
  /** Bar color. Defaults to brand violet. */
  color?: string;
  to?: string;
  /** Optional leading visual node (e.g. a channel/type logo). Takes precedence over `icon`;
   *  replaces the default color dot. (RC4 — used by DistributionList's bar rows.) */
  logo?: React.ReactNode;
  /** Optional leading tinted icon (replaces the default color dot when no `logo`). */
  icon?: OverviewIcon;
}

export interface BreakdownGroup {
  titleEn: string;
  titleAr: string;
  bars: BreakdownBar[];
}

export interface BreakdownCardConfig {
  /** Optional card heading shown above the group(s). */
  titleEn?: string;
  titleAr?: string;
  /** ONE or TWO labeled bar groups rendered stacked in a single card. */
  groups: BreakdownGroup[];
}

// ── Zone 2 LEFT (alt) — Distribution widget (RC2 · RC1/RC1b) ───────────────────
// Groups an entity's records by a chosen dimension. Zone-2-left is EITHER a
// `breakdown` OR a `distribution` (distribution wins when both are present).
// The three universal phases are built into the widget. Status is scoped to a
// chosen Type: its axis comes from the Type's bound lifecycle DEFINITION when the
// Type carries `statuses` (RC1b), else it is derived from the records.

/** The record's high-level phase. Universal across every app. */
export type DistPhase = 'open' | 'on_hold' | 'closed';

/**
 * Group-by dimension. `phase` is universal; `status` requires a Type (RC1).
 * NOTE: the legacy `state` dimension was removed in RC1 — the widget now offers
 * only Phase | Status. `DistItem.state*` + `paramNames.state` are retained purely
 * for older callers' object literals to keep compiling (they are now ignored).
 */
export type DistGroupBy = 'phase' | 'status';

/** One pre-extracted record the app hands to the widget (never fetched here). */
export interface DistItem {
  phase: DistPhase;
  /** The record's Type — required to appear under Status grouping. */
  typeId?: string;
  /** @deprecated RC1 — the "State" grouping was removed; these are now ignored. */
  stateId?: string;
  /** @deprecated RC1 — the "State" grouping was removed; these are now ignored. */
  stateEn?: string;
  /** @deprecated RC1 — the "State" grouping was removed; these are now ignored. */
  stateAr?: string;
  statusId?: string;
  statusEn?: string;
  statusAr?: string;
  /** Per-record source (channel/origin); only used if the entity maps a `source` param. */
  source?: string;
}

/**
 * One Type option shown in the Distribution Type selector.
 * RC1b — when `statuses` is present it is the Type's FULL ordered lifecycle status
 * list; the Status axis then renders ALL of these IN THIS ORDER (zero-count
 * statuses shown as 0, never hidden), matched by `DistItem.statusId`. When ABSENT
 * (older callers), the Status axis is derived from the records (backward compat).
 */
export interface DistributionType {
  id: string;
  nameEn: string;
  nameAr: string;
  /** The Type's full ordered lifecycle statuses (RC1b). Populated from the real lifecycle definition. */
  statuses?: { id: string; nameEn: string; nameAr: string }[];
}

/** One selectable entity (e.g. Leads, Deals) with its records + link contract. */
export interface DistributionEntity {
  key: string;
  labelEn: string;
  labelAr: string;
  /** List route each bar deep-links to; query params are appended from `paramNames`. */
  linkBase: string;
  /** Maps each dimension to the query-param name the target list page reads. */
  paramNames: {
    type?: string;
    phase?: string;
    /** @deprecated RC1 — the "State" grouping was removed; this param name is now ignored. */
    state?: string;
    status?: string;
    source?: string;
  };
  /** A fixed source value appended to every link (via paramNames.source), if any. */
  source?: string;
  /** The Type options shown in the Type selector (required for Status grouping). */
  types: DistributionType[];
  /** App pre-extracts these; the widget only groups + counts them. */
  records: DistItem[];
}

export interface DistributionConfig {
  titleEn: string;
  titleAr: string;
  /** One or more entities; an entity toggle appears only when there are 2+. */
  entities: DistributionEntity[];
}

// ── Zone 2 LEFT (alt) — Channel-mix widget (Overview Corrections v1.3 §7) ──────
// A single card that toggles between named datasets (the Leads|Deals entity-toggle
// pattern), each rendering its OWN pre-computed, per-channel-colored bars via the
// shared BreakdownBarGroup. Unlike the DistributionWidget it does NOT group by
// Phase/Status — the app supplies the bars directly (e.g. "All | Publications |
// Broadcasts", one bar per channel). Zone-2-left precedence: distribution wins,
// then channelMix, then breakdown.
export interface ChannelMixEntity {
  key: string;
  labelEn: string;
  labelAr: string;
  /** Pre-computed, per-channel-colored bars (reuses BreakdownBar). */
  bars: BreakdownBar[];
}

export interface ChannelMixConfig {
  titleEn: string;
  titleAr: string;
  /** One or more datasets; the segmented toggle appears only when there are 2+. */
  entities: ChannelMixEntity[];
}

// ── Distribution list (RC4) — the compact bar-row list ────────────────────────
// Renders the SAME bar visual as BreakdownCard/DistributionWidget bars, but as a
// ranked list: rows sorted by count DESCENDING, capped at 8, each deep-linking via
// `to`, with an explicit footer "Showing {shown} of {total} · View all". NO chips.
// This REPLACES the "Top X" StatusListCard style (e.g. "Open Tickets by Type",
// "Open Requests by Service", "Articles by Type", "Members per Team").
export interface DistributionListRow {
  key: string;
  labelEn: string;
  labelAr: string;
  count: number;
  /** Row deep-link (react-router path). */
  to: string;
  /** Optional leading visual node (e.g. a channel/type logo). Takes precedence over `icon`. */
  logo?: React.ReactNode;
  /** Optional leading tinted icon (when no `logo`). */
  icon?: OverviewIcon;
  /** Bar color. Defaults to the rotating brand palette by rank. */
  color?: string;
}

export interface DistributionListConfig {
  titleEn: string;
  titleAr: string;
  rows: DistributionListRow[];
  /** Full count BEFORE the cap (drives "Showing {min(8,total)} of {total}"). */
  total: number;
  /** Footer "View all" deep-link. */
  viewAllTo: string;
  /** Footer link label overrides (default "View all" / "عرض الكل"). */
  viewAllLabelEn?: string;
  viewAllLabelAr?: string;
}

// ── Zone 2 RIGHT — Status list card ───────────────────────────────────────────
export interface StatusRow {
  nameEn: string;
  nameAr: string;
  count: number;
  /** Optional status pill. OMIT for a plain `name + count` row (v1.2: no phantom chips). */
  chip?: ChipKind;
  /** Override the chip's default label. */
  chipLabelEn?: string;
  chipLabelAr?: string;
  /** Optional text sub-line shown INSTEAD of the numeric count (e.g. "Reports to …"). */
  subtitleEn?: string;
  subtitleAr?: string;
  to?: string;
  /** Leading tinted icon square (tinted by the chip color, else brand violet). */
  icon?: OverviewIcon;
  /** Leading visual node (e.g. a channel logo). Takes precedence over `icon`. */
  logo?: React.ReactNode;
}

export interface StatusListConfig {
  titleEn: string;
  titleAr: string;
  /** Optional one-line subtitle under the heading (e.g. clarifies the rows' semantics). */
  subtitleEn?: string;
  subtitleAr?: string;
  rows: StatusRow[];
  /** Optional footer nav link (e.g. "View all types" / "عرض كل الأنواع") — a plain <Link>, not a row. */
  viewAll?: { labelEn: string; labelAr: string; to: string };
}

// ── Zone 3 — Secondary strip (slim counters) ──────────────────────────────────
export interface SecondaryCounter {
  labelEn: string;
  labelAr: string;
  value: number | string;
  to?: string;
  /** Accent for the value + the leading icon tint. Defaults to brand violet. */
  color?: string;
  /** Optional small tinted icon shown before the counter (RC3). Lighter than Zone-1. */
  icon?: OverviewIcon;
}

// ── Zone 4 — Activity feed ────────────────────────────────────────────────────
export interface ActivityRow {
  icon: OverviewIcon;
  textEn: string;
  textAr: string;
  /** ISO timestamp (formatted relative) or a ready-made display string. */
  ts: string;
  to: string;
  /** Leading-icon tint (RC3 — the icon sits in a tinted circle, never gray).
   *  When omitted, the feed rotates the brand palette deterministically by row index. */
  color?: string;
  chip?: ChipKind;
  chipLabelEn?: string;
  chipLabelAr?: string;
  /** Senaiy-flagged → gradient Senaiy icon + gradient text + a "Suggestion:" sub-line. */
  senaiy?: boolean;
  suggestionEn?: string;
  suggestionAr?: string;
}

export interface ActivityFeedConfig {
  titleEn?: string;
  titleAr?: string;
  rows: ActivityRow[];
}

// ── The whole thing ───────────────────────────────────────────────────────────
export interface OverviewConfig {
  /** Zone 1 — required. Either a stat-card row or the definitions grid. */
  zone1: Zone1Config;
  /** Zone 2 LEFT — omit to hide the whole card (R5: absent, not empty). */
  breakdown?: BreakdownCardConfig;
  /** Zone 2 LEFT (alt) — a group-by distribution widget. Wins over `breakdown` when both are set. */
  distribution?: DistributionConfig;
  /** Zone 2 LEFT (alt) — a channel-mix widget with a dataset toggle. Wins over `breakdown`
   *  (but not over `distribution`) when set. */
  channelMix?: ChannelMixConfig;
  /** Zone 2 RIGHT — omit to hide the whole card. */
  statusList?: StatusListConfig;
  /** Zone 2 RIGHT (alt) — a ranked distribution list (RC4). Wins over `statusList` when both are set. */
  distributionList?: DistributionListConfig;
  /** Full-width logo-tile grid (Sayr Studio §9 — Channels & Connectors). Omit to hide. */
  logoTileGrid?: LogoTileGridConfig;
  /** Zone 3 — render only when present. */
  secondaryStrip?: SecondaryCounter[];
  /** Zone 4 — omit to hide the feed. */
  activity?: ActivityFeedConfig;
  /** Header controls (time pills + Filters button). Default true; set false to hide. */
  timePills?: boolean;
}

// ── Logo tile grid (Sayr Studio §9 — Channels & Connectors) ───────────────────
// A responsive horizontal GRID of connector tiles (not a vertical list). Status
// is strictly binary: connected (teal) / error (red). The whole tile deep-links.
export interface LogoTile {
  key: string;
  nameEn: string;
  nameAr: string;
  /** Leading visual node (e.g. an <img> channel logo). Takes precedence over `icon`. */
  logo?: React.ReactNode;
  /** Fallback icon when no `logo` node is supplied. */
  icon?: OverviewIcon;
  /** Binary connector state — nothing else. */
  status: 'connected' | 'error';
  /** Whole-tile deep-link. */
  to: string;
}

export interface LogoTileGridConfig {
  titleEn?: string;
  titleAr?: string;
  tiles: LogoTile[];
}

// ── Filters (header) — optional, config-driven, reuses the shared FilterDropdown ─
export interface OverviewFilterGroup {
  key: string;
  labelEn: string;
  labelAr: string;
  options: { value: string; labelEn: string; labelAr: string }[];
  searchable?: boolean;
}

/** Controlled filter state: group key → selected option values. */
export type OverviewFilterValues = Record<string, string[]>;
