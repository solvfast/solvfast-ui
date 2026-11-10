import * as React from "react";
import { useFrappeApi } from "../frappe/FrappeProvider";
import { useLocale } from "../theme/ThemeProvider";
import { FieldDesigner, type FieldDesignerProps } from "../record/FieldDesigner";
import { createSayrFieldDesignerAdapter } from "./fieldDesignerAdapter";

export interface SayrFieldDesignerProps extends Omit<FieldDesignerProps, "adapter"> {
  /** The DocType whose form is designed (a family type's DocType). */
  doctype: string;
}

/** FieldDesigner over Sayr's Field Library, for one DocType — e.g. `FrappeTypeForm`'s `designer`:
 *  `designer={(doctype) => <SayrFieldDesigner doctype={doctype} />}`. Needs a FrappeProvider. */
export function SayrFieldDesigner({ doctype, ...props }: SayrFieldDesignerProps) {
  const api = useFrappeApi();
  const { language } = useLocale();
  const adapter = React.useMemo(() => createSayrFieldDesignerAdapter(api, doctype, { language }), [api, doctype, language]);
  return <FieldDesigner adapter={adapter} {...props} />;
}
