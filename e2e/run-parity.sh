#!/bin/bash
# Rebuild the playground + Sear reference, (re)serve them, shoot, compare.   e2e/run-parity.sh <outDir>
set -e
cd "$(dirname "$0")/.."
OUT=${1:?outDir}
./node_modules/.bin/vite build --config playground/vite.config.ts --logLevel error
./node_modules/.bin/vite build --config tools/parity/vite.config.ts --logLevel error 2>/dev/null
for p in 4801 4802; do pid=$(lsof -ti tcp:$p 2>/dev/null || true); [ -n "$pid" ] && kill $pid || true; done; sleep 1
(./node_modules/.bin/vite preview --config playground/vite.config.ts --port 4801 --strictPort >/dev/null 2>&1 &)
(./node_modules/.bin/vite preview --config tools/parity/vite.config.ts --port 4802 --strictPort >/dev/null 2>&1 &)
sleep 3
rm -rf "$OUT"
node e2e/parity.mjs http://localhost:4801/ http://localhost:4802/ "$OUT" >/dev/null
set +e
python3 e2e/compare.py "$OUT/sear" "$OUT/ours" "$OUT/diff"
