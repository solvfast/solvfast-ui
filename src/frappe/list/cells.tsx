/** Row cells Desk draws on every list row: indicator pill, assignee avatars, comment count, likes (docs 13 §2.3). */
import { Heart, MessageSquare } from "lucide-react";
import { Badge } from "../../primitives/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../../primitives/avatar";
import { useListActions } from "../../list/ListActionsContext";
import type { ColumnDef } from "../../list/model/columns";
import { getIndicator, type IndicatorConfig } from "./indicator";
import { commentCount, type ReportviewUser } from "./reportview";
import { useLocale } from "../../theme/ThemeProvider";
import { DOCSTATUS_DESCRIPTION_KEY, toDocStatus } from "../../record/docstatus";

const parseList = (v: unknown): string[] => { try { const l = JSON.parse(String(v || "[]")) as unknown; return Array.isArray(l) ? l.map(String) : []; } catch { return []; } };
const initials = (s: string) => s.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

export function IndicatorCell({ row, config }: { row: Record<string, unknown>; config: IndicatorConfig }) {
  const actions = useListActions();
  const { t } = useLocale();
  const ind = getIndicator(row, config);
  if (!ind) return <span className="text-muted-foreground">—</span>;
  const variant = ind.tone === "muted" ? "secondary" : ind.tone === "destructive" ? "destructive" : ind.tone;
  // P36e submit: Desk's pill title tells the docstatus — with a workflow the pill shows the STATE (list_view.js:1105-1119).
  // Shown for submittable DocTypes only (Desk sets it on every row; on a non-submittable one it always says "draft").
  const ds = config.isSubmittable ? toDocStatus(row.docstatus) : undefined;
  const badge = <Badge variant={variant} className="font-normal" data-indicator={ind.color} data-docstatus={ds} title={ds === undefined ? undefined : t(DOCSTATUS_DESCRIPTION_KEY[ds])}>{ind.label}</Badge>;
  if (!ind.filter || !actions) return badge;
  const [field, value] = ind.filter;
  // filter-on-click, as Desk's pill (it must not open the row)
  return <button type="button" className="rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={(e) => { e.stopPropagation(); actions.applyCondition(field, "equals", String(value)); }}>{badge}</button>;
}

export function AssigneesCell({ value, userInfo }: { value: unknown; userInfo: Record<string, ReportviewUser> }) {
  const users = parseList(value);
  if (!users.length) return <span className="text-muted-foreground">—</span>;
  const shown = users.slice(0, 3);
  return (
    <div className="flex items-center -space-x-2 rtl:space-x-reverse" title={users.map((u) => userInfo[u]?.fullname || u).join(", ")}>
      {shown.map((u) => (
        <Avatar key={u} className="h-6 w-6 border border-background">
          {userInfo[u]?.image ? <AvatarImage src={String(userInfo[u].image)} alt="" /> : null}
          <AvatarFallback className="text-[10px]">{initials(userInfo[u]?.fullname || u)}</AvatarFallback>
        </Avatar>
      ))}
      {users.length > shown.length && <span className="ps-3 text-xs text-muted-foreground" dir="ltr">+{users.length - shown.length}</span>}
    </div>
  );
}

/** `_user_tags` (",a,b", tag.py) → the row's tags (Desk's tag column, list_view.js:799-809); a tag click filters the list by
 *  it (`_user_tags like %tag%`, as the sidebar's tag stats do, list_sidebar.js:232-247). */
export function parseTags(value: unknown): string[] {
  return String(value ?? "").split(",").map((x) => x.trim()).filter(Boolean);
}
export function TagsCell({ value }: { value: unknown }) {
  const actions = useListActions();
  const tags = parseTags(value);
  if (!tags.length) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1" data-tags="">
      {tags.slice(0, 3).map((tag) => {
        const pill = <Badge variant="secondary" className="font-normal">{tag}</Badge>;
        return actions ? (
          <button key={tag} type="button" className="rounded-md hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(e) => { e.stopPropagation(); actions.applyCondition("_user_tags", "like", tag); }}>{pill}</button>
        ) : <span key={tag}>{pill}</span>;
      })}
      {tags.length > 3 && <span className="text-xs text-muted-foreground" dir="ltr">+{tags.length - 3}</span>}
    </span>
  );
}

export function CommentsCell({ row }: { row: Record<string, unknown> }) {
  const n = commentCount(row);
  if (!n) return <span className="text-muted-foreground">—</span>;
  return <span className="inline-flex items-center gap-1 text-sm" dir="ltr"><MessageSquare className="h-3.5 w-3.5" aria-hidden />{n > 99 ? "99+" : n}</span>;
}

export function LikesCell({ value }: { value: unknown }) {
  const users = parseList(value);
  if (!users.length) return <span className="text-muted-foreground">—</span>;
  return <span className="inline-flex items-center gap-1 text-sm" title={users.join(", ")} dir="ltr"><Heart className="h-3.5 w-3.5 fill-current text-destructive" aria-hidden />{users.length}</span>;
}

export interface RowMetaColumnOptions {
  indicator?: IndicatorConfig | null;
  assignees?: boolean;
  comments?: boolean;
  likes?: boolean;
  tags?: boolean;
  userInfo: Record<string, ReportviewUser>;
  /** Start hidden (offered in the column manager) — used when the app curates its own columns. */
  hidden: boolean;
  labels: { indicator: string; assigned: string; comments: string; likes: string; tags?: string };
}

/** Columns for the row metadata Desk shows; `render` closes over the response's `user_info`. */
export function rowMetaColumns(o: RowMetaColumnOptions): { indicator?: ColumnDef<Record<string, unknown>>; trailing: ColumnDef<Record<string, unknown>>[] } {
  const base = { sortable: false, filterable: false, hidden: o.hidden };
  const trailing: ColumnDef<Record<string, unknown>>[] = [];
  if (o.tags) trailing.push({ ...base, key: "_user_tags", label: o.labels.tags ?? "Tags", render: (r) => <TagsCell value={r._user_tags} /> });
  if (o.assignees) trailing.push({ ...base, key: "_assign", label: o.labels.assigned, render: (r) => <AssigneesCell value={r._assign} userInfo={o.userInfo} /> });
  if (o.comments) trailing.push({ ...base, key: "_comments", label: o.labels.comments, render: (r) => <CommentsCell row={r} /> });
  if (o.likes) trailing.push({ ...base, key: "_liked_by", label: o.labels.likes, render: (r) => <LikesCell value={r._liked_by} /> });
  const cfg = o.indicator;
  return { indicator: cfg ? { ...base, key: "__indicator", label: o.labels.indicator, render: (r) => <IndicatorCell row={r} config={cfg} /> } : undefined, trailing };
}
