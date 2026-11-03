# Real metadata fixtures — Frappe 15.110.0 (`ab7e5ae`)

`getdoctype` responses (`docs`: the DocType first, then its child-table DocTypes) for ToDo, Contact, Event, File, User,
Note and Customer (ERPNext 15.110.0), in English (`*.en.json`) and Arabic (`*.ar.json`, with `__messages`).

- Site: `internal.solvfaster.com` (lovable_bench), captured 2026-11-03 by `scripts/capture-real-meta.py`.
- Read-only: `READ ONLY` transaction, rolled back; metadata only — no `getdoc`, no record contents.
- Use them as the real shapes for meta parsing, field rendering and translation tests. They are not evidence of
  behaviour beyond what metadata contains.
