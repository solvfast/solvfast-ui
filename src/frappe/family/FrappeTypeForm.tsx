import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FrappeDocField } from "../contract";
import { useFrappeApi } from "../FrappeProvider";
import { FrappeForm, type FrappeFormProps } from "../form/FrappeForm";
import { familyField, type FamilyDescriptor } from "./family";

export interface FrappeTypeFormProps extends Omit<FrappeFormProps, "doctype"> {
  family: FamilyDescriptor;
  /** The Configuration section (Linked Lifecycle, SLA Policy, Assignment Profile). Default shown; `false` hides it for a
   *  family whose types are not configured this way. */
  configuration?: boolean;
  /** Rendered under the form once the type has its DocType (a saved type): e.g. a field designer for that DocType. */
  designer?: (typeDoctype: string) => React.ReactNode;
}

/**
 * A type of a family: the registry's own form, so every field the registry has is shown (an app's Category included).
 * Saving a new type creates its DocType on the server; `designer` appears after that.
 */
export function FrappeTypeForm({ family, configuration = true, designer, fieldFilter, onSaved, ...form }: FrappeTypeFormProps) {
  const api = useFrappeApi();
  const queryClient = useQueryClient();
  const hidden = React.useMemo(() => new Set(configuration ? [] : familyField.configuration(family)), [configuration, family]);
  const filter = React.useCallback(
    (df: FrappeDocField) => !hidden.has(df.fieldname) && (fieldFilter ? fieldFilter(df) : true),
    [hidden, fieldFilter],
  );
  const name = form.name && !form.name.startsWith("new-") ? form.name : undefined;
  const link = familyField.typeDoctype(family);
  const typeDoctype = useQuery({
    queryKey: ["sf-frappe", "family-type-doctype", family.registry, name],
    queryFn: async () => {
      const rows = await api.getList<Record<string, unknown>>(family.registry, { fields: [link], filters: [["name", "=", name]], limit_page_length: 1 });
      return rows[0]?.[link] ? String(rows[0][link]) : null;
    },
    enabled: !!designer && !!name,
  });

  return (
    <div className="space-y-6">
      <FrappeForm
        {...form}
        doctype={family.registry}
        fieldFilter={configuration && !fieldFilter ? undefined : filter}
        onSaved={(doc, action) => {
          void queryClient.invalidateQueries({ queryKey: ["sf-frappe", "family-type-doctype", family.registry] });
          void queryClient.invalidateQueries({ queryKey: ["sf-frappe", "family-types", family.registry] });
          onSaved?.(doc, action);
        }}
      />
      {designer && typeDoctype.data ? designer(typeDoctype.data) : null}
    </div>
  );
}
