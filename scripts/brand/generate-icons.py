#!/usr/bin/env python3
"""
Babelish brand assets — reproducibly generated from `scripts/brand/logo-source.png`.

The Babelish mascot mark features a friendly white polar bear wrapped in a
3D speech-bubble ribbon, speaking soundwaves beneath three multilingual bubbles
(Latin "A", CJK "文", and Arabic "ض") on a royal-indigo plate.

Run whenever updating brand artwork:

    python3 scripts/brand/generate-icons.py

Outputs (all committed, because stores and Expo builds require them):

    assets/icon.png                    1024  iOS / store / fallback (24-bit RGB)
    assets/android-icon-background.png 1024  adaptive background (indigo gradient)
    assets/android-icon-foreground.png 1024  adaptive foreground (66% safe zone)
    assets/android-icon-monochrome.png 1024  Android 13+ themed icon silhouette
    assets/splash-icon.png              512  native & in-app splash mark (RGBA)
    assets/store/play-icon-512.png      512  Google Play app icon (24-bit RGB)
    assets/store/feature-graphic.png 1024x500 Google Play Store feature graphic
    assets/notification-icon.png         96  Android notification small icon (white)

Requires Pillow (`pip install pillow`). No network, no fonts, no external SVG.
"""

from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE_PNG = os.path.join(HERE, "logo-source.png")
OUT = os.path.abspath(os.path.join(HERE, "..", "..", "assets"))

# ── Brand palette (sampled from the canonical mascot plate + app tokens) ─────
INDIGO_TOP = (66, 82, 214)     # #4252D6
INDIGO_MID = (56, 56, 199)     # #3838C7
INDIGO_DEEP = (40, 21, 160)    # #2815A0
VIOLET_GLOW = (176, 86, 240)   # #B056F0
GOLD_ACCENT = (232, 169, 68)   # #E8A944
SKY_ACCENT = (74, 168, 238)    # #4AA8EE
PARCHMENT = (247, 244, 237)    # #F7F4ED


def lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def fit_plate_surface(src: Image.Image) -> list[list[float]]:
    """
    Fits a smooth 2D quadratic surface [1, u, v, u^2, u*v, v^2] to clean
    interior royal-indigo plate pixels across all four sides of `logo-source.png`
    so full-bleed launcher icons, adaptive layers, and foreground segmentation
    match the 3D lighting gradient seamlessly.
    """
    w, h = src.size
    px = src.load()
    samples: list[tuple[float, float, tuple[int, int, int]]] = []

    for y in range(52, 448, 4):
        for x in (54, 68, 442):
            if x == 442 and 50 <= y <= 258:
                continue  # speech bubbles sit near upper-right
            r, g, b, a = px[x, y]
            if a == 255 and b > 145 and r < 80 and g < 100:
                samples.append((x / w, y / h, (r, g, b)))
    for x in range(60, 240, 6):
        for y in (52, 444):
            r, g, b, a = px[x, y]
            if a == 255 and b > 145 and r < 80 and g < 100:
                samples.append((x / w, y / h, (r, g, b)))

    k = 6
    coeffs: list[list[float]] = []
    for ch in range(3):
        ata = [[0.0] * k for _ in range(k)]
        atb = [0.0] * k
        for u, v, rgb in samples:
            f = [1.0, u, v, u * u, u * v, v * v]
            val = float(rgb[ch])
            for i in range(k):
                atb[i] += f[i] * val
                for j in range(k):
                    ata[i][j] += f[i] * f[j]
        aug = [ata[i] + [atb[i]] for i in range(k)]
        for i in range(k):
            piv = max(range(i, k), key=lambda r: abs(aug[r][i]))
            aug[i], aug[piv] = aug[piv], aug[i]
            for r in range(k):
                if r != i:
                    fac = aug[r][i] / aug[i][i]
                    for c in range(i, k + 1):
                        aug[r][c] -= fac * aug[i][c]
        coeffs.append([aug[i][k] / aug[i][i] for i in range(k)])
    return coeffs


def eval_plate(coeffs: list[list[float]], u: float, v: float) -> tuple[int, int, int]:
    u_c = max(0.08, min(0.92, u))
    v_c = max(0.06, min(0.94, v))
    f = [1.0, u_c, v_c, u_c * u_c, u_c * v_c, v_c * v_c]
    return tuple(
        max(0, min(255, round(sum(coeffs[c][i] * f[i] for i in range(6)))))
        for c in range(3)
    )


def render_plate(coeffs: list[list[float]], width: int, height: int) -> Image.Image:
    # Smooth linear-quadratic field: render at moderate grid and upscale Lanczos
    gw, gh = min(width, 256), min(height, 256)
    grid = Image.new("RGB", (gw, gh))
    px = grid.load()
    for y in range(gh):
        v = y / max(1, gh - 1)
        for x in range(gw):
            u = x / max(1, gw - 1)
            px[x, y] = eval_plate(coeffs, u, v)
    return grid.resize((width, height), Image.BICUBIC)


def inner_artwork_mask(src: Image.Image) -> Image.Image:
    """
    Erodes away the outer ~42 px rounded-squircle bevel of `logo-source.png`
    with a soft Gaussian feather, preserving 100% of the mascot, bubbles,
    soundwaves, and 3D drop shadows in the interior.
    """
    alpha = src.getchannel("A")
    return (
        alpha.filter(ImageFilter.MinFilter(35))
        .filter(ImageFilter.MinFilter(25))
        .filter(ImageFilter.GaussianBlur(15))
    )


def build_full_bleed_icon(src: Image.Image, coeffs: list[list[float]], size: int) -> Image.Image:
    """Full-bleed 24-bit RGB launcher icon (no alpha, no double squircle)."""
    base = render_plate(coeffs, src.size[0], src.size[1]).convert("RGBA")
    inner = src.copy()
    inner.putalpha(inner_artwork_mask(src))
    base.alpha_composite(inner)
    return base.convert("RGB").resize((size, size), Image.LANCZOS)


def build_adaptive_foreground(src: Image.Image, size: int) -> Image.Image:
    """
    Android adaptive foreground (1024x1024 RGBA): scales the inner mascot +
    bubbles into Android's 66% safe circle so launchers never clip the bubbles
    or ribbon under circle, teardrop, or squircle masks.
    """
    inner = src.copy()
    inner.putalpha(inner_artwork_mask(src))
    bbox = inner.getchannel("A").getbbox()
    cropped = inner.crop(bbox) if bbox else inner

    target = round(size * 0.68)
    cw, ch = cropped.size
    scale = min(target / cw, target / ch)
    nw, nh = round(cw * scale), round(ch * scale)
    resized = cropped.resize((nw, nh), Image.LANCZOS)

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.alpha_composite(resized, ((size - nw) // 2, (size - nh) // 2))
    return out


def build_monochrome_mask(src: Image.Image, coeffs: list[list[float]], size: int) -> Image.Image:
    """
    Extracts a crisp white-on-transparent silhouette of the smiling bear,
    ribbon, three speech bubbles (with A / 文 / ض cut out), and soundwaves.
    """
    w, h = src.size
    px = src.load()
    plate = render_plate(coeffs, w, h)
    bpx = plate.load()
    valid = (
        src.getchannel("A")
        .filter(ImageFilter.MinFilter(31))
        .filter(ImageFilter.MinFilter(17))
    )
    vpx = valid.load()

    mask = Image.new("L", (w, h), 0)
    mpx = mask.load()

    for y in range(h):
        for x in range(w):
            if vpx[x, y] < 128:
                continue
            r, g, b, _ = px[x, y]
            br, bg_g, bb = bpx[x, y]
            dr, dg, db = r - br, g - bg_g, b - bb

            # Foreground elements: white bear, purple/magenta ribbon & waves,
            # purple/cyan/gold bubbles (excluding dark cast shadows on the plate).
            is_ribbon_fold = (r - g) > 25 and r > 55 and b > 140 and 95 <= x <= 235 and 290 <= y <= 410
            is_fg = (dr > 25) or (dg > 27) or (dr + dg + db > 48) or is_ribbon_fold
            if not is_fg:
                continue

            # Negative-space cutouts for the three white glyphs inside bubbles:
            # 1) "A" (purple bubble) & "文" (blue bubble)
            if x > 245 and y < 158 and (y < 134 or x > 338):
                if r > 208 and g > 208 and b > 215:
                    continue
            # 2) "ض" (warm gold bubble: gold body has low blue < 120, white glyph has high blue > 165)
            if x > 365 and 155 <= y <= 248:
                if r > 205 and g > 192 and b > 162:
                    continue

            mpx[x, y] = 255

    hi = (
        mask.resize((size, size), Image.BILINEAR)
        .filter(ImageFilter.MedianFilter(5))
        .filter(ImageFilter.GaussianBlur(1.8))
        .point(lambda v: 255 if v > 124 else 0)
        .filter(ImageFilter.GaussianBlur(0.7))
    )

    bbox = hi.getbbox()
    if bbox:
        cropped = hi.crop(bbox)
        target = round(size * 0.62)
        cw, ch = cropped.size
        sc = min(target / cw, target / ch)
        nw, nh = max(1, round(cw * sc)), max(1, round(ch * sc))
        centered = Image.new("L", (size, size), 0)
        centered.paste(cropped.resize((nw, nh), Image.LANCZOS), ((size - nw) // 2, (size - nh) // 2))
        hi = centered

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    white = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    out.paste(white, (0, 0), hi)
    return out


def build_squircle_mark(src: Image.Image, size: int, fill_ratio: float = 0.94) -> Image.Image:
    """Crisp RGBA squircle mark for the splash screen and in-app BrandMark."""
    bbox = src.getchannel("A").getbbox()
    cropped = src.crop(bbox) if bbox else src
    inner = max(1, round(size * fill_ratio))
    cw, ch = cropped.size
    sc = min(inner / cw, inner / ch)
    nw, nh = max(1, round(cw * sc)), max(1, round(ch * sc))
    resized = cropped.resize((nw, nh), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.alpha_composite(resized, ((size - nw) // 2, (size - nh) // 2))
    return out


def build_notification_icon(mono_1024: Image.Image, size: int = 96) -> Image.Image:
    """Android notification small icon: white silhouette filling ~88% of 96x96."""
    alpha = mono_1024.getchannel("A")
    bbox = alpha.getbbox()
    cropped = mono_1024.crop(bbox) if bbox else mono_1024
    target = round(size * 0.88)
    cw, ch = cropped.size
    sc = min(target / cw, target / ch)
    nw, nh = max(1, round(cw * sc)), max(1, round(ch * sc))
    resized = cropped.resize((nw, nh), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.alpha_composite(resized, ((size - nw) // 2, (size - nh) // 2))
    return out


def build_feature_graphic(src: Image.Image) -> Image.Image:
    """
    1024x500 Play Store feature graphic: deep indigo-violet gradient banner,
    the 3D Babelish mascot tile on the left, and three multilingual lesson
    cards on the right (no baked-in store copy, per Play Console best practice).
    """
    w, h = 1024 * 2, 500 * 2
    canvas = Image.new("RGB", (w, h), INDIGO_DEEP)
    px = canvas.load()
    for y in range(h):
        vy = y / (h - 1)
        for x in range(w):
            ux = x / (w - 1)
            t = ux * 0.65 + vy * 0.35
            px[x, y] = (
                lerp(INDIGO_TOP, INDIGO_MID, t / 0.55)
                if t < 0.55
                else lerp(INDIGO_MID, INDIGO_DEEP, (t - 0.55) / 0.45)
            )

    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    # Soft ambient glow behind the mascot icon
    draw.ellipse((76 * 2, 34 * 2, 508 * 2, 466 * 2), fill=VIOLET_GLOW + (34,))

    mascot = build_squircle_mark(src, 384 * 2, fill_ratio=1.0)
    overlay.alpha_composite(mascot, (100 * 2, (h - 384 * 2) // 2))

    # Three sleek lesson cards echoing the purple, sky-blue, and gold bubbles
    cards = [
        (566, 62, 368, 112, VIOLET_GLOW),
        (612, 194, 344, 112, SKY_ACCENT),
        (566, 326, 382, 112, GOLD_ACCENT),
    ]
    for cx, cy, cw, ch, accent in cards:
        draw.rounded_rectangle(
            (cx * 2, cy * 2, (cx + cw) * 2, (cy + ch) * 2),
            radius=30,
            fill=(255, 255, 255, 26),
        )
        draw.rounded_rectangle(
            ((cx + 24) * 2, (cy + 24) * 2, (cx + 148) * 2, (cy + 40) * 2),
            radius=8,
            fill=PARCHMENT + (88,),
        )
        draw.rounded_rectangle(
            ((cx + 24) * 2, (cy + 56) * 2, (cx + cw - 44) * 2, (cy + 69) * 2),
            radius=7,
            fill=accent + (210,),
        )
        draw.rounded_rectangle(
            ((cx + 24) * 2, (cy + 83) * 2, (cx + cw - 116) * 2, (cy + 93) * 2),
            radius=5,
            fill=PARCHMENT + (48,),
        )

    # Bottom brand accent bar
    draw.rectangle((0, (500 - 12) * 2, w, h), fill=VIOLET_GLOW + (255,))

    composed = canvas.convert("RGBA")
    composed.alpha_composite(overlay)
    return composed.convert("RGB").resize((1024, 500), Image.LANCZOS)


def save(image: Image.Image, name: str) -> None:
    path = os.path.abspath(os.path.join(OUT, name))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    image.save(path, "PNG", optimize=True)
    print(f"  {name:<34} {image.size[0]}x{image.size[1]}  {image.mode:<4}  {os.path.getsize(path) / 1024:.0f} KB")


def main() -> None:
    if not os.path.exists(SOURCE_PNG):
        raise FileNotFoundError(f"Missing master logo source: {SOURCE_PNG}")

    print("Babelish brand assets →", OUT)
    src = Image.open(SOURCE_PNG).convert("RGBA")
    coeffs = fit_plate_surface(src)

    # 1. Full-bleed launcher icon (iOS App Store + universal fallback, 24-bit RGB)
    icon_1024 = build_full_bleed_icon(src, coeffs, 1024)
    save(icon_1024, "icon.png")

    # 2. Android Adaptive Icon layers (background + 66% safe-zone foreground + monochrome)
    save(render_plate(coeffs, 1024, 1024), "android-icon-background.png")
    save(build_adaptive_foreground(src, 1024), "android-icon-foreground.png")
    mono_1024 = build_monochrome_mask(src, coeffs, 1024)
    save(mono_1024, "android-icon-monochrome.png")

    # 3. Splash icon (crisp RGBA squircle). Native-only: no web favicon.
    save(build_squircle_mark(src, 512, fill_ratio=0.94), "splash-icon.png")

    # 4. Android notification small icon (white silhouette on transparent)
    save(build_notification_icon(mono_1024, 96), "notification-icon.png")

    # 5. Google Play Console store assets (512x512 RGB icon + 1024x500 RGB feature graphic)
    save(icon_1024.resize((512, 512), Image.LANCZOS), "store/play-icon-512.png")
    save(build_feature_graphic(src), "store/feature-graphic.png")

    print("done")


if __name__ == "__main__":
    main()
