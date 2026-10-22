#!/usr/bin/env python3
"""
Babelish brand assets — generated, not hand-edited.

The mark is two speech bubbles: a large parchment bubble and a smaller
tangerine one answering it. Conversation is the product; the pair reads as
"two voices" at 48 px and as a chat at 1024 px, and the palette is the same
"warm atlas" the app uses (forest ink, parchment, tangerine) so the icon and
the interface agree.

Everything is drawn from the constants below and rendered at 4x, then
downsampled — edit a colour or a coordinate here and re-run:

    python3 scripts/brand/generate-icons.py

Outputs (all committed, because stores need them):

    assets/icon.png                    1024  iOS / store / fallback
    assets/android-icon-background.png 1024  adaptive background (gradient)
    assets/android-icon-foreground.png 1024  adaptive foreground (safe zone)
    assets/android-icon-monochrome.png 1024  themed icons (silhouette)
    assets/splash-icon.png              512  native splash, transparent
    assets/favicon.png                   96  web

Requires Pillow (`pip install pillow`). No network, no fonts, no external SVG.
"""

from __future__ import annotations

import os
from PIL import Image, ImageChops, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets")

# ── Palette (mirrors src/theme/tokens.ts) ────────────────────────────────────
FOREST_DARK = (11, 58, 44)      # #0B3A2C
FOREST_MID = (28, 104, 82)      # #1C6852
FOREST_LIGHT = (46, 139, 111)   # #2E8B6F
PARCHMENT = (247, 244, 237)     # #F7F4ED
TANGERINE = (233, 118, 79)      # #E9764F
SUN = (242, 193, 78)            # #F2C14E

SS = 4  # supersampling factor


def lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size: int) -> Image.Image:
    """135° three-stop forest gradient, drawn once and reused."""
    # Small image stretched afterwards: the gradient is linear, so scaling is
    # exact and this stays fast at 4096 px.
    n = 384
    img = Image.new("RGB", (n, n))
    px = img.load()
    for y in range(n):
        for x in range(n):
            t = (x + y) / (2 * (n - 1))
            colour = lerp(FOREST_DARK, FOREST_MID, t / 0.55) if t < 0.55 else lerp(
                FOREST_MID, FOREST_LIGHT, (t - 0.55) / 0.45
            )
            px[x, y] = colour
    return img.resize((size, size), Image.LANCZOS).convert("RGB")


def mark_layers(size: int) -> tuple[Image.Image, Image.Image]:
    """
    The bubble pair at `size`, as two RGBA layers: (big parchment bubble,
    small tangerine bubble). Coordinates are fractions of the canvas so the
    same drawing works for the 1024 icon and the 512 splash.

    Tails are drawn *before* their body so the union reads as one silhouette —
    drawn after, the triangle's edge cuts across the rounded corner and looks
    like a torn flag. The small bubble also gets a clean gap cut out of the
    big one, so the two never melt together at 48 px.
    """
    w = size * SS
    big = Image.new("RGBA", (w, w), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)

    # Tail first, then the body over it.
    d.polygon(
        [(0.272 * w, 0.548 * w), (0.252 * w, 0.700 * w), (0.412 * w, 0.596 * w)],
        fill=PARCHMENT + (255,),
    )
    d.rounded_rectangle(
        (0.215 * w, 0.270 * w, 0.665 * w, 0.610 * w),
        radius=0.115 * w,
        fill=PARCHMENT + (255,),
    )

    # A written message inside the answering bubble: two ink bars and one
    # tangerine bar (the accent the app uses for "your turn").
    bar_h = 0.040 * w
    for i, (x0, x1, colour) in enumerate(
        [
            (0.300, 0.560, FOREST_DARK),
            (0.300, 0.505, FOREST_DARK),
            (0.300, 0.455, TANGERINE),
        ]
    ):
        y0 = 0.352 * w + i * 0.086 * w
        d.rounded_rectangle(
            (x0 * w, y0, x1 * w, y0 + bar_h),
            radius=bar_h / 2,
            fill=colour + (255,),
        )

    small = Image.new("RGBA", (w, w), (0, 0, 0, 0))
    ds = ImageDraw.Draw(small)
    ds.polygon(
        [(0.742 * w, 0.742 * w), (0.790 * w, 0.862 * w), (0.668 * w, 0.772 * w)],
        fill=TANGERINE + (255,),
    )
    ds.rounded_rectangle(
        (0.545 * w, 0.548 * w, 0.845 * w, 0.800 * w),
        radius=0.100 * w,
        fill=TANGERINE + (255,),
    )

    # Cut a ring around the small bubble out of the big one so the gap shows
    # whatever is behind the mark (gradient, splash colour, or nothing). The
    # ring is drawn as an inflated copy of the same shapes — a morphological
    # dilation here would mean a ~200 px kernel on a 4096 px canvas.
    pad = 0.018 * w
    ring = Image.new("L", (w, w), 0)
    dr = ImageDraw.Draw(ring)
    dr.rounded_rectangle(
        (0.545 * w - pad, 0.548 * w - pad, 0.845 * w + pad, 0.800 * w + pad),
        radius=0.100 * w + pad,
        fill=255,
    )
    dr.polygon(
        [
            (0.742 * w - pad, 0.742 * w - pad),
            (0.790 * w + pad, 0.862 * w + pad),
            (0.668 * w - pad, 0.772 * w + pad),
        ],
        fill=255,
    )
    big.putalpha(ImageChops.subtract(big.split()[3], ring))

    return big.resize((size, size), Image.LANCZOS), small.resize((size, size), Image.LANCZOS)


def compose_mark(size: int) -> Image.Image:
    big, small = mark_layers(size)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.alpha_composite(big)
    out.alpha_composite(small)
    return centred(out)


def centred(mark: Image.Image) -> Image.Image:
    """Moves the drawn pixels to the exact centre of their own canvas."""
    box = mark.split()[3].getbbox()
    if box is None:
        return mark
    size = mark.size[0]
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    out.alpha_composite(mark, (round(size / 2 - cx), round(size / 2 - cy)))
    return out


def monochrome(size: int) -> Image.Image:
    """White silhouette with a true transparent gap (Android themes it)."""
    big, small = mark_layers(size)
    white = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(white, (0, 0), big.split()[3])
    out.paste(white, (0, 0), small.split()[3])
    return out


def scaled(mark: Image.Image, factor: float) -> Image.Image:
    """Centres the mark at `factor` of the canvas (adaptive-icon safe zone)."""
    size = mark.size[0]
    inner = max(1, round(size * factor))
    small = mark.resize((inner, inner), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset = (size - inner) // 2
    out.alpha_composite(small, (offset, offset))
    return out


def save(image: Image.Image, name: str) -> None:
    path = os.path.abspath(os.path.join(OUT, name))
    image.save(path, "PNG", optimize=True)
    print(f"  {name:<34} {image.size[0]}x{image.size[1]}  {os.path.getsize(path) / 1024:.0f} KB")


def main() -> None:
    print("Babelish brand assets →", os.path.abspath(OUT))

    # Full icon: gradient plate + mark.
    icon = gradient(1024).convert("RGBA")
    icon.alpha_composite(scaled(compose_mark(1024), 0.84), (0, 0))
    # 0.78 of the plate: a launcher icon needs more air than a poster, and the
    # same ratio keeps the adaptive foreground honest.
    save(icon.convert("RGB"), "icon.png")

    # Adaptive icon: the launcher supplies the mask, so the mark must stay
    # inside the 66% safe circle and the background is a separate layer.
    save(gradient(1024), "android-icon-background.png")
    save(scaled(compose_mark(1024), 0.64), "android-icon-foreground.png")
    save(scaled(monochrome(1024), 0.64), "android-icon-monochrome.png")

    # Splash: transparent mark, shown on the deep-forest splash colour.
    save(compose_mark(512), "splash-icon.png")

    # Favicon: the full icon, small.
    save(icon.convert("RGB").resize((96, 96), Image.LANCZOS), "favicon.png")

    print("done")


if __name__ == "__main__":
    main()
