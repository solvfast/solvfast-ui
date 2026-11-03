"""
Remove the `SFUI Test` footprint from the CRM site, driven by the manifest the seed wrote.  PREPARED, NOT RUN.

    ../env/bin/python <repo>/e2e/frappe-site/teardown-crm-site.py internal.solvfaster.com <private-dir>             # DRY RUN (default)
    ../env/bin/python <repo>/e2e/frappe-site/teardown-crm-site.py internal.solvfaster.com <private-dir> --execute   # deletes

The default is a dry run: it connects READ-ONLY, prints every object it would delete and every residue it found by
query, and changes nothing.  --execute additionally needs <private-dir>/APPROVED_TEARDOWN (site, approved_by,
approved_at) and takes a fresh backup requirement from the owner's process (docs/qa/backup-safety-net.md).

Order (children before parents; each step logged to <private-dir>/teardown-log.json):
  1 sessions of the SFUI users are cleared
  2 residue rows swept by query (SWEEP_* lists in sfui_footprint.py)
  3 the Workflow (first, so cancelling submitted docs is not blocked by workflow rules), then the Workflow States /
    Action Masters WE created
  4 documents of the SFUI DocTypes (submitted ones are cancelled first)
  5 User Permissions from the manifest
  6 the SFUI users' Contacts - BEFORE the users: User.on_trash only unlinks a Contact (user.py:539-541), it does not delete it
  7 users (their Notification Settings and DocShares go with them, user.py:525-537)
  8 DocTypes, then `DROP TABLE` for the manifest's tables (deleting a DocType does NOT drop its table: delete_doc.py:67-95
    contains no DDL; only installer.py:517 and `bench trim-database` drop tables), then Roles, then the Module Def;
    finally clear_cache
Never deletes anything that is not in the manifest or matched by an SFUI-keyed sweep; a record that was pre-existing
(kind "modified") is left alone.  Rows are removed with delete_permanently=True so no Deleted Document rows appear.
"""
from __future__ import annotations

import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sfui_footprint as fp  # noqa: E402

USAGE = "usage: teardown-crm-site.py internal.solvfaster.com <private-dir> [--dry-run | --execute]"


def main(argv: list[str]) -> int:
	if len(argv) < 2:
		print(USAGE, file=sys.stderr)
		return 64
	site, private_arg = argv[0], argv[1]
	flags = set(argv[2:])
	if flags - {"--dry-run", "--execute"} or {"--dry-run", "--execute"} <= flags:
		print(USAGE, file=sys.stderr)
		return 64
	execute = "--execute" in flags
	fp.require_site(site)
	private = fp.prepare_private_dir(private_arg)
	if execute:
		approval = fp.read_approval(private, "APPROVED_TEARDOWN", need_backup=False)
		print(f"approval: {approval['approved_by']} at {approval['approved_at']}")
	manifest_path = private / "manifest.json"
	if not manifest_path.is_file():
		fp.refuse(f"no manifest at {manifest_path}: nothing to tear down (and nothing will be guessed)")
	import frappe  # noqa: E402

	return run(frappe, site, private, execute)


def run(frappe, site: str, private, execute: bool) -> int:
	frappe.init(site=site, sites_path=".")
	frappe.connect()
	if frappe.local.site != fp.SITE:
		fp.refuse(f"connected site is {frappe.local.site!r}")
	frappe.set_user("Administrator")
	if not execute:
		frappe.flags.read_only = True
		frappe.db.rollback()
		frappe.db.begin(read_only=True)
	frappe.flags.mute_emails = True

	man = fp.Manifest(private)
	log = []

	def step(action, doctype, name, fn=None):
		exists = bool(name) and frappe.db.exists(doctype, name) if doctype != "table" else True
		entry = {"action": action, "doctype": doctype, "name": name, "exists": bool(exists), "executed": False}
		print(("DELETE " if execute else "would delete ") + f"{doctype}: {name}" + ("" if exists else "  (already gone)"))
		if execute and exists and fn:
			try:
				fn()
				frappe.db.commit()
				entry["executed"] = True
			except Exception as e:  # keep going: report, never force
				frappe.db.rollback()
				entry["error"] = f"{type(e).__name__}: {e}"
				print("   FAILED:", entry["error"])
		log.append(entry)

	def delete(doctype, name, **kw):
		return lambda: frappe.delete_doc(doctype, name, ignore_permissions=True, delete_permanently=True, **kw)

	# 1. sessions
	for u in fp.USERS:
		if frappe.db.exists("User", u):
			print(("clear sessions of " if execute else "would clear sessions of ") + u)
			if execute:
				from frappe.sessions import clear_sessions

				clear_sessions(u, force=True)

	# 2. residue by query (rows Frappe or the tests created about SFUI DocTypes)
	for dt, field in fp.SWEEP_BY_DOCTYPE:
		if not frappe.db.table_exists(dt):
			continue
		names = frappe.get_all(dt, filters={field: ("in", fp.DOCTYPES)}, pluck="name", limit=0)
		print(f"sweep {dt}.{field} in SFUI doctypes: {len(names)} rows")
		for n in names:
			step("sweep", dt, n, delete(dt, n, force=1))
	for dt, field in fp.SWEEP_BY_USER:
		if dt in ("Notification Settings", "DocShare") or not frappe.db.table_exists(dt):
			continue  # these two go with User.on_trash
		names = frappe.get_all(dt, filters={field: ("in", fp.USERS)}, pluck="name", limit=0)
		print(f"sweep {dt}.{field} for SFUI users: {len(names)} rows")
		for n in names:
			step("sweep", dt, n, delete(dt, n, force=1))
	print("sweep __UserSettings for SFUI users")
	if execute:
		for u in fp.USERS:
			frappe.db.sql("delete from `__UserSettings` where `user` = %s", (u,))
		frappe.db.commit()

	# 3. workflow, then the shared master records WE created
	for n in man.names("created", "Workflow"):
		step("workflow", "Workflow", n, delete("Workflow", n))
	for dt in ("Workflow Action Master", "Workflow State"):
		for n in man.names("created", dt):
			step(dt.lower(), dt, n, delete(dt, n))

	# 4. documents of the SFUI DocTypes (parents first; children are removed with them)
	for dt in reversed(fp.DOCTYPES):
		if not frappe.db.table_exists(dt):
			continue
		if frappe.get_meta(dt).istable:
			continue
		for n in frappe.get_all(dt, pluck="name", limit=0):
			doc = frappe.get_doc(dt, n)
			if doc.docstatus == 1:  # submitted docs cannot be deleted: cancel first
				step("cancel", dt, n, lambda d=doc: (setattr(d.flags, "ignore_permissions", True), d.cancel()))
			step("document", dt, n, delete(dt, n, force=1))

	# 5. user permissions from the manifest
	for n in man.names("created", "User Permission"):
		step("user permission", "User Permission", n, delete("User Permission", n))

	# 6. contacts of the SFUI users (before the users)
	contacts = set(man.names("side_effect", "Contact"))
	for u in fp.USERS:
		contacts.update(frappe.get_all("Contact", filters={"user": u}, pluck="name"))
		contacts.update(frappe.get_all("Contact Email", filters={"email_id": u, "parenttype": "Contact"}, pluck="parent"))
	for n in sorted(contacts):
		step("contact", "Contact", n, delete("Contact", n, force=1))

	# 7. users
	for u in fp.USERS:
		step("user", "User", u, delete("User", u))

	# 8. doctypes, tables, roles, module
	for dt in reversed(fp.DOCTYPES):
		step("doctype", "DocType", dt, delete("DocType", dt, force=1))

	def drop(table):
		assert table.startswith("tabSFUI Test "), table  # hard guard: only our tables
		frappe.db.sql_ddl(f"DROP TABLE IF EXISTS `{table}`")

	for t in man.names("created", "table"):
		print(("DROP TABLE " if execute else "would drop table ") + t)
		if execute:
			drop(t)
	for r in fp.ROLES:
		step("role", "Role", r, delete("Role", r))
	step("module", "Module Def", fp.MODULE, delete("Module Def", fp.MODULE))

	# autoname counters (tabSeries) of the SFUI prefixes only
	print(("DELETE " if execute else "would delete ") + "Series rows " + ", ".join(fp.SERIES))
	if execute:
		for pfx in fp.SERIES:
			assert pfx.startswith("SFUI-")
			frappe.db.sql("delete from `tabSeries` where `name` = %s", (pfx,))
		frappe.db.commit()

	if execute:
		frappe.clear_cache()
		frappe.db.commit()

	# verification (works in both modes: dry run shows what remains BEFORE deleting)
	left = []
	for dt, names in (("DocType", fp.DOCTYPES), ("Role", fp.ROLES), ("Module Def", [fp.MODULE]), ("User", fp.USERS), ("Workflow", [fp.WORKFLOW])):
		left += [f"{dt}:{n}" for n in names if frappe.db.exists(dt, n)]
	left += [f"table:{t[0]}" for t in frappe.db.sql("show tables like 'tabSFUI Test%'")]
	left += [f"Contact:{c}" for u in fp.USERS for c in frappe.get_all("Contact", filters={"user": u}, pluck="name")]
	fp.write_private(private / ("teardown-log.json" if execute else "teardown-dryrun.json"), {"site": fp.SITE, "at": time.strftime("%F %T"), "steps": log, "remaining": left})
	print("remaining after this run:" if execute else "currently present (would be removed):", left or "nothing")
	frappe.destroy()
	return 0 if (not execute or not left) else 1


if __name__ == "__main__":
	sys.exit(main(sys.argv[1:]))
