#!/bin/bash
# Clean-consumer test: pack the package, install the tarball into fresh apps OUTSIDE this repo, type-check, build.
#   e2e/consumers/run.sh <workDir>      (path A = Tailwind 3 + preset; path B = no Tailwind, full.css)
set -e
cd "$(dirname "$0")/../.."
WORK=${1:?workDir}; rm -rf "$WORK"; mkdir -p "$WORK"
npm pack --pack-destination "$WORK" >/dev/null 2>&1
TGZ=$(ls "$WORK"/*.tgz)
for v in a b; do
  cp -r e2e/consumers/$v "$WORK/$v"
  # the playground's showcases + Sear demo config, importing from the published name instead of the playground alias
  mkdir -p "$WORK/$v/src/showcase" "$WORK/$v/src/demo"
  # (the simulator's repo-relative imports go through the published testing entry; its recorded fixtures are copied)
  for f in playground/src/showcase/*.tsx playground/src/demo/*.ts; do sed -E -e 's#from "@ui(/[a-z-]+)?"#from "@solvfast/ui\1"#' \
    -e 's#from "(\.\./)+src/frappe/testing"#from "@solvfast/ui/frappe/testing"#' -e 's#from "(\.\./)+tests/fixtures/real-15\.110/#from "./fixtures/#' \
    "$f" > "$WORK/$v/src/${f#playground/src/}"; done
  mkdir -p "$WORK/$v/src/demo/fixtures" && cp tests/fixtures/real-15.110/{todo,user,contact}.en.json "$WORK/$v/src/demo/fixtures/"
  cp -r playground/src/demo/sear-assets "$WORK/$v/src/demo/"
  [ $v = b ] && node e2e/consumers/b-layout-css.mjs "$WORK/$v"
  (cd "$WORK/$v" && npm install --no-audit --no-fund --prefer-offline >/dev/null 2>&1 && npm install --no-audit --no-fund --prefer-offline "$TGZ" >/dev/null 2>&1)
  echo "== consumer $v"; (cd "$WORK/$v" && npx tsc --noEmit && echo "  tsc OK" && npx vite build --logLevel error && echo "  build OK")
  echo "  react copies: $(find "$WORK/$v/node_modules" -path '*/react/package.json' -not -path '*@types*' | wc -l)"
done
