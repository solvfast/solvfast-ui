// Public API report: every name exported by each package entry point, and the prop names of every exported component.
//   node scripts/api-report.mjs [--root <dir>] > api/<version>.json          write a snapshot
//   node scripts/api-report.mjs --check api/0.9.0.json api/changes-0.10.0.json  fail on an undocumented removal
// A removal (an export, or a component prop) must be listed in the changes file, so a breaking change is always deliberate.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const rootArg = args.indexOf("--root");
const root = rootArg >= 0 ? path.resolve(args[rootArg + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");

const ENTRIES = {
  ".": "src/index.ts",
  "./frappe": "src/frappe/index.ts",
  "./frappe/testing": "src/frappe/testing/index.ts",
  "./toast": "src/toast/index.ts",
  "./chart": "src/chart/index.ts",
  "./form": "src/form/index.ts",
  "./lifecycle-diagram": "src/lifecycle-diagram/index.ts",
  "./sayr": "src/sayr/index.ts",
};

function report() {
  const files = Object.values(ENTRIES).map((f) => path.join(root, f)).filter((f) => fs.existsSync(f));
  const cfg = ts.getParsedCommandLineOfConfigFile(path.join(root, "tsconfig.json"), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
  const program = ts.createProgram(files, { ...cfg.options, noEmit: true });
  const checker = program.getTypeChecker();
  const out = {};
  for (const [entry, rel] of Object.entries(ENTRIES)) {
    const sf = program.getSourceFile(path.join(root, rel));
    if (!sf) { out[entry] = null; continue; }
    const mod = checker.getSymbolAtLocation(sf);
    const names = {};
    for (const sym of checker.getExportsOfModule(mod)) {
      const target = sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym;
      const isValue = !!(target.flags & ts.SymbolFlags.Value);
      const rec = { kind: isValue ? "value" : "type" };
      // A component: an exported function (or const) whose name starts upper-case and whose first parameter is an object.
      if (isValue && /^[A-Z]/.test(sym.name)) {
        const decl = target.valueDeclaration ?? target.declarations?.[0];
        if (decl) {
          const t = checker.getTypeOfSymbolAtLocation(target, decl);
          const sig = t.getCallSignatures()[0];
          const p0 = sig?.getParameters()[0];
          if (p0) {
            const pt = checker.getTypeOfSymbolAtLocation(p0, decl);
            const props = checker.getPropertiesOfType(pt).map((p) => p.name).filter((n) => !n.startsWith("__")).sort();
            if (props.length && props.length < 400) rec.props = props;
          }
        }
      }
      names[sym.name] = rec;
    }
    out[entry] = Object.fromEntries(Object.entries(names).sort(([a], [b]) => a.localeCompare(b)));
  }
  return out;
}

const current = report();
const check = args.indexOf("--check");
if (check < 0) {
  process.stdout.write(JSON.stringify(current, null, 1) + "\n");
  process.exit(0);
}
const base = JSON.parse(fs.readFileSync(path.resolve(args[check + 1]), "utf8"));
const changes = JSON.parse(fs.readFileSync(path.resolve(args[check + 2]), "utf8"));
const allowedRemoved = new Set(changes.removed ?? []);
const allowedProps = new Set(changes.removedProps ?? []);
const problems = [];
const added = [];
for (const [entry, names] of Object.entries(base)) {
  if (!names) continue;
  const now = current[entry];
  if (!now) { problems.push(`entry ${entry} disappeared`); continue; }
  for (const [name, rec] of Object.entries(names)) {
    const key = `${entry}:${name}`;
    if (!now[name]) { if (!allowedRemoved.has(key)) problems.push(`removed export ${key}`); continue; }
    if (rec.kind === "value" && now[name].kind !== "value" && !allowedRemoved.has(key)) problems.push(`export ${key} is no longer a value`);
    for (const p of rec.props ?? []) {
      if (!(now[name].props ?? []).includes(p) && !allowedProps.has(`${key}.${p}`)) problems.push(`removed prop ${key}.${p}`);
    }
  }
}
for (const [entry, names] of Object.entries(current)) for (const n of Object.keys(names ?? {})) if (!base[entry]?.[n]) added.push(`${entry}:${n}`);
console.log(`API check vs ${path.basename(args[check + 1])}: ${added.length} added, ${problems.length} undocumented removals`);
for (const p of problems) console.log("  ✗ " + p);
process.exit(problems.length ? 1 : 0);
