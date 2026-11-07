/** Lets a custom cell act on the list it is rendered in (e.g. an indicator pill that filters by its value). Frappe-free. */
import * as React from "react";
import type { FilterQuery, Operator } from "./model/filters";

export interface ListActions {
  /** Replace any condition on `field` with `field <operator> value` (Desk's filter-on-click). */
  applyCondition: (field: string, operator: Operator, value: string) => void;
  /** Remove every condition on `field` (e.g. a sidebar value clicked again). */
  removeCondition?: (field: string) => void;
  /** The list's current filter query (what is applied, e.g. to mark a sidebar value as selected). */
  query?: FilterQuery;
}
export const ListActionsContext = React.createContext<ListActions | null>(null);
export const useListActions = () => React.useContext(ListActionsContext);
