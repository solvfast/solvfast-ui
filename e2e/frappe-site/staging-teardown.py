"""
P36 staging teardown: removes what staging-seed.py created, driven by its manifest.  PREPARED, NOT RUN.

    cd <staging-bench>/sites
    export SFUI_STAGING_SITE=<staging-site-name>
    ../env/bin/python <repo>/e2e/frappe-site/staging-teardown.py <site> <private-dir>             # DRY RUN (read-only)
    ../env/bin/python <repo>/e2e/frappe-site/staging-teardown.py <site> <private-dir> --execute   # deletes

Same guards as the seed (staging_guards.py): allowlisted, non-production site; not inside a production bench; private
directory mode 700 outside every git work tree; APPROVED_STAGING naming the site (--execute also needs allow_write).
Deletes only: objects in the manifest, rows of the SFUI DocTypes, residue rows keyed by the SFUI DocTypes or the SFUI
accounts (SWEEP_* below), the SFUI tables, and the tabSeries counters of the SFUI prefixes. Nothing else.
"""
from __future__ import annotations

import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staging_guards as G  # noqa: E402

USAGE = "usage: staging-teardown.py <site> <private-dir> [--execute]"
DOCTYPES = ["SFUI Test Tag Row", "SFUI Test Child", "SFUI Test Contact", "SFUI Test Parent", "SFUI Test Workflow", "SFUI Test Attachments"]
MODULE = "SFUI Test"
ROLES = ["SFUI Manager", "SFUI Writer", "SFUI Reader", "SFUI Field"]
SERIES = ["SFUI-CON-", "SFUI-PAR-", "SFUI-WF-", "SFUI-ATT-"]
SWEEP_BY_DOCTYPE = [
	("ToDo", "reference_type"), ("Comment", "reference_doctype"), ("Version", "ref_doctype"), ("File", "attached_to_doctype"),
	("View Log", "reference_doctype"), ("Notification Log", "document_type"), ("Workflow Action", "reference_doctype"),
	("DocShare", "share_doctype"), ("Communication", "reference_doctype"), ("Tag Link", "document_type"),
	("Activity Log", "reference_doctype"), ("Energy Point Log", "reference_doctype"), ("Email Queue", "reference_doctype"),
	("Deleted Document", "deleted_doctype"), ("Document Follow", "ref_doctype"), ("List Filter", "reference_doctype"),
	("Reminder", "reminder_doctype"), ("Kanban Board", "reference_doctype"), ("Print Format", "doc_type"),
	("Data Import", "reference_doctype"), ("Access Log", "export_from"), ("Report", "ref_doctype"),
]
SWEEP_BY_USER = [("Activity Log", "user"), ("Route History", "user"), ("Access Log", "user"), ("Notification Log", "for_user")]


def main(argv: list[str]) -> int:
	args = [a for a in argv if not a.startswith("--")]
	flags = {a for a in argv if a.startswith("--")}
	if len(args) != 2 or flags - {"--execute"}:
		print(USAGE, file=sys.stderr)
		return 64
	site, private_arg = args
	execute = "--execute" in flags
	G.check_site(site)
	G.check_cwd()
	private = G.check_private_dir(private_arg)
	approval = G.read_approval(private, site, need_write=execute)
	print(f"approval: {approval['approved_by']} at {approval['approved_at']}")
	mpath = private / "manifest.json"
	if not mpath.is_file():
		G.refuse(f"no manifest at {mpath}: nothing to tear down (nothing is guessed)")
	manifest = json.loads(mpath.read_text())
	if manifest.get("site") != site:
		G.refuse(f"the manifest is for {manifest.get('site')!r}, not {site!r}")
	G.no_frappe_guard()
	import frappe  # noqa: E402

	return run(frappe, site, private, manifest, execute)


def run(frappe, site, private, manifest, execute: bool) -> int:
	frappe.init(site=site, sites_path=".")
	frappe.connect()
	G.check_connected(frappe, site)
	frappe.set_user("Administrator")
	if not execute:
		frappe.flags.read_only = True
		frappe.db.rollback()
		frappe.db.begin(read_only=True)
	frappe.flags.mute_emails = True
	items = manifest.get("items", [])
	names = lambda kind, dt: [i["name"] for i in items if i["kind"] == kind and i["doctype"] == dt]
	users = names("created", "User")
	log = []

	def step(doctype, name, fn):
		exists = bool(frappe.db.exists(doctype, name))
		entry = {"doctype": doctype, "name": name, "exists": exists, "executed": False}
		print(("DELETE " if execute else "would delete ") + f"{doctype}: {name}" + ("" if exists else "  (already gone)"))
		if execute and exists:
			try:
				fn()
				frappe.db.commit()
				entry["executed"] = True
			except Exception as e:  # report, never force
				frappe.db.rollback()
				entry["error"] = f"{type(e).__name__}: {e}"
				print("   FAILED:", entry["error"])
		log.append(entry)

	delete = lambda dt, n, **kw: (lambda: frappe.delete_doc(dt, n, ignore_permissions=True, delete_permanently=True, **kw))

	for u in users:
		if frappe.db.exists("User", u):
			print(("clear sessions of " if execute else "would clear sessions of ") + u)
			if execute:
				from frappe.sessions import clear_sessions

				clear_sessions(u, force=True)
	for dt, field in SWEEP_BY_DOCTYPE:
		if not frappe.db.table_exists(dt) or not frappe.get_meta(dt).has_field(field):
			continue
		for n in frappe.get_all(dt, filters={field: ("in", DOCTYPES)}, pluck="name", limit=0):
			step(dt, n, delete(dt, n, force=1))
	for dt, field in SWEEP_BY_USER:
		if users and frappe.db.table_exists(dt):
			for n in frappe.get_all(dt, filters={field: ("in", users)}, pluck="name", limit=0):
				step(dt, n, delete(dt, n, force=1))
	if execute and users:
		for u in users:
			frappe.db.sql("delete from `__UserSettings` where `user` = %s", (u,))
		frappe.db.sql("delete from `__UserSettings` where `doctype` in %s", (tuple(DOCTYPES),))
		frappe.db.commit()
	for dt in ("Workflow", "Workflow Action Master", "Workflow State", "Kanban Board", "Print Format", "Letter Head", "Email Template", "List Filter"):
		for n in names("created", dt):
			step(dt, n, delete(dt, n))
	for dt in reversed(DOCTYPES):
		if not frappe.db.table_exists(dt) or frappe.get_meta(dt).istable:
			continue
		for n in frappe.get_all(dt, pluck="name", limit=0):
			if frappe.db.get_value(dt, n, "docstatus") == 1:
				step(dt, n, lambda d=dt, x=n: frappe.get_doc(d, x).cancel())
			step(dt, n, delete(dt, n, force=1))
	for n in names("created", "User Permission"):
		step("User Permission", n, delete("User Permission", n))
	for n in frappe.get_all("List View Settings", filters={"name": ("in", DOCTYPES)}, pluck="name"):
		step("List View Settings", n, delete("List View Settings", n))
	for u in users:
		for c in set(frappe.get_all("Contact", filters={"user": u}, pluck="name")) | set(
			frappe.get_all("Contact Email", filters={"email_id": u, "parenttype": "Contact"}, pluck="parent")
		):
			step("Contact", c, delete("Contact", c, force=1))
	for u in users:
		step("User", u, delete("User", u))
	for n in sorted(set(names("created", "Tag")) | set(frappe.get_all("Tag", filters={"name": ("like", "sfui-%")}, pluck="name"))):
		step("Tag", n, delete("Tag", n))
	for dt in reversed(DOCTYPES):
		step("DocType", dt, delete("DocType", dt, force=1))
	for t in names("created", "table"):
		assert t.startswith("tabSFUI Test "), t  # hard guard: only our tables
		print(("DROP TABLE " if execute else "would drop table ") + t)
		if execute:
			frappe.db.sql_ddl(f"DROP TABLE IF EXISTS `{t}`")
	for r in ROLES:
		step("Role", r, delete("Role", r))
	step("Module Def", MODULE, delete("Module Def", MODULE))
	print(("DELETE " if execute else "would delete ") + "Series rows " + ", ".join(SERIES))
	if execute:
		for pfx in SERIES:
			assert pfx.startswith("SFUI-")
			frappe.db.sql("delete from `tabSeries` where `name` = %s", (pfx,))
		frappe.clear_cache()
		frappe.db.commit()

	left = [f"DocType:{d}" for d in DOCTYPES if frappe.db.exists("DocType", d)]
	left += [f"User:{u}" for u in users if frappe.db.exists("User", u)]
	left += [f"Role:{r}" for r in ROLES if frappe.db.exists("Role", r)]
	left += [f"table:{t[0]}" for t in frappe.db.sql("show tables like 'tabSFUI Test%'")]
	G.write_private(private / ("teardown-log.json" if execute else "teardown-dryrun.json"), {"site": site, "at": time.strftime("%F %T"), "steps": log, "remaining": left})
	print("remaining after this run:" if execute else "currently present (would be removed):", left or "nothing")
	frappe.destroy()
	return 0 if (not execute or not left) else 1


if __name__ == "__main__":
	sys.exit(main(sys.argv[1:]))
