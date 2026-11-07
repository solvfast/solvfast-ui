/**
 * ReminderDialog — Desk's "Create a Reminder" (form/reminders.js ReminderManager): "Remind Me In" (30 minutes, 1 hour
 * — the default —, 4 hours, 1 Day, Custom), "Remind At" (read-only unless Custom) and a required "Description".
 * Frappe-free: `onCreate` creates the reminder and resolves with the time the server stored. A time in the past is
 * refused here as the server would ("Reminder cannot be created in past.", reminder.py validate); a rejection is shown
 * in the dialog.
 * Times are the BROWSER's local time (Desk uses `frappe.datetime.now_datetime()` — the user's / system time zone;
 * UNVERIFIED when they differ).
 */
import * as React from "react";
import { Button } from "../primitives/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../primitives/dialog";
import { Input } from "../primitives/input";
import { Label } from "../primitives/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../primitives/select";
import { Textarea } from "../primitives/textarea";
import { useLocale } from "../theme/ThemeProvider";
import { errorText, fmt } from "./format";

export type RemindIn = "30_minutes" | "1_hour" | "4_hours" | "1_day" | "custom";
const PERIOD_MS: Record<Exclude<RemindIn, "custom">, number> = { "30_minutes": 30 * 60_000, "1_hour": 3_600_000, "4_hours": 4 * 3_600_000, "1_day": 86_400_000 };

const pad = (n: number) => String(n).padStart(2, "0");
/** "YYYY-MM-DD HH:mm:ss" in local time (Frappe's datetime string). */
export function toFrappeDatetime(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
/** Desk `_convert_period_to_absolute_time` (reminders.js): now + the chosen period. */
export function remindAtFor(period: Exclude<RemindIn, "custom">, now: Date): Date {
  return new Date(now.getTime() + PERIOD_MS[period]);
}
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export interface ReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Create the reminder; resolve with the stored `remindAt` (shown in the confirmation) or nothing. */
  onCreate: (r: { remindAt: string; description: string }) => Promise<{ remindAt?: string } | void> | void;
  /** After a successful create (e.g. a toast with `fmt(t("r35ReminderSet"), remindAt)`). */
  onCreated?: (r: { remindAt: string }) => void;
  defaultDescription?: string;
  /** Clock (tests). */
  now?: () => Date;
}

export function ReminderDialog({ open, onOpenChange, onCreate, onCreated, defaultDescription = "", now = () => new Date() }: ReminderDialogProps) {
  const { t } = useLocale();
  const id = React.useId();
  const [period, setPeriod] = React.useState<RemindIn>("1_hour");
  const [custom, setCustom] = React.useState("");
  const [description, setDescription] = React.useState(defaultDescription);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [fixed, setFixed] = React.useState<Date>(() => now());
  React.useEffect(() => {
    if (!open) return;
    const n = now();
    setPeriod("1_hour"); setCustom(toLocalInput(remindAtFor("1_hour", n))); setDescription(defaultDescription); setError(""); setFixed(n);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const at: Date | null = period === "custom" ? (custom ? new Date(custom) : null) : remindAtFor(period, fixed);
  const options: [RemindIn, string][] = [["30_minutes", t("r35In30Minutes")], ["1_hour", t("r35In1Hour")], ["4_hours", t("r35In4Hours")], ["1_day", t("r35In1Day")], ["custom", t("r35InCustom")]];

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    if (!description.trim()) { setError(t("r35DescriptionRequired")); return; }
    if (!at || Number.isNaN(at.getTime()) || at.getTime() < now().getTime()) { setError(t("r35ReminderPast")); return; }
    const remindAt = toFrappeDatetime(at);
    setBusy(true);
    try {
      const r = await onCreate({ remindAt, description: description.trim() });
      onCreated?.({ remindAt: (r && r.remindAt) || remindAt });
      onOpenChange(false);
    } catch (err) { setError(errorText(err) || "Error"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(e) => void submit(e)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t("r35ReminderTitle")}</DialogTitle>
            <DialogDescription className="sr-only">{t("r35ReminderTitle")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`${id}-in`}>{t("r35RemindIn")}</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as RemindIn)}>
                <SelectTrigger id={`${id}-in`} aria-label={t("r35RemindIn")}><SelectValue /></SelectTrigger>
                <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-at`}>{t("r35RemindAt")}</Label>
              {period === "custom"
                ? <Input id={`${id}-at`} type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} aria-required="true" />
                : <Input id={`${id}-at`} readOnly value={at ? toFrappeDatetime(at) : ""} dir="ltr" />}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-desc`}>{t("r35Description")}</Label>
            <Textarea id={`${id}-desc`} value={description} onChange={(e) => setDescription(e.target.value)} aria-required="true" rows={3} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{t("r35Cancel")}</Button>
            <Button type="submit" loading={busy}>{t("r35Create")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The confirmation text Desk shows ("Reminder set at {0}"). */
export const reminderSetText = (t: (k: "r35ReminderSet") => string, remindAt: string) => fmt(t("r35ReminderSet"), remindAt);
