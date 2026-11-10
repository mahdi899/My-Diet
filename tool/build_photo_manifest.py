# -*- coding: utf-8 -*-
"""Build the bundled photo set for the app.

* Moves the raw originals out of the asset bundle into app/_originals_photo/
  (git-ignored) the first time it runs, never deleting them.
* Writes ASCII-safe, categorised, resized JPEGs to app/assets/photo/<kind>/
  (900px long edge, q58) plus 400px thumbs (`_t` suffix).
* Writes app/assets/photo/manifest.json (Persian titles/tags come from
  tool/photo_catalog.py).

Usage (from repo root):  python tool/build_photo_manifest.py
Requires: pip install pillow
"""
import json
import re
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parent))
from photo_catalog import CATALOG  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
PHOTO = APP / "assets" / "photo"
ORIGINALS = APP / "_originals_photo"
KINDS = ("food", "expert", "lifestyle", "ingredient")
FOOD_CATS = {"breakfast", "lunch", "dinner", "snack", "dessert", "drink"}
MAX_EDGE, THUMB_EDGE, QUALITY, THUMB_QUALITY = 900, 400, 58, 55

HASH_RE = re.compile(r"_([0-9a-f]{8})\.jpe?g$", re.I)


def kind_of(cat: str) -> str:
    if cat in FOOD_CATS:
        return "food"
    if cat in ("expert", "lifestyle", "ingredient"):
        return cat
    raise ValueError(cat)


def slug_of(name: str, truncated: bool) -> str:
    stem = HASH_RE.sub("", name)
    if truncated:  # name was cut mid-word with an ellipsis
        stem = stem.split("\u2026")[0]
        stem = stem.rsplit("_", 1)[0] if "_" in stem else stem
    stem = stem.replace("\u2026", "")
    slug = re.sub(r"[^a-z0-9]+", "_", stem.lower()).strip("_")
    return slug


def dominant_hex(img: Image.Image) -> str:
    small = img.copy()
    small.thumbnail((64, 64))
    q = small.quantize(colors=8, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()
    counts = sorted(q.getcolors(), reverse=True)  # (count, index)
    best, best_score = None, -1.0
    for count, idx in counts:
        r, g, b = pal[idx * 3: idx * 3 + 3]
        mx, mn = max(r, g, b), min(r, g, b)
        sat = (mx - mn) / mx if mx else 0
        lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        # prefer frequent, reasonably saturated, not near white/black
        score = count * (0.35 + sat) * (1 - abs(lum - 0.5) * 0.9)
        if score > best_score:
            best, best_score = (r, g, b), score
    r, g, b = best
    return "#%02X%02X%02X" % (r, g, b)


def resize(img: Image.Image, edge: int) -> Image.Image:
    out = img.copy()
    out.thumbnail((edge, edge), Image.Resampling.LANCZOS)
    return out


def stash_originals() -> None:
    ORIGINALS.mkdir(parents=True, exist_ok=True)
    moved = 0
    for f in list(PHOTO.glob("*.jp*g")):
        shutil.move(str(f), str(ORIGINALS / f.name))
        moved += 1
    if moved:
        print(f"moved {moved} originals -> {ORIGINALS}")


def main() -> None:
    stash_originals()
    sources = sorted(p for p in ORIGINALS.iterdir() if HASH_RE.search(p.name))
    if not sources:
        sys.exit("no originals found")

    for k in KINDS:  # clean rebuild
        shutil.rmtree(PHOTO / k, ignore_errors=True)
        (PHOTO / k).mkdir(parents=True, exist_ok=True)

    items, used, missing = [], set(), []
    for src in sources:
        h = HASH_RE.search(src.name).group(1).lower()
        meta = CATALOG.get(h)
        if meta is None:
            missing.append(src.name)
            continue
        cat, title, fa_tags, en_tags = meta
        kind = kind_of(cat)
        slug = slug_of(src.name, "\u2026" in src.name)
        if slug in used:
            slug = f"{slug}_{h[:4]}"
        used.add(slug)

        img = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        color = dominant_hex(img)
        full, thumb = resize(img, MAX_EDGE), resize(img, THUMB_EDGE)
        rel = f"assets/photo/{kind}/{slug}.jpg"
        rel_t = f"assets/photo/{kind}/{slug}_t.jpg"
        full.save(APP / rel, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        thumb.save(APP / rel_t, "JPEG", quality=THUMB_QUALITY, optimize=True)
        tags = sorted(set(fa_tags.split()) | set(en_tags.split()) | set(slug.split("_")))
        items.append({
            "id": slug,
            "path": rel,
            "thumb": rel_t,
            "title": title,
            "category": cat,
            "kind": kind,
            "tags": tags,
            "color": color,
            "w": full.width,
            "h": full.height,
        })
        print(f"{slug:55s} {cat:10s} {color}")

    if missing:
        print("\nUNCATALOGUED:", *missing, sep="\n  ")
        sys.exit(1)

    items.sort(key=lambda i: (i["kind"], i["category"], i["id"]))
    manifest = {"version": 1, "count": len(items), "items": items}
    (PHOTO / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    total = sum(f.stat().st_size for f in PHOTO.rglob("*") if f.is_file())
    by_cat: dict = {}
    for i in items:
        by_cat[i["category"]] = by_cat.get(i["category"], 0) + 1
    print(f"\n{len(items)} photos, bundle {total / 1e6:.1f} MB")
    print(by_cat)


if __name__ == "__main__":
    main()



