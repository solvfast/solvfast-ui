"""Read-only capture of REAL Frappe 15.110 responses from Sada DocTypes, for the 0.4.0 real-response tests.

Usage (from the bench's sites/ folder, with the bench's Python):
    ../env/bin/python <solvfast-ui>/scripts/capture-real-sada.py internal.solvfaster.com <outdir>

Safety:
- the whole run is one READ ONLY transaction (`frappe.db.begin(read_only=True)`), rolled back at the end: any write a
  "read" endpoint attempted would raise, so a clean run proves these calls are side-effect free for these DocTypes;
- Sada DocTypes have track_seen = track_views = 0 and no onload hooks, so getdoc writes neither _seen nor View Log;
- record CONTENTS are captured only for configuration DocTypes (Sada Post Type, Sada Lifecycle) — demo/config data.
  Sada Brand / Post / Asset (business content): metadata only;
- every e-mail address and full name in the output is replaced by a stable pseudonym (user-N@example.invalid).
"""

import json
import os
import re
import sys

site, out = sys.argv[1], sys.argv[2]

import frappe  # noqa: E402

frappe.init(site=site, sites_path=".")
frappe.connect()
captured = {}
try:
	frappe.set_user("Administrator")
	frappe.flags.read_only = True
	frappe.db.rollback()
	frappe.db.begin(read_only=True)
	from frappe.client import validate_link
	from frappe.desk.form.load import getdoc, getdoctype
	from frappe.desk.reportview import get as reportview_get
	from frappe.desk.reportview import get_count
	from frappe.desk.search import search_link
	from frappe.permissions import get_doc_permissions

	def meta(dt):
		frappe.local.response = frappe._dict({"docs": []})
		getdoctype(dt)
		return {"docs": frappe.local.response.get("docs"), "user_settings": frappe.local.response.get("user_settings")}

	def report(dt, fields, **kw):
		frappe.local.form_dict = frappe._dict(
			doctype=dt, fields=json.dumps(fields), filters=json.dumps(kw.get("filters", [])), order_by=f"`tab{dt}`.`modified` desc",
			start=0, page_length=20, with_comment_count=1,
		)
		return {"message": reportview_get()}

	def count(dt):
		frappe.local.form_dict = frappe._dict(doctype=dt, filters="[]", fields="[]", distinct=False, limit=1001)
		return {"message": get_count()}

	def doc(dt, name):
		frappe.local.response = frappe._dict({"docs": []})
		getdoc(dt, name)
		return {"docs": frappe.local.response.get("docs"), "docinfo": frappe.local.response.get("docinfo")}

	for dt in ("Sada Post Type", "Sada Lifecycle", "Sada Brand", "Sada Post", "Sada Asset", "Sada Content Configuration"):
		captured[f"getdoctype::{dt}"] = meta(dt)

	captured["reportview.get::Sada Post Type"] = report("Sada Post Type", ["`tabSada Post Type`.`name`", "`tabSada Post Type`.`type_name`", "`tabSada Post Type`.`is_active`", "`tabSada Post Type`.`lifecycle`", "`tabSada Post Type`.`modified`", "`tabSada Post Type`.`docstatus`", "`tabSada Post Type`.`_assign`", "`tabSada Post Type`.`_comments`", "`tabSada Post Type`.`_liked_by`"])
	captured["reportview.get::Sada Lifecycle"] = report("Sada Lifecycle", ["`tabSada Lifecycle`.`name`", "`tabSada Lifecycle`.`lifecycle_name`", "`tabSada Lifecycle`.`entity`", "`tabSada Lifecycle`.`modified`"])
	captured["reportview.get::Sada Post Type::filtered-empty"] = report("Sada Post Type", ["`tabSada Post Type`.`name`"], filters=[["Sada Post Type", "type_name", "=", "__no_such_value__"]])
	captured["reportview.get_count::Sada Post Type"] = count("Sada Post Type")
	captured["reportview.get_count::Sada Lifecycle"] = count("Sada Lifecycle")
	captured["search_link::Sada Post Type::"] = {"message": search_link("Sada Post Type", "", page_length=10)}
	captured["search_link::Sada Lifecycle::lc"] = {"message": search_link("Sada Lifecycle", "lc", page_length=10)}
	captured["validate_link::Sada Lifecycle::lc-post-default"] = {"message": validate_link("Sada Lifecycle", "lc-post-default", ["lifecycle_name", "entity"])}
	captured["validate_link::Sada Lifecycle::missing"] = {"message": validate_link("Sada Lifecycle", "no-such-lifecycle", ["lifecycle_name"])}
	from frappe.desk.listview import get_list_settings
	for dt in ("Sada Post Type", "Sada Lifecycle"):
		captured[f"get_list_settings::{dt}"] = {"message": get_list_settings(dt)}
	captured["getdoc::Sada Post Type::post Type1"] = doc("Sada Post Type", "post Type1")
	captured["getdoc::Sada Lifecycle::lc-post-default"] = doc("Sada Lifecycle", "lc-post-default")

	# Server-side permission outcomes, computed (not impersonated) for every enabled holder of a Sada role.
	users = frappe.get_all("Has Role", filters={"role": ["like", "Sada %"], "parenttype": "User"}, pluck="parent", distinct=True)
	perms = []
	for user in sorted(set(users)):
		if not frappe.db.get_value("User", user, "enabled"):
			continue
		entry = {"user": user, "roles": frappe.get_roles(user), "doc_permissions": {}}
		for dt, name in (("Sada Post Type", "post Type1"), ("Sada Lifecycle", "lc-post-default")):
			d = frappe.get_doc(dt, name)
			entry["doc_permissions"][dt] = get_doc_permissions(d, user=user)
		perms.append(entry)
	captured["permissions::sada-role-holders"] = perms
	captured["_meta"] = {"frappe": frappe.__version__, "site": site, "read_only_transaction": True}
	# Frappe's own serialiser (Document → dict), while the site is still connected
	text = frappe.as_json(captured, indent=None)
finally:
	frappe.db.rollback()
	frappe.destroy()

# ---- pseudonymise e-mails and full names ------------------------------------------------------------------------------
emails = sorted(set(re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text)))
mapping = {e: f"user-{i + 1}@example.invalid" for i, e in enumerate(emails)}
for e, p in mapping.items():
	text = text.replace(e, p)
data = json.loads(text)


def scrub_names(node):
	if isinstance(node, dict):
		for k, v in list(node.items()):
			if k in ("fullname", "full_name", "first_name", "last_name", "name") and isinstance(v, str) and isinstance(node.get("image", None), (str, type(None))) and "fullname" in node:
				node[k] = "Pseudonymised User"
			elif k == "image" and "fullname" in node:
				node[k] = None
			else:
				scrub_names(v)
	elif isinstance(node, list):
		for v in node:
			scrub_names(v)


scrub_names(data)
os.makedirs(out, exist_ok=True)
with open(os.path.join(out, "sada-real-responses.json"), "w") as f:
	json.dump(data, f, indent=1, sort_keys=True, ensure_ascii=False)
print(f"captured {len(captured)} entries; pseudonymised {len(mapping)} e-mail addresses")
