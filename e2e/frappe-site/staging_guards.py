"""
P36 guards shared by staging-seed.py and staging-teardown.py.  PREPARED, NOT RUN against any site.

This module imports NOTHING from frappe, so every refusal path can be exercised without a bench or a site
(tests/frappe-site-guards.test.ts runs them with /usr/bin/python3 -I, where frappe is not importable).

A run is allowed only when ALL hold, checked BEFORE `import frappe`:
  1. the site argument is in the explicit allowlist SFUI_STAGING_SITE (comma-separated) and neither it nor any
     allowlist entry is production (production-denylist.json: exact names, suffixes, loopback);
  2. the current directory is not inside one of the production benches of the shared server;
  3. the private directory (outside this repository and every git work tree) exists with mode 700;
  4. <private>/APPROVED_STAGING (JSON, mode 600) names this site, a URL, approved_by, approved_at (<= 30 days old) and
     isolated_from_production: true; writes additionally need allow_write: true;
  5. writing is explicit (--apply / --execute); the default prints a plan and never imports frappe.
After connecting, the seed re-checks frappe.local.site and the site's host_name against the same deny list.
"""
from __future__ import annotations

import json
import os
import stat
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
FIXTURES = HERE / "fixtures"
DENYLIST = json.loads((HERE / "production-denylist.json").read_text())
APPROVAL_FILE = "APPROVED_STAGING"
MAX_APPROVAL_AGE_DAYS = 30
P36_RULE = (
	"P36 rule: no script may touch a production site; real-site validation runs only on an owner-approved, isolated "
	"STAGING site (e2e/frappe-site/README.md)"
)


class Refused(SystemExit):
	pass


def refuse(msg: str):
	print(f"REFUSED: {msg}", file=sys.stderr)
	raise Refused(2)


def normalize_host(name: str) -> str:
	h = str(name or "").strip().lower()
	if h.startswith("["):
		h = h[1 : h.index("]")] if "]" in h else h[1:]
	elif h.count(":") == 1:
		h = h.split(":")[0]
	return h.rstrip(".")


def production_reason(name: str) -> str | None:
	h = normalize_host(name)
	if not h:
		return "empty name"
	if h in DENYLIST["exact"]:
		return f"{h} is a production site on the shared server (production-denylist.json)"
	for s in DENYLIST["suffixes"]:
		if h.endswith(s):
			return f"{h} matches the production domain *{s}"
	if h in DENYLIST["loopback"] or any(h.startswith(p) for p in DENYLIST["loopback_prefixes"]):
		return f"{h} is loopback / unspecified"
	return None


def check_site(site: str, env=None) -> list[str]:
	env = os.environ if env is None else env
	allow = [s.strip() for s in (env.get("SFUI_STAGING_SITE") or "").split(",") if s.strip()]
	if not allow:
		refuse("SFUI_STAGING_SITE (the explicit allowlist of staging site names) is not set. " + P36_RULE)
	for s in allow:
		why = production_reason(s)
		if why:
			refuse(f"SFUI_STAGING_SITE entry refused: {why}. {P36_RULE}")
	why = production_reason(site)
	if why:
		refuse(f"site refused: {why}. {P36_RULE}")
	if site not in allow:
		refuse(f"site {site!r} is not in SFUI_STAGING_SITE")
	return allow


def check_cwd(cwd: str | None = None):
	here = Path(cwd or os.getcwd()).resolve()
	for bench in DENYLIST["production_benches"]:
		b = Path(bench)
		if here == b or b in here.parents:
			refuse(f"the current directory is inside the production bench {bench}. {P36_RULE}")


def _git_ancestor(p: Path):
	for d in (p, *p.parents):
		if (d / ".git").exists():
			return d
	return None


def check_private_dir(path: str, create: bool = False) -> Path:
	if not path:
		refuse("no private directory given")
	p = Path(path).resolve()
	if p == REPO_ROOT or REPO_ROOT in p.parents:
		refuse("the private directory must be outside this repository (credentials and the manifest live there)")
	g = _git_ancestor(p)
	if g:
		refuse(f"the private directory must be outside every git work tree (found one at {g})")
	if not p.exists():
		if not create:
			refuse(f"private directory {p} does not exist")
		p.mkdir(mode=0o700, parents=True)
	if not p.is_dir():
		refuse(f"{p} is not a directory")
	if stat.S_IMODE(p.stat().st_mode) != 0o700:
		refuse(f"private directory {p} must be mode 700 (is {oct(stat.S_IMODE(p.stat().st_mode))})")
	return p


def read_approval(private: Path, site: str, need_write: bool, now: datetime | None = None) -> dict:
	f = private / APPROVAL_FILE
	if not f.is_file():
		refuse(f"no {APPROVAL_FILE} in {private}: the owner's written approval of the staging site is required")
	if stat.S_IMODE(f.stat().st_mode) & 0o077:
		refuse(f"{APPROVAL_FILE} must be mode 600")
	try:
		a = json.loads(f.read_text())
	except ValueError:
		refuse(f"{APPROVAL_FILE} is not valid JSON")
	for k in ("site", "url", "approved_by", "approved_at"):
		if not isinstance(a.get(k), str) or not a.get(k):
			refuse(f"{APPROVAL_FILE}: missing {k!r}")
	if a["site"] != site:
		refuse(f"{APPROVAL_FILE}: site {a['site']!r} is not {site!r}")
	from urllib.parse import urlparse

	host = urlparse(a["url"]).hostname or ""
	why = production_reason(host)
	if why:
		refuse(f"{APPROVAL_FILE}: url refused: {why}. {P36_RULE}")
	if a.get("isolated_from_production") is not True:
		refuse(f'{APPROVAL_FILE}: "isolated_from_production": true is required (own database, Redis and workers)')
	try:
		at = datetime.fromisoformat(a["approved_at"].replace("Z", "+00:00"))
	except ValueError:
		refuse(f"{APPROVAL_FILE}: approved_at is not an ISO date")
	if at.tzinfo is None:
		at = at.replace(tzinfo=timezone.utc)
	age = ((now or datetime.now(timezone.utc)) - at).total_seconds() / 86400
	if age < -1 or age > MAX_APPROVAL_AGE_DAYS:
		refuse(f"{APPROVAL_FILE}: approved_at must be within the last {MAX_APPROVAL_AGE_DAYS} days")
	if need_write and a.get("allow_write") is not True:
		refuse(f'{APPROVAL_FILE}: writing needs "allow_write": true')
	return a


def no_frappe_guard():
	"""Tests set SFUI_NO_FRAPPE=1: reaching the frappe import is then itself a refusal (belt and braces)."""
	if os.environ.get("SFUI_NO_FRAPPE") == "1":
		refuse("SFUI_NO_FRAPPE=1: the script reached the point where it would import frappe (test mode)")


def check_connected(frappe, site: str):
	"""After frappe.connect(): the connected site and its host_name must still pass the deny list."""
	if frappe.local.site != site:
		refuse(f"connected site is {frappe.local.site!r}, expected {site!r}")
	why = production_reason(site)
	if why:
		refuse(f"connected site refused: {why}")
	from urllib.parse import urlparse

	host_name = frappe.conf.get("host_name") or ""
	if host_name:
		why = production_reason(urlparse(host_name).hostname or host_name)
		if why:
			refuse(f"the site's host_name is production: {why}")


def write_private(path: Path, data) -> None:
	tmp = path.with_suffix(path.suffix + ".tmp")
	fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
	with os.fdopen(fd, "w") as fh:
		json.dump(data, fh, indent=1, default=str)
		fh.flush()
		os.fsync(fh.fileno())
	os.replace(tmp, path)


def load_fixture(name: str):
	return json.loads((FIXTURES / name).read_text())
