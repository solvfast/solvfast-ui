# Frappe field types — `@solvfast/ui` 0.7.x

This page shows what `FrappeField` (`@solvfast/ui/frappe`) renders for each Frappe field type, and what is still missing.
`FrappeForm` / `FrappeFormView` render every field through `FrappeField`. You can also use it alone: give it a DocField
(`df`), its `value` and `onChange`.

- The target is Frappe **v15.110**.
- The full audit, with file:line for every native behaviour, server validation and the implementation plan, is in
  `docs/audit/p36d/FIELD-TYPES.md` (in the repository). The row ids `FT-nn` match that file.
- The showcase has a **Frappe Field Types** group: the inventory, a per-type inspector, Links & files (SIMULATED), and
  Layout & display.
- Evidence is jsdom unit tests and the in-package simulator. **Nothing here ran against a real Frappe site.**

```tsx
import { FrappeField } from "@solvfast/ui/frappe";

<FrappeField
  df={{ fieldname: "email", fieldtype: "Data", options: "Email", label: "Email", reqd: 1 }}
  value={doc.email}
  onChange={(v) => setDoc({ ...doc, email: v })}
  doc={doc}            // Dynamic Link reads its DocType from here; Attach attaches to it
  status={status}      // "Write" | "Read" | "None" from the form's permissions (optional)
  error={serverMessage} // e.g. the server's validation message for this field (optional)
/>
```

## Stored formats (what `onChange` gives you, what the server expects)

| Type | Value |
|---|---|
| Check | `0` / `1` |
| Int, Long Int | an integer. Typed arithmetic is evaluated, e.g. `2+3` → `5`. |
| Float, Currency, Percent | a number, rounded to `df.precision`, else the site's precision |
| Rating | a **fraction 0…1** (`options` = number of stars, default 5) |
| Duration | **seconds** |
| Date | `YYYY-MM-DD` |
| Datetime | `YYYY-MM-DD HH:mm:ss` |
| Time | `HH:mm:ss` |
| Color | `#RRGGBB` |
| Attach, Attach Image | the File's URL |
| Table, Table MultiSelect | an array of child rows |
| Text Editor | sanitized HTML |
| Every other text type | a string |

## Coverage

These statuses cover the 43 DocField types:
- **Complete**: the value, the stored format, the read display, the statuses and the main interaction match Desk.
- **Partial**: a native behaviour that changes data, validation or the main interaction is missing.
- **Not implemented yet**: the field shows its stored value read-only, and the form lists it in its issues banner.

| Type | Status | Notes |
|---|---|---|
| Data | Complete | Writes 500 ms after typing and on blur; `maxlength` = `length` or 140. |
| Data (Email) | Complete | Several addresses allowed; soft check, and the server validates. |
| Data (Phone) | Complete | Desk's phone pattern; `type=tel`. |
| Data (Name) | Partial | No soft check; the server validates. |
| Data (URL) | Partial | Soft check; no open-link button, and the read display is not a link. |
| Data (Barcode) | Partial | No Scan button. |
| Data (IBAN) | Partial | Grouped read display; no input grouping or check. |
| Small Text, Text, Long Text | Complete | Textarea. |
| Read Only | Complete | Formatted value, never an input. |
| Text Editor | Partial | Rich text with sanitized HTML; no mentions, image upload or tables. |
| Markdown Editor, HTML Editor, Code, JSON | Partial | Monospace textarea (`dir=ltr`); no syntax highlighting, preview or JSON check. |
| Password | Partial | `type=password`; no show/hide toggle or strength meter. |
| Select | Partial | Translated options, blank option, an unknown stored value is kept; `sort_options` is ignored. |
| Autocomplete | Partial | `df.options` suggestions; a value outside the list is cleared (unless `ignore_validation`); no server `get_query`. |
| Link | Complete | `search_link`, `validate_link`, fetch_from, titles, Create new, filters / `setQuery`; no Advanced Search. |
| Dynamic Link | Complete | Searches the DocType in the sibling field named by `options`. |
| Check, Int, Long Int, Float, Percent, Rating, Duration | Complete | |
| Currency | Partial | The input does not use the field's own currency for its number format. |
| Date | Partial | The site's date format; no `t` = today key; `options` JSON is ignored. |
| Datetime | Partial | Edited in the browser's time zone; seconds are dropped. |
| Time | Partial | 12 h when the site's time format has `a`; a Now button; no `t` key. |
| Phone | Partial | Free text, `type=tel`. Desk has a country picker and stores `+isd-number`, which the server checks. |
| Color | Partial | Hex box; no picker popover; no swatch in read display. |
| Attach, Attach Image | Complete | Desk's uploader (My Device / Library / Link / Camera, Crop, Optimize, private / public, `max_file_size`); in a form the form is saved after an upload. |
| Image | Complete | Shows the URL in `doc[options]`. |
| Table, Table MultiSelect | Complete | Child grid / pills; grid gaps are listed in the forms doc. |
| Section Break, Column Break, Tab Break, Heading | Complete | |
| Fold | Partial | Rendered as a Section Break, not folded. |
| HTML | Partial | Shows `df.options` sanitized; no equivalent for script-written content. |
| Button | Partial | Runs `onButtonClick` / the form's events; `options` → `run_doc_method` is not wired. |
| Signature, Barcode, Geolocation, Icon | **Not implemented yet** | Stored value shown read-only. |

## States

- **Read.** `df.read_only`, the Read Only type, or `status="Read"` (permlevel without write, a submitted document,
  `set_only_once`) all render the formatted value, never an input. An empty Read field is not shown, except HTML,
  Image, Button, Geolocation and Heading.
- **Required.** `reqd` marks the label (`*`) and sets `aria-invalid` while the value is empty. It is not marked in Read.
- **Errors.** Pass the server's message as `error`. FrappeForm does this for `MandatoryError` / `LinkValidationError`.
- **Disabled.** Frappe has no separate disabled state: `df.disabled` turns Write into Read.
- **Loading.** Only the server-backed controls have one: Link / Dynamic Link search and Attach upload.

## Not covered yet (planned)

Details and sizes are in the audit's plan.
- **Phase 1:**
  - a Phone country picker with `+isd-number`;
  - Name / IBAN checks;
  - Datetime time zone;
  - the Currency edit format;
  - `maxlength` on Link / Select.
- **Phase 2:**
  - the URL open button;
  - the `t` key;
  - the Password toggle;
  - Fold;
  - `sort_options`, Autocomplete `get_query`;
  - Signature;
  - Button `run_doc_method`.
- **Phase 3:**
  - code editors;
  - Text Editor mentions and images;
  - Link Advanced Search;
  - Barcode / Geolocation / Icon (they need optional peer dependencies);
  - Table paste from a spreadsheet.
