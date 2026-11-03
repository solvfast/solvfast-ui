# Real metadata fixtures — Frappe 15.110.0 (`ab7e5ae`)

`getdoctype` responses (`docs`: the DocType first, then its child-table DocTypes) for ToDo, Contact, Event, File, User,
Note and Customer (ERPNext 15.110.0). `*.ar.json` were captured with the session language set to Arabic but are
**byte-identical to `*.en.json`**: in 15.110 `getdoctype` does not return translations (`__messages` is listed in
`desk/form/meta.py` ASSET_KEYS but never set). Desk gets translations from boot (`translate.get_messages_for_boot`), and
no whitelisted method returns a language's dictionary. Arabic labels therefore need an app-supplied dictionary.

- Site: `internal.solvfaster.com` (lovable_bench), captured 2026-11-03 by `scripts/capture-real-meta.py`.
- Read-only: `READ ONLY` transaction, rolled back; metadata only — no `getdoc`, no record contents.
- Use them as the real shapes for meta parsing, field rendering and translation tests. They are not evidence of
  behaviour beyond what metadata contains.
