# Real Frappe 15.110 responses — Sada (read-only), 2026-11-03

Internal test input only. `package.json` `files` excludes `tests/`, so none of this ships in the tarball.

- **Provenance.** `internal.solvfaster.com` (lovable_bench, Frappe 15.110.0 `ab7e5ae`). The DocTypes belong to the `sada` app.
- **`sada-real-responses.json`** (`scripts/capture-real-sada.py`):
  - captured in-process **as Administrator** inside ONE `READ ONLY` database transaction, rolled back, so a write would have raised;
  - side effects outside the database: Frappe's Redis metadata and translation caches were populated, as on any meta read;
  - contents: Sada DocType metadata (6 DocTypes plus child tables) and the contents of configuration records only (2 Sada Post Type, 1 Sada Lifecycle);
  - Sada Brand, Post and Asset: metadata only;
  - every e-mail and full name is pseudonymised (`user-N@example.invalid`, "Pseudonymised User"), and role lists are kept.
- **`guest-http.json`** (`scripts/real-guest-http.mjs`):
  - anonymous HTTP to the bench's gunicorn through the package's built client;
  - logged by the server like any anonymous request;
  - tracebacks removed.
- **Use.** `tests/real/sada-real.test.tsx`. These are real responses, but not an authenticated HTTP session from the CRM.
- **If the owner rejects the Administrator capture,** delete this folder and that test file; nothing else depends on them.
