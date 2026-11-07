# P35 — Frappe Form / List View coverage audit (baseline: @solvfast/ui 0.6.0 = 0ef45c1; CRM 127c0b4)

Read-only audits run 2026-11-07 by five parallel agents. Reports in this folder:

| Report | Scope |
|---|---|
| A-form.md | Form View requirements A–P (184 rows) |
| B-list.md | List View requirements A–J (123 rows) |
| C-native.md | Native Frappe 15.110 behaviour vs the DS (file:line on both sides) |
| D-crm.md | CRM adoption (98 rows, migration matrix, SD/SM isolation) |
| E-tests.md | Tests, exports, Showcase, docs; gate results |

## Denominator (fixed before implementation)

Coverage = rows **COMPLETE** (behaviour exercised by a cited test) ÷ **applicable rows** (all rows except NOT APPLICABLE)
of A-form.md + B-list.md. BLOCKED rows stay in the denominator. "COMPLETE" never means "verified on a real site":
no row has been exercised against an authenticated real Frappe site (see the evidence column of each report).

| | Rows | COMPLETE | PARTIAL | MISSING | N/A | BLOCKED | Coverage |
|---|---|---|---|---|---|---|---|
| Form (A) | 184 | 79 | 62 | 38 | 3 | 2 | 79 / 181 = 43.6 % |
| List (B) | 123 | 69 | 17 | 31 | 3 | 3 | 69 / 120 = 57.5 % |
| **Total** | 307 | 148 | 79 | 69 | 6 | 5 | **148 / 301 = 49.2 %** |

CRM (D): 98 rows — 30 already on the DS, 15 migrate now with 0.6.0 exports, 13 need a new DS capability, 13 CRM-specific,
5 N/A, 9 blocked by mock mode / backend.
