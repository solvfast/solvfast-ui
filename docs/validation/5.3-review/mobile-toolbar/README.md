# Intentional difference from Sear: the list toolbar on phones

Sear's list toolbar keeps Saved / Filter / Columns / the page action on one line, so on a phone the page is wider
than the screen (506 px at 390 px in English: "Create Field Preset" is cut off; in Arabic the page is shifted and the
search box clipped). The package lets that group wrap (`flex-wrap justify-end`): wherever the buttons fit — every
desktop state — it is one line exactly as in Sear; on a phone they wrap and the page fits the screen. The table
still scrolls horizontally inside its card.

`<combo>__mobile__{sear,package}.webp` — 390 × 844, lossless, from `e2e/list-parity.mjs` (15 Oct 2026).
Width check: `node e2e/list-mobile.mjs <url>` (360 and 390 px, en/ar, default and every-option list).
