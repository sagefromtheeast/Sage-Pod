#!/usr/bin/env python3
"""Store screenshots with a device frame and a caption, for Google Play and the App Store.

Capture the screens at store resolution first (the default harness shots are
too small for a 1290 px wide iPhone image):

    SHOTS_SCALE=2.5 npm run shots -- store
    python3 tool/store_mockups.py          # needs Pillow

Writes store-assets/:

- google-play/phone/    1080 x 1920   (9:16, Play phone screenshots)
- google-play/tablet/   2560 x 1600   (16:10, Play 7" and 10" tablet screenshots)
- app-store/iphone/     1290 x 2796   (6.9" iPhone, the size App Store Connect requires)
- app-store/ipad/       2064 x 2752   (13" iPad)

The frames are drawn here (a generic phone and tablet, no maker's design), in
the website's colours: forest ink and lime, alternating with pale mint.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "screenshots" / "store"
OUT = ROOT / "store-assets"

INK = (22, 51, 0)          # website --ink
LIME = (159, 232, 112)     # website --lime
MIST = (226, 246, 213)     # website --mist
BODY = (17, 22, 19)        # device body, near the app's own background
EDGE = (58, 66, 61)        # thin highlight round the body
SS = 2                     # supersampling for smooth curves

PHONE = [
    ("home", "Podcasts that stay on your phone."),
    ("player", "Hear more of what you came for."),
    ("feed", "Every episode of every show you follow."),
    ("episode", "Resume, download or queue in one tap."),
    ("queue", "You decide what plays next."),
    ("discover", "Follow anything with a feed."),
    ("stats", "See where your listening hours go."),
    ("echo-top", "Your year in podcasts, every December."),
]
TABLET = [
    ("home", "Pick up where you stopped."),
    ("player", "Hear more of what you came for."),
    ("library", "Your whole library at a glance."),
    ("feed", "Every episode of every show you follow."),
]

FONT = "/usr/share/fonts/opentype/inter/InterDisplay-Black.otf"


def font(size: int) -> ImageFont.FreeTypeFont:
    if Path(FONT).exists():
        return ImageFont.truetype(FONT, size)
    return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size)


def wrap(draw: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont, width: int) -> list[str]:
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=f) <= width or not line:
            line = trial
        else:
            lines.append(line)
            line = word
    lines.append(line)
    return lines


def caption(img: Image.Image, text: str, box: tuple[int, int, int, int], size: int, colour) -> None:
    """Headline in Inter Display Black, wrapped into box, shrunk until it fits."""
    draw = ImageDraw.Draw(img)
    x, y, w, h = box
    while True:
        f = font(size)
        lines = wrap(draw, text, f, w)
        lead = int(size * 1.02)
        if len(lines) * lead <= h or size < 20:
            break
        size = int(size * 0.94)
    for i, line in enumerate(lines):
        draw.text((x, y + i * lead), line, font=f, fill=colour)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def device(screen: Image.Image, screen_w: int, kind: str) -> Image.Image:
    """A screen inside a generic device body. Returns RGBA, body edge to body edge."""
    sw = screen_w
    sh = round(screen.height * sw / screen.width)
    short = min(sw, sh)
    bezel = round(short * (0.030 if kind == "phone" else 0.034))
    r_screen = round(short * (0.105 if kind == "phone" else 0.045))
    bw, bh = sw + 2 * bezel, sh + 2 * bezel
    side = max(4, round(short * 0.012)) if kind == "phone" else 0
    out = Image.new("RGBA", (bw + 2 * side, bh), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    # Side buttons (phone only): volume on the left, power on the right.
    if side:
        btn = dict(fill=(36, 42, 38))
        d.rounded_rectangle((0, round(bh * 0.20), side * 2, round(bh * 0.27)), radius=side, **btn)
        d.rounded_rectangle((0, round(bh * 0.29), side * 2, round(bh * 0.36)), radius=side, **btn)
        d.rounded_rectangle((bw, round(bh * 0.24), bw + 2 * side, round(bh * 0.32)), radius=side, **btn)
    body = Image.new("RGBA", (bw, bh), EDGE + (255,))
    ring = max(2, round(short * 0.004))
    inner = Image.new("RGBA", (bw - 2 * ring, bh - 2 * ring), BODY + (255,))
    body.paste(inner, (ring, ring), rounded_mask(inner.size, r_screen + bezel - ring))
    out.paste(body, (side, 0), rounded_mask((bw, bh), r_screen + bezel))
    shot = screen.convert("RGB").resize((sw, sh), Image.LANCZOS)
    out.paste(shot, (side + bezel, bezel), rounded_mask((sw, sh), r_screen))
    # Front camera: a punch hole on the phone, a dot in the bezel on the tablet.
    if kind == "phone":
        cr = round(sw * 0.017)
        cx, cy = side + bw // 2, bezel + round(sw * 0.035)
        d = ImageDraw.Draw(out)
        d.ellipse((cx - cr, cy - cr, cx + cr, cy + cr), fill=(5, 7, 6))
    else:
        cr = round(bezel * 0.16)
        if bw > bh:
            cx, cy = bezel // 2, bh // 2
        else:
            cx, cy = bw // 2, bezel // 2
        ImageDraw.Draw(out).ellipse((cx - cr, cy - cr, cx + cr, cy + cr), fill=(40, 46, 42))
    return out


def shadow(dev: Image.Image, blur: int, strength: int) -> Image.Image:
    alpha = dev.split()[-1].point(lambda a: strength if a else 0)
    sh = Image.new("RGBA", dev.size, (0, 0, 0, 0))
    sh.putalpha(alpha)
    pad = blur * 3
    canvas = Image.new("RGBA", (dev.width + 2 * pad, dev.height + 2 * pad), (0, 0, 0, 0))
    canvas.paste(sh, (pad, pad))
    return canvas.filter(ImageFilter.GaussianBlur(blur))


def compose_portrait(shot: Image.Image, text: str, size: tuple[int, int], kind: str, dark: bool) -> Image.Image:
    W, H = size[0] * SS, size[1] * SS
    bg, fg = (INK, LIME) if dark else (MIST, INK)
    img = Image.new("RGBA", (W, H), bg + (255,))
    m = round(W * 0.085)
    top = round(H * 0.065)
    head_h = round(H * 0.17)
    caption(img, text, (m, top, W - 2 * m, head_h), round(W * (0.092 if kind == "phone" else 0.072)), fg)
    screen_w = round(W * (0.70 if kind == "phone" else 0.80))
    dev = device(shot, screen_w, kind)
    x = (W - dev.width) // 2
    y = top + head_h + round(H * 0.035)
    # The device runs off the bottom edge, so the screen is as large as the canvas allows.
    blur = round(W * 0.025)
    sh = shadow(dev, blur, 120 if dark else 70)
    img.alpha_composite(sh, (x - blur * 3, y - blur * 3 + round(W * 0.02)))
    img.alpha_composite(dev, (x, y))
    return img.convert("RGB").resize(size, Image.LANCZOS)


def compose_landscape(shot: Image.Image, text: str, size: tuple[int, int], dark: bool) -> Image.Image:
    W, H = size[0] * SS, size[1] * SS
    bg, fg = (INK, LIME) if dark else (MIST, INK)
    img = Image.new("RGBA", (W, H), bg + (255,))
    m = round(W * 0.05)
    col = round(W * 0.31)
    caption(img, text, (m, round(H * 0.12), col - m, round(H * 0.6)), round(W * 0.042), fg)
    screen_w = round(W * 0.62)
    dev = device(shot, screen_w, "tablet")
    x = W - dev.width - round(W * 0.035)
    y = (H - dev.height) // 2 + round(H * 0.08)
    blur = round(W * 0.012)
    sh = shadow(dev, blur, 120 if dark else 70)
    img.alpha_composite(sh, (x - blur * 3, y - blur * 3 + round(W * 0.01)))
    img.alpha_composite(dev, (x, y))
    return img.convert("RGB").resize(size, Image.LANCZOS)


def load(name: str, suffix: str) -> Image.Image:
    src = SHOTS / f"{name}--{suffix}.png"
    if not src.exists():
        raise SystemExit(f"missing {src}: run `SHOTS_SCALE=2.5 npm run shots -- store` first")
    return Image.open(src)


def write(img: Image.Image, folder: Path, i: int, name: str) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    img.save(folder / f"{i:02d}-{name}.png", optimize=True)


def main() -> None:
    for old in OUT.glob("**/*.png"):
        old.unlink()
    for i, (name, text) in enumerate(PHONE, start=1):
        shot, dark = load(name, "phone"), i % 2 == 1
        write(compose_portrait(shot, text, (1080, 1920), "phone", dark), OUT / "google-play" / "phone", i, name)
        write(compose_portrait(shot, text, (1290, 2796), "phone", dark), OUT / "app-store" / "iphone", i, name)
    for i, (name, text) in enumerate(TABLET, start=1):
        dark = i % 2 == 1
        land = load(name, "tablet-land")
        write(compose_landscape(land, text, (2560, 1600), dark), OUT / "google-play" / "tablet", i, name)
        port = load(name, "tablet")
        write(compose_portrait(port, text, (2064, 2752), "tablet", dark), OUT / "app-store" / "ipad", i, name)
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
