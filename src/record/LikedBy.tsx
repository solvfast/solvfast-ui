/**
 * LikedBy — the form sidebar's like heart, count and "liked by" list (P36b social), Frappe-free.
 *
 * Native behaviour reproduced (Frappe 15.110 `form/templates/form_sidebar.html:142-149`, `form/sidebar/form_sidebar.js:
 * 200-205, 237-251`, `ui/like.js`): the heart (`LikeToggle`, controlled — it changes only when the host passes the new
 * state, i.e. after the server confirmed; ui/like.js:25-34 toggles the class in the callback), the number of users who
 * liked the document next to it, and the list of those users (Desk: a hover popover with avatar + full name,
 * like.js:63-127). Deliberate deviation: the list opens from the count (a button, so keyboard and touch users reach it —
 * Desk shows the popover on mouse hover only and never on touch screens, like.js:64-66).
 */
import { cn } from "../lib/cn";
import { Avatar, AvatarFallback, AvatarImage } from "../primitives/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";
import { useLocale } from "../theme/ThemeProvider";
import { fmt, initials } from "./format";
import { LikeToggle } from "./LikeToggle";

export interface LikedByUser { id: string; label: string; image?: string | null }

export interface LikedByProps {
  /** The session user is among the likers. */
  liked: boolean;
  /** Everyone who liked the document (Desk: `_liked_by`, in order). */
  users: LikedByUser[];
  /** Like / unlike. The heart stays disabled until the promise settles and never flips by itself. */
  onToggle?: (next: boolean) => Promise<unknown>;
  onError?: (error: unknown) => void;
  /** The heart cannot be used (Guest, read-only page). The count and list stay available. */
  disabled?: boolean;
  labels?: { like?: string; likedBy?: string; none?: string };
  className?: string;
}

export function LikedBy({ liked, users, onToggle, onError, disabled, labels, className }: LikedByProps) {
  const { t } = useLocale();
  const L = { likedBy: labels?.likedBy ?? t("socLikedBy"), none: labels?.none ?? t("socNoLikes") };
  const names = users.map((u) => u.label).join(", ");
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} data-sf-liked-by="">
      <LikeToggle liked={liked} onToggle={onToggle} onError={onError} disabled={disabled || !onToggle} title={names || undefined} label={labels?.like} />
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label={fmt(t("socLikeCount"), users.length)} data-like-count=""
            className="min-w-[1.25rem] rounded px-1 text-sm tabular-nums text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {users.length}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-2">
          <p className="mb-1 px-1 text-xs font-medium text-muted-foreground">{L.likedBy}</p>
          {users.length ? (
            <ul className="max-h-60 space-y-0.5 overflow-y-auto" aria-label={L.likedBy}>
              {users.map((u) => (
                <li key={u.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm" data-user={u.id}>
                  <Avatar aria-hidden className="h-6 w-6 text-[10px]">
                    {u.image ? <AvatarImage src={u.image} alt="" /> : null}
                    <AvatarFallback>{initials(u.label)}</AvatarFallback>
                  </Avatar>
                  <bdi className="truncate">{u.label}</bdi>
                </li>
              ))}
            </ul>
          ) : <p className="px-1 py-1 text-sm text-muted-foreground">{L.none}</p>}
        </PopoverContent>
      </Popover>
    </span>
  );
}
