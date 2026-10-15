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
  # the showcase, importing from the published name instead of the playground alias
  sed 's#from "@ui"#from "@solvfast/ui"#' playground/src/showcase/Primitives.tsx > "$WORK/$v/src/Primitives.tsx"
  [ $v = b ] && node e2e/consumers/b-layout-css.mjs "$WORK/$v"
  (cd "$WORK/$v" && npm install --no-audit --no-fund --prefer-offline >/dev/null 2>&1 && npm install --no-audit --no-fund --prefer-offline "$TGZ" >/dev/null 2>&1)
  echo "== consumer $v"; (cd "$WORK/$v" && npx tsc --noEmit && echo "  tsc OK" && npx vite build --logLevel error && echo "  build OK")
  echo "  react copies: $(find "$WORK/$v/node_modules" -path '*/react/package.json' -not -path '*@types*' | wc -l)"
done
