#!/usr/bin/env python3
"""Resize + optimize the user's icon.
- build/icon-light.png  -> 512x512 RGBA master (used by electron-builder + ICO generator)
- build/favicon.png     -> 256-color optimized version (smaller, for web favicon)
"""
from PIL import Image
import os

SRC = r"D:\cooks\websites\cloneforge\apps\desktop\release\.icon-ico\clonedzz icon.png"
MASTER = r"D:\cooks\websites\cloneforge\apps\desktop\build\icon-light.png"
FAV = r"D:\cooks\websites\cloneforge\apps\desktop\build\favicon.png"

img = Image.open(SRC)
print(f"source: {img.size} mode={img.mode} size={os.path.getsize(SRC):,} bytes")
if img.mode not in ("RGBA", "LA"):
    img = img.convert("RGBA")

# 512x512 RGBA master
img512 = img.resize((512, 512), Image.LANCZOS)
img512.save(MASTER, "PNG", optimize=True)
print(f"master RGBA 512: {os.path.getsize(MASTER):,} bytes")

# 256-color palette favicon (smaller)
fav = img512.convert("RGB").quantize(colors=256, method=Image.MEDIANCUT)
fav.save(FAV, "PNG", optimize=True)
print(f"favicon 256-palette: {os.path.getsize(FAV):,} bytes")
