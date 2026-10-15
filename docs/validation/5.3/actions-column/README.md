# Intentional difference from Sear: the Actions column

Sear's Field Library declares its row actions as an ordinary `actions` field. The package keeps row actions as a
fixed last column instead: not sortable, filterable, hideable or reorderable (approved bug fix, docs/FEATURES.md).
This changes 8 of the 44 list-parity screenshots; the other 36 are pixel-identical to Sear. Screenshots are
lossless WebP copies of the parity run (`e2e/list-parity.mjs`, 15 Oct 2026, Sear baseline `7abc895-dirty`).

| Files | What differs |
|---|---|
| `<combo>__columns-open__{sear,package}.webp` (4 combos) | Sear's column manager lists "Actions"; the package's does not |
| `<combo>__column-shown__{sear,package}.webp` (4 combos) | after showing "Created By", Sear appends it after "Actions"; the package keeps "Actions" last |
| `light-en__filter-fields__{sear,package}.webp` | Sear's filter field list offers "Actions" (and ID / Created On / Last Updated from its Frappe metadata helper — Frappe layer, 5.4) |
| `light-en__sort-actions__{sear,package}.webp` | clicking Sear's "Actions" header shows a sort arrow and sorts nothing; the package's header is plain text |

`<combo>` is `light-en`, `dark-en`, `light-ar`, `dark-ar`.
