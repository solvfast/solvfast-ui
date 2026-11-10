import {
  Ban, Workflow, Layers, Boxes, Plug, Wrench, Sparkles, LifeBuoy, Bug, Settings, Cloud, Bot, Mail, CreditCard, Headphones, Rocket, Shield, Zap, Target, Flag, Star, Heart, Bell, Calendar, Clock, FileText, Folder, Database, Server, Globe, Link, Package, Truck, ShoppingCart, Tag, Users, UserCheck, MessageSquare, Phone, Send, Inbox, BarChart3, TrendingUp, PieChart, Activity, Award, Gift, Key, Lock, Eye, Search, Filter, Code,
  type LucideIcon,
} from "lucide-react";
import { Label } from "../primitives/label";
import { useLocale } from "../theme/ThemeProvider";
import { cn } from "../lib/cn";

/** The icons a record can carry (Lucide names, stored as text), as Sayr Studio offers them (IconColorPicker). Each is
 *  imported by name, so an app bundles these and no other icon. */
export const APPEARANCE_ICONS: Record<string, LucideIcon> = { Workflow, Layers, Boxes, Plug, Wrench, Sparkles, LifeBuoy, Bug, Settings, Cloud, Bot, Mail, CreditCard, Headphones, Rocket, Shield, Zap, Target, Flag, Star, Heart, Bell, Calendar, Clock, FileText, Folder, Database, Server, Globe, Link, Package, Truck, ShoppingCart, Tag, Users, UserCheck, MessageSquare, Phone, Send, Inbox, BarChart3, TrendingUp, PieChart, Activity, Award, Gift, Key, Lock, Eye, Search, Filter, Code };
export const APPEARANCE_ICON_NAMES = Object.keys(APPEARANCE_ICONS);
/** The colours offered, as Sayr Studio offers them. */
export const APPEARANCE_COLORS = ["#F26B1D", "#1F3A5F", "#25d0fe", "#512195", "#22c55e", "#eab308", "#ef4444", "#ec4899", "#0ea5e9", "#64748b", "#14b8a6", "#a855f7", "#f59e0b", "#84cc16", "#06b6d4", "#475569", "#fe4e18", "#11bf9d", "#cbfe00", "#00264c", "#132e2c"];

export interface IconColorPickerProps {
  /** A Lucide icon name, or null for none. A name outside the choices previews as Workflow. */
  icon: string | null;
  color: string | null;
  onIconChange: (icon: string | null) => void;
  onColorChange: (color: string) => void;
  iconChoices?: string[];
  colorChoices?: string[];
  /** The "No icon" choice. Default shown. */
  allowNoIcon?: boolean;
  /** Without an icon the colours are hidden. Default true. */
  hideColorWhenNoIcon?: boolean;
  className?: string;
}

/** An icon and a colour, with a preview: the Appearance of a type, a team, a unit… (Sayr Studio's picker). */
export function IconColorPicker({
  icon, color, onIconChange, onColorChange, iconChoices = APPEARANCE_ICON_NAMES, colorChoices = APPEARANCE_COLORS,
  allowNoIcon = true, hideColorWhenNoIcon = true, className,
}: IconColorPickerProps) {
  const { t } = useLocale();
  const shown = color || colorChoices[0];
  const Preview = icon ? APPEARANCE_ICONS[icon] ?? APPEARANCE_ICONS.Workflow : null;
  const noIcon = !icon;
  const showColor = !noIcon || !hideColorWhenNoIcon;
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-3">
        <div
          className={cn("h-14 w-14 rounded-xl flex items-center justify-center border transition-colors",
            noIcon ? "bg-muted/40 border-dashed border-border text-muted-foreground" : "border-transparent")}
          style={!noIcon ? { backgroundColor: `${shown}1a`, color: shown } : undefined}
        >
          {Preview ? <Preview className="h-6 w-6" /> : <Ban className="h-5 w-5" />}
        </div>
        <div className="text-xs text-muted-foreground">{noIcon ? t("icNoIconSelected") : t("icPreview")}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">{t("icIcon")}</Label>
          <div role="radiogroup" aria-label={t("icIcon")} className="flex flex-wrap gap-1.5 p-2 border border-border rounded-md bg-muted/20 max-h-44 overflow-y-auto">
            {allowNoIcon && (
              <button type="button" role="radio" aria-checked={noIcon} onClick={() => onIconChange(null)} title={t("icNoIcon")} aria-label={t("icNoIcon")}
                className={cn("h-8 w-8 rounded-md flex items-center justify-center transition-colors border border-dashed",
                  noIcon ? "bg-primary/10 text-primary border-primary/50" : "border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <Ban className="h-4 w-4" />
              </button>
            )}
            {iconChoices.map((name) => {
              const I = APPEARANCE_ICONS[name] ?? APPEARANCE_ICONS.Workflow;
              const active = icon === name;
              return (
                <button key={name} type="button" role="radio" aria-checked={active} onClick={() => onIconChange(name)} title={name} aria-label={name}
                  className={cn("h-8 w-8 rounded-md flex items-center justify-center transition-colors",
                    active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}>
                  <I className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>
        {showColor && (
          <div className="space-y-2">
            <Label className="text-xs">{t("icColor")}</Label>
            <div role="radiogroup" aria-label={t("icColor")} className="flex flex-wrap gap-2 p-2 border border-border rounded-md bg-muted/20">
              {colorChoices.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={shown === c} aria-label={c} onClick={() => onColorChange(c)}
                  className={cn("h-7 w-7 rounded-full border-2 transition-all", shown === c ? "border-foreground scale-110" : "border-transparent hover:scale-105")}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
