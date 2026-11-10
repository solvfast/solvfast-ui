/**
 * User menu (0.7.0-dev.7) — the signed-in user's photo at the end of the top bar, as in Sayr and Frappe's Desk: the
 * photo, else the initials; it opens the name and email, "My Profile" and "Log out". The app passes the user and both
 * actions; the package fetches nothing.
 */
import { LogOut, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../primitives/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "../primitives/dropdown-menu";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";

export interface ShellUser {
  /** The user id, shown under the name (Frappe: the email). */
  name: string;
  fullName: string;
  /** Photo URL (Frappe's `user_image`); without one the initials show. */
  image?: string | null;
  onProfile: () => void;
  onLogout: () => void | Promise<void>;
}

export interface UserMenuProps {
  user: ShellUser;
  /** Size classes for the avatar (default `h-8 w-8`, the top bar's button size). */
  className?: string;
}

/** Frappe's avatar initials: the first letter of the first two words. */
export function userInitials(fullName: string): string {
  return fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function UserMenu({ user, className }: UserMenuProps) {
  const { t } = useLocale();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={t("account")} title={user.fullName}
          className="ms-1 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar className={cn("h-8 w-8", className)}>
            {user.image && <AvatarImage src={user.image} alt="" className="object-cover" />}
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">{userInitials(user.fullName)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{user.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">{user.name}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onSelect={() => user.onProfile()}>
          <UserRound className="h-4 w-4 text-muted-foreground" />
          {t("myProfile")}
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onSelect={() => { void user.onLogout(); }}>
          <LogOut className="h-4 w-4" />
          {t("logOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
