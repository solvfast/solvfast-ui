"""Read-only capture of real DocType metadata from a Frappe site, for the 0.4.0 contract fixtures.

Usage (from the bench's sites/ folder, with the bench's Python):
    ../env/bin/python <solvfast-ui>/scripts/capture-real-meta.py <site> <outdir> <DocType> [<DocType> ...]

Safety:
- the database transaction is READ ONLY (`frappe.db.begin(read_only=True)`) and is rolled back;
- only `frappe.desk.form.load.getdoctype` is called (metadata). `getdoc` is never called: it writes
  `_seen` and View Log entries;
- no record contents are read; the only files written are JSON files in <outdir>.
"""

import json
import os
import sys

site, out, doctypes = sys.argv[1], sys.argv[2], sys.argv[3:]

import frappe  # noqa: E402

frappe.init(site=site, sites_path=".")
frappe.connect()
try:
	frappe.set_user("Administrator")
	frappe.flags.read_only = True
	frappe.db.rollback()
	frappe.db.begin(read_only=True)
	from frappe.desk.form.load import getdoctype

	os.makedirs(out, exist_ok=True)
	for lang in ("en", "ar"):
		frappe.local.lang = lang
		for dt in doctypes:
			frappe.local.response = frappe._dict({"docs": []})
			getdoctype(dt)
			data = json.loads(frappe.as_json({"docs": frappe.local.response.get("docs")}))
			name = f"{dt.lower().replace(' ', '_')}.{lang}.json"
			with open(os.path.join(out, name), "w") as f:
				json.dump(data, f, indent=1, sort_keys=True, ensure_ascii=False)
			print(f"captured {dt} [{lang}]: {len(data['docs'] or [])} meta docs")
finally:
	frappe.db.rollback()
	frappe.destroy()
