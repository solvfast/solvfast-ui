"""
P36 staging seed for the real-site validation matrix of @solvfast/ui.  PREPARED, NOT RUN.

Creates ONLY synthetic, SFUI-prefixed data on ONE owner-approved, isolated STAGING site. Never on production: the
guards (staging_guards.py) refuse every name in production-denylist.json, every *.solvfaster.com host, loopback, any
working directory inside a production bench of the shared server, and any run without the owner's APPROVED_STAGING file.

    cd <staging-bench>/sites      # the owner runs this on the STAGING bench, never on the shared production server
    export SFUI_STAGING_SITE=<staging-site-name>          # explicit allowlist (comma-separated)
    ../env/bin/python <repo>/e2e/frappe-site/staging-seed.py <site> <private-dir>              # PLAN (no frappe import)
    ../env/bin/python <repo>/e2e/frappe-site/staging-seed.py <site> <private-dir> --preflight  # read-only checks
    ../env/bin/python <repo>/e2e/frappe-site/staging-seed.py <site> <private-dir> --apply      # writes
    (add --with-system-manager to also create sfui-sysmgr@example.com with System Manager — owner decision)

<private-dir>: outside every git work tree, mode 700, holding APPROVED_STAGING (mode 600):
    {"site": "<site>", "url": "https://<staging-host>", "approved_by": "<name>", "approved_at": "<ISO date>",
     "isolated_from_production": true, "allow_write": true}
The seed writes there (mode 600): manifest.json (every object, recorded BEFORE it is created), accounts.json (random
passwords of the synthetic @example.com accounts — never printed) and expected.json (names + totals computed here in
Python from the inserted rows, which run-matrix.mjs compares the site's answers against).

Reuses fixtures/module.json, fixtures/doctype-*.json, fixtures/workflow.json and the contacts of fixtures/records.json;
fixtures/staging/*.json replace the roles, users and permissions and add the P36 records (print format, letter head,
e-mail template, Kanban board, saved filters, tags, assignments, User Permissions, connections).
"""
from __future__ import annotations

import os
import secrets
import sys
import time
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staging_guards as G  # noqa: E402  (imports nothing from frappe)

USAGE = "usage: staging-seed.py <site> <private-dir> [--preflight | --apply] [--with-system-manager]"
MODULE = "SFUI Test"
DOCTYPES = ["SFUI Test Tag Row", "SFUI Test Child", "SFUI Test Contact", "SFUI Test Parent", "SFUI Test Workflow", "SFUI Test Attachments"]
AVATAR = "/assets/frappe/images/default-avatar.png"  # preset so User.on_update does not enqueue update_gravatar (outbound HTTP)


# ---- fixtures (pure; no frappe) -------------------------------------------------------------------------------------


def doctype_fixture(name: str) -> dict:
	fx = G.load_fixture(f"doctype-{name.lower().replace(' ', '-')}.json")
	perms = G.load_fixture("staging/permissions.json")
	overlay = G.load_fixture("staging/overlay.json")
	fx["permissions"] = [dict(p) for p in perms.get(name, [])]
	for field in fx["fields"]:
		field.update(overlay["field_patches"].get(name, {}).get(field["fieldname"], {}))
	fx.update(overlay["doctype_patches"].get(name, {}))
	return fx


def workflow_fixture() -> dict:
	wf = G.load_fixture("workflow.json")
	role_map = G.load_fixture("staging/overlay.json")["workflow_role_map"]
	for s in wf["workflow"]["states"]:
		s["allow_edit"] = role_map.get(s["allow_edit"], s["allow_edit"])
	for t in wf["workflow"]["transitions"]:
		t["allowed"] = role_map.get(t["allowed"], t["allowed"])
	return wf


def accounts(with_sysmgr: bool) -> dict:
	u = G.load_fixture("staging/users.json")
	acc = dict(u["accounts"])
	if with_sysmgr:
		acc["sysmgr"] = u["optional"]["sysmgr"]
	return acc


def plan_text(site: str, with_sysmgr: bool) -> str:
	rec = G.load_fixture("staging/records.json")
	contacts = G.load_fixture("records.json")["contacts"]
	lines = [f"PLAN for STAGING site {site} (nothing is executed in this mode; frappe is not imported)", ""]
	lines.append(f"Module Def {MODULE} (custom=1)")
	lines.append("Roles: " + ", ".join(r["role_name"] for r in G.load_fixture("staging/roles.json")))
	for d in DOCTYPES:
		fx = doctype_fixture(d)
		lines.append(f"DocType {d}: {len(fx['fields'])} fields, {len(fx['permissions'])} permission rows (custom=1)")
	wf = workflow_fixture()
	lines.append(f"Workflow {wf['workflow']['workflow_name']!r}: {len(wf['workflow']['transitions'])} transitions "
		f"(roles remapped: {G.load_fixture('staging/overlay.json')['workflow_role_map']})")
	for k, a in accounts(with_sysmgr).items():
		lines.append(f"Account {k}: {a['email']} roles={a['roles']}" + (" + User Permissions" if a.get("user_permissions") else ""))
	p = rec["parents"]
	lines.append(f"Records: {contacts['count']} contacts, {p['count']} parents (every {p['submit_every']}th submitted), "
		f"{len(rec['workflow_docs'])} workflow docs, 1 attachments doc, print format {rec['print_format']['name']!r}, "
		f"letter head {rec['letter_head']['letter_head_name']!r}, e-mail template {rec['email_template']['name']!r}, "
		f"Kanban board {rec['kanban_board']['kanban_board_name']!r}, {len(rec['list_filters'])} saved filters, tags, assignments")
	lines.append("Private files (mode 600): manifest.json, accounts.json (passwords, never printed), expected.json")
	return "\n".join(lines)


# ---- entry ----------------------------------------------------------------------------------------------------------


def main(argv: list[str]) -> int:
	args = [a for a in argv if not a.startswith("--")]
	flags = {a for a in argv if a.startswith("--")}
	if len(args) != 2 or flags - {"--preflight", "--apply", "--with-system-manager"} or {"--preflight", "--apply"} <= flags:
		print(USAGE, file=sys.stderr)
		return 64
	site, private_arg = args
	with_sysmgr = "--with-system-manager" in flags
	G.check_site(site)
	G.check_cwd()
	private = G.check_private_dir(private_arg)
	if not flags & {"--preflight", "--apply"}:
		print(plan_text(site, with_sysmgr))
		return 0
	approval = G.read_approval(private, site, need_write="--apply" in flags)
	print(f"approval: {approval['approved_by']} at {approval['approved_at']} for {approval['site']} ({approval['url']})")
	G.no_frappe_guard()
	import frappe  # noqa: E402  (first contact with a bench; everything above is local)

	if "--preflight" in flags:
		return preflight(frappe, site)
	return apply(frappe, site, private, with_sysmgr)


def _connect(frappe, site: str, read_only: bool):
	frappe.init(site=site, sites_path=".")
	frappe.connect()
	G.check_connected(frappe, site)
	frappe.set_user("Administrator")
	if read_only:
		frappe.flags.read_only = True
		frappe.db.rollback()
		frappe.db.begin(read_only=True)


def collisions(frappe, with_sysmgr: bool) -> list[str]:
	rec = G.load_fixture("staging/records.json")
	bad = []
	if frappe.db.exists("Module Def", MODULE):
		bad.append(f"Module Def {MODULE!r} exists")
	for r in G.load_fixture("staging/roles.json"):
		if frappe.db.exists("Role", r["role_name"]):
			bad.append(f"Role {r['role_name']!r} exists")
	for d in DOCTYPES:
		if frappe.db.exists("DocType", d):
			bad.append(f"DocType {d!r} exists")
	for t in frappe.db.sql("show tables like 'tabSFUI Test%'"):
		bad.append(f"table {t[0]!r} exists")
	if frappe.db.exists("Workflow", workflow_fixture()["workflow"]["workflow_name"]):
		bad.append("the SFUI workflow exists")
	for k, a in accounts(with_sysmgr).items():
		if frappe.db.exists("User", a["email"]):
			bad.append(f"User {a['email']!r} exists")
	for dt, name in (("Print Format", rec["print_format"]["name"]), ("Letter Head", rec["letter_head"]["letter_head_name"]),
			("Email Template", rec["email_template"]["name"]), ("Kanban Board", rec["kanban_board"]["kanban_board_name"])):
		if frappe.db.exists(dt, name):
			bad.append(f"{dt} {name!r} exists")
	return bad


def preflight(frappe, site: str) -> int:
	_connect(frappe, site, read_only=True)
	try:
		print("connected site:", frappe.local.site)
		print("frappe version:", getattr(frappe, "__version__", "?"))
		print("installed apps:", ", ".join(frappe.get_installed_apps()))
		print("host_name:", frappe.conf.get("host_name") or "(not set)")
		print("db_host:", frappe.conf.get("db_host") or "localhost", "(the owner confirms it is NOT a production database server)")
		for k in ("redis_cache", "redis_queue", "redis_socketio"):
			print(f"{k}:", frappe.conf.get(k) or "(bench default)", "(must not be shared with production)")
		print("User count:", frappe.db.count("User"))
		bad = collisions(frappe, with_sysmgr=True)
		for b in bad:
			print("COLLISION:", b)
		print("preflight:", "FAILED" if bad else "ok (no name collisions)")
		return 1 if bad else 0
	finally:
		frappe.db.rollback()
		frappe.destroy()


# ---- writes ---------------------------------------------------------------------------------------------------------


class Manifest:
	"""Every object, written BEFORE the call (status 'pending') and flipped to 'created' after it."""

	def __init__(self, private, site):
		self.path = private / "manifest.json"
		self.data = {"site": site, "started_at": time.strftime("%Y-%m-%d %H:%M:%S"), "items": []}
		self.save()

	def save(self):
		G.write_private(self.path, self.data)

	def intent(self, kind, doctype, name):
		item = {"kind": kind, "doctype": doctype, "name": name, "status": "pending"}
		self.data["items"].append(item)
		self.save()
		return item

	def done(self, item, name=None):
		if name:
			item["name"] = name
		item["status"] = "created"
		self.save()


def apply(frappe, site: str, private, with_sysmgr: bool) -> int:
	from frappe.desk.doctype.tag.tag import add_tag
	from frappe.desk.form.assign_to import add as assign
	from frappe.utils.password import update_password

	if (private / "manifest.json").exists():
		G.refuse("manifest.json already exists in the private directory: run staging-teardown.py --execute first")
	_connect(frappe, site, read_only=False)
	frappe.flags.mute_emails = True
	bad = collisions(frappe, with_sysmgr)
	if bad:
		for b in bad:
			print("COLLISION:", b)
		G.refuse("planned names already exist; nothing is adopted")
	man = Manifest(private, site)
	started = time.time()

	def create(doctype, doc_dict, key=None, **kw):
		item = man.intent("created", doctype, key or doc_dict.get("name") or "pending")
		doc = frappe.get_doc({"doctype": doctype, **doc_dict} if "doctype" not in doc_dict else doc_dict)
		doc.insert(ignore_permissions=True, **kw)
		frappe.db.commit()
		man.done(item, doc.name)
		return doc

	# 1. module, roles, doctypes, workflow
	create("Module Def", G.load_fixture("module.json"))
	for r in G.load_fixture("staging/roles.json"):
		create("Role", {k: v for k, v in r.items() if k != "purpose"})
	for d in DOCTYPES:
		create("DocType", doctype_fixture(d))
		item = man.intent("created", "table", f"tab{d}")
		man.done(item)
	overlay = G.load_fixture("staging/overlay.json")
	for dt_name, links in overlay["after_create_links"].items():  # connections: needs the target DocType to exist
		item = man.intent("modified", "DocType", dt_name)
		dt = frappe.get_doc("DocType", dt_name)
		for link in links:
			dt.append("links", link)
		dt.save(ignore_permissions=True)
		frappe.db.commit()
		man.done(item)
	wf = workflow_fixture()
	for s in wf["workflow_states"]:
		if not frappe.db.exists("Workflow State", s["workflow_state_name"]):
			create("Workflow State", {"doctype": "Workflow State", **s})
	for a in wf["workflow_actions"]:
		if not frappe.db.exists("Workflow Action Master", a):
			create("Workflow Action Master", {"doctype": "Workflow Action Master", "workflow_action_name": a})
	create("Workflow", wf["workflow"])

	# 2. accounts (random passwords → accounts.json only)
	acc = accounts(with_sysmgr)
	creds = {}
	for key, a in acc.items():
		item = man.intent("created", "User", a["email"])
		user = frappe.get_doc({
			"doctype": "User", "email": a["email"], "first_name": a["first_name"], "last_name": a["last_name"],
			"enabled": 1, "send_welcome_email": 0, "user_image": AVATAR, "roles": [{"role": r} for r in a["roles"]],
		})
		user.flags.no_welcome_mail = True
		user.insert(ignore_permissions=True)
		pwd = secrets.token_urlsafe(24)
		update_password(a["email"], pwd)
		if frappe.db.exists("Notification Settings", a["email"]):
			frappe.db.set_value("Notification Settings", a["email"], "enable_email_notifications", 0)
		frappe.db.commit()
		man.done(item)
		creds[key] = {"usr": a["email"], "pwd": pwd}
	G.write_private(private / "accounts.json", {"site": site, "accounts": creds, "note": "synthetic accounts; delete after the run"})
	email_of = {k: a["email"] for k, a in acc.items()}

	# 3. contacts (reused pattern), User Permissions
	cs = G.load_fixture("records.json")["contacts"]
	contacts = [None]
	for n in range(1, cs["count"] + 1):
		doc = create("SFUI Test Contact", {"contact_name": cs["name_pattern"].format(n=n), "email_id": cs["email_pattern"].format(n=n),
			"status": cs["status_cycle"][(n - 1) % len(cs["status_cycle"])]}, key=f"contact-{n}")
		contacts.append(doc.name)
	for key, a in acc.items():
		up = a.get("user_permissions")
		if not up:
			continue
		for idx in up["contact_indexes"]:
			create("User Permission", {"user": a["email"], "allow": up["allow"], "for_value": contacts[idx],
				"apply_to_all_doctypes": up["apply_to_all_doctypes"]}, key=f"{key}->{idx}")

	# 4. parents (dates, statuses, child rows, tags, assignments, submitted ones, permlevel-1 value)
	rec = G.load_fixture("staging/records.json")
	p = rec["parents"]
	d0 = date.fromisoformat(p["due_date_start"])
	parents = []
	with_child_rows = 0
	tags_made = set()
	for n in range(1, p["count"] + 1):
		i = n - 1
		items = [{"item_code": f"SFUI-ITEM-{k + 1:02d}", "qty": k + 1, "rate": 10 * (k + 1), "kind": "Normal" if k % 2 else "Special",
			"special_note": "SFUI note"} for k in range(p["items_cycle"][i % len(p["items_cycle"])])]
		with_child_rows += bool(items)
		doc = create("SFUI Test Parent", {
			"title": p["title_pattern"].format(n=n), "status": p["status_cycle"][i % len(p["status_cycle"])],
			"contact": contacts[p["contact_indexes_cycle"][i % len(p["contact_indexes_cycle"])]],
			"due_date": (d0 + timedelta(days=i * p["due_date_step_days"])).isoformat(),
			"level1_field": p["level1_value"], "items": items,
		}, key=f"parent-{n}")
		frappe.db.set_value("SFUI Test Parent", doc.name, "owner", email_of[p["owner_cycle"][i % len(p["owner_cycle"])]], update_modified=False)
		for tag in p["tags_cycle"][i % len(p["tags_cycle"])]:
			if tag not in tags_made and not frappe.db.exists("Tag", tag):
				item = man.intent("created", "Tag", tag)
				tags_made.add(tag)
				add_tag(tag, "SFUI Test Parent", doc.name)
				man.done(item)
			else:
				add_tag(tag, "SFUI Test Parent", doc.name)
		users = [email_of[k] for k in p["assign_cycle"][i % len(p["assign_cycle"])]]
		if users:
			assign({"assign_to": users, "doctype": "SFUI Test Parent", "name": doc.name, "description": "SFUI P36 assignment"}, ignore_permissions=True)
		if n % p["submit_every"] == 0:
			doc.reload()
			doc.submit()
		frappe.db.commit()
		parents.append(doc.name)

	# 5. workflow docs, attachments doc, print format, letter head, e-mail template, Kanban board, saved filters
	wf_names = {}
	for w in rec["workflow_docs"]:
		doc = create("SFUI Test Workflow", {"subject": w["subject"], "amount": w["amount"], "workflow_state": "SFUI Draft"}, key=w["key"])
		frappe.db.set_value("SFUI Test Workflow", doc.name, "owner", email_of[w["owner"]], update_modified=False)
		frappe.db.commit()
		wf_names[w["key"]] = doc.name
	att = create("SFUI Test Attachments", {"title": rec["attachments_doc"]["title"]}, key="attachments")
	pf = create("Print Format", dict(rec["print_format"]))
	lh = create("Letter Head", dict(rec["letter_head"]))
	et = create("Email Template", dict(rec["email_template"]))
	kb = create("Kanban Board", dict(rec["kanban_board"]))
	lfs = {}
	for lf in rec["list_filters"]:
		doc = create("List Filter", {"reference_doctype": "SFUI Test Parent", "filter_name": lf["filter_name"],
			"for_user": email_of[lf["for_user"]] if lf["for_user"] else "", "filters": lf["filters"]}, key=lf["key"])
		frappe.db.set_value("List Filter", doc.name, "owner", email_of["manager"], update_modified=False)
		frappe.db.commit()
		lfs[lf["key"]] = doc.name

	# 6. expected answers, computed HERE from what was inserted (not by asking the site to filter)
	rows = frappe.get_all("SFUI Test Parent", fields=["name", "status", "contact", "due_date", "docstatus", "_user_tags", "_assign", "owner"], limit=0)
	allowed = {contacts[i] for i in acc["restricted"]["user_permissions"]["contact_indexes"]}
	tag_count = lambda t: sum(t in (r._user_tags or "").split(",") for r in rows)
	assigned = lambda e: sum(e in (r._assign or "") for r in rows)
	expected = {
		"site": site,
		"names": {"contacts": contacts[1:], "parents": parents, "workflow": wf_names, "attachments": att.name,
			"print_format": pf.name, "letter_head": lh.name, "email_template": et.name, "kanban_board": kb.name, "list_filters": lfs},
		"accounts": {k: v["usr"] for k, v in creds.items()},
		"parents": {
			"total": len(rows),
			"with_child_rows": with_child_rows,
			"by_status": {s: sum(r.status == s for r in rows) for s in p["status_cycle"]},
			"by_docstatus": {str(d): sum(r.docstatus == d for r in rows) for d in (0, 1, 2)},
			"tags": {t: tag_count(t) for t in ("sfui-red", "sfui-blue")},
			"assigned": {k: assigned(email_of[k]) for k in ("writer", "manager")},
			"restricted_visible": sum(r.contact in allowed for r in rows),
			"due_in_dec_2026": sum(bool(r.due_date) and str(r.due_date).startswith("2026-12") for r in rows),
			"draft_owned_by_writer": [r.name for r in rows if r.docstatus == 0 and r.owner == email_of["writer"]],
			"submitted": [r.name for r in rows if r.docstatus == 1],
			"restricted_allowed": [r.name for r in rows if r.contact in allowed],
			"restricted_hidden": [r.name for r in rows if r.contact not in allowed],
		},
		"contacts": {"total": cs["count"], "restricted_visible": len(allowed), "allowed": sorted(allowed),
			"linked_by_parents": {c: sum(r.contact == c for r in rows) for c in contacts[1:7]}},
		"level1_value": p["level1_value"],
		"print_marker": "SFUI-P36-PRINT-MARKER", "letterhead_marker": "SFUI-P36-LETTERHEAD", "template_marker": "SFUI-P36-TEMPLATE",
	}
	G.write_private(private / "expected.json", expected)
	man.data["finished_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
	man.save()
	print(f"seeded in {time.time() - started:.0f}s: {len(rows)} parents, {cs['count']} contacts, {len(creds)} accounts. "
		f"manifest, accounts (mode 600) and expected totals are in the private directory")
	frappe.destroy()
	return 0


if __name__ == "__main__":
	sys.exit(main(sys.argv[1:]))
