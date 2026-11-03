/**
 * FrappeTableMultiSelect — a Table MultiSelect field (docs `12` §11): a child table with one used Link field (the
 * FIRST Link field of the child DocType), shown as pills over the generic TagInput.
 *  - Search is the Link field's (`search_link` on the link's target, the field's query applies); values already chosen
 *    are hidden from the results; after a pick the box is cleared and keeps focus.
 *  - A new entry is validated with `validate_link` unless `ignore_link_validation`; a duplicate, blank or invalid
 *    entry is dropped silently (Desk shows no message).
 *  - The value is the array of child rows (`{<link field>: name}` + the row model: `__islocal`, `idx`); removing a pill
 *    removes its row. `<table>_add` / `_remove` are NOT fired (Desk adds rows directly).
 *  - Read-only: the linked names, comma-joined. A child DocType without a Link field shows Desk's error text.
 */
import { useLocale } from "../../theme/ThemeProvider";
import { TagInput } from "../../fields/TagInput";
import { ReadOnlyValue } from "../../fields/ReadOnlyValue";
import type { FieldDisplayStatus, FrappeDoc, FrappeDocField, MetaBundle } from "../contract";
import { resolveLinkQuery, type LinkQuery } from "./events";
import { useFormServices } from "./services";
import { childMetaOf, useLocalTableController, type TableController } from "./FrappeChildTable";
import { useLinkTitles } from "./linkTitles";

export interface FrappeTableMultiSelectProps {
  df: FrappeDocField;
  bundle?: MetaBundle;
  parent: FrappeDoc;
  rows: FrappeDoc[];
  onRowsChange?: (rows: FrappeDoc[]) => void;
  controller?: TableController;
  status?: FieldDisplayStatus;
  query?: LinkQuery;
  invalid?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

export function FrappeTableMultiSelect({ df, bundle, parent, rows, onRowsChange, controller, status = "Write", query, invalid, id, className, ...aria }: FrappeTableMultiSelectProps) {
  const s = useFormServices();
  const { t } = useLocale();
  const titles = useLinkTitles();
  const childMeta = childMetaOf(df, bundle);
  const local = useLocalTableController(df, childMeta, parent, rows, onRowsChange);
  const ctl = controller ?? local;
  const linkDf = childMeta?.fields.find((f) => f.fieldtype === "Link");
  const data = controller ? controller.rows : rows;
  if (!childMeta || !linkDf?.options) {
    return <p role="alert" className="text-sm text-destructive">{t("formMultiSelectNoLink")}</p>;
  }
  const target = linkDf.options;
  const lf = linkDf.fieldname;
  const values = data.map((r) => r[lf]).filter((v): v is string => typeof v === "string" && !!v);
  const titleOf = (v: string) => titles.get(target, v) ?? s.formatContext.linkTitles?.[`${target}::${v}`] ?? v;

  if (status === "None") return null;
  if (status === "Read") return <ReadOnlyValue id={id} {...aria} value={values.map(titleOf).join(", ")} className={className} />;

  const onChange = (next: string[]) => {
    const removed = data.map((r, i) => (next.includes(String(r[lf])) ? -1 : i)).filter((i) => i >= 0);
    if (removed.length) void ctl.remove(removed);
    for (const v of next) if (!values.includes(v)) ctl.add(undefined, { [lf]: v });
  };
  return (
    <TagInput
      id={id}
      {...aria}
      className={className}
      value={values}
      onChange={onChange}
      getLabel={titleOf}
      debounceMs={500}
      invalid={invalid}
      itemHref={(v) => s.linkHref(target, v)}
      search={async (txt) => {
        const q = resolveLinkQuery(query, parent, parent.doctype, parent.name);
        const res = await s.searchLink(target, txt, {
          pageLength: s.pageLength, referenceDoctype: bundle?.doctype,
          ...(q.filters ? { filters: q.filters as Record<string, unknown> } : {}), ...(q.query ? { query: q.query } : {}),
          ...(df.ignore_user_permissions ? { ignoreUserPermissions: true } : {}),
        });
        for (const r of res) if (r.label) titles.remember(target, r.value, r.label);
        return res;
      }}
      validate={df.ignore_link_validation ? undefined : async (v) => (await s.validateLink(target, v)).name}
    />
  );
}
