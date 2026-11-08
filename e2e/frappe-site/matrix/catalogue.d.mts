// Types for catalogue.mjs (P36), so tests/frappe-site-guards.test.ts typechecks without allowJs.
export declare const FRAPPE_REF: string;
export interface MatrixTest {
  id: string;
  area: "Form" | "List" | "Views" | "Security";
  feature: string;
  kind: "read" | "write" | "reject" | "browser" | "infra";
  automated: "api" | "browser" | "manual";
  infra?: string;
  users: string[];
  rows: string[];
  pre: string;
  steps: string[];
  expect: string;
  cite: string[];
  evidence: string;
  run?: (ctx: unknown) => Promise<void>;
}
export declare const TESTS: MatrixTest[];
export interface RowClass { cat: "a" | "b" | "c" | "d" | "e" | "na"; sub?: "W" | "A" | "P" | "R"; note?: string }
export declare const ROW_CLASS: Record<string, RowClass>;
export declare const CATEGORY_LABEL: Record<string, string>;
export interface CoverageRow { id: string; section: string; req: string; baseline: string; now: string; ev: string; lim: string }
export declare function categorize(row: Pick<CoverageRow, "id" | "now" | "ev">): RowClass;
export declare function testsForRow(id: string): string[];
export declare function parseCoverage(markdown: string): CoverageRow[];
export declare function parseSection5(markdown: string): string[];
