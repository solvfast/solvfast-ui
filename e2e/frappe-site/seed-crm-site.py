"""
Create the `SFUI Test` footprint on the CRM site.  PREPARED, NOT RUN - never run without the owner's written approval and
a verified backup (docs/qa/backup-safety-net.md).  Every side effect is listed in docs/qa/test-footprint.md.

    cd /home/frappe/lovable_bench/sites          # the bench's sites folder (the owner runs this, not an agent)
    ../env/bin/python <repo>/e2e/frappe-site/seed-crm-site.py internal.solvfaster.com <private-dir>             # PLAN (no frappe)
    ../env/bin/python <repo>/e2e/frappe-site/seed-crm-site.py internal.solvfaster.com <private-dir> --preflight # read-only checks
    ../env/bin/python <repo>/e2e/frappe-site/seed-crm-site.py internal.solvfaster.com <private-dir> --apply     # writes

Refuses unless: the site is exactly internal.solvfaster.com; <private-dir> (outside the repo, mode 700) holds an
APPROVED_SEED file naming the site, the approver, the time and a verified backup directory with a file newer than 6 h;
and --apply is given.  --preflight additionally aborts if ANY planned name already exists (nothing is ever adopted).

Creates (all names are SFUI-prefixed and recorded in <private-dir>/manifest.json BEFORE each call):
  Module Def "SFUI Test" (custom=1, app frappe) - 3 custom Roles - 6 custom DocTypes - Workflow States / Action Masters
  (only if missing) - Workflow "SFUI Test Workflow Flow" - 5 users @example.com - 61 SFUI Test Contacts - 3 Parents -
  3 Workflow docs - 1 User Permission.
Records the Frappe-created side effects (Contact, Notification Settings, DocShare self-share) as kind "side_effect".
"""
from __future__ import annotations

# ---- P36: DISABLED. This script targets the PRODUCTION site internal.solvfaster.com, which P36 forbids. -------------
# It is kept (not deleted) for the record; the staging replacement is staging-seed.py. The exit below is the first executable
# statement, before any other import, so nothing in this file can reach a site.
import sys as _p36_sys  # noqa: E402

_p36_sys.exit(
	"REFUSED (P36): seed-crm-site.py targets the production site internal.solvfaster.com. P36 forbids any script from touching "
	"production data. Use staging-seed.py against an owner-approved, isolated STAGING site (e2e/frappe-site/README.md)."
)

import os
import secrets
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sfui_footprint as fp  # noqa: E402  (no frappe import here)

USAGE = "usage: seed-crm-site.py internal.solvfaster.com <private-dir> [--preflight | --apply]"


def plan_text() -> str:
	lines = [f"PLAN for site {fp.SITE} (nothing is executed in this mode)", ""]
	lines.append(f"Module Def: {fp.MODULE} (custom=1, app_name=frappe). NOTE: its on_update runs a SITE-WIDE frappe.clear_cache().")
	lines.append(f"Roles ({len(fp.ROLES)}): " + ", ".join(fp.ROLES) + " (desk_access=1, is_custom=1)")
	for d in fp.DOCTYPES:
		fx = fp.load_fixture(f"doctype-{d.lower().replace(' ', '-')}.json")
		lines.append(f"DocType {d}: {len(fx['fields'])} fields, {len(fx.get('permissions', []))} permission rows (custom=1; DDL creates `tab{d}`)")
	wf = fp.load_fixture("workflow.json")
	lines.append(
		f"Workflow States: {len(wf['workflow_states'])} (created only if missing), Action Masters: {len(wf['workflow_actions'])} "
		f"(only if missing), Workflow {fp.WORKFLOW!r} for SFUI Test Workflow (send_email_alert=0)"
	)
	users = fp.load_fixture("users.json")
	lines.append(f"Users ({len(users)}): " + ", ".join(u["email"] for u in users))
	lines.append("  side effects per user: Notification Settings, DocShare self-share, an async Contact (create_contact), hooks (see docs/qa/test-footprint.md)")
	rec = fp.load_fixture("records.json")
	lines.append(f"Records: {rec['contacts']['count']} contacts, {len(rec['parents'])} parents, {len(rec['workflow_docs'])} workflow docs, 1 User Permission")
	return "\n".join(lines)


def main(argv: list[str]) -> int:
	if len(argv) < 2:
		print(USAGE, file=sys.stderr)
		return 64
	site, private_arg = argv[0], argv[1]
	flags = set(argv[2:])
	if flags - {"--preflight", "--apply"}:
		print(USAGE, file=sys.stderr)
		return 64
	fp.require_site(site)
	private = fp.prepare_private_dir(private_arg)

	if not flags:
		print(plan_text())
		return 0
	if "--apply" in flags and "--preflight" in flags:
		fp.refuse("choose --preflight or --apply, not both")

	if "--apply" in flags:  # approval and backup are checked BEFORE frappe is even imported
		approval = fp.read_approval(private, "APPROVED_SEED", need_backup=True)
		print(f"approval: {approval['approved_by']} at {approval['approved_at']}; backup {approval['backup_dir']}")

	import frappe  # noqa: E402  (first contact with the bench; everything above is local)

	if "--preflight" in flags:
		return preflight(frappe, site)
	return apply(frappe, site, private)


# ---- read-only ------------------------------------------------------------------------------------------------------


def _connect(frappe, site: str, read_only: bool):
	frappe.init(site=site, sites_path=".")
	frappe.connect()
	if frappe.local.site != fp.SITE:
		fp.refuse(f"connected site is {frappe.local.site!r}")
	frappe.set_user("Administrator")
	if read_only:
		frappe.flags.read_only = True
		frappe.db.rollback()
		frappe.db.begin(read_only=True)


def collisions(frappe) -> list[str]:
	bad = []
	if frappe.db.exists("Module Def", fp.MODULE):
		bad.append(f"Module Def {fp.MODULE!r} exists")
	for r in fp.ROLES:
		if frappe.db.exists("Role", r):
			bad.append(f"Role {r!r} exists")
	for d in fp.DOCTYPES:
		if frappe.db.exists("DocType", d):
			bad.append(f"DocType {d!r} exists")
	for t in frappe.db.sql("show tables like 'tabSFUI Test%'"):
		bad.append(f"table {t[0]!r} exists")
	if frappe.db.exists("Workflow", fp.WORKFLOW):
		bad.append(f"Workflow {fp.WORKFLOW!r} exists")
	for u in fp.USERS:
		if frappe.db.exists("User", u):
			bad.append(f"User {u!r} exists")
		if frappe.db.exists("Contact Email", {"email_id": u}) or frappe.db.exists("Contact", {"user": u}):
			bad.append(f"a Contact for {u!r} exists (ERPNext update_contact / create_contact would adopt it)")
	return bad


def preflight(frappe, site: str) -> int:
	import frappe.utils.scheduler  # noqa: F401

	_connect(frappe, site, read_only=True)
	try:
		print("installed apps:", ", ".join(frappe.get_installed_apps()))
		print("developer_mode:", bool(frappe.conf.get("developer_mode")), "(Module Def custom=1 is written to the DB only)")
		print("scheduler disabled:", frappe.utils.scheduler.is_scheduler_disabled(), "(create_contact is enqueued after commit)")
		print("User count:", frappe.db.count("User"))
		hooks = frappe.get_hooks("doc_events")
		for key in ("User", "*"):
			print(f"doc_events[{key!r}]:")
			for event, fns in (hooks.get(key) or {}).items():
				print(f"   {event}: {fns}")
		bad = collisions(frappe)
		for b in bad:
			print("COLLISION:", b)
		print("preflight:", "FAILED" if bad else "ok (no name collisions)")
		return 1 if bad else 0
	finally:
		frappe.db.rollback()
		frappe.destroy()


# ---- writes ---------------------------------------------------------------------------------------------------------


def apply(frappe, site: str, private) -> int:
	from frappe.utils.password import update_password

	_connect(frappe, site, read_only=False)
	frappe.flags.mute_emails = True  # this process only; the users' Notification Settings handle the web processes
	started = time.time()
	man = fp.Manifest(private)
	if man.all():
		fp.refuse(f"{man.path} already lists items: run teardown-crm-site.py --execute first (a partial seed is never resumed)")
	bad = collisions(frappe)
	if bad:
		for b in bad:
			print("COLLISION:", b)
		fp.refuse("planned names already exist; nothing is adopted. Remove them or choose another prefix.")

	def create(kind, doctype, name, doc_dict, **kw):
		"""manifest intent -> insert -> commit -> manifest done."""
		man.intent(kind, doctype, name)
		doc = frappe.get_doc(doc_dict)
		doc.insert(ignore_permissions=True, **kw)
		frappe.db.commit()
		man.done(kind, doctype, name)
		return doc

	# 1. module, roles, doctypes -----------------------------------------------------------------------------------
	mod = fp.load_fixture("module.json")
	create("created", "Module Def", mod["module_name"], mod)
	for r in fp.load_fixture("roles.json"):
		r = {k: v for k, v in r.items() if k != "purpose"}
		create("created", "Role", r["role_name"], r)
	for d in fp.DOCTYPES:
		fx = fp.load_fixture(f"doctype-{d.lower().replace(' ', '-')}.json")
		create("created", "DocType", d, fx)
		man.intent("created", "table", f"tab{d}")  # DDL table; DELETE of the DocType does not drop it (teardown does)
		man.done("created", "table", f"tab{d}")

	# 2. workflow --------------------------------------------------------------------------------------------------
	wf = fp.load_fixture("workflow.json")
	for s in wf["workflow_states"]:
		if frappe.db.exists("Workflow State", s["workflow_state_name"]):
			continue  # shared record: never touched, never recorded as ours
		create("created", "Workflow State", s["workflow_state_name"], {"doctype": "Workflow State", **s})
	for a in wf["workflow_actions"]:
		if frappe.db.exists("Workflow Action Master", a):
			continue
		create("created", "Workflow Action Master", a, {"doctype": "Workflow Action Master", "workflow_action_name": a})
	create("created", "Workflow", wf["workflow"]["workflow_name"], wf["workflow"])

	# 3. users -----------------------------------------------------------------------------------------------------
	creds = {}
	users = fp.load_fixture("users.json")
	for u in users:
		email = u["email"]
		man.intent("created", "User", email)
		doc = frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": u["first_name"],
				"last_name": u["last_name"],
				"enabled": 1,
				"send_welcome_email": 0,
				"language": u["language"],
				"user_image": fp.AVATAR,  # makes User.on_update skip the gravatar enqueue (user.py:243-248)
				"roles": [{"role": r} for r in u["roles"]],
			}
		)
		doc.flags.no_welcome_mail = True
		doc.insert(ignore_permissions=True)
		pwd = secrets.token_urlsafe(24)
		update_password(email, pwd)
		frappe.db.commit()
		man.done("created", "User", email)
		creds[email] = pwd
		# Frappe-created companions (recorded so teardown does not rely on guessing)
		if frappe.db.exists("Notification Settings", email):
			man.intent("side_effect", "Notification Settings", email)
			frappe.db.set_value("Notification Settings", email, "enable_email_notifications", 0)
			frappe.db.commit()
			man.done("side_effect", "Notification Settings", email)
		for ds in frappe.get_all("DocShare", filters={"share_doctype": "User", "share_name": email, "user": email}, pluck="name"):
			man.intent("side_effect", "DocShare", ds)
			man.done("side_effect", "DocShare", ds)
	fp.write_private(private / "users.json", {"password_for": creds, "note": "synthetic accounts; delete this file after the run"})

	# 4. the async Contacts (User.on_update enqueues create_contact after commit; a worker creates them later) --------
	deadline = time.time() + 120
	pending = set(fp.USERS)
	while pending and time.time() < deadline:
		for email in list(pending):
			for c in frappe.get_all("Contact", filters={"user": email}, pluck="name"):
				man.intent("side_effect", "Contact", c)
				man.done("side_effect", "Contact", c)
				pending.discard(email)
		if pending:
			time.sleep(3)
			frappe.db.rollback()  # fresh snapshot for the next poll
	if pending:
		print("WARNING: no Contact appeared yet for", sorted(pending), "- teardown looks them up by user/email, so this is safe")

	# 5. records ---------------------------------------------------------------------------------------------------
	rec = fp.load_fixture("records.json")
	cs = rec["contacts"]
	contact_names = []
	for n in range(1, cs["count"] + 1):
		doc = create(
			"created",
			"SFUI Test Contact",
			f"pending-{n}",
			{
				"doctype": "SFUI Test Contact",
				"contact_name": cs["name_pattern"].format(n=n),
				"email_id": cs["email_pattern"].format(n=n),
				"status": cs["status_cycle"][(n - 1) % len(cs["status_cycle"])],
			},
		)
		# the autoname is only known now: replace the placeholder entry
		item = man.find("created", "SFUI Test Contact", f"pending-{n}")
		item["name"] = doc.name
		man._save()
		contact_names.append(doc.name)

	for u in users:
		if "user_permission" in u:
			target = contact_names[u["user_permission"]["for_value_index"]]
			name = f"{u['email']}->{target}"
			man.intent("created", "User Permission", name)
			up = frappe.get_doc(
				{"doctype": "User Permission", "user": u["email"], "allow": "SFUI Test Contact", "for_value": target, "apply_to_all_doctypes": 1}
			).insert(ignore_permissions=True)
			frappe.db.commit()
			item = man.find("created", "User Permission", name)
			item["name"] = up.name
			man.done("created", "User Permission", up.name)

	def set_owner(dt, name, owner):
		frappe.db.set_value(dt, name, "owner", owner, update_modified=False)

	for p in rec["parents"]:
		items = [
			{"item_code": f"ITEM-{i + 1:02d}", "qty": i + 1, "rate": 10 * (i + 1), "kind": "Normal" if i % 2 else "Special"}
			for i in range(p["items"])
		]
		doc = create(
			"created",
			"SFUI Test Parent",
			f"pending-{p['key']}",
			{
				"doctype": "SFUI Test Parent",
				"title": p["title"],
				"status": p["status"],
				"contact": contact_names[p["contact_index"]],
				"items": items,
			},
		)
		item = man.find("created", "SFUI Test Parent", f"pending-{p['key']}")
		item["name"] = doc.name
		man._save()
		set_owner("SFUI Test Parent", doc.name, p["owner"])
		if p.get("submit"):
			doc.reload()
			doc.submit()
		frappe.db.commit()

	for w in rec["workflow_docs"]:
		doc = create(
			"created",
			"SFUI Test Workflow",
			f"pending-{w['key']}",
			{"doctype": "SFUI Test Workflow", "subject": w["subject"], "amount": w["amount"], "workflow_state": "SFUI Draft"},
		)
		item = man.find("created", "SFUI Test Workflow", f"pending-{w['key']}")
		item["name"] = doc.name
		man._save()
		set_owner("SFUI Test Workflow", doc.name, w["owner"])
		frappe.db.commit()

	man.data["finished_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
	man._save()
	print(f"seeded in {time.time() - started:.0f}s; manifest {man.path}; credentials {private / 'users.json'} (mode 600)")
	frappe.destroy()
	return 0


if __name__ == "__main__":
	sys.exit(main(sys.argv[1:]))
