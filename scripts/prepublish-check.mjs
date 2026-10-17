// Runs before `npm publish` (prepublishOnly) and refuses to publish unless:
// - the working tree is clean (what is published is exactly a commit);
// - HEAD carries the tag v<version> (tags are made only with the owner's approval);
// - LICENSE names the copyright holder (no "pending confirmation" placeholder).
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
if (/pending confirmation/i.test(fs.readFileSync(path.join(root, "LICENSE"), "utf8"))) problems.push("LICENSE: the copyright holder is still pending confirmation");
if (problems.length) {
  console.error(`✖ not publishing @solvfast/ui@${pkg.version}:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`✔ ready to publish @solvfast/ui@${pkg.version} (clean tree, tag v${pkg.version}, licence holder set)`);
