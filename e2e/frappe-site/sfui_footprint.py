"""
Shared guards, manifest and constants for seed-crm-site.py and teardown-crm-site.py.  PREPARED, NOT RUN.

This module imports NOTHING from frappe, so the refusal paths can be exercised without a bench or a site.

Safety model (every one of these must hold, each is checked before the first connection to the site):
  1. the site name argument is exactly SITE (internal.solvfaster.com) - anything else is refused;
  2. a write run needs the owner's approval file in the PRIVATE directory (APPROVED_SEED / APPROVED_TEARDOWN, JSON) whose
     "site" equals SITE, with "approved_by", "approved_at" and (seed only) "backup_dir" naming a verified backup;
  3. the private directory is outside this repository and is created/kept mode 700; files in it are mode 600;
  4. writing is explicit (--apply / --execute); the default is to print a plan.
"""
from __future__ import annotations

import json
import os
import stat
import sys
import time
from pathlib import Path

SITE = "internal.solvfaster.com"
REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURES = Path(__file__).resolve().parent / "fixtures"

MODULE = "SFUI Test"
# creation order (children first); teardown walks it in reverse
DOCTYPES = [
	"SFUI Test Tag Row",
	"SFUI Test Child",
	"SFUI Test Contact",
	"SFUI Test Parent",
	"SFUI Test Workflow",
	"SFUI Test Attachments",
]
ROLES = ["SFUI Tester", "SFUI Reader", "SFUI Approver"]
USERS = [
	"sfui-tester@example.com",
	"sfui-reader@example.com",
	"sfui-approver@example.com",
	"sfui-limited@example.com",
	"sfui-ar@example.com",
]
WORKFLOW = "SFUI Test Workflow Flow"
# autoname "format:<prefix>{####}" keeps its counter in tabSeries under the prefix; teardown removes exactly these rows
SERIES = ["SFUI-CON-", "SFUI-PAR-", "SFUI-WF-", "SFUI-ATT-"]
AVATAR = "/assets/frappe/images/default-avatar.png"  # set so update_gravatar (an outbound HTTP call) is NOT enqueued

# Records that Frappe or the tests create as a SIDE EFFECT and that the manifest cannot list by name.
# (doctype, field that holds the SFUI DocType name) - teardown deletes rows where field IN DOCTYPES.
SWEEP_BY_DOCTYPE = [
	("ToDo", "reference_type"),
	("Comment", "reference_doctype"),
	("Version", "ref_doctype"),
	("File", "attached_to_doctype"),
	("View Log", "reference_doctype"),
	("Notification Log", "document_type"),
	("Workflow Action", "reference_doctype"),
	("DocShare", "share_doctype"),
	("Communication", "reference_doctype"),
	("Tag Link", "document_type"),
	("Activity Log", "reference_doctype"),
	("Energy Point Log", "reference_doctype"),
	("Email Queue", "reference_doctype"),
	("Deleted Document", "deleted_doctype"),
	("Document Follow", "ref_doctype"),
]
# rows keyed by the SFUI USERS (logins, route history, saved settings)
SWEEP_BY_USER = [
	("Activity Log", "user"),
	("Route History", "user"),
	("Access Log", "user"),
	("Notification Settings", "name"),
	("DocShare", "user"),
	("Notification Log", "for_user"),
]


class Refused(SystemExit):
	pass


def refuse(msg: str):
	print(f"REFUSED: {msg}", file=sys.stderr)
	raise Refused(2)


def require_site(site: str):
	# P36: the footprint is defined for the PRODUCTION site internal.solvfaster.com, so it is refused unconditionally.
	refuse(
		"P36 forbids touching the production site internal.solvfaster.com; use staging-seed.py / staging-teardown.py "
		"against an owner-approved STAGING site (e2e/frappe-site/README.md)"
	)
	if site != SITE:
		refuse(f"site must be exactly {SITE!r} (got {site!r}); this footprint is defined for that site only")


def prepare_private_dir(path: str) -> Path:
	p = Path(path).resolve()
	if REPO_ROOT in (p, *p.parents):
		refuse("the private directory must be outside the repository (credentials and the manifest live there)")
	p.mkdir(mode=0o700, parents=True, exist_ok=True)
	os.chmod(p, 0o700)
	if stat.S_IMODE(p.stat().st_mode) != 0o700:
		refuse(f"cannot make {p} mode 700")
	return p


def read_approval(private: Path, name: str, need_backup: bool) -> dict:
	f = private / name
	if not f.is_file():
		refuse(f"no approval file {f}; the owner's approval is required (see docs/qa/backup-safety-net.md)")
	try:
		data = json.loads(f.read_text())
	except ValueError:
		refuse(f"{f} is not valid JSON")
	if data.get("site") != SITE:
		refuse(f"{name}: 'site' must equal {SITE!r}")
	for k in ("approved_by", "approved_at"):
		if not data.get(k):
			refuse(f"{name}: missing {k!r}")
	if need_backup:
		d = data.get("backup_dir")
		if not d or not data.get("backup_verified") is True:
			refuse(f"{name}: 'backup_dir' and 'backup_verified': true are required (docs/qa/backup-safety-net.md)")
		newest = max((x.stat().st_mtime for x in Path(d).glob("*") if x.is_file()), default=0)
		if not newest or time.time() - newest > 6 * 3600:
			refuse(f"{name}: no file in backup_dir {d!r} newer than 6 hours - take and verify a backup first")
	return data


def write_private(path: Path, data) -> None:
	tmp = path.with_suffix(path.suffix + ".tmp")
	fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
	with os.fdopen(fd, "w") as fh:
		json.dump(data, fh, indent=1, default=str)
		fh.flush()
		os.fsync(fh.fileno())
	os.replace(tmp, path)


class Manifest:
	"""Every object the seed creates, written BEFORE the call (status 'pending') and flipped to 'created' after it.
	A crash therefore leaves a 'pending' entry that teardown checks for existence instead of missing it."""

	def __init__(self, private: Path):
		self.path = private / "manifest.json"
		if self.path.exists():
			self.data = json.loads(self.path.read_text())
		else:
			self.data = {"site": SITE, "started_at": time.strftime("%Y-%m-%d %H:%M:%S"), "items": []}
			self._save()

	def _save(self):
		write_private(self.path, self.data)

	def find(self, kind: str, doctype: str, name: str):
		for i in self.data["items"]:
			if (i["kind"], i["doctype"], i["name"]) == (kind, doctype, name):
				return i
		return None

	def intent(self, kind: str, doctype: str, name: str, **extra):
		"""kind: created | side_effect | modified (a pre-existing shared record we only changed - never deleted)."""
		if self.find(kind, doctype, name):
			return
		self.data["items"].append({"kind": kind, "doctype": doctype, "name": name, "status": "pending", **extra})
		self._save()

	def done(self, kind: str, doctype: str, name: str):
		i = self.find(kind, doctype, name)
		if i:
			i["status"] = "created"
			i["at"] = time.strftime("%Y-%m-%d %H:%M:%S")
			self._save()

	def names(self, kind: str, doctype: str):
		return [i["name"] for i in self.data["items"] if i["kind"] == kind and i["doctype"] == doctype]

	def all(self, kind=None):
		return [i for i in self.data["items"] if kind is None or i["kind"] == kind]


def load_fixture(name: str):
	return json.loads((FIXTURES / name).read_text())
