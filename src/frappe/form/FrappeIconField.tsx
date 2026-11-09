/**
 * FrappeIconField — Desk's Icon control (Frappe 15.110 `form/controls/icon.js`) on the Core `IconInput` (P36e ftypes).
 * The stored value is an icon NAME; what the name refers to is Frappe's SVG sprite, which is a Frappe-layer concern:
 *
 * - Names: Desk lists the `<symbol id="icon-…">` of the sprites the page loaded into `#all-symbols`
 *   (icon.js:11-16; www/app.html:43, 58-66 fetch every `app_include_icons` file, hooks.py:36-39). This control reads
 *   them the same way when the page has them (a page served by Desk, or a host that put the sprite there). Without a
 *   sprite in the page it offers `FRAPPE_ICON_NAMES`, the 179 `icon-*` symbols of Frappe 15.110's
 *   public/icons/timeless/icons.svg (the espresso sprite's `es-*` symbols are not `icon-` names and Desk skips them
 *   too). Icons added by other apps' sprites are then not listed, but can be typed.
 * - Glyphs: drawn with `<use href="#icon-<name>">` (frappe.utils.icon, utils.js:1219-1240) ONLY when that symbol is in
 *   the page; otherwise the name alone is shown. No other icon set (e.g. lucide) is substituted: its names differ.
 * The empty value draws `folder-normal` beside the input and never stores it (icon.js:94-100, 98).
 */
import * as React from "react";
import { IconInput, type IconInputProps } from "../../fields/IconInput";

/** The `icon-*` symbol names of Frappe 15.110 frappe/public/icons/timeless/icons.svg, in file order. */
export const FRAPPE_ICON_NAMES: readonly string[] = [
  "up-line", "small-up", "down", "small-down", "right", "left", "up-arrow", "down-arrow", "arrow-left", "arrow-right", "move", "unhide",
  "hide", "sidebar-collapse", "sidebar-expand", "change", "sort", "select", "arrow-up-right", "arrow-down-left", "arrow-down-right", "expand", "collapse", "expand-alt",
  "shrink", "external-link", "up", "both", "small-add", "add", "remove", "close", "close-alt", "check", "tick", "dot-horizontal",
  "dot-vertical", "drag", "drag-sm", "dialpad", "unread-status", "read-status", "mark-as-read", "insert-below", "insert-above", "group-by", "kanban", "sort-descending",
  "sort-ascending", "gantt", "filter", "filter-x", "list", "menu", "table_2", "table", "heart", "heart-active", "lock", "unlock",
  "delete", "delete-active", "pen", "edit", "edit-fill", "review", "star", "notification", "notification-with-indicator", "message", "message-1", "small-message",
  "comment", "refresh", "upload", "tag", "restriction", "attachment", "view", "call", "full-page", "crop", "scan", "link-url",
  "map", "search", "website", "users", "tool", "support", "stock", "setting", "setting-gear", "sell", "retail", "quantity-1",
  "quality", "quality-3", "projects", "project", "project-2", "folder-open", "project-1", "folder-normal", "organization", "non-profit", "money-coins-1", "loan",
  "integration", "hr", "getting-started", "education", "customization", "crm", "equity", "buying", "assets", "agriculture", "accounting", "healthcare",
  "expenses", "income", "liabilities", "file", "list-alt", "milestone", "small-file", "image", "today", "primitive-dot", "image-view", "keyboard",
  "mail", "calendar", "assign", "customer", "share", "share-people", "branch", "reply", "reply-all", "printer", "permission", "month-view",
  "dashboard", "clap", "criticize", "card", "duplicate", "chart", "shortcut", "spacer", "onboarding", "number-card", "dashboard-list", "workflow",
  "text", "header", "header-1", "header-2", "header-3", "header-4", "header-5", "header-6", "help", "edit-round", "add-round", "solid-error",
  "solid-info", "solid-success", "solid-warning", "upload-lg", "color-energy-points", "color-monthly-rank", "color-rank", "color-review-points", "folder-normal-large", "file-large", "clipboard",
];

/** Desk's list: the `icon-` symbols in `#all-symbols` (icon.js:11-16). Empty when the page has no sprite. */
export function deskIconNames(root: Document | undefined = typeof document === "undefined" ? undefined : document): string[] {
  if (!root) return [];
  const out: string[] = [];
  root.querySelectorAll("#all-symbols > svg > symbol[id]").forEach((s) => { if (s.id.includes("icon-")) out.push(s.id.replace("icon-", "")); });
  return out;
}

/** True when the page has the sprite symbol for `name`. */
export const hasFrappeIcon = (name: string) => typeof document !== "undefined" && !!name && !!document.getElementById(`icon-${name}`);

/** A Frappe icon from the page's sprite (frappe.utils.icon), or null when the page has no such symbol. */
export function FrappeIconGlyph({ name, className }: { name: string; className?: string }) {
  if (!hasFrappeIcon(name)) return null;
  return <svg className={className ?? "size-4"} aria-hidden="true" data-frappe-icon={name}><use href={`#icon-${name}`} /></svg>;
}

export type FrappeIconFieldProps = Omit<IconInputProps, "icons" | "renderIcon" | "emptyIcon" | "onOpen">;

export function FrappeIconField(props: FrappeIconFieldProps) {
  const read = () => { const d = deskIconNames(); return d.length ? d : FRAPPE_ICON_NAMES; };
  const [icons, setIcons] = React.useState<readonly string[]>(read);
  return (
    <IconInput {...props} icons={icons} renderIcon={(n) => <FrappeIconGlyph name={n} />} emptyIcon="folder-normal"
      onOpen={() => setIcons(read())} />
  );
}
