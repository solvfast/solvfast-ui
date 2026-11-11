import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FrappeDocField } from "../contract";
import { useFrappeApi } from "../FrappeProvider";
import { FrappeForm, type FrappeFormProps } from "../form/FrappeForm";
import type { FormController } from "../form/events";
import type { DesignerPending } from "../../record/FieldDesigner";
import { APPEARANCE_COLORS, IconColorPicker } from "../../fields/IconColorPicker";
import { familyField, type FamilyDescriptor } from "./family";

/** What the `designer` slot gets besides the type's DocType. */
export interface TypeDesignerContext {
  /** The type's Wizard mode (its form's tabs are a new record's steps): a change is the type's, saved with it.
   *  `undefined` when the registry has no such field. */
  wizard?: { on: boolean; onChange: (on: boolean) => void };
  /** Give it to the designer (`FieldDesigner` `onPendingChange`): the type's Save then saves the designer's changes too
   *  (after the type itself), and the type counts as not saved while they are pending. */
  onPendingChange: (pending: DesignerPending) => void;
}

export interface FrappeTypeFormProps extends Omit<FrappeFormProps, "doctype"> {
  family: FamilyDescriptor;
  /** The Configuration section (Linked Lifecycle, SLA Policy, Assignment Profile). Default shown; `false` hides it for a
   *  family whose types are not configured this way. */
  configuration?: boolean;
  /** Rendered under the form once the type has its DocType (a saved type): e.g. a field designer for that DocType. */
  designer?: (typeDoctype: string, context: TypeDesignerContext) => React.ReactNode;
  /** Values a NEW type starts with (e.g. the app's default lifecycle, SLA policy and assignment profile). */
  defaults?: Record<string, unknown>;
  /** The registry's icon field drawn as an icon + colour picker (the colour field and Sayr's `appearance_column` then
   *  leave the form). Default on. */
  appearancePicker?: boolean;
}

/**
 * A type of a family: the registry's own form, so every field the registry has is shown (an app's Category included).
 * Saving a new type creates its DocType on the server; `designer` appears after that. The registry's Wizard mode field
 * is not on the form: it is the designer's switch (`context.wizard`). One Save saves the type, then the designer's
 * changes (`context.onPendingChange`).
 */
export function FrappeTypeForm({ family, configuration = true, designer, defaults, appearancePicker = true, fieldFilter, renderField, onSaved, newDocDefaults, ...form }: FrappeTypeFormProps) {
  const api = useFrappeApi();
  const queryClient = useQueryClient();
  const ownController = React.useRef<FormController | null>(null);
  const controller = form.controllerRef ?? ownController;
  const [pending, setPending] = React.useState<DesignerPending | null>(null);
  const [wizardOn, setWizardOn] = React.useState<boolean | undefined>(undefined);
  const wizardField = familyField.wizard(family);
  const iconField = family.iconField === null ? undefined : family.iconField ?? "icon";
  const colorField = family.colorField === null ? undefined : family.colorField ?? "color";
  const picker = appearancePicker && !!iconField && !!colorField;
  const hidden = React.useMemo(
    () => new Set([
      ...(configuration ? [] : familyField.configuration(family)),
      ...(wizardField ? [wizardField] : []),
      ...(picker ? [colorField!, "appearance_column"] : []),
    ]),
    [configuration, family, wizardField, picker, colorField],
  );
  const drawField = React.useCallback<NonNullable<FrappeFormProps["renderField"]>>((df, ctx) => {
    if (picker && df.fieldname === iconField) {
      return (
        <IconColorPicker
          icon={(ctx.value as string) || null}
          color={(ctx.doc[colorField!] as string) || null}
          onIconChange={(icon) => {
            ctx.setValue(iconField, icon);
            if (icon && !ctx.doc[colorField!]) ctx.setValue(colorField!, APPEARANCE_COLORS[0]);
          }}
          onColorChange={(c) => ctx.setValue(colorField!, c)}
        />
      );
    }
    return renderField?.(df, ctx);
  }, [picker, iconField, colorField, renderField]);
  const filter = React.useCallback(
    (df: FrappeDocField) => !hidden.has(df.fieldname) && (fieldFilter ? fieldFilter(df) : true),
    [hidden, fieldFilter],
  );
  const name = form.name && !form.name.startsWith("new-") ? form.name : undefined;
  const link = familyField.typeDoctype(family);
  const key = ["sf-frappe", "family-type-doctype", family.registry, name];
  const typeRow = useQuery({
    queryKey: key,
    queryFn: async () => {
      const meta = await api.getMeta(family.registry);
      const hasWizard = !!wizardField && meta.fields.some((df) => df.fieldname === wizardField);
      const rows = await api.getList<Record<string, unknown>>(family.registry, {
        fields: [link, ...(hasWizard ? [wizardField!] : [])], filters: [["name", "=", name]], limit_page_length: 1,
      });
      const row = rows[0];
      return { doctype: row?.[link] ? String(row[link]) : null, wizard: hasWizard ? !!Number(row?.[wizardField!]) : undefined };
    },
    enabled: !!designer && !!name,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["sf-frappe", "family-type-doctype", family.registry] });
    void queryClient.invalidateQueries({ queryKey: ["sf-frappe", "family-types", family.registry] });
  };
  const setWizard = (on: boolean) => {
    controller.current?.setValue(wizardField!, on ? 1 : 0);
    setWizardOn(on);
  };
  const startWith = defaults
    ? { ...newDocDefaults, routeOptions: { ...newDocDefaults?.routeOptions, ...defaults } }
    : newDocDefaults;

  return (
    <div className="space-y-6">
      <FrappeForm
        {...form}
        doctype={family.registry}
        controllerRef={controller}
        alsoSave={pending ?? undefined}
        newDocDefaults={startWith}
        fieldFilter={hidden.size || fieldFilter ? filter : undefined}
        renderField={picker || renderField ? drawField : undefined}
        onSaved={(doc, action) => {
          refresh();
          setWizardOn(undefined);
          onSaved?.(doc, action);
        }}
      />
      {designer && typeRow.data?.doctype
        ? designer(typeRow.data.doctype, {
          wizard: typeRow.data.wizard === undefined ? undefined : { on: wizardOn ?? typeRow.data.wizard, onChange: setWizard },
          onPendingChange: setPending,
        })
        : null}
    </div>
  );
}
