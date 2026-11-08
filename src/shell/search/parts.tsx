/** Small render helpers shared by the search bar and dialog (P36b). Core. */
import * as React from "react";
import { cn } from "../../lib/cn";
import { markSegments } from "./marks";
import type { SearchItem } from "./types";

/** Text with its fuzzy-match runs in <mark> (Desk SU:594-619 builds the same runs as HTML). */
export function Marked({ text, marks, className }: { text: string; marks?: readonly number[]; className?: string }) {
  return (
    <span className={className}>
      {markSegments(text, marks).map((s, i) =>
        s.mark ? <mark key={i} className="rounded-sm bg-primary/15 px-0 font-semibold text-foreground">{s.text}</mark> : <React.Fragment key={i}>{s.text}</React.Fragment>,
      )}
    </span>
  );
}

/** The description line: structured details ("Label: value", SU:414-421, joined by ", " SU:444) or plain text. */
export function ItemDescription({ item, className }: { item: SearchItem; className?: string }) {
  if (item.details?.length) {
    return (
      <span className={cn("block text-xs text-muted-foreground", className)} data-testid="search-item-details">
        {item.details.map((d, i) => (
          <React.Fragment key={i}>
            {i > 0 && ", "}
            {d.label !== undefined && <span className="opacity-80"><Marked text={d.label} marks={d.labelMarks} />: </span>}
            <Marked text={d.value} marks={d.valueMarks} className="text-foreground/80" />
          </React.Fragment>
        ))}
      </span>
    );
  }
  if (!item.description) return null;
  return <span className={cn("block truncate text-xs text-muted-foreground", className)}>{item.description}</span>;
}

/** Initials or image avatar (Desk: `frappe.get_avatar("avatar-medium", label, image)`, SD:333-341). */
export function ItemAvatar({ item }: { item: SearchItem }) {
  if (item.image === undefined) return null;
  const initials = item.label.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium text-muted-foreground" aria-hidden>
      {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : initials}
    </span>
  );
}

/** Ctrl / ⌘ (or a middle click) = open in a new tab (AB:118-123). */
export const wantsNewTab = (e: React.MouseEvent | React.KeyboardEvent) => e.ctrlKey || e.metaKey || ("button" in e && e.button === 1);

/** `frappe.utils.is_mac()`. */
export const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || "");

/** Desk's shortcut handler skips inputs (keyboard.js:43-47). */
export function isEditableTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}
