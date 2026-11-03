# Secret and sensitive-content audit before any off-site push

Owner: A6 (QA). Read-only: nothing was written to either repository and nothing was pushed. Tool: `docs/qa/tools/secret_scan.py <repo> <ref>...`
(re-runnable; it walks every reachable blob once - the full history of the given refs, not only HEAD - and never prints a secret, only a redacted
excerpt). Date of the scan: 2026-11-03.

## Scope and method

| Repo | Refs scanned | Reachable blobs |
|---|---|---|
| Package `/home/frappe/solvfast-ui` (remote `origin` = `https://github.com/solvfast/solvfast-ui.git`) | `feat/0.4.0-frappe`, `feat/0.4.0/{form,foundation,list,qa,record}` | 1,129 |
| CRM work repo `/home/frappe/sfui-dev/crm-base` (no remote) | `crm/{baseline,boot,forms,integration,list,migration,record}`, tag `baseline-20261103` | 1,810 |

Checks: AWS keys, GitHub / OpenAI / Anthropic / Slack tokens, private-key headers, credentials in URLs, bearer tokens, JWTs, npm `_authToken`, password / secret / api-key
assignments (placeholders filtered), Frappe `token key:secret`; file names (`.env*`, `.npmrc`, `site_config*.json`, `*.pem/*.key`, SQL dumps, archives, `node_modules`, build outputs,
`credentials/secrets` files); blobs > 1 MB; every e-mail address that is not `example.*`, `solvfast.com`, noreply; commit messages and author identities; tracked `.claude/`, `.bildfast/`, `graphify-out/`;
docx metadata. Not covered: the content of binary files beyond names and sizes (PNG, DOCX bodies), and untracked or stashed working-tree files (they are not pushed).

## Result: no credential, token, key or password found in either repository's history

| Check | Package | CRM |
|---|---|---|
| API keys / tokens / private keys / bearer / JWT / URL credentials | none | none |
| `.env`, `site_config.json`, key material, database dumps, archives | none | none |
| `node_modules`, `dist`, `public/serve-fast` | none | none (the ignore list excludes them) |
| passwords in code or docs | none | none |
| Frappe commit messages mentioning password/token | only prose about the word "tokens" (bidi isolates, CSRF wording) | none |

## Findings (each with commit and path)

### Package repo

| # | Kind | Path | First commit | Assessment |
|---|---|---|---|---|
| P1 | `.npmrc` with `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}` | `.npmrc` (`df32329`, 2026-10-17) | `df32329` | Not a secret: an environment-variable reference. The same pattern, and `${GITHUB_TOKEN}` variants, appear in `docs/CONSUMING.md` (9 blob versions, first `9dac49d`) and `docs/RELEASING.md` (4 versions, first `df32329`), and in the guards of `scripts/check-package.mjs`, `scripts/prepublish-check.mjs` (`df32329`) that **reject** a literal token. Safe |
| P2 | Personal e-mail `Ismailakram200@gmail.com` | `docs/RELEASING.md` | `c3931ef` (2026-10-17) | Personal data in documentation, and also the git author/committer e-mail of 179 of the 180 commits reachable from the scanned refs (the other is a GitHub noreply address). **The address is already published**: it is in `origin/main` (`63bbd1b`, 2026-10-19), so the identity is not new, but the 0.4.0 push adds 155 more commits carrying it. Decide only whether that is acceptable (rewriting would change every SHA; not recommended) |
| P3 | Plausibly real company domain in a test | `tests/record-frappe.test.tsx` and `playground/src/showcase/FrappeSimPage.tsx` use `sara@rihlat.travel` / `…@very-long-company-domain-name.example.com` | `8a7c050` (2026-11-03), `b4c0f7d` | `rihlat.travel` also appears in the CRM mock data (see C3): a demo customer. Low; replace by `@example.com` if the domain is a real client |
| P4 | Other addresses | `ann@x.com`, `a@x.com`, `bob@x.com`, `me@x.com`, `hello@test.com` across docs and tests | various | Synthetic. Safe |
| P5 | Commit identities | `IsmailAkram200 <Ismailakram200@gmail.com>` (179 commits, including all 155 not yet on `main`), `khalid sabbah <…@users.noreply.github.com>` (1) | - | The sfui-dev identity does not appear in the package repo; the worktrees commit with the machine's git config |
| P6 | Large binaries | none > 1 MB | - | Safe |

### CRM work repo (`crm/*`, tag `baseline-20261103`)

| # | Kind | Path | First commit | Assessment |
|---|---|---|---|---|
| C1 | Build output tracked | `serve_fast/www/serve-fast.html`, `serve_fast/www/serve_fast.py` (the project's own rule says `www/` is a build output) | `0aed241` (baseline, 2026-11-03), `serve_fast.py` also `f4e8c54` | Not a secret; it is generated. Harmless but noise; do not rewrite history |
| C2 | Large artefacts | `graphify-out/graph.json` (12.0 MB), `frontend/src/sear_studio/assets/apps/{agentic,crm,service-desk}.png` (1.7 MB each); tracked tree is 50.2 MiB, `.git` 30.8 MiB | `0aed241` | Size only. `graphify-out/` is tool output (also `.bildfast/GRAPH_REPORT.md`, 93 KB copy) |
| C3 | Names and addresses that look like real customers in demo data | 34 non-example addresses, for example `abdullah@alfaisaliah.com` (`frontend/src/sear_studio/contacts/data/mockData.ts`, `pages/Orders/mockOrders.ts`, `pages/DataQuality/mockData.ts`), `tariq@neom.sa` (`pages/Tickets/mockTickets.ts`), `faten@rotana.com` (`connect_fast/data/contactConversations.ts`), `khalid@alrashid-construction.sa` (`pages/Proposals/proposalStore.ts`), `zeina@rihlat.travel` (`shared/account/accountStore.ts`, `shared/tenant/tenantConfig.ts`), `*@rihlat.travel` / `*@rihlat.sa` in 9 more files, `omar@servefast.io`, `admin@servefast.com`, `support@senaiy.care` | all in the baseline commit `0aed241` | Mock data, but the domains match real organisations and a hotel/travel client set. Whether they are real people is for the owner to confirm. Remains personal-data-like content; keep the remote private |
| C4 | Commercially sensitive documents | `.bildfast/plans/0011-package-proposal-pricing-v2.2.md` (pricing), `.bildfast/business.md`, `.bildfast/architecture.md`; 12 proposal templates `frontend/public/proposal-templates/{servefast,complai}_{financial,technical}_{ar,en}.docx` (0.4-0.47 MB each; core properties have no author) | `0aed241` | Not credentials; business-confidential. Private remote only |
| C5 | Session history | `.bildfast/checkpoints.jsonl` (137 entries, 17 K characters of user prompts, no e-mail/token strings; 12 long digit strings to eyeball) | `0aed241` | Chat-derived. Review once by eye before pushing anywhere shared |
| C6 | `.npmrc` | `frontend/.npmrc` = `@solvfast:registry=https://npm.pkg.github.com` (no token) | `0aed241` | Safe |
| C7 | Agent configuration | `.claude/agents/*.md` (BildFast agent prompts), `CLAUDE.md` | `0aed241` | No secrets. Internal process text |
| C8 | Author identities | `IsmailAkram200 <Ismailakram200@gmail.com>` (25 commits of the imported baseline history), `sfui-dev Lead <dev@solvfast.com>` (17 commits, the CRM integration work) | - | Personal e-mail in history, as in P2 |
| C9 | Uncommitted work in `crm-migration` | 4 modified + 2 untracked files (`data/frappe/{client,demoTypes,fixtureBackend,draftMetas}.ts`, `env.d.ts`, `CrmEntityFormFields.tsx`) | - | **Not in any branch head**: a push does not carry it. Commit it first if it should be backed up (A5/Lead) |

### Not found anywhere (explicitly)
No `site_config.json` or `common_site_config.json` copy, no database credentials (`db_password`), no SSH/PEM keys, no `.env`, no API key strings, no bearer tokens, no URL with embedded credentials, no Frappe API key:secret pair, no SQL dump, no archive (zip/tar/gz), no `node_modules`.

## Recommendation (for the owner)

1. Package branches can go to the existing private-or-public GitHub origin; the only sensitive item (P2) is already published via `main`. Optionally replace P3.
2. The CRM work repo must go only to a **private** remote (C3, C4, C5 are business content, not secrets). No history rewrite is needed for credentials because none exist.
3. Decide on C9 before the push; decide whether `graphify-out/` (12 MB) belongs on the remote (a later `git rm` does not shrink history; it is already in every `crm/*` branch).
4. Re-run the scan at the push moment (branch heads move): `python3 docs/qa/tools/secret_scan.py <repo> <refs...>`; the numbers above are for the heads listed in `offsite-backup-list.md`.

## Re-run 2026-11-03 (after the Sada fixtures, package `fb32d69`)

- `secret_scan.py /home/frappe/solvfast-ui 'feat/0.4.0*' main`: 1,150 blobs, 71 findings.
  - 50 e-mail addresses, all test placeholders. The Sada fixtures contain only `user-1/2@example.invalid` pseudonyms.
  - 20 npm-auth hits, all `${NODE_AUTH_TOKEN}` / `${GITHUB_TOKEN}` placeholders or the scan's own patterns.
  - 1 `.npmrc` (placeholder).
  - **No credentials.**
- `crm-base`, all `crm/*` branches plus `baseline-20261103`: 1,821 blobs, 42 findings.
  - 34 demo e-mail addresses, 4 large blobs, 3 build outputs, 1 `.npmrc`.
  - **No credentials.** The earlier advice stands: push the CRM history to a private remote only.
- Full names in the Sada fixtures: only "Pseudonymised User". The `owner` / `modified_by` fields are "Administrator".
