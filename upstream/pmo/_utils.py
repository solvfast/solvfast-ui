"""Shared helpers for the solvfast_pmo whitelisted API layer.

Every public data call the React app makes lands at ``solvfast_pmo.api.<fn>`` (see ``api/__init__.py``
which re-exports each wave module). These helpers keep the response envelopes and the server-side access
checks consistent across waves. Access control is enforced HERE (server-side) per architecture.md §RBAC;
the frontend RBAC only mirrors it for UX.
"""

import frappe
from frappe import _


# ---- response envelopes -------------------------------------------------------------------------

def page_bounds(page=1, page_size=20):
	"""Return (limit_start, limit_page_length) for frappe.get_list from 1-based page + size."""
	page = max(1, int(page or 1))
	page_size = max(1, min(200, int(page_size or 20)))
	return (page - 1) * page_size, page_size


def list_response(items, total, page=1, page_size=20):
	"""Collection envelope used by every list_* endpoint: { items, total, page, page_size }."""
	return {"items": items, "total": total, "page": int(page or 1), "page_size": int(page_size or 20)}


# ---- identity / roles ---------------------------------------------------------------------------

def current_user():
	return frappe.session.user


def user_roles(user=None):
	return set(frappe.get_roles(user or frappe.session.user))


def has_role(*roles):
	"""True if the session user holds ANY of the given roles (System Manager always passes)."""
	mine = user_roles()
	return "System Manager" in mine or any(r in mine for r in roles)


def ensure_role(*roles):
	"""Raise PermissionError unless the session user holds one of the roles (System Manager bypass)."""
	if not has_role(*roles):
		frappe.throw(_("You are not permitted to perform this action."), frappe.PermissionError)


def is_management():
	"""PMO Lead / Project Manager / Product Owner / System roles — the management tier used by dashboards
	& approvals. Product Owner is aliased to the PM tier for permissions (business.md §6.12)."""
	return has_role("PMO Lead", "Project Manager", "Product Owner", "System Manager")


def require(condition, message):
	"""Validation guard — raises a ValidationError with a translated message when condition is falsy."""
	if not condition:
		frappe.throw(_(message))


# ---- serialization ------------------------------------------------------------------------------

def doc_dict(doc, fields=None):
	"""A plain dict for a Document — optionally projected to a field subset (always includes name)."""
	d = doc.as_dict() if hasattr(doc, "as_dict") else dict(doc)
	if fields:
		keep = set(fields) | {"name"}
		d = {k: v for k, v in d.items() if k in keep}
	return d


def assignees_of(name, doctype="Task"):
	"""Resolve the `_assign` JSON on a doc to a list of user ids (assignment via ToDo)."""
	raw = frappe.db.get_value(doctype, name, "_assign")
	return frappe.parse_json(raw) if raw else []


# ---- dynamic (meta-driven) advanced filters -----------------------------------------------------
# The frontend AdvancedFilter builds a CRM-style FilterQuery over the doctype's REAL meta fields and
# sends it as `advanced` (JSON). We translate it to frappe.get_all conditions server-side so ANY field
# (not just the curated row keys) can be filtered. See api/meta.get_filter_fields for the field source.

_NUMERIC_FT = {"Int", "Float", "Currency", "Percent"}
_OP_MAP = {"equals": "=", "not_equals": "!=", "gt": ">", "lt": "<", "gte": ">=", "lte": "<="}
_TRUTHY = {"1", "true", "yes", "on"}


def _coerce(value, fieldtype):
	"""Coerce a string filter value to the column's stored type (Check → 0/1, numeric → float)."""
	if fieldtype == "Check":
		return 1 if str(value).strip().lower() in _TRUTHY else 0
	if fieldtype in _NUMERIC_FT:
		try:
			return float(value)
		except (TypeError, ValueError):
			return None
	return value


def _translate_condition(field, op, value, fieldtype):
	"""One FilterQuery condition → a frappe `[field, operator, value]` list (or None to skip)."""
	if op == "is_set":
		return [field, "is", "set"]
	if op == "is_not_set":
		return [field, "is", "not set"]

	if op in ("in", "not_in"):
		items = [s.strip() for s in str(value or "").split(",") if s.strip()]
		if not items:
			return None
		return [field, "in" if op == "in" else "not in", items]

	# Value-bearing operators: ignore half-built conditions with an empty value.
	if value is None or value == "":
		return None

	if op == "like":
		return [field, "like", f"%{value}%"]
	if op == "not_like":
		return [field, "not like", f"%{value}%"]

	coerced = _coerce(value, fieldtype)
	if coerced is None:
		return None
	if op in _OP_MAP:
		return [field, _OP_MAP[op], coerced]
	return None


def build_advanced_filters(doctype, advanced):
	"""Translate a frontend FilterQuery into (and_conditions, or_conditions) for frappe.get_all.

	Conditions reference REAL doctype fieldnames (meta-driven). The base/RBAC conditions are always AND-ed;
	when the query conjunction is OR, the advanced group is returned separately to pass as `or_filters`
	(frappe semantics: ``(base AND ...) AND (adv1 OR adv2)``). Returns ([], []) when there is nothing to add.
	"""
	if isinstance(advanced, str):
		advanced = frappe.parse_json(advanced) if advanced.strip() else None
	if not advanced:
		return [], []

	conjunction = (advanced.get("conjunction") or "and").lower()
	conditions = advanced.get("conditions") or []
	meta = frappe.get_meta(doctype)
	std = {"name", "creation", "modified", "owner", "modified_by", "idx"}

	out = []
	for c in conditions:
		field = c.get("field")
		op = c.get("operator")
		if not field or not op:
			continue
		df = None if field in std else meta.get_field(field)
		if field not in std and df is None:
			continue  # unknown field — ignore rather than error (meta drift safety)
		fieldtype = df.fieldtype if df else ("Datetime" if field in ("creation", "modified") else "Data")
		cond = _translate_condition(field, op, c.get("value"), fieldtype)
		if cond:
			out.append(cond)

	if not out:
		return [], []
	if conjunction == "or" and len(out) > 1:
		return [], out
	return out, []


def dict_to_conditions(query):
	"""Convert a base filter dict (scalar or ``[op, value]`` values) to a frappe condition list."""
	out = []
	for key, val in query.items():
		if isinstance(val, (list, tuple)) and len(val) == 2:
			out.append([key, val[0], val[1]])
		else:
			out.append([key, "=", val])
	return out


def safe_extra_fields(doctype, requested, base=None):
	"""Validate frontend-requested column fieldnames against the doctype meta — keep only REAL, scalar fields
	not already in ``base``. Powers metadata-driven columns: the list view can ask for any doctype field and
	we return its value, without allowing arbitrary/invalid field injection into the query."""
	if isinstance(requested, str):
		requested = [f.strip() for f in requested.split(",") if f.strip()]
	if not requested:
		return []
	meta = frappe.get_meta(doctype)
	base_set = set(base or [])
	std = {"name", "creation", "modified", "owner", "modified_by", "idx"}
	skip = {"Section Break", "Column Break", "Tab Break", "HTML", "HTML Editor", "Heading", "Fold",
		"Table", "Table MultiSelect", "Button", "Image", "Attach", "Attach Image", "Signature",
		"Geolocation", "Barcode", "Password", "JSON"}
	out = []
	for f in requested:
		if f in base_set or f in out:
			continue
		if f in std or (meta.has_field(f) and meta.get_field(f).fieldtype not in skip):
			out.append(f)
	return out


def query_with_advanced(doctype, base_query, advanced, fields, order_by, start=None, length=None):
	"""Run a list query merging base conditions + a meta-driven advanced FilterQuery, with a correct total.

	Returns (rows, total). Pagination is applied only when ``start``/``length`` are given.
	"""
	base = dict_to_conditions(base_query) if isinstance(base_query, dict) else list(base_query or [])
	and_conds, or_conds = build_advanced_filters(doctype, advanced)
	filters = base + and_conds
	or_filters = or_conds or None

	kwargs = {"filters": filters, "or_filters": or_filters, "fields": fields, "order_by": order_by}
	if start is not None:
		kwargs["limit_start"] = start
		kwargs["limit_page_length"] = length
	rows = frappe.get_all(doctype, **kwargs)

	if or_filters:
		total = len(frappe.get_all(doctype, filters=filters, or_filters=or_filters, pluck="name"))
	else:
		total = frappe.db.count(doctype, filters)
	return rows, total
