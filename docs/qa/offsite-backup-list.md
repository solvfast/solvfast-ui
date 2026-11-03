# Off-site backup list - branches, heads, remotes and exact commands (NOT EXECUTED)

Owner: A6 (QA). Prepared 2026-11-03. Nothing here was run; no remote was contacted. Read `secret-audit.md` first (no credentials found in either history;
the CRM repo contains business-confidential content and must go to a private remote). Heads move: **re-read them with the verification commands before pushing**.

## 1. Package repo - `/home/frappe/solvfast-ui`

Remote: **`origin` = `https://github.com/solvfast/solvfast-ui.git`** (exists; `origin/main` = `63bbd1b8f4d5a1e406e226100eadc6dec9793771`, 2026-10-19). `main` is unchanged
locally (same commit) and is **not** pushed. 155 commits (all authored as `IsmailAkram200 <Ismailakram200@gmail.com>`, see secret-audit P2/P5) are not yet on the remote.

| Branch | Head at preparation | Worktree |
|---|---|---|
| `feat/0.4.0-frappe` (integration) | `5762c017232a046b77476b782fdd900b7cbd691c` | `/home/frappe/sfui-dev/pkg-integration` |
| `feat/0.4.0/foundation` | `5762c017232a046b77476b782fdd900b7cbd691c` | `pkg-foundation` |
| `feat/0.4.0/form` | `ebb8353516b05bae7b4dff16fb456ce38cdfa6fd` | `pkg-form` |
| `feat/0.4.0/list` | `ebefff3dd566aa83f04325b3b95c904125552395` | `pkg-list` |
| `feat/0.4.0/record` | `c4f1f6170e00a59079d3d82d74298713e892193f` | `pkg-record` |
| `feat/0.4.0/qa` | the commit that contains this file (read it with the command below; at the time of writing the parent is `31762126c537bd44339ca984f6ae82e787cdc72c`) | `pkg-qa` |

All worktrees were clean (only the untracked `.agent/` notes in `pkg-qa`). Tags: none new (`v0.1.0`-`v0.3.0` already on the remote).

Verify, then push (a ref name cannot be both a file and a directory: `feat/0.4.0-frappe` and `feat/0.4.0/*` coexist because the first is a different name, not `feat/0.4.0`):
```bash
cd /home/frappe/solvfast-ui
git for-each-ref --format='%(refname:short) %(objectname)' refs/heads/feat/0.4.0-frappe 'refs/heads/feat/0.4.0/'   # compare with the table
git fetch origin                                   # needs network; shows whether origin/main moved
git merge-base --is-ancestor origin/main feat/0.4.0-frappe && echo "fast-forward from origin/main: OK"
git push --dry-run origin \
  refs/heads/feat/0.4.0-frappe:refs/heads/feat/0.4.0-frappe \
  refs/heads/feat/0.4.0/foundation:refs/heads/feat/0.4.0/foundation \
  refs/heads/feat/0.4.0/form:refs/heads/feat/0.4.0/form \
  refs/heads/feat/0.4.0/list:refs/heads/feat/0.4.0/list \
  refs/heads/feat/0.4.0/record:refs/heads/feat/0.4.0/record \
  refs/heads/feat/0.4.0/qa:refs/heads/feat/0.4.0/qa
# when the dry run looks right, run the same command without --dry-run (no --force, no --all, no --mirror, no tags):
git push origin \
  refs/heads/feat/0.4.0-frappe:refs/heads/feat/0.4.0-frappe \
  refs/heads/feat/0.4.0/foundation:refs/heads/feat/0.4.0/foundation \
  refs/heads/feat/0.4.0/form:refs/heads/feat/0.4.0/form \
  refs/heads/feat/0.4.0/list:refs/heads/feat/0.4.0/list \
  refs/heads/feat/0.4.0/record:refs/heads/feat/0.4.0/record \
  refs/heads/feat/0.4.0/qa:refs/heads/feat/0.4.0/qa
git ls-remote --heads origin 'feat/0.4.0*'          # confirm the remote heads equal the table
```
Authentication is the owner's (GitHub credentials / token via the usual helper); do not put a token on the command line.

## 2. CRM work repo - `/home/frappe/sfui-dev/crm-base` (all worktrees share this `.git`)

**No remote is configured** (`git remote` is empty; no credential or url settings). The owner must choose one. Options, in order of preference:

| Option | Remote | Notes |
|---|---|---|
| **A. Private GitHub repository in the owner's organisation** (proposed name `solvfast/crm-work-sfui`, **private**, empty, no README) | `https://github.com/solvfast/crm-work-sfui.git` | Off-site. Needed because the content is business-confidential (secret-audit C3-C5) and the repo is 31 MB packed |
| B. Offline bundle copied elsewhere | a file, no remote | `git bundle` of all refs below; verify with `git bundle verify`; copy off the host. Same-host copy is not off-site |
| C. Bare repository on another machine over SSH | `ssh://<user>@<host>/<path>/crm-work-sfui.git` | owner provides host |

| Ref | Head at preparation |
|---|---|
| `crm/baseline` | `0aed2412b6d0361b597a25011dd7fc03d2d658ad` (also tag `baseline-20261103`, a **lightweight** tag pointing at the same commit) |
| `crm/boot` | `f4e8c54e23a03fce1853ba071695d764ae881cb8` |
| `crm/forms` | `77d860f7b30288682fdfad57117c4ef86b5c5389` |
| `crm/integration` | `b82492f43f6215c651aceeac51c9bc01c69e778a` |
| `crm/list` | `455f47431586128d18157a2696fc54096b3a8c6b` |
| `crm/migration` | `b4a4e4a39fce85286a1490a0bf31d91305fd393d` |
| `crm/record` | `cc7978af65368157b4e0155259c07792d5306e7b` |

Warning: `/home/frappe/sfui-dev/crm-migration` has **uncommitted work** (4 modified, 2 untracked files under `frontend/src/sear_studio/data/frappe/` and `components/forms/CrmEntityFormFields.tsx`). It is in no head above and is **not** pushed. `crm-deps` and `crm-base`'s other siblings are not separate repositories (`crm-deps` is not a git repo).

Option A (replace the URL by the one the owner creates):
```bash
cd /home/frappe/sfui-dev/crm-base
git for-each-ref --format='%(refname:short) %(objectname)' 'refs/heads/crm/' refs/tags/baseline-20261103   # compare with the table
git remote add backup https://github.com/solvfast/crm-work-sfui.git
git push --dry-run backup \
  refs/heads/crm/baseline:refs/heads/crm/baseline \
  refs/heads/crm/boot:refs/heads/crm/boot \
  refs/heads/crm/forms:refs/heads/crm/forms \
  refs/heads/crm/integration:refs/heads/crm/integration \
  refs/heads/crm/list:refs/heads/crm/list \
  refs/heads/crm/migration:refs/heads/crm/migration \
  refs/heads/crm/record:refs/heads/crm/record \
  refs/tags/baseline-20261103:refs/tags/baseline-20261103
# then the same command without --dry-run (no --force / --all / --mirror):
git push backup \
  refs/heads/crm/baseline:refs/heads/crm/baseline refs/heads/crm/boot:refs/heads/crm/boot \
  refs/heads/crm/forms:refs/heads/crm/forms refs/heads/crm/integration:refs/heads/crm/integration \
  refs/heads/crm/list:refs/heads/crm/list refs/heads/crm/migration:refs/heads/crm/migration \
  refs/heads/crm/record:refs/heads/crm/record refs/tags/baseline-20261103:refs/tags/baseline-20261103
git ls-remote backup | cat                          # confirm heads and the tag
```

Option B (offline bundle, no network, no remote):
```bash
cd /home/frappe/sfui-dev/crm-base
B=/home/frappe/pmo-backups/crm-work-sfui-$(date +%Y%m%d).bundle     # then copy it OFF this host
git bundle create "$B" crm/baseline crm/boot crm/forms crm/integration crm/list crm/migration crm/record baseline-20261103
git bundle verify "$B"
sha256sum "$B" > "$B.sha256"
# restore anywhere with:  git clone "$B" crm-work && git -C crm-work branch -a
```
The same bundle approach works for the package repo if the owner prefers not to use GitHub: `git bundle create <file> feat/0.4.0-frappe feat/0.4.0/foundation feat/0.4.0/form feat/0.4.0/list feat/0.4.0/record feat/0.4.0/qa`.

## 3. Before pushing (checklist)

1. Re-run `python3 docs/qa/tools/secret_scan.py` on the final refs (commands in `secret-audit.md`); expect only the findings listed there.
2. Confirm the CRM remote is **private** and who has access.
3. Commit or consciously exclude the uncommitted `crm-migration` work.
4. Push the package branches before the CRM branches if the CRM work refers to a package version (`@solvfast/ui` 0.4.0-dev.x).
