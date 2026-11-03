# Recovery plan for `internal.solvfaster.com` - PREPARED, NOT EXECUTED

Owner: A6 (QA). Extends `backup-safety-net.md` (steps 1-7 there stay valid; this file adds the exact copy-first commands, the
side-effect accounting of a fresh backup, the restore options with their blast radius on the shared bench, and the findings on the
broken backup cron). Everything below was derived by **reading** (source of `/home/frappe/lovable_bench/apps/frappe`, logs, crontab,
`ls`, `df`). Nothing was run that writes: no backup, no copy, no restore, no cron or config change. Commands are for the owner / Ops.

Site facts used (read-only, 2026-11-03): bench `/home/frappe/lovable_bench`, MariaDB 127.0.0.1:3306 (one server for all 18 sites;
`mariadbd` up 11 days), 64 GB RAM with about 1.6 GB free (9 GB cache), root disk 427 GB free (49 % used), `/home/frappe/pmo-backups`
holds 27 entries (1.5 GB) from other projects. The site's backup folder `sites/internal.solvfaster.com/private/backups` holds exactly the 27 Oct files
(database 258,862 and 252,928 bytes, two `*-files.tar` / `*-private-files.tar` of 10,240 bytes, two `site_config_backup.json`).
The live database is about 51 MB (Lead's figure, not re-measured here). A 51 MB database compressing to about 250 KB is not plausible, so
**the 27 Oct dumps must be treated as unverified** until the table-count check below passes.

## (a) Preserve the 27 Oct backups first

Nothing may run `bench backup` for this site before this step is finished and verified: `new_backup()` starts with
`delete_temp_backups()` (`frappe/utils/backups.py:604`) which deletes every file in the site's backup folder older than
`keep_backups_for_hours or 24` hours by `st_ctime` (`:630-660`). The 27 Oct files are older than that.

```bash
SITE=internal.solvfaster.com
SRC=/home/frappe/lovable_bench/sites/$SITE/private/backups
DST=/home/frappe/pmo-backups/$SITE-27oct-preserved
set -euo pipefail
test ! -e "$DST"                                   # refuse to overwrite an earlier copy
df -h /home/frappe | tail -1                        # need > 10 MB; 427 GB are free
mkdir -m 700 "$DST"
cp -a --no-clobber "$SRC"/. "$DST"/                 # -a keeps mode, owner, mtimes; originals stay in place
( cd "$SRC" && sha256sum -- * ) > "$DST.sha256"     # checksums of the ORIGINALS
( cd "$DST" && sha256sum -c "$DST.sha256" )         # every line must read: OK
ls -la --time-style=long-iso "$DST"
for f in "$DST"/*-database.sql.gz; do
  gzip -t "$f" && echo "gzip OK  $f  tables: $(zcat "$f" | grep -c '^CREATE TABLE')"
done
chmod -R a-w "$DST"                                  # read-only copy
```
Stop if any checksum is not `OK`. Record the table counts: they are the baseline for (b). If the counts are far below the live table
count (step (b)), the old dumps are partial and must not be described as a recovery point.

## (b) A fresh backup of `internal.solvfaster.com`

Run only after (a) verified. Ideally in the same quiet window as the footprint seed and not at 00/06/12/18 h (the bench cron runs then).

```bash
cd /home/frappe/lovable_bench
TS=$(date +%Y%m%d-%H%M%S)
OUT=/home/frappe/pmo-backups/$SITE-fresh-$TS
mkdir -m 700 "$OUT"
time bench --site $SITE backup --backup-path "$OUT" --verbose      # add --with-files only if the owner wants public/private files
( cd "$OUT" && sha256sum -- * ) > "$OUT.sha256"
gzip -t "$OUT"/*-database.sql.gz
```
What the command does (source: `commands/site.py:836-895`, `utils/backups.py`):
- `new_backup()` first calls `delete_temp_backups()` on **`sites/$SITE/private/backups`** (the default path, not `--backup-path`): anything older than
  24 h there is deleted. With (a) done this loses nothing.
- It runs, as the site's own database user, `mariadb-dump --user=<site user> --host=127.0.0.1 --port=3306 --single-transaction --quick --lock-tables=false <db> | gzip`
  (the exact form is visible in `logs/backup.log` for the other sites). Then it writes the `site_config_backup.json` (key names only, about 200 bytes).
- **Load on the shared MariaDB**: one read stream of about 51 MB of table data. `--single-transaction` takes one consistent InnoDB snapshot
  (REPEATABLE READ) without table locks, so other projects keep writing; the cost is I/O and CPU for the duration, and old row versions stay
  in the undo log until the dump ends (purge lag, small at this size). A DDL statement on this database during the dump waits for its metadata lock;
  other databases are not affected. MyISAM tables, if any, are not covered by the snapshot (Frappe tables are InnoDB).
- **Time and disk**: for scale, the log shows a 1 MB (gz) site dumping in about 2 s; this one should take tens of seconds and produce roughly
  5-10 MB gz (estimate from the sizes of the other sites' dumps: 0.2-9 MB for databases of comparable order). 427 GB are free; no disk risk.
- **Process side effects**: CPU for `gzip`, one short DB connection from the bench Python; no cache clear, no Redis write, no email, no change to
  any document. The site is not put into maintenance mode.
- With `--with-files` it also tars `public/files` and `private/files` (the current tars are 10 KB, i.e. empty folders).

Verify (as in `backup-safety-net.md` step 4): `zcat "$OUT"/*-database.sql.gz | grep -c '^CREATE TABLE'` equals the live
`information_schema.tables` count for the site's database (needs the DB credentials from `site_config.json`; do not put them on a command line), the dump ends with
`-- Dump completed`, and `grep -c '^INSERT INTO \`tabUser\`'` is at least 1.

## (c) Restore options, from least to most invasive

| Option | When | What it touches | Shared-bench impact |
|---|---|---|---|
| **1. Manifest-driven teardown** (`e2e/frappe-site/teardown-crm-site.py`, dry run first) | any problem caused by the SFUI footprint | only objects in the private manifest plus SFUI-keyed residue sweeps; DocTypes, tables (`DROP TABLE`, manifest names only), Roles, Module Def, 5 users and their Contacts | cache clear at the end; DDL per table; nothing of other projects. **This is the only mechanism that can undo the footprint without losing other people's data** |
| **2. Inspect, do not apply** | to prove what the backup holds | `zcat dump \| sed -n '/^-- Table structure for table `tabX`/,/^-- Table structure for table /p' > /tmp/tabX.sql` (read-only, a file) | none |
| **3. Table-level import** with `bench --site $SITE partial-restore <file>` | a few SFUI-owned tables damaged | **Caution: `partial-restore` replays whatever SQL file it is given into the site's database with the site's own credentials (`installer.py:851-869`, `db_manager.py:53-83`). A full dump contains `DROP TABLE IF EXISTS` + `CREATE TABLE` for every table, so giving it the full dump overwrites EVERY table, which is a full restore without root.** Use it only with a file that contains just the extracted tables of option 2 | replaces those tables wholesale (loses writes since the backup in them). Never for shared tables (`tabUser`, `tabContact`, `tabVersion`, `tabComment`, `tabFile`, `tabDocShare`, `tabSeries`...): other projects write to them |
| **4. Whole-site restore**: `bench --site $SITE --force restore <dump> --db-root-username root --db-root-password <prompted>` | disaster only (database lost or corrupted) | `restore` goes through `new_site` -> `setup_database(force)` (`installer.py:170`): it **drops and recreates the site database and its DB user** (needs MariaDB root), then pipes the dump in (`db_manager.py:53-83`) | the site's whole state reverts to the dump time: **all 52 apps' tables, every project's data written since, and the migrations other projects ran since** (schema and DocType rows older than the code on disk, so a `bench migrate` is needed afterwards and re-runs those migrations; that itself is a shared-bench event). Announce a freeze first and take a second backup immediately before. Not a rollback tool for test data |

Decision rule: footprint problem -> option 1. Corrupted SFUI table -> option 2 then 3 with an extracted file. Site unusable -> option 4, owner's decision, with
the root credentials held by whoever owns MariaDB (not available to the agents).

## (d) The broken backup cron (read-only investigation; note for Ops)

See `ops-note-backup-cron.md` for the hand-over text. Summary of the evidence:
- `crontab -l` (user `frappe`): the bench line is `0 */6 * * * cd /home/frappe/lovable_bench && bench --verbose --site all backup >> logs/backup.log 2>&1`,
  plus a dedicated line for `socotech.solvfaster.com` only, whose comment says `--site all` aborts on `hotelswavaota.solvfaster.com`.
- `logs/backup.log` (65.7 MB, 2,294 "Backup for Site ... completed" vs 5,815 "Backup failed" lines): the last success for any site that sorts after `hotelswavaota`
  is **2026-07-17 15:00**; since then only `aidev`, `client-poc`, `complaidemo` (alphabetically before it) succeed. 15 of 18 sites fail.
- The error is one and the same everywhere: `pymysql.err.OperationalError (1045) Access denied for user '_3253a0f569748e46'@'localhost'`, which is the DB user of
  `hotelswavaota.solvfaster.com` (`site_config.json` there is 94 bytes: only `db_name`, `db_password`, `db_type`; the site folder dates from 2026-07-17 10:41, has no backups folder and no apps data). Its credentials do not match any MariaDB account.
- **Why it cascades to every later site**: the loop in `commands/site.py:844-885` calls `frappe.destroy()` only on the success path; the `except` branch does `continue`
  without it, and `frappe.init()` returns immediately when `frappe.local` is already initialised (`frappe/__init__.py:197-198`). Every following site therefore keeps the failed site's configuration and fails with the same user. So one bad site poisons all that follow, and the "bad credentials" of one stub explain 15 failures.
- Consequence: no scheduled backup of `internal.solvfaster.com` (or 14 other sites) since 2026-07-17; the only dump is the manual one of 27 Oct. Sites that failed also never run `delete_temp_backups()`, which is why their old files are still on disk.

## (e) A fresh backup alone does not make writes to the site safe

1. **It is a disaster net, not an undo.** The only way back is a whole-site restore (option 4), which also discards the writes of every other project on this shared site since the backup.
   Nobody will accept that to remove 5 test users; so the footprint's real undo is the manifest teardown (option 1), whose correctness is independent of the backup.
2. **Not everything is in the dump.** The footprint also causes DDL (implicit commits: six `CREATE TABLE`, never rolled back), a site-wide `frappe.clear_cache()`, queued background jobs on the shared worker
   (`create_contact`), Redis keys, realtime events, log lines, monitor entries and (with tests) uploaded files; a database dump restores none of those, and without `--with-files` not the files either.
3. **A backup restores to a past that other projects have moved on from**: code and migrations of 52 apps change about 4 times a day (contract note on `bench migrate`), so a restored database can disagree with the code on disk.
4. **The safety net has not been proven to restore.** Until a restore has been rehearsed somewhere else (a scratch database, not this site) and the dump passes the table-count check, it is an unverified file. The 27 Oct dumps already fail the plausibility test above.
5. **No scheduled net exists**: the cron failure (d) means there is no fresh recovery point except the one taken by hand, so a failure hours later has no recent backup unless the owner repeats (b).
6. The site is protected and has `allow_tests: true` in `site_config.json` (`commands/utils.py:777-782`): nothing here may run `bench run-tests` on it.

Therefore: write approval (`APPROVED_SEED`) requires (a), (b) verified, a window announced to the other projects, and the owner accepting that undo = teardown, not restore.
