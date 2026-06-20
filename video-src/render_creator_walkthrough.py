from __future__ import annotations

import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
VIDEO = ASSETS / "video"
SRC = VIDEO / "src"
FPS = 24
DURATION = 18

WINE = "#7a1633"
WINE_DEEP = "#3f0b1d"
WINE_DARK = "#260711"
WINE_LIGHT = "#b95876"
ROSE = "#f1dce3"
PAPER = "#f8f5f6"
INK = "#1d1720"
MUTED = "#706570"
WHITE = "#ffffff"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "seguisb.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size)


def ease(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return 1 - (1 - value) ** 3


def phase(t: float, start: float, end: float) -> float:
    return ease((t - start) / (end - start))


def rounded(draw: ImageDraw.ImageDraw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def fit_image(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    ratio = max(target_w / image.width, target_h / image.height)
    resized = image.resize(
        (round(image.width * ratio), round(image.height * ratio)),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def paste_glow(base: Image.Image, image: Image.Image, xy: tuple[int, int], blur=24):
    alpha = image.getchannel("A")
    glow = Image.new("RGBA", base.size)
    mask = Image.new("L", base.size)
    mask.paste(alpha, xy)
    mask = mask.filter(ImageFilter.GaussianBlur(blur))
    tint = Image.new("RGBA", base.size, (122, 22, 51, 0))
    tint.putalpha(mask.point(lambda p: round(p * 0.32)))
    base.alpha_composite(tint)
    base.alpha_composite(image, xy)


def draw_logo(base: Image.Image, logo: Image.Image, x: int, y: int, size: int):
    mark = logo.resize((size, size), Image.Resampling.LANCZOS)
    paste_glow(base, mark, (x, y), blur=max(8, size // 6))


def draw_cursor(base: Image.Image, x: int, y: int, click: float = 0):
    d = ImageDraw.Draw(base)
    if click > 0:
        radius = 16 + round(18 * click)
        d.ellipse((x - radius, y - radius, x + radius, y + radius), outline=(122, 22, 51, round(150 * (1 - click))), width=3)
    points = [(x, y), (x + 9, y + 24), (x + 14, y + 15), (x + 25, y + 14)]
    d.polygon(points, fill=WHITE, outline=WINE_DEEP)


def glass_panel(base: Image.Image, box, radius=18, dark=False):
    x1, y1, x2, y2 = box
    panel = Image.new("RGBA", (x2 - x1, y2 - y1), (255, 255, 255, 0))
    d = ImageDraw.Draw(panel)
    if dark:
        rounded(d, (0, 0, panel.width - 1, panel.height - 1), radius, (63, 11, 29, 235), (255, 255, 255, 30), 1)
    else:
        rounded(d, (0, 0, panel.width - 1, panel.height - 1), radius, (255, 255, 255, 224), (122, 22, 51, 28), 1)
    d.line((24, 1, panel.width * 0.45, 1), fill=(255, 255, 255, 180), width=2)
    shadow = Image.new("RGBA", base.size)
    shadow_mask = Image.new("L", base.size)
    ImageDraw.Draw(shadow_mask).rounded_rectangle(box, radius=radius, fill=90)
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(24))
    shadow.putalpha(shadow_mask)
    tint = Image.new("RGBA", base.size, (63, 11, 29, 0))
    tint.putalpha(shadow_mask)
    base.alpha_composite(tint, (0, 10))
    base.alpha_composite(panel, (x1, y1))


def draw_app_shell(base: Image.Image, box, logo: Image.Image, compact=False):
    x1, y1, x2, y2 = box
    glass_panel(base, box, radius=20)
    d = ImageDraw.Draw(base)
    header_h = 58 if not compact else 50
    d.line((x1, y1 + header_h, x2, y1 + header_h), fill=(122, 22, 51, 28), width=1)
    draw_logo(base, logo, x1 + 15, y1 + 10, 36 if not compact else 30)
    d.text((x1 + 58, y1 + 17), "ThumbForge", font=font(18 if not compact else 15, True), fill=WINE_DEEP)
    for i in range(3):
        cx = x2 - 22 - i * 18
        d.ellipse((cx - 3, y1 + 27, cx + 3, y1 + 33), fill=(122, 22, 51, 80))
    return header_h


def draw_source_scene(base, box, logo, t, compact=False):
    x1, y1, x2, y2 = box
    header = draw_app_shell(base, box, logo, compact)
    d = ImageDraw.Draw(base)
    pad = 24 if not compact else 16
    d.text((x1 + pad, y1 + header + 22), "Start with the actual video", font=font(28 if not compact else 20, True), fill=INK)
    d.text((x1 + pad, y1 + header + 61), "Paste a public link or the script.", font=font(16 if not compact else 13), fill=MUTED)
    field_y = y1 + header + (104 if not compact else 90)
    rounded(d, (x1 + pad, field_y, x2 - pad, field_y + 54), 9, (248, 245, 246, 255), (122, 22, 51, 45), 1)
    typed = "youtube.com/watch?v=creator-challenge"
    visible = typed[: round(len(typed) * phase(t, 3.0, 5.0))]
    d.text((x1 + pad + 17, field_y + 16), visible, font=font(15 if not compact else 12), fill=MUTED)
    button_w = 132 if not compact else 104
    button_box = (x2 - pad - button_w, field_y + 72, x2 - pad, field_y + 118)
    rounded(d, button_box, 8, WINE)
    d.text((button_box[0] + 22, button_box[1] + 13), "Analyze video", font=font(14 if not compact else 11, True), fill=WHITE)
    cursor_p = phase(t, 4.5, 5.6)
    cursor_x = round((x1 + pad + 80) * (1 - cursor_p) + (button_box[0] + button_w // 2) * cursor_p)
    cursor_y = round((field_y + 20) * (1 - cursor_p) + (button_box[1] + 20) * cursor_p)
    click = max(0, 1 - abs(t - 5.65) / 0.25)
    draw_cursor(base, cursor_x, cursor_y, click)
    status_y = field_y + 145
    if t > 5.5:
        d.text((x1 + pad, status_y), "Reading transcript", font=font(13 if not compact else 11, True), fill=WINE)
        progress = phase(t, 5.5, 6.9)
        rounded(d, (x1 + pad, status_y + 28, x2 - pad, status_y + 36), 4, ROSE)
        rounded(d, (x1 + pad, status_y + 28, x1 + pad + round((x2 - x1 - 2 * pad) * progress), status_y + 36), 4, WINE)


def draw_analysis_scene(base, box, logo, t, compact=False):
    x1, y1, x2, y2 = box
    header = draw_app_shell(base, box, logo, compact)
    d = ImageDraw.Draw(base)
    pad = 22 if not compact else 14
    d.text((x1 + pad, y1 + header + 18), "Context locked", font=font(27 if not compact else 20, True), fill=INK)
    d.text((x1 + pad, y1 + header + 54), "The brief is built from the source.", font=font(15 if not compact else 12), fill=MUTED)
    labels = [
        ("THE HOOK", "25 creators. One final winner."),
        ("THE CAST", "Only people in the video."),
        ("THE VIBE", "High-energy competition."),
    ]
    card_gap = 12
    card_top = y1 + header + (92 if not compact else 82)
    available = y2 - card_top - pad
    card_h = (available - card_gap * 2) // 3
    for i, (label, value) in enumerate(labels):
        appear = phase(t, 7.0 + i * 0.35, 7.65 + i * 0.35)
        slide = round((1 - appear) * 28)
        top = card_top + i * (card_h + card_gap) + slide
        rounded(d, (x1 + pad, top, x2 - pad, top + card_h), 10, (248, 245, 246, round(245 * appear)), (122, 22, 51, round(32 * appear)), 1)
        d.text((x1 + pad + 16, top + 14), label, font=font(12 if not compact else 10, True), fill=WINE)
        d.text((x1 + pad + 16, top + 38), value, font=font(17 if not compact else 13, True), fill=INK)
        d.ellipse((x2 - pad - 35, top + 20, x2 - pad - 17, top + 38), fill=WINE)
        d.text((x2 - pad - 32, top + 18), "OK", font=font(10, True), fill=WHITE)


def draw_concepts_scene(base, box, logo, thumbs, t, compact=False):
    x1, y1, x2, y2 = box
    header = draw_app_shell(base, box, logo, compact)
    d = ImageDraw.Draw(base)
    pad = 22 if not compact else 14
    d.text((x1 + pad, y1 + header + 18), "Choose the strongest direction", font=font(25 if not compact else 18, True), fill=INK)
    d.text((x1 + pad, y1 + header + 52), "Finished concepts, not random generations.", font=font(14 if not compact else 11), fill=MUTED)
    content_top = y1 + header + (88 if not compact else 76)
    if compact:
        thumb_w = x2 - x1 - pad * 2
        thumb_h = round(thumb_w * 9 / 16)
        positions = [(x1 + pad, content_top), (x1 + pad, content_top + thumb_h + 16)]
    else:
        gap = 16
        thumb_w = (x2 - x1 - pad * 2 - gap) // 2
        thumb_h = round(thumb_w * 9 / 16)
        positions = [(x1 + pad, content_top), (x1 + pad + thumb_w + gap, content_top)]
    for i, (thumb, pos) in enumerate(zip(thumbs, positions)):
        appear = phase(t, 11 + i * 0.35, 11.8 + i * 0.35)
        image = fit_image(thumb, (thumb_w, thumb_h))
        if i == 0 and t > 13.0:
            border = WINE
            width = 5
        else:
            border = (122, 22, 51, 45)
            width = 1
        top = pos[1] + round((1 - appear) * 35)
        base.alpha_composite(image, (pos[0], top))
        d.rounded_rectangle((pos[0], top, pos[0] + thumb_w, top + thumb_h), radius=8, outline=border, width=width)
    if t > 13:
        d.text((positions[0][0], positions[0][1] + thumb_h + 12), "SELECTED  |  MOBILE CHECK PASSED", font=font(12 if not compact else 10, True), fill=WINE)
        cursor_p = phase(t, 12.3, 13.1)
        cx = round((x2 - 40) * (1 - cursor_p) + (positions[0][0] + thumb_w * 0.72) * cursor_p)
        cy = round((y2 - 40) * (1 - cursor_p) + (positions[0][1] + thumb_h * 0.6) * cursor_p)
        draw_cursor(base, cx, cy, max(0, 1 - abs(t - 13.05) / 0.25))


def caption(base, text, subtext, xy, width, dark=False, align="left"):
    x, y = xy
    d = ImageDraw.Draw(base)
    color = WHITE if dark else INK
    muted = (255, 255, 255, 165) if dark else MUTED
    d.text((x, y), text, font=font(39 if width > 500 else 31, True), fill=color, anchor="la" if align == "left" else "ma")
    d.text((x, y + 54), subtext, font=font(17 if width > 500 else 14), fill=muted, anchor="la" if align == "left" else "ma")


def frame_wide(t, presenter, logo, thumbs):
    base = Image.new("RGBA", (1280, 720), PAPER)
    d = ImageDraw.Draw(base)
    d.rectangle((0, 0, 1280, 8), fill=WINE)
    draw_logo(base, logo, 44, 32, 54)
    d.text((106, 48), "ThumbForge", font=font(21, True), fill=WINE_DEEP)
    d.text((1138, 50), "CREATOR GUIDE", font=font(12, True), fill=WINE)

    creator = presenter.copy()
    creator = ImageEnhance.Contrast(creator).enhance(1.03)
    creator.thumbnail((530, 640), Image.Resampling.LANCZOS)
    y = 720 - creator.height + 18
    paste_glow(base, creator, (-22, y), 32)

    app_box = (510, 92, 1230, 644)
    if t < 3:
        intro = phase(t, 0, 1.1)
        caption(base, "Your thumbnail should know the video.", "Here is the 18-second ThumbForge workflow.", (520, 205), 680)
        glass_panel(base, (520, 360, 1170, 510), 18)
        d.text((553, 393), "Link or script", font=font(16, True), fill=WINE)
        d.text((760, 393), ">", font=font(25, True), fill=WINE_LIGHT)
        d.text((825, 393), "Context", font=font(16, True), fill=WINE)
        d.text((964, 393), ">", font=font(25, True), fill=WINE_LIGHT)
        d.text((1025, 393), "Concept", font=font(16, True), fill=WINE)
        d.text((553, 455), "One guided flow. No prompt roulette.", font=font(18), fill=MUTED)
    elif t < 7:
        draw_source_scene(base, app_box, logo, t, False)
        caption(base, "1. Drop in the source", "The platform starts with context, not a blank prompt.", (56, 112), 430)
    elif t < 11:
        draw_analysis_scene(base, app_box, logo, t, False)
        caption(base, "2. Let it read the story", "Hook, cast, and visual energy are extracted first.", (56, 112), 430)
    elif t < 15:
        draw_concepts_scene(base, app_box, logo, thumbs, t, False)
        caption(base, "3. Pick a reviewed concept", "Every credit becomes a finished direction.", (56, 112), 430)
    else:
        final = fit_image(thumbs[0], (680, 383))
        final_x, final_y = 520, 140
        base.alpha_composite(final, (final_x, final_y))
        d.rounded_rectangle((final_x, final_y, final_x + 680, final_y + 383), radius=12, outline=(255, 255, 255, 180), width=2)
        overlay = Image.new("RGBA", base.size, (38, 7, 17, 118))
        base.alpha_composite(overlay)
        caption(base, "Ready for the feed.", "Context first. Click second.", (70, 180), 430, dark=True)
        rounded(d, (70, 304, 320, 360), 9, WINE)
        d.text((104, 320), "CREATE YOUR BRIEF", font=font(16, True), fill=WHITE)
        draw_logo(base, logo, 70, 405, 86)
    return base.convert("RGB")


def frame_mobile(t, presenter, logo, thumbs):
    base = Image.new("RGBA", (720, 1280), PAPER)
    d = ImageDraw.Draw(base)
    d.rectangle((0, 0, 720, 9), fill=WINE)
    draw_logo(base, logo, 34, 28, 52)
    d.text((95, 45), "ThumbForge", font=font(20, True), fill=WINE_DEEP)
    d.text((562, 47), "GUIDE", font=font(12, True), fill=WINE)

    creator = presenter.copy()
    creator.thumbnail((430, 520), Image.Resampling.LANCZOS)
    if t < 11:
        paste_glow(base, creator, (-54, 780), 28)
    app_box = (34, 192, 686, 805)
    if t < 3:
        d.text((36, 164), "Your thumbnail should", font=font(34, True), fill=INK)
        d.text((36, 210), "know the video.", font=font(34, True), fill=INK)
        d.text((36, 266), "A creator-first walkthrough.", font=font(15), fill=MUTED)
        glass_panel(base, (36, 430, 684, 640), 18)
        d.text((68, 470), "LINK OR SCRIPT", font=font(15, True), fill=WINE)
        d.text((285, 470), ">", font=font(25, True), fill=WINE_LIGHT)
        d.text((350, 470), "CONTEXT", font=font(15, True), fill=WINE)
        d.text((505, 470), ">", font=font(25, True), fill=WINE_LIGHT)
        d.text((565, 470), "CLICK", font=font(15, True), fill=WINE)
        d.text((68, 550), "No blank prompt. No random faces.", font=font(19), fill=MUTED)
    elif t < 7:
        draw_source_scene(base, app_box, logo, t, True)
        caption(base, "1. Send the source", "Paste the video link or script.", (36, 95), 640)
    elif t < 11:
        draw_analysis_scene(base, app_box, logo, t, True)
        caption(base, "2. Lock the context", "Hook. Cast. Vibe.", (36, 95), 640)
    elif t < 15:
        draw_concepts_scene(base, app_box, logo, thumbs, t, True)
        caption(base, "3. Choose the concept", "Reviewed and ready for mobile.", (36, 95), 640)
    else:
        final = fit_image(thumbs[0], (652, 367))
        base.alpha_composite(final, (34, 245))
        d.rounded_rectangle((34, 245, 686, 612), radius=12, outline=(255, 255, 255, 180), width=2)
        overlay = Image.new("RGBA", base.size, (38, 7, 17, 118))
        base.alpha_composite(overlay)
        d.text((36, 115), "Ready for", font=font(38, True), fill=WHITE)
        d.text((36, 166), "the feed.", font=font(38, True), fill=WHITE)
        d.text((36, 226), "Context first. Click second.", font=font(16), fill=(255, 255, 255, 175))
        rounded(d, (36, 700, 344, 762), 9, WINE)
        d.text((74, 719), "CREATE YOUR BRIEF", font=font(18, True), fill=WHITE)
        draw_logo(base, logo, 36, 830, 100)
    return base.convert("RGB")


def render(name: str, size: tuple[int, int], frame_fn):
    out = VIDEO / f"thumbforge-process-{name}.mp4"
    poster = VIDEO / f"thumbforge-process-{name}-poster.jpg"
    command = [
        "ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{size[0]}x{size[1]}", "-r", str(FPS), "-i", "-",
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "22",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    poster_frame = None
    for index in range(FPS * DURATION):
        t = index / FPS
        image = frame_fn(t)
        if abs(t - 13.5) < 1 / FPS:
            poster_frame = image.copy()
        process.stdin.write(image.tobytes())
    process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError(f"ffmpeg failed for {name}")
    (poster_frame or frame_fn(13.5)).save(poster, quality=88, optimize=True)
    print(f"Rendered {out}")


def main():
    presenter = Image.open(SRC / "creator-presenter.png").convert("RGBA")
    presenter = presenter.crop(presenter.getbbox())
    logo = Image.open(ASSETS / "brand" / "thumbforge-logo.png").convert("RGBA")
    thumbs = [
        Image.open(ASSETS / "sample-football.png").convert("RGBA"),
        Image.open(ASSETS / "sample-youtube-legends.png").convert("RGBA"),
    ]
    render("wide", (1280, 720), lambda t: frame_wide(t, presenter, logo, thumbs))
    render("mobile", (720, 1280), lambda t: frame_mobile(t, presenter, logo, thumbs))


if __name__ == "__main__":
    main()
