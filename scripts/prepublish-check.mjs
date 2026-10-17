// Runs before `npm publish` (prepublishOnly) and refuses to publish unless:
// - the working tree is clean (what is published is exactly a commit);
// - HEAD carries the tag v<version> (tags are made only with the owner's approval);
// - LICENSE states a decided licence (not the "licence not decided" placeholder);
// - no tracked file holds a credential (token) — a push would publish it too.
// It never publishes anything itself.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const problems = [];
if (git("status", "--porcelain")) problems.push("the working tree has uncommitted changes");
const tags = git("tag", "--points-at", "HEAD").split("\n").filter(Boolean);
if (!tags.includes(`v${pkg.version}`)) problems.push(`HEAD is not tagged v${pkg.version} (tags on HEAD: ${tags.join(", ") || "none"})`);
if (/not (been )?decided|pending confirmation/i.test(fs.readFileSync(path.join(root, "LICENSE"), "utf8"))) problems.push("LICENSE: the licence has not been decided");
const CREDENTIAL = /gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|npm_[A-Za-z0-9]{30,}|_authToken=(?!\$\{)[A-Za-z0-9_.-]{20,}/;
for (const f of git("ls-files").split("\n").filter(Boolean)) {
  const full = path.join(root, f);
  if (!fs.existsSync(full) || fs.statSync(full).size > 5_000_000) continue;
  const text = fs.readFileSync(full);
  if (text.includes(0)) continue; // binary
  if (CREDENTIAL.test(text.toString("utf8"))) problems.push(`${f} contains what looks like a credential (token) — remove it before publishing or pushing`);
}
if (problems.length) {
  console.error(`✖ not publishing @solvfast/ui@${pkg.version}:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`✔ ready to publish @solvfast/ui@${pkg.version} (clean tree, tag v${pkg.version}, licence decided, no credentials in tracked files)`);
