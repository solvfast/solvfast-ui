/** Lets a custom cell act on the list it is rendered in (e.g. an indicator pill that filters by its value). Frappe-free. */
import * as React from "react";
import type { Operator } from "./model/filters";

export interface ListActions {
  /** Replace any condition on `field` with `field <operator> value` (Desk's filter-on-click). */
  applyCondition: (field: string, operator: Operator, value: string) => void;
}
export const ListActionsContext = React.createContext<ListActions | null>(null);
export const useListActions = () => React.useContext(ListActionsContext);
