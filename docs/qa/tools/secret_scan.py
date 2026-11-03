#!/usr/bin/env python3
"""
Read-only secret / sensitive-content scan of the FULL history reachable from the given refs (every reachable blob once).
    python3 secret_scan.py <repo> <ref> [<ref> ...]        # e.g. refs: 'feat/0.4.0*' or 'refs/heads/crm/*' refs/tags/baseline-20261103
Prints, per finding: kind, path, blob, first commit that contains it, and a REDACTED excerpt (never the secret itself).
Never writes to the repository.
"""
import re, subprocess, sys, collections

repo, refs = sys.argv[1], sys.argv[2:]
git = lambda *a, **k: subprocess.run(["git", "-C", repo, *a], capture_output=True, **k)

def refs_expanded():
    out = []
    for r in refs:
        if any(c in r for c in "*?["):
            out += git("for-each-ref", "--format=%(refname)", r if r.startswith("refs/") else f"refs/heads/{r}", text=True).stdout.split()
        else:
            out.append(r)
    return out
R = refs_expanded()
objs = git("rev-list", "--objects", *R, text=True).stdout.splitlines()
blobs = {}
for line in objs:
    sha, _, path = line.partition(" ")
    if path:
        blobs.setdefault(sha, set()).add(path)
types = {}
proc = subprocess.run(["git", "-C", repo, "cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"], input="\n".join(blobs) + "\n", capture_output=True, text=True)
for l in proc.stdout.splitlines():
    s, t, z = l.split()
    types[s] = (t, int(z))
blobs = {s: p for s, p in blobs.items() if types.get(s, ("", 0))[0] == "blob"}

PATTERNS = [
    ("aws-access-key", re.compile(rb"AKIA[0-9A-Z]{16}")),
    ("github-token", re.compile(rb"\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}")),
    ("openai/anthropic-key", re.compile(rb"\bsk-(ant-)?[A-Za-z0-9_-]{24,}")),
    ("slack-token", re.compile(rb"xox[baprs]-[A-Za-z0-9-]{10,}")),
    ("private-key", re.compile(rb"-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY")),
    ("credentials-in-url", re.compile(rb"[a-z][a-z0-9+.-]*://[^/\s:@'\"<>]{2,}:[^/\s@'\"<>]{3,}@[A-Za-z0-9.-]+")),
    ("bearer-token", re.compile(rb"[Bb]earer\s+[A-Za-z0-9._~+/=-]{24,}")),
    ("jwt", re.compile(rb"\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")),
    ("npm-auth", re.compile(rb"_authToken\s*=\s*\S+|//registry[^\s]*:_auth")),
    ("password-assignment", re.compile(rb"""(?i)["']?(db_)?(password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)["']?\s*[:=]\s*["'][^"'\s$<{][^"'\s]{5,}["']""")),
    ("frappe-api-secret", re.compile(rb"token\s+[a-f0-9]{10,}:[a-f0-9]{10,}")),
]
NAME_RULES = [
    ("env-file", re.compile(r"(^|/)\.env(\.|$)")), ("npmrc", re.compile(r"(^|/)\.npmrc$")), ("site-config", re.compile(r"(^|/)(site|common_site)_config(\.json|_backup\.json)$")),
    ("key-material", re.compile(r"\.(pem|key|p12|pfx|jks|keystore)$|(^|/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$")),
    ("database-dump", re.compile(r"\.(sql|sql\.gz|dump|sqlite3?|db)$")), ("archive", re.compile(r"\.(zip|tar|tgz|gz|7z|rar)$")),
    ("node_modules", re.compile(r"(^|/)node_modules/")), ("build-output", re.compile(r"(^|/)(dist|build|\.next|playground/dist|public/serve-fast|www)/")),
    ("credentials-file", re.compile(r"(?i)(^|/)(credentials|secrets?)(\.|$)|serviceaccount.*\.json$")),
]
PLACEHOLDER = re.compile(rb"(?i)(example|changeme|your[_-]?|xxx+|\*{3,}|<.*>|placeholder|dummy|test|demo|fake|sample|redacted|process\.env|\$\{|token:|password:\s*\"?\")")
EMAIL = re.compile(rb"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
OKMAIL = re.compile(rb"@(example\.(com|org|net)|users\.noreply\.github\.com|solvfast\.com|frappe\.io|anthropic\.com)$|^(noreply|no-reply)@", re.I)

def first_commit(sha):
    return git("log", *R, f"--find-object={sha}", "--format=%h %cs", "--reverse", text=True).stdout.splitlines()[:1]

def redact(b):
    s = b.decode("utf8", "replace")
    return s[:18] + "…<redacted %d chars>" % max(0, len(s) - 18)

findings = []
for sha, paths in blobs.items():
    size = types[sha][1]
    pl = sorted(paths)
    for p in pl:
        for k, rx in NAME_RULES:
            if rx.search(p):
                findings.append((k, p, sha, f"size={size}"))
                break
    if size > 1_000_000:
        findings.append(("large-blob", pl[0], sha, f"size={size}"))
        continue
    data = subprocess.run(["git", "-C", repo, "cat-file", "blob", sha], capture_output=True).stdout
    if b"\0" in data[:4096]:
        continue
    for k, rx in PATTERNS:
        for m in rx.finditer(data):
            line_start = data.rfind(b"\n", 0, m.start()) + 1
            line = data[line_start:data.find(b"\n", m.end()) if data.find(b"\n", m.end()) != -1 else len(data)]
            if PLACEHOLDER.search(line) and k in ("password-assignment", "credentials-in-url", "bearer-token"):
                continue
            findings.append((k, pl[0], sha, redact(m.group(0))))
            break
    for m in EMAIL.finditer(data):
        if not OKMAIL.search(m.group(0)):
            findings.append(("email-address", pl[0], sha, m.group(0).decode()[:60]))
            break

seen = collections.OrderedDict()
for k, p, sha, note in findings:
    seen.setdefault((k, p, sha), note)
print(f"# repo={repo} refs={len(R)} reachable_blobs={len(blobs)} findings={len(seen)}")
for (k, p, sha), note in sorted(seen.items()):
    fc = first_commit(sha)
    print(f"{k}\t{p}\tblob {sha[:10]}\tfirst-in {fc[0] if fc else '?'}\t{note}")
