/**
 * The list's Actions: delete, submit, cancel, edit, assign (docs 13 §3), as the content of the generic bar
 * (`renderBulkActions`). Destructive ones confirm; the outcome (succeeded / failed / queued) is announced in the bar and
 * the list reloads. Gated by `bulkMenu` (permissions + workflow rules). `onBusy` lets the list pause realtime refresh.
 */
import * as React from "react";
import { Pencil, Send, Trash2, UserPlus, Ban } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../primitives/alert-dialog";
import { Button } from "../../primitives/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../primitives/dialog";
import { Input } from "../../primitives/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../primitives/select";
import { useLocale } from "../../theme/ThemeProvider";
import type { FrappeClient } from "../client";
import type { FrappeListMeta } from "../meta";
import { invalidateFrappeList } from "../useFrappeList";
import { bulkAssign, bulkDelete, bulkMenu, bulkSubmitCancelOrUpdate, type BulkKind, type BulkOutcome, type BulkPermissions } from "./bulk";

export interface FrappeBulkOptions {
  /** The user's rights on the DocType (`usePermissions().levels[0]` or `can`). Without it no action is offered. */
  permissions?: BulkPermissions;
  /** The DocType has a Workflow (Desk hides Edit / Delete / Submit / Cancel then). */
  hasWorkflow?: boolean;
  /** List View Settings `allow_edit`. */
  allowEdit?: boolean;
  /** Offer only these. */
  only?: BulkKind[];
  /** After each action (also failures), e.g. for the app's own refresh or toast. */
  onDone?: (kind: BulkKind, outcome: BulkOutcome, names: string[]) => void;
  onError?: (error: unknown, kind: BulkKind) => void;
}

const ICON = { delete: Trash2, submit: Send, cancel: Ban, edit: Pencil, assign: UserPlus } as const;
const LABEL = { delete: "listBulkDelete", submit: "listBulkSubmit", cancel: "listBulkCancel", edit: "listBulkEdit", assign: "listBulkAssign" } as const;

export function FrappeBulkActions({ client, meta, doctype, keys, clear, options, onBusy, onMessage }: {
  client: FrappeClient; meta: FrappeListMeta; doctype: string; keys: string[]; clear: () => void; options: FrappeBulkOptions; onBusy?: (busy: boolean) => void;
  /** The outcome line; the host shows it (the bar disappears once the selection is cleared). */
  onMessage?: (message: string) => void;
}) {
  const { t } = useLocale();
  const qc = useQueryClient();
  const kinds = bulkMenu({ permissions: options.permissions, isSubmittable: meta.isSubmittable, hasWorkflow: !!options.hasWorkflow, allowEdit: !!options.allowEdit, hasEditableFields: meta.editable.length > 0 })
    .filter((k) => !options.only || options.only.includes(k));
  const [asking, setAsking] = React.useState<BulkKind | null>(null);
  const [form, setForm] = React.useState<"edit" | "assign" | null>(null);
  const [busy, setBusy] = React.useState<BulkKind | null>(null);
  const setMessage = (m: string) => onMessage?.(m);
  const [field, setField] = React.useState(meta.editable[0]?.name ?? "");
  const [value, setValue] = React.useState("");
  const [user, setUser] = React.useState("");

  const run = async (kind: BulkKind, call: () => Promise<BulkOutcome>) => {
    setBusy(kind); setMessage(""); onBusy?.(true);
    try {
      const out = await call();
      options.onDone?.(kind, out, keys);
      setMessage(out.queued ? t("listBulkQueued") : t("listBulkResult").replace("{ok}", String(keys.length - out.failed.length)).replace("{failed}", String(out.failed.length)));
      if (out.failed.length < keys.length) { clear(); await invalidateFrappeList(qc, doctype); } // Desk refreshes unless everything failed
    } catch (e) {
      options.onError?.(e, kind);
      setMessage(e instanceof Error ? e.message : String(e));
    } finally { setBusy(null); onBusy?.(false); }
  };

  const confirmed = (kind: BulkKind) => {
    setAsking(null);
    if (kind === "delete") void run(kind, () => bulkDelete(client, doctype, keys));
    else if (kind === "submit") void run(kind, () => bulkSubmitCancelOrUpdate(client, doctype, keys, "submit"));
    else if (kind === "cancel") void run(kind, () => bulkSubmitCancelOrUpdate(client, doctype, keys, "cancel"));
  };
  const editField = meta.editable.find((f) => f.name === field);
  const submitForm = () => {
    const f = form; setForm(null);
    if (f === "edit" && editField) void run("edit", () => bulkSubmitCancelOrUpdate(client, doctype, keys, "update", { [field]: value === "" ? null : editField.fieldtype === "Check" ? Number(value) : value }));
    if (f === "assign" && user.trim()) void run("assign", () => bulkAssign(client, doctype, keys, [user.trim()]));
  };

  if (!kinds.length) return null;
  const n = String(keys.length);
  return (
    <>
      {kinds.map((k) => {
        const Icon = ICON[k];
        return (
          <Button key={k} size="sm" variant={k === "delete" ? "destructive" : "outline"} className="gap-1.5" loading={busy === k} disabled={!!busy}
            onClick={() => (k === "edit" || k === "assign" ? setForm(k) : setAsking(k))}>
            <Icon className="h-4 w-4" /> {t(LABEL[k])}
          </Button>
        );
      })}

      <AlertDialog open={!!asking} onOpenChange={(o) => !o && setAsking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{asking ? t(LABEL[asking]) : ""}</AlertDialogTitle>
            <AlertDialogDescription>
              {asking === "delete" ? t("listBulkDeleteConfirm").replace("{n}", n) : asking === "submit" ? t("listBulkSubmitConfirm").replace("{n}", n) : t("listBulkCancelConfirm").replace("{n}", n)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction asChild onClick={() => asking && confirmed(asking)}>
              <Button variant={asking === "delete" ? "destructive" : "default"}>{t("confirm")}</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form ? t(LABEL[form]) : ""}</DialogTitle></DialogHeader>
          {form === "edit" ? (
            <div className="space-y-3">
              <label className="block space-y-1 text-sm"><span>{t("listBulkField")}</span>
                <Select value={field} onValueChange={(v) => { setField(v); setValue(""); }}>
                  <SelectTrigger aria-label={t("listBulkField")}><SelectValue /></SelectTrigger>
                  <SelectContent>{meta.editable.map((f) => <SelectItem key={f.name} value={f.name}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              {editField?.options?.length ? (
                <Select value={value || "__none__"} onValueChange={(v) => setValue(v === "__none__" ? "" : v)}>
                  <SelectTrigger aria-label={t("listBulkValue")}><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__none__">—</SelectItem>{editField.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              ) : editField?.fieldtype === "Check" ? (
                <Select value={value || "__none__"} onValueChange={(v) => setValue(v === "__none__" ? "" : v)}>
                  <SelectTrigger aria-label={t("listBulkValue")}><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="1">{t("yes")}</SelectItem><SelectItem value="0">{t("no")}</SelectItem></SelectContent>
                </Select>
              ) : (
                <Input aria-label={t("listBulkValue")} placeholder={t("listBulkValue")} value={value} onChange={(e) => setValue(e.target.value)} />
              )}
            </div>
          ) : (
            <Input aria-label={t("listBulkAssignee")} placeholder={t("listBulkAssignee")} value={user} onChange={(e) => setUser(e.target.value)} dir="ltr" />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>{t("cancel")}</Button>
            <Button onClick={submitForm} disabled={form === "assign" && !user.trim()}>{t("listBulkApply")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
