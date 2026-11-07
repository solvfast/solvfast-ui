/**
 * FrappeReminder — "Remind Me" on a document: the Core `ReminderDialog` over
 * `frappe.automation.doctype.reminder.reminder.create_new_reminder(remind_at, description, reminder_doctype,
 * reminder_docname)` (reminder.py:58-74; Desk form/reminders.js `create_reminder`). The server sets the user to the
 * session user and refuses a time in the past (reminder.py:36-39); it answers the inserted Reminder (`remind_at`).
 */
import { ReminderDialog } from "../../record/ReminderDialog";
import type { FrappeDoc } from "../contract";
import { useFrappeApi } from "../FrappeProvider";

export const CREATE_REMINDER_METHOD = "frappe.automation.doctype.reminder.reminder.create_new_reminder";

export interface FrappeReminderProps {
  doc: FrappeDoc;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After the server created it (`remindAt` as stored). */
  onCreated?: (r: { remindAt: string; name?: string }) => void;
  now?: () => Date;
}

export function FrappeReminder({ doc, open, onOpenChange, onCreated, now }: FrappeReminderProps) {
  const api = useFrappeApi();
  let created: { name?: string } = {};
  return (
    <ReminderDialog
      open={open} onOpenChange={onOpenChange} now={now}
      onCreate={async ({ remindAt, description }) => {
        const res = await api.call(CREATE_REMINDER_METHOD, { remind_at: remindAt, description, reminder_doctype: doc.doctype, reminder_docname: doc.name });
        const m = (res.message ?? {}) as { name?: unknown; remind_at?: unknown };
        created = { name: typeof m.name === "string" ? m.name : undefined };
        return { remindAt: typeof m.remind_at === "string" ? m.remind_at : remindAt };
      }}
      onCreated={(r) => onCreated?.({ ...r, ...created })}
    />
  );
}
