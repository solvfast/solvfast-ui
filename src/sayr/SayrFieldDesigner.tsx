import * as React from "react";
import { useFrappeApi } from "../frappe/FrappeProvider";
import { useLocale } from "../theme/ThemeProvider";
import { FieldDesigner, type FieldDesignerProps } from "../record/FieldDesigner";
import { createSayrFieldDesignerAdapter, type SayrNewType } from "./fieldDesignerAdapter";

export interface SayrFieldDesignerProps extends Omit<FieldDesignerProps, "adapter"> {
  /** The DocType whose form is designed (a family type's DocType); `null` for a type not created yet (`newType`). */
  doctype: string | null;
  /** A type not created yet (`FrappeTypeForm`'s `context.newType`): the form starts with its family's shared fields and
   *  is saved onto the DocType the type's Save makes. */
  newType?: SayrNewType;
}

/** FieldDesigner over Sayr's Field Library, for one DocType — e.g. `FrappeTypeForm`'s `designer`, saved by the type's
 *  Save: `designer={(doctype, ctx) => <SayrFieldDesigner doctype={doctype} newType={ctx.newType} wizard={ctx.wizard} onPendingChange={ctx.onPendingChange} />}`.
 *  Needs a FrappeProvider. */
export function SayrFieldDesigner({ doctype, newType, ...props }: SayrFieldDesignerProps) {
  const api = useFrappeApi();
  const { language } = useLocale();
  // The host may pass a new `doctype` getter each render; the adapter keeps one, asking the latest.
  const latest = React.useRef(newType);
  latest.current = newType;
  const parent = newType?.parent;
  const adapter = React.useMemo(
    () => createSayrFieldDesignerAdapter(api, doctype ?? { parent: parent ?? "", doctype: () => latest.current!.doctype() }, { language }),
    [api, doctype, parent, language],
  );
  return <FieldDesigner adapter={adapter} {...props} />;
}
