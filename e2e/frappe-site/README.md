# Real-site validation of the Frappe layer — P36: PREPARED, NOT RUN

**Nothing in this folder has been run against any Frappe site.** No site was contacted, seeded, read or written; no
account was created; no result here may be described as passing. What has run, locally and without network:
`run-matrix.mjs --dry-run`, the guard tests (`tests/frappe-site-guards.test.ts`), the Python guards' refusal paths
(with a Python that cannot import frappe) and `vite build` of the harness.

**P36 rule:** real-site validation runs only on an owner-approved, **isolated STAGING** site — never on production.
The shared server hosts only production / client sites (`internal.solvfaster.com`, `pms`, `hr`, `pos`, `aidev`, `pmodev`, …);
none of them is approved, and every script here refuses them.

The matrix (every COVERAGE.md row → category (a)–(e) → concrete real-site tests) is `docs/audit/p36/VALIDATION-MATRIX.md`,
rendered from `matrix/catalogue.mjs` — the same catalogue the runner executes.

## What the owner must provide

1. **A staging site** — name (for `SFUI_STAGING_SITE`) and URL (for `SFUI_STAGING_URL`), Frappe 15 (the cites are 15.110.0).
   It must be **isolated from production**: its own database server or at least its own database and credentials, its own
   Redis (cache / queue / socketio) and workers, not on the shared production server (the runner refuses loopback and any
   address of the machine it runs on; the seed refuses to run from a production bench directory). Names in
   `production-denylist.json` and `*.solvfaster.com` / `*.drooby.ai` are refused outright — use another domain.
2. **A network path** from the machine that runs `run-matrix.mjs` (and the harness) to the staging URL over HTTP(S). No SSH
   tunnel to the shared server's loopback ports: loopback is refused.
3. **A private directory** outside every git work tree, `chmod 700`, named in `SFUI_STAGING_PRIVATE`, holding the approval:

   `<private>/APPROVED_STAGING` (chmod 600):

   ```json
   { "site": "<staging site name>", "url": "https://<staging host>", "approved_by": "<owner>",
     "approved_at": "<ISO date, at most 30 days old>", "isolated_from_production": true, "allow_write": true }
   ```
   Without it nothing runs. `allow_write: true` is needed for `--write` and for the seed / teardown `--apply` / `--execute`.
4. **Accounts** — either let `staging-seed.py --apply` create the five synthetic accounts (random passwords written only to
   `<private>/accounts.json`, mode 600, never printed) or create them yourself with the same names and roles
   (`fixtures/staging/users.json`) and write `accounts.json` as `{ "accounts": { "manager": { "usr", "pwd" }, "writer": …,
   "reader": …, "restricted": …, "field": … } }`. Optional `sysmgr` (System Manager) only with `--with-system-manager` —
   your decision; without it the System-Manager half of `L-LVS-1` stays BLOCKED.
5. **Optional infrastructure** for the manual tests: a PDF engine (F-PDF-1), an outgoing Email Account that delivers only to
   a capture mailbox (F-EMAIL-2), a background worker (L-IMPORT-1), socket.io reachable from the runner (L-REALTIME-1), a
   website-generator DocType (F-WEB-1).

## Commands (for the owner — none of these has been run)

```bash
export SFUI_STAGING_SITE=<staging-site-name>            # allowlist (comma-separated)
export SFUI_STAGING_URL=https://<staging-host>
export SFUI_STAGING_PRIVATE=/path/outside/any/repo        # chmod 700, holds APPROVED_STAGING

# 0. local, no network: guards + plan
node e2e/frappe-site/run-matrix.mjs --dry-run [--write] [--browser]

# 1. seed — on the STAGING bench, from its sites/ folder (bench python)
../env/bin/python <repo>/e2e/frappe-site/staging-seed.py "$SFUI_STAGING_SITE" "$SFUI_STAGING_PRIVATE"              # plan
../env/bin/python <repo>/e2e/frappe-site/staging-seed.py "$SFUI_STAGING_SITE" "$SFUI_STAGING_PRIVATE" --preflight  # read-only
../env/bin/python <repo>/e2e/frappe-site/staging-seed.py "$SFUI_STAGING_SITE" "$SFUI_STAGING_PRIVATE" --apply      # writes

# 2. run (copy expected.json + accounts.json into the runner's private dir if it is another machine)
node e2e/frappe-site/run-matrix.mjs                      # read checks
node e2e/frappe-site/run-matrix.mjs --write              # + write and server-rejection checks
npx vite build --config e2e/frappe-site/vite.config.ts && npx vite preview --config e2e/frappe-site/vite.config.ts &
SFUI_HARNESS_URL=http://127.0.0.1:4821 node e2e/frappe-site/run-matrix.mjs --browser   # harness checks (Playwright)
#    --only F-SAVE-2,L-PERM-1   runs a subset;   --out <dir>   (default <private>/results/<timestamp>)

# 3. teardown — on the staging bench
../env/bin/python <repo>/e2e/frappe-site/staging-teardown.py "$SFUI_STAGING_SITE" "$SFUI_STAGING_PRIVATE"            # dry run
../env/bin/python <repo>/e2e/frappe-site/staging-teardown.py "$SFUI_STAGING_SITE" "$SFUI_STAGING_PRIVATE" --execute  # deletes
# then delete the private directory (it holds the passwords)
```

Run order inside `run-matrix.mjs`: read checks first, then writes. Write tests create their own `SFUI P36 RUN …` records
(linked to contact #12, which no seeded parent uses) and the aggregate checks count only the seeded parents
(`title like "SFUI Parent %"`). The tested path is **one `--write` run per seed**; tear down and reseed between write runs
(L-SAVED-2 may delete a seeded saved filter, F-PERMLEVEL-2 re-saves a seeded draft).

Results: `<out>/results.json` and `results.md` — per test: requirement ids, feature, expected Frappe behaviour (+ source
cite), actual checks, environment (site, URL, Frappe version), users, PASS / FAIL / BLOCKED, evidence (request / response
**shapes** and statuses, redacted; screenshots), issue; plus every COVERAGE row aggregated with its category. Write tests
create only records titled `SFUI P36 RUN <timestamp> …` on the SFUI DocTypes; the teardown removes them with the seed.

## Files

| File | What it does |
|---|---|
| `guards.mjs` (+ `.d.mts`) | P36 guards for Node: production deny list (exact + suffix, never substring), loopback / own-address refusal, site allowlist, private dir (mode 700, outside every git tree), `APPROVED_STAGING`, `accounts.json`, `redact()` |
| `staging_guards.py` | the same guards for the Python scripts; imports nothing from frappe; checks the working directory is not a production bench |
| `production-denylist.json` | the deny list both read: site directory **names** under `/home/frappe/*/sites/` (contents never read), `*.solvfaster.com`, `*.drooby.ai`, loopback, the production benches |
| `staging-seed.py` / `staging-teardown.py` | synthetic, SFUI-prefixed staging data and its manifest-driven removal (plan / preflight / apply; dry run / execute) |
| `fixtures/*.json` | reused P34 fixtures (DocTypes, workflow, contacts) — not edited |
| `fixtures/staging/*.json` | P36: roles, accounts, permissions per DocType, overlay (workflow mandatory field, image field, connections), records (print format, letter head, e-mail template, Kanban board, saved filters, tags, assignments, dates) |
| `run-matrix.mjs` | the runner (`--dry-run`, read, `--write`, `--browser`, `--only`, `--out`) |
| `matrix/catalogue.mjs` | the 86 tests (75 in P36 batch 1 + 11 in batch 2) (preconditions, user, steps, expected Frappe behaviour + `file:line`, evidence, and the API check itself) and the row → category map |
| `matrix/render.mjs` | renders `docs/audit/p36/VALIDATION-MATRIX.md` (`--check` fails when stale) |
| `harness/` + `vite.config.ts` | `FrappeForm` / `FrappeListView` (`selectionMode="header"`) / `FrappeViews` on the seeded DocTypes (`?view=form|list|views&doctype=…&name=…`); `vite preview` proxies only to the guarded staging URL |
| `seed-crm-site.py`, `teardown-crm-site.py`, `sfui_footprint.py` | **DISABLED (P36).** They target the production site `internal.solvfaster.com`: both scripts now exit immediately with a P36 refusal as their first statement (before any other import), and `sfui_footprint.require_site` refuses unconditionally. Kept for the record, not deleted |
| `seed.py`, `validate.mjs` | legacy P34 ToDo validation (read-only); now behind the same guards (seed: allowlist + approval + not a production bench; validate: only the guarded harness URL). Superseded by the staging seed and `run-matrix.mjs` |

Database credentials are never passed on a command line or stored by these scripts; the seed runs as the bench's own
process on the staging host.
