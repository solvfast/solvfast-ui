/**
 * Desk's "List Settings" dialog (list_settings.js; menu entry for System Managers, list_view.js:1772-1785): the list's
 * fields in order (the subject first and fixed, the Status pseudo-field `status_field` not removable), "Maximum Number of
 * Fields", and the List View Settings checks. Save → `frappe.desk.doctype.list_view_settings.list_view_settings.
 * save_listview_settings(doctype, listview_settings, removed_listview_fields)` (list_view_settings.py:29-46), which also
 * flips `in_list_view` of the listed / removed fields. The list then uses the saved row from the response, as Desk's
 * `refresh_columns(r.message.meta, r.message.listview_settings)` does (list_settings.js:51-53), and reloads the meta.
 */
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Button } from "../../primitives/button";
import { Checkbox } from "../../primitives/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../primitives/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../primitives/select";
import { useLocale } from "../../theme/ThemeProvider";
import type { Messages } from "../../theme/messages";
import type { DocMeta, FrappeClient } from "../client";
import { FrappeErrorState } from "../feedback/FrappeErrorState";
import type { ListViewSettings } from "./settings";

export const SAVE_LISTVIEW_SETTINGS_METHOD = "frappe.desk.doctype.list_view_settings.list_view_settings.save_listview_settings";
/** `frappe.model.no_value_type` (model.js:40-52): never list columns. */
const NO_VALUE = new Set(["Section Break", "Column Break", "Tab Break", "HTML", "Table", "Table MultiSelect", "Button", "Image", "Fold", "Heading"]);
const CHECKS: { key: keyof ListViewSettings; label: keyof Messages }[] = [
  { key: "disable_count", label: "listSettingsDisableCount" },
  { key: "disable_comment_count", label: "listSettingsDisableCommentCount" },
  { key: "disable_sidebar_stats", label: "listSettingsDisableSidebarStats" },
  { key: "disable_auto_refresh", label: "listSettingsDisableAutoRefresh" },
  { key: "disable_automatic_recency_filters", label: "listSettingsDisableRecency" },
  { key: "allow_edit", label: "listSettingsAllowEdit" },
];
export interface ListSettingsField { fieldname: string; label: string; type?: string }

/**
 * The fields the dialog starts with (list_settings.js:236-290): the saved `fields`, else the subject (title field, else
 * ID), the Status pseudo-field when the DocType has an indicator, then the `in_list_view` value fields.
 */
export function initialListSettingsFields(meta: DocMeta, settings: ListViewSettings | null | undefined, hasIndicator: boolean, idLabel = "ID", statusLabel = "Status"): ListSettingsField[] {
  if (settings?.fields) {
    try { const l = JSON.parse(settings.fields) as ListSettingsField[]; if (Array.isArray(l)) return l.filter((f, i, a) => f?.fieldname && a.findIndex((x) => x.fieldname === f.fieldname) === i); } catch { /* fall through */ }
  }
  const titleDf = meta.title_field ? (meta.fields || []).find((d) => d.fieldname === meta.title_field) : undefined;
  const subject = titleDf ? { fieldname: titleDf.fieldname, label: titleDf.label || titleDf.fieldname } : { fieldname: "name", label: idLabel };
  return [
    subject,
    ...(hasIndicator ? [{ type: "Status", label: statusLabel, fieldname: "status_field" }] : []),
    ...(meta.fields || []).filter((d) => d.in_list_view && !NO_VALUE.has(d.fieldtype) && d.fieldname !== subject.fieldname).map((d) => ({ fieldname: d.fieldname, label: d.label || d.fieldname })),
  ];
}

export interface FrappeListSettingsDialogProps {
  client: FrappeClient;
  doctype: string;
  /** The DocType as getdoctype sent it (fields with `in_list_view`). */
  meta: DocMeta;
  settings: ListViewSettings | null | undefined;
  /** The DocType has a status indicator (`frappe.has_indicator`): the Status pseudo-field is listed. */
  hasIndicator?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After the server saved (the response's `listview_settings`). */
  onSaved?: (settings: ListViewSettings) => void;
}

export function FrappeListSettingsDialog({ client, doctype, meta, settings, hasIndicator = false, open, onOpenChange, onSaved }: FrappeListSettingsDialogProps) {
  const { t } = useLocale();
  const qc = useQueryClient();
  const initial = React.useMemo(() => initialListSettingsFields(meta, settings, hasIndicator, t("fieldId"), t("listIndicator")), [meta, settings, hasIndicator, t]);
  const [fields, setFields] = React.useState(initial);
  const [total, setTotal] = React.useState<string>(() => String(Number(settings?.total_fields) || Math.min(10, Math.max(4, initial.length))));
  const [checks, setChecks] = React.useState<Record<string, boolean>>(() => Object.fromEntries(CHECKS.map((c) => [c.key, !!Number(settings?.[c.key] ?? 0)])));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);
  React.useEffect(() => { if (open) { setFields(initial); setError(null); } }, [open, initial]);

  const shown = fields.slice(0, Number(total) || fields.length);
  const listed = new Set(fields.map((f) => f.fieldname));
  const addable = (meta.fields || []).filter((d) => !NO_VALUE.has(d.fieldtype) && !listed.has(d.fieldname));
  const move = (i: number, by: number) => setFields((l) => { const n = [...l]; const j = i + by; if (j < 1 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const save = async () => {
    setBusy(true); setError(null);
    // Desk's get_removed_listview_fields: the fields that were listed when the dialog opened and are not any more
    const removed = initial.map((f) => f.fieldname).filter((f) => !shown.some((x) => x.fieldname === f));
    const values = { ...Object.fromEntries(CHECKS.map((c) => [c.key, checks[c.key] ? 1 : 0])), total_fields: total, fields: JSON.stringify(shown.map(({ fieldname, label, type }) => ({ fieldname, label, ...(type ? { type } : {}) }))) };
    try {
      const res = await client.call(SAVE_LISTVIEW_SETTINGS_METHOD, { doctype, listview_settings: JSON.stringify(values), removed_listview_fields: JSON.stringify(removed) });
      const saved = ((res.message as { listview_settings?: ListViewSettings } | undefined)?.listview_settings ?? values) as ListViewSettings;
      qc.setQueryData(["sf-frappe", "list-settings", doctype], saved);
      void qc.invalidateQueries({ queryKey: ["sf-frappe", "list-meta", doctype] });
      onSaved?.(saved);
      onOpenChange(false);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t("listSettingsTitle").replace("{doctype}", doctype)}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <label className="block space-y-1"><span>{t("listSettingsTotalFields")}</span>
            <Select value={total} onValueChange={setTotal}>
              <SelectTrigger aria-label={t("listSettingsTotalFields")}><SelectValue /></SelectTrigger>
              <SelectContent>{["4", "5", "6", "7", "8", "9", "10"].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <fieldset className="space-y-1.5">
            <legend className="mb-1">{t("listSettingsFields")}</legend>
            <ol className="space-y-1" data-list-settings-fields="">
              {shown.map((f, i) => (
                <li key={f.fieldname} className="flex items-center gap-2 rounded-md border border-border px-2 py-1" data-fieldname={f.fieldname}>
                  <span className="flex-1 truncate">{f.label}</span>
                  {i > 0 && (
                    <>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={i < 2} onClick={() => move(i, -1)} aria-label={`↑ ${f.label}`}><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={i === shown.length - 1} onClick={() => move(i, 1)} aria-label={`↓ ${f.label}`}><ArrowDown className="h-3.5 w-3.5" /></Button>
                      {f.fieldname !== "status_field" && (
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFields((l) => l.filter((x) => x.fieldname !== f.fieldname))} aria-label={t("listSettingsRemoveField").replace("{field}", f.label)}><X className="h-3.5 w-3.5" /></Button>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ol>
            {addable.length > 0 && shown.length < (Number(total) || 10) && (
              <Select value="" onValueChange={(v) => { const d = addable.find((x) => x.fieldname === v); if (d) setFields((l) => [...l.slice(0, shown.length), { fieldname: d.fieldname, label: d.label || d.fieldname }]); }}>
                <SelectTrigger aria-label={t("listSettingsAddField")} className="h-8"><SelectValue placeholder={t("listSettingsAddField")} /></SelectTrigger>
                <SelectContent>{addable.map((d) => <SelectItem key={d.fieldname} value={d.fieldname}>{d.label || d.fieldname}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </fieldset>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHECKS.map((c) => (
              <label key={c.key} className="flex items-center gap-2">
                <Checkbox checked={!!checks[c.key]} onCheckedChange={(v) => setChecks((p) => ({ ...p, [c.key]: v === true }))} aria-label={t(c.label)} /> {t(c.label)}
              </label>
            ))}
          </div>
          {error ? <FrappeErrorState error={error} compact /> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button onClick={() => void save()} loading={busy}>{t("listSettingsSave")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
