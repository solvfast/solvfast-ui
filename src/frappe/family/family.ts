import { useQuery } from "@tanstack/react-query";
import { useFrappeApi } from "../FrappeProvider";
import type { FrappeApi } from "../client";
import type { Localized } from "../../lib/localized";

/**
 * A family: a parent DocType whose records each live in their type's own DocType, and a registry DocType with one row
 * per type naming that DocType (Sayr's inheritance). Field names differ from family to family, so the app states them
 * once; the defaults are Sayr's own (a registry Sayr creates, the Record section Sayr adds to a parent).
 */
export interface FamilyDescriptor {
  /** The parent: one row per record, whatever its type (e.g. "SRF Ticket"). */
  parent: string;
  /** The registry: one row per type (e.g. "SRF Ticket Type"). */
  registry: string;
  /** Registry: the Link to DocType naming the type's DocType. Default "type_doctype". */
  typeDoctypeField?: string;
  /** Registry: the English name. Default: the row's name. */
  labelField?: string;
  /** Registry: the Arabic name, shown in Arabic when filled. */
  labelArField?: string;
  /** Registry fields read when the registry has them. Defaults "description", "icon", "color"; `null` skips one. */
  descriptionField?: string | null;
  iconField?: string | null;
  colorField?: string | null;
  /** Registry: only rows with this ticked are offered for new records. Default "enabled"; `null` offers every row. */
  enabledField?: string | null;
  /** Parent: the Link to DocType and the Dynamic Link naming each row's record. Default Sayr's "inheritance_doctype" /
   *  "inheritance_record". */
  recordDoctypeField?: string;
  recordField?: string;
  /** Parent: the Link to the registry. Default "inheritance_type". */
  typeField?: string;
  /** Registry: the Configuration fields `FrappeTypeForm` hides with `configuration={false}`. Default
   *  `SAYR_CONFIGURATION_FIELDS`. */
  configurationFields?: readonly string[];
}

/** The fields Sayr adds to every registry for a type's lifecycle, SLA policy and assignment profile. */
export const SAYR_CONFIGURATION_FIELDS = [
  "configuration_section", "lifecycle", "sla_policy", "configuration_column", "assignment_profile",
] as const;

/** One type a record can be created in. */
export interface FamilyType {
  name: string;
  label: Localized;
  description?: string;
  /** The type's DocType, where its records are created and edited. */
  doctype: string;
  icon?: string;
  color?: string;
  /** The registry row as read. */
  row: Record<string, unknown>;
}

/** Where a parent row's record lives. */
export interface FamilyRecordRef {
  doctype: string;
  name: string;
  /** The row's type (registry name), when the parent has the field. */
  type?: string;
}

export const familyField = {
  typeDoctype: (f: FamilyDescriptor) => f.typeDoctypeField ?? "type_doctype",
  recordDoctype: (f: FamilyDescriptor) => f.recordDoctypeField ?? "inheritance_doctype",
  record: (f: FamilyDescriptor) => f.recordField ?? "inheritance_record",
  type: (f: FamilyDescriptor) => f.typeField ?? "inheritance_type",
  configuration: (f: FamilyDescriptor) => f.configurationFields ?? SAYR_CONFIGURATION_FIELDS,
};

const opt = (value: string | null | undefined, fallback: string) => (value === null ? undefined : value ?? fallback);

/** The registry's enabled types that have a DocType, in name order. Reads only the fields the registry has. */
export async function fetchFamilyTypes(api: Pick<FrappeApi, "getMeta" | "getList">, family: FamilyDescriptor): Promise<FamilyType[]> {
  const meta = await api.getMeta(family.registry);
  const has = new Set(meta.fields.map((df) => df.fieldname));
  const link = familyField.typeDoctype(family);
  const pick = (f?: string) => (f && has.has(f) ? f : undefined);
  const labelField = pick(family.labelField);
  const arField = pick(family.labelArField);
  const descField = pick(opt(family.descriptionField, "description"));
  const iconField = pick(opt(family.iconField, "icon"));
  const colorField = pick(opt(family.colorField, "color"));
  const enabledField = pick(opt(family.enabledField, "enabled"));
  const fields = [...new Set(["name", link, labelField, arField, descField, iconField, colorField].filter(Boolean) as string[])];
  const rows = await api.getList<Record<string, unknown>>(family.registry, {
    fields,
    filters: [[link, "is", "set"], ...(enabledField ? [[enabledField, "=", 1] as [string, string, unknown]] : [])],
    order_by: `${labelField ?? "name"} asc`,
    limit_page_length: 500,
  });
  return rows.map((row) => {
    const en = String((labelField ? row[labelField] : undefined) ?? row.name);
    const ar = arField && row[arField] ? String(row[arField]) : en;
    return {
      name: String(row.name),
      label: { en, ar },
      description: descField && row[descField] ? String(row[descField]) : undefined,
      doctype: String(row[link]),
      icon: iconField && row[iconField] ? String(row[iconField]) : undefined,
      color: colorField && row[colorField] ? String(row[colorField]) : undefined,
      row,
    };
  });
}

/** Where a parent row's record lives: its type's DocType, the record there and, when the parent has it, the type. */
export async function fetchFamilyRecord(api: Pick<FrappeApi, "getMeta" | "getList">, family: FamilyDescriptor, name: string): Promise<FamilyRecordRef> {
  const meta = await api.getMeta(family.parent);
  const typeField = familyField.type(family);
  const hasType = meta.fields.some((df) => df.fieldname === typeField);
  const doctypeField = familyField.recordDoctype(family);
  const recordField = familyField.record(family);
  const rows = await api.getList<Record<string, unknown>>(family.parent, {
    fields: [doctypeField, recordField, ...(hasType ? [typeField] : [])],
    filters: [["name", "=", name]],
    limit_page_length: 1,
  });
  const row = rows[0];
  if (!row || !row[doctypeField] || !row[recordField]) throw new Error("not-found");
  return { doctype: String(row[doctypeField]), name: String(row[recordField]), type: hasType && row[typeField] ? String(row[typeField]) : undefined };
}

/** `fetchFamilyTypes` through React Query, for pickers of the app's own. */
export function useFamilyTypes(family: FamilyDescriptor) {
  const api = useFrappeApi();
  return useQuery({ queryKey: ["sf-frappe", "family-types", family.registry], queryFn: () => fetchFamilyTypes(api, family), staleTime: 60_000 });
}

/** `fetchFamilyRecord` through React Query (a page's title can show the type while the form loads). */
export function useFamilyRecord(family: FamilyDescriptor, name: string) {
  const api = useFrappeApi();
  return useQuery({ queryKey: ["sf-frappe", "family-record", family.parent, name], queryFn: () => fetchFamilyRecord(api, family, name), retry: false });
}
