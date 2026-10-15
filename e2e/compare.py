#!/usr/bin/env python3
# Pixel-compare two screenshot folders (PIL). <=2/255 max channel delta counts as imperceptible.
"""Pixel-compare two screenshot dirs. usage: compare.py <dirA> <dirB> [diffDir]"""
import sys, os
from PIL import Image, ImageChops
a, b = sys.argv[1], sys.argv[2]
diffdir = sys.argv[3] if len(sys.argv) > 3 else None
fa, fb = set(os.listdir(a)), set(os.listdir(b))
fa = {f for f in fa if f.endswith(".png")}; fb = {f for f in fb if f.endswith(".png")}
only_a, only_b = sorted(fa - fb), sorted(fb - fa)
same, diff, near = 0, [], []
for f in sorted(fa & fb):
    ia, ib = Image.open(os.path.join(a, f)).convert("RGB"), Image.open(os.path.join(b, f)).convert("RGB")
    if ia.size != ib.size:
        diff.append((f, f"size {ia.size} vs {ib.size}")); continue
    d = ImageChops.difference(ia, ib)
    box = d.getbbox()
    if box is None: same += 1
    else:
        mx = max(hi for lo, hi in d.getextrema())
        if mx <= 2:
            near.append((f, f"max delta {mx}/255 in box {box}")); continue
        diff.append((f, f"max delta {mx}/255 in box {box}"))
        if diffdir:
            os.makedirs(diffdir, exist_ok=True)
            w = ia.width
            sheet = Image.new("RGB", (w * 2 + 10, ia.height), "white"); sheet.paste(ia, (0, 0)); sheet.paste(ib, (w + 10, 0))
            sheet.save(os.path.join(diffdir, f))
print(f"identical: {same}   imperceptible(<=2/255): {len(near)}   different: {len(diff)}   only-in-A: {len(only_a)}   only-in-B: {len(only_b)}")
for f, why in near: print("  NEAR", f, why)
for f, why in diff: print("  DIFF", f, why)
for f in only_a: print("  ONLY-A", f)
for f in only_b: print("  ONLY-B", f)
sys.exit(0 if not diff and not only_a and not only_b else 1)
