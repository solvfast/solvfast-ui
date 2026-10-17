"""
Seed a dedicated validation site for @solvfast/ui's Frappe layer — synthetic data only. PREPARED, NOT RUN (README.md).

    cd <bench>/sites
    ../env/bin/python <solvfast-ui>/e2e/frappe-site/seed.py sfui-test.localhost <private-dir>

Safety: refuses any site but `sfui-test.localhost`, a site with any app but `frappe`, or a site that already has ToDos.
Creates, on that site only:
- role "SFUI Validation Reader" (Desk access) with read / select / report on ToDo. ToDo's permissions are replaced by
  custom ones (System Manager + this role; the "All" rule is removed), so no account but Administrator can write ToDos;
- 4 synthetic users (@example.com) and the validation account sfui-validator@example.com, all with only that role.
  The account's password is random, written to <private-dir>/validator.json (mode 600) and never printed;
- 45 synthetic ToDos with fixed dates (none at midnight);
- <private-dir>/expected.json: the totals the List View must show, computed HERE in Python from the inserted rows —
  not by asking Frappe to filter, so the validation compares the package + Frappe against an independent answer.
"""
import json
import os
import secrets
import sys
from collections import Counter
from datetime import date, datetime, timedelta

SITE, OUT = sys.argv[1], sys.argv[2]
if SITE != "sfui-test.localhost":
	sys.exit("refusing: this script only seeds sfui-test.localhost")

import frappe  # noqa: E402
from frappe.permissions import add_permission, setup_custom_perms, update_permission_property  # noqa: E402
from frappe.utils.password import update_password  # noqa: E402

ROLE = "SFUI Validation Reader"
VALIDATOR = "sfui-validator@example.com"
USERS = [
	("sara@example.com", "Sara", "Al-Otaibi"),
	("khaled@example.com", "Khaled", "Al-Mutairi"),
	("omar@example.com", "Omar", "Al-Shehri"),
	("lina@example.com", "Lina", "Haddad"),
]
TASKS = [
	"Confirm hotel block for the Riyadh offsite", "Review visa documents for the Jeddah team",
	"Call the airline about group fares", "Update the corporate travel policy", "Approve expense report",
	"Prepare the quarterly booking summary", "Renew the travel insurance contract", "Collect passport copies",
	"Send the itinerary to the client", "Check the visa appointment slots", "Follow up on the refund",
	"Book meeting rooms for the workshop",
]
REFS = [("User", "sara@example.com"), ("DocType", "ToDo"), ("Role", ROLE), (None, None)]
D0 = date(2026, 10, 15)


def private_write(path, data):
	fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
	with os.fdopen(fd, "w") as f:
		json.dump(data, f, indent=1, default=str)


def main():
	os.makedirs(OUT, mode=0o700, exist_ok=True)
	os.chmod(OUT, 0o700)
	frappe.set_user("Administrator")
	frappe.flags.mute_emails = True

	if frappe.get_installed_apps() != ["frappe"]:
		sys.exit(f"refusing: installed apps are {frappe.get_installed_apps()}, expected only frappe")
	if frappe.db.count("ToDo"):
		sys.exit("refusing: the site already has ToDos")

	# read-only role on ToDo; ToDo's standard rules replaced by custom ones without the "All" rule
	if not frappe.db.exists("Role", ROLE):
		frappe.get_doc({"doctype": "Role", "role_name": ROLE, "desk_access": 1}).insert(ignore_permissions=True)
	setup_custom_perms("ToDo")
	for name in frappe.get_all("Custom DocPerm", filters={"parent": "ToDo", "role": "All"}, pluck="name"):
		frappe.delete_doc("Custom DocPerm", name, ignore_permissions=True)
	add_permission("ToDo", ROLE, 0)  # read
	for ptype in ("select", "report"):
		update_permission_property("ToDo", ROLE, 0, ptype, 1)
	frappe.clear_cache(doctype="ToDo")

	for email, first, last in USERS + [(VALIDATOR, "SFUI", "Validator")]:
		if not frappe.db.exists("User", email):
			user = frappe.get_doc({
				"doctype": "User", "email": email, "first_name": first, "last_name": last,
				"send_welcome_email": 0, "roles": [{"role": ROLE}],
			})
			user.flags.no_welcome_mail = True
			user.insert(ignore_permissions=True)
	password = secrets.token_urlsafe(24)
	update_password(VALIDATOR, password)
	private_write(os.path.join(OUT, "validator.json"), {"usr": VALIDATOR, "pwd": password})

	for i in range(45):
		ref_type, ref_name = REFS[i % len(REFS)]
		suffix = f" ({i // len(TASKS) + 1})" if i >= len(TASKS) else ""
		doc = frappe.get_doc({
			"doctype": "ToDo",
			"status": "Cancelled" if i % 7 == 0 else "Closed" if i % 3 == 0 else "Open",
			"priority": ["High", "Medium", "Low"][i % 3],
			"date": None if i % 5 == 4 else D0 + timedelta(days=(i % 11) - 4),
			"description": f"<p>{TASKS[i % len(TASKS)]}{suffix}</p>",
			"reference_type": ref_type, "reference_name": ref_name,
			"allocated_to": USERS[i % 4][0], "assigned_by": USERS[(i + 1) % 4][0],
		}).insert(ignore_permissions=True)
		creation = datetime.combine(D0 - timedelta(days=20 - (i % 15)), datetime.min.time()) + timedelta(hours=i % 10, minutes=15)
		modified = datetime.combine(D0 - timedelta(days=6 - (i % 6)), datetime.min.time()) + timedelta(hours=10 + i % 10, minutes=i % 60)
		frappe.db.set_value("ToDo", doc.name, {"creation": creation, "modified": modified}, update_modified=False)
	frappe.db.commit()

	# expected answers, computed in Python from what was inserted
	rows = frappe.get_all("ToDo", fields=["name", "status", "priority", "date", "description", "reference_type",
		"reference_name", "allocated_to", "creation"], limit=0)
	low = lambda v: str(v or "").lower()  # MariaDB's default collation compares case-insensitively
	search_fields = ["description", "reference_type", "reference_name", "name"]
	due = Counter(r.date for r in rows if r.date).most_common(1)[0][0]
	created = Counter(r.creation.date() for r in rows).most_common(1)[0][0]
	expected = {
		"total": len(rows),
		"search": {"text": "visa", "fields": search_fields,
			"count": sum(any("visa" in low(r[f]) for f in search_fields) for r in rows)},
		"match_any": {"status": "Open", "priority": "High", "count": sum(r.status == "Open" or r.priority == "High" for r in rows)},
		"match_all": {"count": sum(r.status == "Open" and r.priority == "High" for r in rows)},
		"link": {"field": "allocated_to", "value": "sara@example.com", "count": sum(r.allocated_to == "sara@example.com" for r in rows)},
		"due_on": {"date": due.isoformat(), "count": sum(r.date == due for r in rows)},
		"created_on": {"date": created.isoformat(), "count": sum(r.creation.date() == created for r in rows),
			"at_midnight": sum(r.creation == datetime.combine(created, datetime.min.time()) for r in rows)},
		"open": {"count": sum(r.status == "Open" for r in rows)},
		"users": [u[0] for u in USERS],
		"a_todo": rows[0].name,
		"role": ROLE,
	}
	private_write(os.path.join(OUT, "expected.json"), expected)
	print(f"seeded {len(rows)} ToDos, {len(USERS) + 1} users, role {ROLE!r}; expected totals and the validation "
		f"account's credentials written to {OUT} (mode 600)")


frappe.init(site=SITE, sites_path=".")
frappe.connect()
try:
	main()
finally:
	frappe.destroy()
