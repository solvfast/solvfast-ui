# Real-site validation of the Frappe layer — PREPARED, NOT RUN

**Status: deferred.** Real-site validation will happen when the package is first integrated into a real project
(decision of 2026-10-17). Nothing in this folder has been run against any site, and no result here may be described
as passing. Simulated-request tests are in `tests/frappe.test.tsx` (docs/VALIDATION.md, 5.4).

Run it only with the owner's approval of the site, the bench and the test account. It must stay read-only.

## What it needs

- A Frappe 15 site the owner approves (a dedicated test site, or the real project's development site), served on
  127.0.0.1 only.
- A test account with read access only (`seed.py` creates one, plus synthetic ToDos, but **only** on a site named
  `sfui-test.localhost` with nothing but the frappe app and no ToDos — it refuses anything else).
- `expected.json` with the totals to compare against (written by `seed.py`, computed in Python from the seeded rows)
  and `validator.json` with the test account's credentials, both in a private folder (mode 700) outside every
  repository, deleted afterwards.

## Files

| File | What it does |
|---|---|
| `seed.py` | synthetic data + read-only account on a dedicated `sfui-test.localhost` site (run with the bench's Python, from its `sites/` folder) |
| `harness/` + `vite.config.ts` | the page under test: `FrappeListView` on ToDo, served on 127.0.0.1:4821 with `/api` and `/app` proxied to the site (`SFUI_FRAPPE_TARGET`, default `http://127.0.0.1:18104`; `SFUI_FRAPPE_SITE`, default `sfui-test.localhost`). It reads the CSRF token from `/app`, as Desk does |
| `validate.mjs` | the read-only checks (list, search, Match any / all and totals, link search, date filters, an old saved filter, Arabic labels, CSRF, read-only account, and Frappe's behaviour behind the package's fixes) → `results.json`, `results.md`, screenshots |

## Outline

1. Owner-approved site served on 127.0.0.1 (e.g. `gunicorn -b 127.0.0.1:18104 frappe.app:application` from the bench's
   `sites/`); for a dedicated test site, seed it with `seed.py`.
2. `SFUI_FRAPPE_TARGET=… SFUI_FRAPPE_SITE=… vite build --config e2e/frappe-site/vite.config.ts && vite preview --config e2e/frappe-site/vite.config.ts`
3. `node e2e/frappe-site/validate.mjs http://127.0.0.1:4821 <privateDir> <outDir>`
4. Stop everything; remove the private folder; remove any test site only with the owner's approval.

Database credentials are never passed on a command line or stored: `bench new-site` / `drop-site` prompt for them
when run by a person.
