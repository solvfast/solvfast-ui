// Sayr's FieldDesigner adapter: a type's Form section over Sayr's Field Library (sear_product), the one place in the
// package that calls Sayr's own methods. A type's added fields are a `Sear Field Deployment` named after its DocType —
// saving it deploys them — and a family type's whole order (its shared fields included) is its `field_order`
// (`save_field_order`). Same reads and writes as Sayr Studio's field set editor (DeploymentEditorPage).
import type { FrappeApi } from "../frappe/client";
import type { DesignerFieldSet, DesignerRemoval, DesignerSetField, DesignerState, FieldDesignerAdapter } from "../record/FieldDesigner";
import { kindOfFieldtype, previousId, type DesignerItem } from "../record/fieldLayout";

const METHODS = "sear_product.apis.field_library.deployments";
const DEPLOYMENT = "Sear Field Deployment";
const FIELD_SET = "Sear Field Preset";
const BREAK_TYPES = new Set(["section_break", "column_break", "tab_break"]);

type RowKind = "field" | "section" | "tab";
interface DeploymentRow {
  field_preset: string;
  field_key: string;
  row_kind: RowKind;
  label?: string | null;
  insert_after?: string | null;
  fieldname?: string | null;
  overrides?: unknown;
}
interface Screen {
  refusal: string | null;
  deployment: null | { name: string; status: string; fields: DeploymentRow[] };
  family: null | { role: "child" | "parent"; shared?: string[] };
  target_fields: { fieldname: string; label?: string; fieldtype: string }[];
}

export type SayrApi = Pick<FrappeApi, "call" | "getList">;
export interface SayrFieldDesignerOptions { language?: "en" | "ar" }

/** `@tab::<label>`, `@<set>::__section`, `@<set>::<key>`: how Sayr names a row before it has a column. */
export const sayrToken = (row: Pick<DeploymentRow, "row_kind" | "label" | "field_preset" | "field_key">) =>
  row.row_kind === "tab" ? `@tab::${(row.label ?? "").trim()}`
    : `@${row.field_preset}::${row.row_kind === "section" ? "__section" : row.field_key}`;
const idOf = (row: DeploymentRow) => row.fieldname || sayrToken(row);

function rowOfToken(id: string): DeploymentRow | null {
  if (id.startsWith("@tab::")) return { field_preset: "", field_key: "", row_kind: "tab", label: id.slice(6) };
  const m = /^@(.+)::(.+)$/.exec(id);
  if (!m) return null;
  return m[2] === "__section"
    ? { field_preset: m[1], field_key: "", row_kind: "section" }
    : { field_preset: m[1], field_key: m[2], row_kind: "field" };
}

/** What Deploy writes: a section or tab with nothing put into it is dropped, as Sayr's server does — an emptied section
 *  first, then the tab left holding nothing (DeploymentEditorPage `effective`). */
function effective(rows: DeploymentRow[]): DeploymentRow[] {
  let kept = rows;
  for (;;) {
    const filled = new Set<string>();
    for (const r of kept) {
      const holder = kept.find((h) => h.row_kind !== "field" && (idOf(h) === r.insert_after || (!!h.fieldname && h.fieldname === r.insert_after)));
      if (!holder) continue;
      if (r.row_kind === "field" || (r.row_kind === "section" && holder.row_kind === "tab")) filled.add(idOf(holder));
    }
    const next = kept.filter((r) => r.row_kind === "field" || filled.has(idOf(r)));
    if (next.length === kept.length) return kept;
    kept = next;
  }
}

const sameRows = (a: DeploymentRow[], b: DeploymentRow[]) =>
  a.length === b.length && a.every((r, i) => idOf(r) === idOf(b[i]) && (r.insert_after ?? null) === (b[i].insert_after ?? null));

/** A FieldDesigner adapter for one type DocType (a family type, or any DocType Sayr's Field Library can deploy on).
 *  Needs the Sear Platform Administrator role; without it `load` resolves to a refusal. */
export function createSayrFieldDesignerAdapter(api: SayrApi, doctype: string, options: SayrFieldDesignerOptions = {}): FieldDesignerAdapter {
  const ar = options.language === "ar";
  let screen: Screen | null = null;
  let rows: DeploymentRow[] = [];

  const call = async <T,>(method: string, args: Record<string, unknown>) => (await api.call(`${METHODS}.${method}`, args)).message as T;

  const load = async (): Promise<DesignerState> => {
    let s: Screen;
    try {
      s = await call<Screen>("doctype_deployment", { target_doctype: doctype });
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 403) return { items: [], refusal: ar ? "يتطلب تصميم النموذج دور مسؤول منصة سير." : "Designing this form needs the Sear Platform Administrator role." };
      throw e;
    }
    screen = s;
    if (s.refusal) { rows = []; return { items: [], refusal: s.refusal }; }
    const live = s.deployment && s.deployment.status !== "removed" ? s.deployment : null;
    rows = live ? live.fields.map((r) => ({ ...r })) : [];
    const sets = [...new Set(rows.map((r) => r.field_preset).filter(Boolean))];
    const setLabel = new Map<string, string>();
    if (sets.length) {
      const found = await api.getList<Record<string, string>>(FIELD_SET, {
        fields: ["name", "preset_name", "preset_name_ar"], filters: [["name", "in", sets]], limit_page_length: sets.length,
      });
      for (const r of found) setLabel.set(r.name, (ar && r.preset_name_ar) || r.preset_name || r.name);
    }
    const byField = new Map(rows.filter((r) => r.fieldname).map((r) => [r.fieldname as string, r]));
    const shared = new Set(s.family?.role === "child" ? s.family.shared ?? [] : []);
    let items: DesignerItem[] = s.target_fields.map((f) => {
      const kind = kindOfFieldtype(f.fieldtype);
      const label = f.label === f.fieldname ? "" : f.label;
      const row = byField.get(f.fieldname);
      if (row) {
        return {
          id: f.fieldname,
          kind: row.row_kind === "section" ? "section_break" : row.row_kind === "tab" ? "tab_break" : kind,
          label: row.row_kind === "tab" ? row.label ?? label : row.row_kind === "section" ? setLabel.get(row.field_preset) ?? label : label,
          fieldtype: kind === "field" ? f.fieldtype : undefined,
          source: setLabel.get(row.field_preset),
        };
      }
      return { id: f.fieldname, kind, label, fieldtype: kind === "field" ? f.fieldtype : undefined, native: true, movable: kind === "field" && shared.has(f.fieldname) };
    });
    // Rows saved but without a column yet (a failed or pending deploy) sit after their anchors, or at the end.
    for (const row of rows.filter((r) => !r.fieldname || !items.some((i) => i.id === r.fieldname))) {
      const item: DesignerItem = { id: sayrToken(row), kind: row.row_kind === "section" ? "section_break" : row.row_kind === "tab" ? "tab_break" : "field",
        label: row.row_kind === "tab" ? row.label ?? "" : row.field_key || setLabel.get(row.field_preset), source: setLabel.get(row.field_preset) };
      const at = items.findIndex((i) => i.id === row.insert_after);
      items = at < 0 ? [...items, item] : [...items.slice(0, at + 1), item, ...items.slice(at + 1)];
    }
    const notice = live?.status === "outdated"
      ? (ar ? "تغيّرت مجموعة حقول مستخدمة هنا منذ آخر حفظ. أعد نشرها من مكتبة الحقول في سير ستوديو." : "A field set used here changed since this form was saved. Redeploy it from the Field Library in Sear Studio.")
      : undefined;
    return { items, notice };
  };

  return {
    load,

    async listFieldSets(): Promise<DesignerFieldSet[]> {
      const sets = await api.getList<Record<string, string>>(FIELD_SET, {
        fields: ["name", "preset_name", "preset_name_ar"], filters: [["status", "=", "published"]], order_by: "preset_name asc", limit_page_length: 500,
      });
      return sets.map((r) => ({ name: r.name, label: { en: r.preset_name || r.name, ar: r.preset_name_ar || r.preset_name || r.name } }));
    },

    async fieldsOf(set: string): Promise<DesignerSetField[]> {
      const doc = (await api.call("frappe.client.get", { doctype: FIELD_SET, name: set })).message as { fields?: Record<string, string>[] };
      const deployed = new Set(rows.filter((r) => r.field_preset === set).map((r) => r.field_key));
      return (doc.fields ?? [])
        .filter((f) => !BREAK_TYPES.has(f.field_type) && !deployed.has(f.field_key))
        .map((f) => ({
          id: `@${set}::${f.field_key}`,
          kind: "field" as const,
          label: { en: f.label_en || f.field_key, ar: f.label_ar || f.label_en || f.field_key },
          fieldtype: f.field_type,
        }));
    },

    sectionOf: (set: string, label: string): DesignerItem => ({ id: `@${set}::__section`, kind: "section_break", label, source: label }),
    makeTab: (label: string): DesignerItem => ({ id: `@tab::${label}`, kind: "tab_break", label }),

    async save(items: DesignerItem[]): Promise<DesignerState> {
      const byId = new Map(rows.map((r) => [idOf(r), r]));
      const wanted = effective(items.filter((i) => !i.native).flatMap((i) => {
        const row = byId.get(i.id) ?? rowOfToken(i.id);
        return row ? [{ ...row, insert_after: previousId(items, i.id) }] : [];
      }));
      const deployment = screen?.deployment ?? null;
      const live = !!deployment && deployment.status !== "removed";
      if (!wanted.length) {
        if (live) await call("withdraw_deployment", { name: deployment!.name });
      } else if (!live || !sameRows(wanted, rows)) {
        const fields = wanted.map((r) => ({
          field_preset: r.field_preset || null, field_key: r.field_key || null, row_kind: r.row_kind,
          label: r.row_kind === "tab" ? r.label : null, insert_after: r.insert_after ?? null, overrides: r.overrides ?? null,
        }));
        if (deployment) {
          const doc = (await api.call("frappe.client.get", { doctype: DEPLOYMENT, name: deployment.name })).message as Record<string, unknown>;
          await api.call("frappe.client.save", { doc: JSON.stringify({ ...doc, fields }) });
        } else {
          await api.call("frappe.client.insert", { doc: JSON.stringify({ doctype: DEPLOYMENT, target_doctype: doctype, fields }) });
        }
      }
      // A family type keeps its form as arranged, its shared fields included; the new rows' tokens resolve now.
      if (screen?.family?.role === "child") {
        await call("save_field_order", { target_doctype: doctype, order: JSON.stringify(items.map((i) => i.id)) });
      }
      return load();
    },

    async removalImpact(ids: string[]): Promise<DesignerRemoval[]> {
      const deployment = screen?.deployment;
      if (!deployment) return [];
      const gone = rows.filter((r) => ids.includes(idOf(r)) && r.row_kind === "field");
      if (!gone.length) return [];
      const impact = await call<{ fields: { field_key: string; fieldname?: string; rows_with_data: number }[] }>(
        "deployment_removal_impact", { name: deployment.name, field_keys: JSON.stringify(gone.map((r) => r.field_key)) });
      const labels = new Map(screen!.target_fields.map((f) => [f.fieldname, f.label ?? f.fieldname]));
      return impact.fields
        .filter((f) => gone.some((r) => r.field_key === f.field_key))
        .map((f) => ({ id: f.fieldname ?? f.field_key, label: (f.fieldname && labels.get(f.fieldname)) || f.field_key, rowsWithData: f.rows_with_data ?? 0 }));
    },
  };
}
