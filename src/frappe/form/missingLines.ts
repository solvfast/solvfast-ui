import { interpolate } from "../../fields/FieldShell";
import { commaAnd, type MandatoryLine } from "./model/mandatory";

/** One line of Desk's Missing Fields dialog (save.js:192-260) in the UI language. */
export function missingLineText(l: MandatoryLine, t: (key: string) => string): string {
  switch (l.kind) {
    case "field": return interpolate(t("formFieldRequired"), { label: l.label });
    case "every": return interpolate(t("formRowsEvery"), { table: l.table, label: l.label });
    case "rows": return interpolate(t(l.single ? "formRowsOne" : "formRowsList"), { table: l.table, label: l.label, rows: commaAnd(l.ranges, t("formAnd")) });
    case "count": return interpolate(t("formRowsCount"), { table: l.table, label: l.label, n: l.count });
  }
}
