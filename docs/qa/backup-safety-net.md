# Backup safety net for the CRM test footprint — PREPARED, NOT EXECUTED

Owner: A6 (QA). Site: `internal.solvfaster.com` on `/home/frappe/lovable_bench` (Frappe 15.110.0 + ERPNext, 52 apps,
shared by about 50 projects). **Nothing in this file has been run.** Every command below is for the owner (or someone
the owner designates) to run, in this order, before `seed-crm-site.py --apply` is allowed to do anything. The seed
script enforces the last step itself: it needs `APPROVED_SEED` naming a backup directory that holds a file newer than
6 hours (`e2e/frappe-site/sfui_footprint.py`, `read_approval`).

## 0. What was observed (read-only, 2026-11-03)

| Fact | Evidence |
|---|---|
| The newest backup of the site is from 27 Oct: `20261027_184420-…-database.sql.gz` (258,862 bytes), `20261027_205214-…-database.sql.gz` (252,928 bytes), two small `*-files.tar` / `*-private-files.tar` (10,240 bytes each), two `site_config_backup.json` | `ls -la sites/internal.solvfaster.com/private/backups` |
| Those dumps are small for a site with ERPNext installed. A valid gzip of a truncated dump passes `gzip -t`, so step 4 compares table counts | observation; hence the count check below |
| **`bench backup` first deletes backups older than 24 h** in the site's backup folder (or `keep_backups_for_hours`) | `frappe/utils/backups.py:604` (`delete_temp_backups()` is the first statement of `new_backup`, :585, reached from `scheduled_backup`, which `bench backup` calls: `commands/site.py:853`), `:630-634` (`keep_backups_for_hours or 24`); age uses `st_ctime` (`is_file_old`, `:644`); folder = `get_backup_path()` = `conf.backup_path` or `private/backups` (`:670-671`) |
| So running `bench backup` today would **delete the 27 Oct backups** (>24 h old) before writing the new one | same lines |
| The bench backup cron fails for 15 of 18 sites | inspection report of 2026-11-03 (`41-test-environment.md` §0) |
| `/home/frappe/pmo-backups/` exists and already holds other projects' archives; the disk has 430 GB free | `ls`, `df -h /home/frappe` |
| The site's `site_config.json` has `"allow_tests": true`, which is what lets `bench run-tests` run (`frappe/commands/utils.py:777-782`); it is **not** needed by this plan and nothing here runs tests on the site | `site_config.json` (keys only; secrets not read) |

## 1. Procedure (in order — do not reorder)

All paths relative to `/home/frappe/lovable_bench`. `SITE=internal.solvfaster.com`. `TS=$(date +%Y%m%d-%H%M%S)`.

### Step 1 — copy the existing 27 Oct backups FIRST, preserving them byte-for-byte
```bash
SITE=internal.solvfaster.com
SRC=/home/frappe/lovable_bench/sites/$SITE/private/backups
DST=/home/frappe/pmo-backups/$SITE-pre-sfui-footprint
mkdir -p "$DST" && chmod 700 "$DST"
df -h /home/frappe                                  # confirm free space (>= 10x the folder size below)
du -sh "$SRC"
cp -a "$SRC"/. "$DST"/existing-27oct/               # -a keeps mode and mtimes; this is a COPY, the originals stay
( cd "$SRC" && sha256sum * ) > "$DST"/existing-27oct.sha256
( cd "$DST"/existing-27oct && sha256sum -c ../existing-27oct.sha256 )   # every line must say OK
```
Stop here if any line is not `OK` or `cp` printed an error.

### Step 2 — take the new backup, WRITING OUTSIDE the folder that gets cleaned
`bench backup` deletes old files only in `get_backup_path()`. Writing the new files to the destination directly keeps
them out of the cleaner's reach for the next run, and the originals are already copied (Step 1), so the 24-hour
clean-up that still happens in `$SRC` cannot lose anything.
```bash
cd /home/frappe/lovable_bench
mkdir -p "$DST"/new-$TS
bench --site $SITE backup --backup-path "$DST"/new-$TS --verbose        # database + site_config
```
Whether to add `--with-files` (public + private files of the site) is the **owner's decision**: this plan creates no
Files outside the SFUI doctypes, so a database backup is sufficient for restoring "before"; `--with-files` costs disk
and time on a shared host. Record the choice in `APPROVED_SEED`.

### Step 3 — checksum and integrity of the new files
```bash
( cd "$DST"/new-$TS && sha256sum * ) > "$DST"/new-$TS.sha256
gzip -t "$DST"/new-$TS/*-database.sql.gz && echo "gzip OK"
ls -la "$DST"/new-$TS "$DST"/existing-27oct
```
(`gzip -t` proves the container, not the content: that is step 4.)

### Step 4 — verify the content: table count (and one data probe)
```bash
DUMP=$(ls "$DST"/new-$TS/*-database.sql.gz)
DUMPED=$(zcat "$DUMP" | grep -c '^CREATE TABLE')
echo "tables in dump: $DUMPED"
# tables in the live database: the owner (or whoever holds the DB credentials) runs ONE of the following.
# The credentials are in sites/$SITE/site_config.json; never paste them in a shell history or a log.
mysql -N -e "select count(*) from information_schema.tables where table_schema = '<db_name>' and table_type='BASE TABLE'"
```
Pass criteria: `DUMPED` equals the live count (`__Auth`-style and `tab*` tables alike), or the difference is explained
(`touched_tables.json`, views). Probe: `zcat "$DUMP" | grep -c '^INSERT INTO \`tabUser\`'` is at least 1 and
`zcat "$DUMP" | tail -n 3` ends with the MariaDB dump completion comment (a truncated dump has no trailer).
**If the count does not match, the backup is not a safety net: stop and tell the Lead.**

### Step 5 — repeat the same checks for the 27 Oct dumps (so the owner knows what the old net was worth)
```bash
for f in "$DST"/existing-27oct/*-database.sql.gz; do
  gzip -t "$f" && echo "$f: gzip OK, tables: $(zcat "$f" | grep -c '^CREATE TABLE')"
done
```
Their sizes (≈255 KB) suggest a much smaller table set than the live site; record the numbers in the report to the owner.

### Step 6 — write the approval file, in a private directory outside the repository
```bash
PRIV=/home/frappe/.sfui-private && mkdir -p -m 700 "$PRIV"
cat > "$PRIV"/APPROVED_SEED <<EOF
{"site": "$SITE", "approved_by": "<owner name>", "approved_at": "$(date -Is)",
 "backup_dir": "$DST/new-$TS", "backup_verified": true, "with_files": false,
 "tables_in_dump": $DUMPED, "notes": "27 Oct copies in $DST/existing-27oct"}
EOF
chmod 600 "$PRIV"/APPROVED_SEED
```
`APPROVED_SEED` is the flag file the seed script requires; the script also re-checks that `backup_dir` contains a file
younger than 6 hours.

### Step 7 — only now: plan, preflight, apply
```bash
cd /home/frappe/lovable_bench/sites
../env/bin/python <repo>/e2e/frappe-site/seed-crm-site.py $SITE $PRIV                 # prints the plan, touches nothing
../env/bin/python <repo>/e2e/frappe-site/seed-crm-site.py $SITE $PRIV --preflight     # read-only: collisions, hooks, settings
../env/bin/python <repo>/e2e/frappe-site/seed-crm-site.py $SITE $PRIV --apply         # the footprint
```
Choose a quiet window (the Module Def and DocType inserts clear the site cache, `docs/qa/test-footprint.md` §1).

## 2. Restore plan (if the footprint damages anything)

1. Prefer **teardown** (`teardown-crm-site.py`, dry run first): it is manifest-driven and removes only SFUI objects.
2. A full restore is a last resort and affects every project on the site (data written since the backup is lost):
   `bench --site $SITE --force restore "$DST"/new-$TS/<…>-database.sql.gz` — only by the owner, after announcing a freeze.
   Take a *second* backup immediately before it.
3. After either, run the residue queries listed in `teardown-crm-site.py` (it prints `remaining after this run`).

## 3. What this plan does not do

- It does not touch the other 17 sites on the bench, `common_site_config.json`, or any app.
- It does not enable or disable the backup cron; fixing the cron (failing for 15 of 18 sites) is a separate decision for
  the owner. Until it is fixed there is no scheduled safety net for this site; the backup above is a one-off.
- It does not change `keep_backups_for_hours`. Raising it in `site_config.json` would stop the 24-hour deletion at the
  source, but it is a site setting, so it is the owner's call, not part of this footprint.
