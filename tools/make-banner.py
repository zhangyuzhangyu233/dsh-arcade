"""Compose the dsh-arcade repo/social banner from the pixel-art seaside drop.

    python tools/make-banner.py

Outputs (assets/branding/):
  banner-16x9.png    1920x1080  — README header, 16:9
  banner-social.png  1280x640   — GitHub social preview, 2:1
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = "assets/branding"
FONT_BOLD = r"C:\Windows\Fonts\msyhbd.ttc"
FONT_UI = r"C:\Windows\Fonts\msyh.ttc"

TITLE_ZH = "等待模型思考的同时，何不来上一把？"

SKY_LOGO_TOP = 0.155     # logo top as a fraction of banner height
LOGO_WIDTH = 0.56        # logo width as a fraction of banner width
SUBTITLE_GAP = 34


def pixel_text(text, target_h, color=(255, 255, 255, 255), stroke=(16, 22, 45, 255), stroke_w=2):
    """Render CJK text at a small size, then nearest-upscale it -> pixel look."""
    base = max(14, int(target_h / 3))
    font = ImageFont.truetype(FONT_BOLD, base)
    box = font.getbbox(text)
    tw = box[2] - box[0] + stroke_w * 4
    th = box[3] - box[1] + stroke_w * 4
    low = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    d = ImageDraw.Draw(low)
    d.text((stroke_w * 2 - box[0], stroke_w * 2 - box[1]), text, font=font,
           fill=color, stroke_width=stroke_w, stroke_fill=stroke)
    scale = max(1, round(target_h / low.height))
    return low.resize((low.width * scale, low.height * scale), Image.NEAREST)


def hard_shadow(img, dx, dy, alpha=170):
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    a = img.split()[3].point(lambda v: int(v * alpha / 255))
    color = Image.new("RGBA", img.size, (8, 12, 30, 0))
    color.putalpha(a)
    shadow.paste(color, (dx, dy), color)
    return shadow


def logo_layer(width, height, logo_path, fraction_w, top_fraction):
    logo = Image.open(logo_path).convert("RGBA")
    bbox = logo.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox()
    logo = logo.crop(bbox)
    target_w = int(width * fraction_w)
    scale = target_w / logo.width
    logo = logo.resize((target_w, max(1, round(logo.height * scale))), Image.LANCZOS)
    x = (width - logo.width) // 2
    y = int(height * top_fraction)
    layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    # Soft navy glow so the cream logo edge separates from the bright sky.
    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    ghost = Image.new("RGBA", logo.size, (9, 16, 40, 0))
    ghost.putalpha(logo.split()[3].point(lambda v: int(v * 0.5)))
    glow.paste(ghost, (x, y + 10), ghost)
    glow = glow.filter(ImageFilter.GaussianBlur(9))
    layer.alpha_composite(glow)
    layer.paste(logo, (x, y), logo)
    return layer, x, y, logo.width, logo.height



NPM_CMD = "npm i @kennielearngames/dsh-arcade"
NPM_COLORS = [(238, 91, 87), (242, 201, 76), (76, 195, 138), (76, 201, 240),
              (176, 106, 179), (242, 153, 74), (91, 124, 250), (168, 224, 99)]
CREAM = (255, 246, 214, 255)
NAVY = (15, 20, 48, 255)


def pixel_command(text, target_h):
    """Chunky pixel glyphs: cream border, navy outline, bright colour fill —
    the same layering as the pixel wordmark, rendered low-res then nearest-upscaled."""
    base = max(12, int(target_h / 2.6))
    font = ImageFont.truetype("C:/Windows/Fonts/consolab.ttf", base)
    spacing = max(1, base // 8)
    margin = 5
    widths = [max(1, round(font.getlength(ch))) for ch in text]
    low_w = sum(widths) + spacing * (len(text) - 1) + margin * 2
    low_h = base * 2 + margin * 2
    low = Image.new("RGBA", (low_w, low_h), (0, 0, 0, 0))
    d = ImageDraw.Draw(low)
    x = margin
    for i, ch in enumerate(text):
        d.text((x, margin), ch, font=font, fill=CREAM, stroke_width=2, stroke_fill=CREAM)
        d.text((x, margin), ch, font=font, fill=NAVY, stroke_width=1, stroke_fill=NAVY)
        d.text((x, margin), ch, font=font, fill=NPM_COLORS[i % len(NPM_COLORS)] + (255,))
        x += widths[i] + spacing
    bbox = low.getbbox()
    low = low.crop(bbox)
    scale = max(2, round(target_h / low.height))
    return low.resize((low.width * scale, low.height * scale), Image.NEAREST)


def draw_npm_badge(base, width, height):
    cmd = pixel_command(NPM_CMD, target_h=int(height * 0.050))
    pad_x = max(16, cmd.height // 2)
    pad_y = max(8, cmd.height // 4)
    bw, bh = cmd.width + pad_x * 2, cmd.height + pad_y * 2
    x, y = (width - bw) // 2, height - int(height * 0.045) - bh
    shadow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([x + 3, y + 6, x + bw + 3, y + bh + 6], radius=8,
                         fill=(4, 8, 20, 140))
    base.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(4)))
    plate = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    pd = ImageDraw.Draw(plate)
    pd.rounded_rectangle([0, 0, bw - 1, bh - 1], radius=8,
                         fill=(12, 16, 38, 205), outline=CREAM, width=2)
    plate.alpha_composite(cmd, (pad_x, pad_y))
    base.alpha_composite(plate, (x, y))


def compose(width, height, output, logo_fraction=LOGO_WIDTH, logo_top=SKY_LOGO_TOP,
            subtitle_h=58):
    bg = Image.open(f"{ROOT}/seaside.webp").convert("RGBA")
    # cover-crop to the target aspect
    target_ratio = width / height
    src_ratio = bg.width / bg.height
    if src_ratio > target_ratio:
        new_h = bg.height
        new_w = int(new_h * target_ratio)
        left = (bg.width - new_w) // 2
        bg = bg.crop((left, 0, left + new_w, new_h))
    else:
        new_w = bg.width
        new_h = int(new_w / target_ratio)
        top = (bg.height - new_h) // 2
        bg = bg.crop((0, top, new_w, top + new_h))
    bg = bg.resize((width, height), Image.LANCZOS)

    base = bg.copy()
    layer, lx, ly, lw, lh = logo_layer(width, height, f"{ROOT}/logo-title.png",
                                       logo_fraction, logo_top)
    base.alpha_composite(layer)

    # subtitle centred under the logo, in a pixelated CJK style
    sub = pixel_text(TITLE_ZH, subtitle_h)
    sx = (width - sub.width) // 2
    sy = ly + lh + int(height * SUBTITLE_GAP / 1080)
    base.alpha_composite(hard_shadow(sub, 0, max(3, subtitle_h // 9)), (sx, sy))
    base.alpha_composite(sub, (sx, sy))

    draw_npm_badge(base, width, height)

    base.convert("RGB").save(output, optimize=True)
    print("wrote", output, base.size)


if __name__ == "__main__":
    compose(1920, 1080, f"{ROOT}/banner-16x9.png")
    compose(1280, 640, f"{ROOT}/banner-social.png",
            logo_fraction=0.60, logo_top=0.13, subtitle_h=34)
