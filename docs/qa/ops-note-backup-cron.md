# Note for Ops: the bench backup cron has been failing since 2026-07-17 (15 of 18 sites)

From A6 (QA). Evidence read-only; nothing was changed. Details and sources in `recovery-plan.md` (d).

**Symptom.** `0 */6 * * * ... bench --verbose --site all backup` (bench `/home/frappe/lovable_bench`) writes `logs/backup.log` (65.7 MB). Since 2026-07-17 15:00 only
`aidev`, `client-poc` and `complaidemo` produce backups. The other 15 sites (including `internal.solvfaster.com` and `lovable.solvfaster.com`) log
`Backup failed for Site X. Database or site_config.json may be corrupted`. Latest dumps on disk: `internal` 2026-10-27 (manual), `zad-dev` 2026-10-20, most others 2026-10-13, `socotech` and `lovable` 2026-11-03 (manual / dedicated cron line).

**Root cause (two parts).**
1. `hotelswavaota.solvfaster.com` is a stub: `site_config.json` has 94 bytes (`db_name`, `db_password`, `db_type` only), created 2026-07-17 10:41, no backups folder. MariaDB answers
   `1045 Access denied for user '_3253a0f569748e46'@'localhost'` for it. (The password is not reproduced here.)
2. The `bench backup` loop (`apps/frappe/frappe/commands/site.py:844-885`) calls `frappe.destroy()` only after a successful backup; on failure it `continue`s. `frappe.init()` returns early when already
   initialised (`frappe/__init__.py:197-198`), so every later site in the alphabetical `--site all` list inherits the failed site's configuration and fails with the same user. In the last run every one of the 15 failures names the same user (`_3253a0f569748e46`), none names its own site's user.

**Proposed fix (for Ops to decide and apply; ordered by safety).**
1. Decide the fate of `hotelswavaota.solvfaster.com`: if unused, archive it (`bench drop-site`, which keeps a backup, needs MariaDB root) or move its folder out of `sites/` so `--site all` no longer lists it; if used, repair its DB user/password to match `site_config.json`.
2. Make the cron robust against any single bad site: replace `--site all` by a loop that isolates sites, e.g. `for s in $(ls -d sites/*.*/ | xargs -n1 basename); do bench --site "$s" backup || echo "FAILED $s"; done` (one process per site, so no shared state), and alert on `FAILED`.
3. Upstream/patch candidate (not for this bench without review): call `frappe.destroy()` in the `except` branch of `commands/site.py` so one failure cannot poison the rest.
4. After the fix: one manual run per site, then check `ls -la sites/*/private/backups` ages; consider `keep_backups_for_hours` per site (the cleaner uses `st_ctime`, default 24 h, so with a 6-hourly cron only about 4 files per site survive).
5. Take a verified copy of existing old dumps (`/home/frappe/pmo-backups`) before the first successful run, because the first successful run deletes files older than 24 h (`utils/backups.py:604,630-660`).

**Not verified here (needs Ops):** that the dedicated `socotech` cron line is the only workaround in place; MariaDB-side account list (no root access).
