#!/usr/bin/env python3
"""Play Store graphics from the screenshot harness.

Run after `npm run shots -- after` (dark theme, seeded demo data):

    python3 tool/store_assets.py

Writes into fastlane/metadata/android/en-US/images/ (the layout fastlane
supply and F-Droid read):

- icon.png            512 x 512 app icon
- featureGraphic.png  1024 x 500 banner
- phoneScreenshots/   the harness's phone shots, padded to Play's 2:1 limit
- tenInchScreenshots/ the harness's landscape tablet shots
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "screenshots" / "after"
OUT = ROOT / "fastlane" / "metadata" / "android" / "en-US" / "images"

# The app's dark theme (src/ui/theme.ts), so padding blends into the screens.
BG = (14, 21, 18)
TEXT = (236, 243, 238)
MUTED = (155, 170, 161)
ACCENT = (74, 222, 128)

PHONE = [
    "home",
    "player",
    "feed",
    "episode",
    "queue",
    "discover",
    "stats",
    "echo-top",
]
TABLET = ["home", "player", "library", "feed"]


def font(size: int, weight: str = "Bold") -> ImageFont.FreeTypeFont:
    for path in (
        f"/usr/share/fonts/opentype/inter/Inter-{weight}.otf",
        f"/usr/share/fonts/truetype/dejavu/DejaVuSans{'-Bold' if weight == 'Bold' else ''}.ttf",
    ):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def pad_to_ratio(img: Image.Image, max_ratio: float = 2.0) -> Image.Image:
    """Play rejects a screenshot whose long side is more than twice the short one."""
    w, h = img.size
    if h / w <= max_ratio:
        return img
    width = int(round(h / max_ratio))
    canvas = Image.new("RGB", (width, h), BG)
    canvas.paste(img, ((width - w) // 2, 0))
    return canvas


def screenshots(names: list[str], suffix: str, folder: str) -> None:
    out = OUT / folder
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.png"):
        old.unlink()
    for i, name in enumerate(names, start=1):
        src = SHOTS / f"{name}--{suffix}.png"
        if not src.exists():
            raise SystemExit(f"missing {src}: run `npm run shots -- after` first")
        pad_to_ratio(Image.open(src).convert("RGB")).save(out / f"{i}.png", optimize=True)


def icon() -> Image.Image:
    return Image.open(ROOT / "assets" / "icon.png").convert("RGBA")


def feature_graphic() -> None:
    w, h = 1024, 500
    img = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(img)
    # A soft accent band behind the icon.
    draw.ellipse((-120, -60, 420, 560), fill=(23, 32, 28))
    art = icon().resize((260, 260), Image.LANCZOS)
    mask = Image.new("L", art.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *art.size), radius=58, fill=255)
    img.paste(art, (70, (h - 260) // 2), mask)
    x = 380
    draw.text((x, 150), "Sage Pod", font=font(92), fill=TEXT)
    draw.text((x, 262), "Free, open-source podcasts.", font=font(38, "Medium"), fill=MUTED)
    draw.text((x, 312), "No account. No ads. No tracking.", font=font(38, "Medium"), fill=ACCENT)
    img.save(OUT / "featureGraphic.png", optimize=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    icon().resize((512, 512), Image.LANCZOS).save(OUT / "icon.png", optimize=True)
    feature_graphic()
    screenshots(PHONE, "phone", "phoneScreenshots")
    screenshots(TABLET, "tablet-land", "tenInchScreenshots")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
