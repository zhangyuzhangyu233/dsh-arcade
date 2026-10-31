"""Build the game's embedded image assets from the source art.

Outputs `src/generated/assets.js` (ES module with data URIs) consumed by the
client bundle. Frames of the maid are extracted from the animated GIFs and
re-encoded as individual PNGs so the client can play them at a speed that
tracks the game world instead of the GIF's fixed rate.

Run animation and static slide pose come from the latest art drop
(`output/animation/run_1_25x_v12/deliverables`). The slide frame is scaled so
its character stays the same size as the run frames, even though the pose bbox
is much wider and flatter.
"""
from PIL import Image, ImageSequence
import os, io, json, base64

ROOT = r"C:\Users\zy134\Desktop\dsh-game\output"
ANIM = os.path.join(ROOT, "animation", "run_1_25x_v12", "deliverables")
OUT_DIR = r"C:\Users\zy134\Desktop\dsh-game\dsh-sushi-run\src\generated"
os.makedirs(OUT_DIR, exist_ok=True)

# Retro resolution: the browser renders these at half size on a DPR-2 screen.
FRAME_HEIGHT = 168          # ~94 CSS px * 2; the runner is drawn 78 CSS px tall
FOOD_BOX = {                # CSS px logical boxes per food type
    "apple":     {"height": 34, "scale": 2},
    "bowl":      {"height": 32, "scale": 2},
    "onigiri":   {"height": 36, "scale": 2},
    "sushi":     {"height": 28, "scale": 2},
    "ramen":     {"height": 40, "scale": 2},
    "omurice":   {"height": 38, "scale": 2},
    "cake_slice":{"height": 38, "scale": 2},
    "ice_cream": {"height": 40, "scale": 2},
    "sundae":    {"height": 40, "scale": 2},
    "coin":      {"height": 28, "scale": 2},
    "banknote":  {"height": 30, "scale": 2},
}

# Keys are the UI color schemes: light uses black line art, dark white line art.
MAID_FILES = {
    "light": "run-black-1.25x-transparent.gif",
    "dark": "run-white-1.25x-transparent.gif",
}
SLIDE_FILES = {
    "light": "slide-black-static-transparent.png",
    "dark": "slide-white-static-transparent.png",
}
# The original three foods live in the art drop; the newer ones were dropped
# into the repo's own assets/foods folder.
LOCAL_FOOD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "foods")
CURRENCY_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "currency")
FOOD_FILES = {
    "apple":      {"light": os.path.join(LOCAL_FOOD_DIR, "apple_black_outline.png"),
                   "dark":  os.path.join(LOCAL_FOOD_DIR, "apple_white_outline.png")},
    "bowl":       {"light": os.path.join(ROOT, "rice_bowl_black_outline.png"),
                   "dark":  os.path.join(ROOT, "极简白色寿司饭碗图标.png")},
    "onigiri":    {"light": os.path.join(ROOT, "onigiri_black_outline.png"),
                   "dark":  os.path.join(ROOT, "白描饭团图标.png")},
    "sushi":      {"light": os.path.join(ROOT, "sushi_black_outline.png"),
                   "dark":  os.path.join(ROOT, "白线简约寿司图标.png")},
    "ramen":      {"light": os.path.join(LOCAL_FOOD_DIR, "ramen_black_outline.png"),
                   "dark":  os.path.join(LOCAL_FOOD_DIR, "ramen_white_outline.png")},
    "omurice":    {"light": os.path.join(LOCAL_FOOD_DIR, "omurice_black_outline.png"),
                   "dark":  os.path.join(LOCAL_FOOD_DIR, "omurice_white_outline.png")},
    "cake_slice": {"light": os.path.join(LOCAL_FOOD_DIR, "cake_slice_black_outline.png"),
                   "dark":  os.path.join(LOCAL_FOOD_DIR, "cake_slice_white_outline.png")},
    "ice_cream":  {"light": os.path.join(LOCAL_FOOD_DIR, "ice_cream_black_outline.png"),
                   "dark":  os.path.join(LOCAL_FOOD_DIR, "ice_cream_white_outline.png")},
    "sundae":     {"light": os.path.join(LOCAL_FOOD_DIR, "sundae_black_outline.png"),
                   "dark":  os.path.join(LOCAL_FOOD_DIR, "sundae_white_outline.png")},
    "coin":       {"light": os.path.join(CURRENCY_DIR, "coin_black.png"),
                   "dark":  os.path.join(CURRENCY_DIR, "coin_white.png")},
    "banknote":   {"light": os.path.join(CURRENCY_DIR, "banknote_black.png"),
                   "dark":  os.path.join(CURRENCY_DIR, "banknote_white.png")},
}

# Obstacles: one art file per theme, baked into a shared box so the footprint is
# identical in light and dark mode. `height` is the CSS display height.
OBSTACLE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "obstacles")
OBSTACLE_FILES = {
    "bamboo": {
        "height": 160,   # hang length; the engine trims the ground gap at runtime
        "files": {"light": os.path.join(OBSTACLE_DIR, "bamboo_black.png"),
                  "dark": os.path.join(OBSTACLE_DIR, "bamboo_white.png")},
    },
    "spike": {
        "height": 44,    # a single ground spike; the engine packs 1-4 of them
        "files": {"light": os.path.join(OBSTACLE_DIR, "spike_black.png"),
                  "dark": os.path.join(OBSTACLE_DIR, "spike_white.png")},
    },
}


def data_uri(im, fmt="PNG", **kw):
    buf = io.BytesIO()
    im.save(buf, format=fmt, **kw)
    raw = buf.getvalue()
    mime = "image/png" if fmt == "PNG" else "image/webp"
    return f"data:{mime};base64,{base64.b64encode(raw).decode('ascii')}", len(raw)


def union_bbox(frames):
    boxes = [f.convert("RGBA").getchannel("A").getbbox() for f in frames]
    boxes = [b for b in boxes if b]
    if not boxes:
        return None
    return (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))


def maid_frames(name, path):
    im = Image.open(path)
    frames = []
    frame_ms = []
    for frame in ImageSequence.Iterator(im):
        frames.append(frame.convert("RGBA"))
        frame_ms.append(frame.info.get("duration") or 20)
    box = union_bbox(frames)
    # 2 px transparent breathing room, clamped to the canvas.
    l, t, r, b = box
    l, t = max(0, l - 2), max(0, t - 2)
    r, b = min(im.width, r + 2), min(im.height, b + 2)
    crop_w, crop_h = r - l, b - t
    target_h = FRAME_HEIGHT
    target_w = max(1, round(crop_w * target_h / crop_h))
    uris = []
    total = 0
    for fr in frames:
        cut = fr.crop((l, t, r, b)).resize((target_w, target_h), Image.LANCZOS)
        uri, size = data_uri(cut, "PNG", optimize=True)
        uris.append(uri)
        total += size
    print(f"maid {name}: {len(uris)} frames {target_w}x{target_h} cycle {sum(frame_ms)}ms total {total/1024:.1f} KiB")
    return {"frames": uris, "width": target_w, "height": target_h, "frameMs": frame_ms}, crop_h


def slide_frame(name, path, run_crop_h):
    """Static duck/slide pose, scaled to the same character size as the run."""
    im = Image.open(path).convert("RGBA")
    box = im.getchannel("A").getbbox()
    l, t, r, b = box
    im = im.crop((l, t, r, b))
    scale = FRAME_HEIGHT / run_crop_h
    target_h = max(1, round(im.height * scale))
    target_w = max(1, round(im.width * target_h / im.height))
    im = im.resize((target_w, target_h), Image.LANCZOS)
    uri, size = data_uri(im, "PNG", optimize=True)
    print(f"slide {name}: {target_w}x{target_h} {size/1024:.1f} KiB")
    return {"src": uri, "width": target_w, "height": target_h}


def food_aspect(path):
    im = Image.open(path).convert("RGBA")
    box = im.getchannel("A").getbbox()
    return (box[2] - box[0]) / max(1, box[3] - box[1])


def food(name, mode, path, target_w, target_h):
    """Crop to the alpha bbox and resize into the shared per-type box. Both
    themes get the exact same width/height so an icon never changes size when
    the UI switches between light and dark."""
    im = Image.open(path).convert("RGBA")
    box = im.getchannel("A").getbbox()
    l, t, r, b = box
    im = im.crop((l, t, r, b)).resize((target_w, target_h), Image.LANCZOS)
    uri, size = data_uri(im, "PNG", optimize=True)
    print(f"food {name}/{mode}: {target_w}x{target_h} css {target_w/2:.1f}x{target_h/2:.1f} {size/1024:.1f} KiB")
    return {"src": uri, "w": target_w, "h": target_h}


def obstacle_frame(name, mode, path, target_w, target_h):
    """Hanging obstacle art, cropped to the bbox and baked into a shared box."""
    im = Image.open(path).convert("RGBA")
    box = im.getchannel("A").getbbox()
    l, t, r, b = box
    im = im.crop((l, t, r, b)).resize((target_w, target_h), Image.LANCZOS)
    uri, size = data_uri(im, "PNG", optimize=True)
    print(f"obstacle {name}/{mode}: {target_w}x{target_h} {size/1024:.1f} KiB")
    return {"src": uri, "w": target_w, "h": target_h}


assets = {"maid": {}, "foods": {}, "obstacles": {}}
for mode, filename in MAID_FILES.items():
    data, run_crop_h = maid_frames(mode, os.path.join(ANIM, filename))
    data["slide"] = slide_frame(mode, os.path.join(ANIM, SLIDE_FILES[mode]), run_crop_h)
    assets["maid"][mode] = data
for food_name, modes in FOOD_FILES.items():
    # Shared box per type (mean of both themes' bbox aspect) => same size always.
    aspects = [food_aspect(path) for path in modes.values()]
    canonical = FOOD_BOX[food_name].get("aspect") or (sum(aspects) / len(aspects))
    target_h = FOOD_BOX[food_name]["height"] * FOOD_BOX[food_name]["scale"]
    target_w = max(1, round(target_h * canonical))
    assets["foods"][food_name] = {}
    for mode, path in modes.items():
        assets["foods"][food_name][mode] = food(food_name, mode, path, target_w, target_h)
for obs_name, cfg in OBSTACLE_FILES.items():
    modes = cfg["files"]
    aspects = [food_aspect(path) for path in modes.values()]
    target_h = cfg["height"] * 2
    target_w = max(1, round(target_h * (sum(aspects) / len(aspects))))
    assets["obstacles"][obs_name] = {}
    for mode, path in modes.items():
        assets["obstacles"][obs_name][mode] = obstacle_frame(obs_name, mode, path, target_w, target_h)

out = os.path.join(OUT_DIR, "assets.js")
with open(out, "w", encoding="utf-8") as f:
    f.write("// Generated by tools/build-assets.py — do not edit by hand.\n")
    f.write("export const ASSETS = ")
    f.write(json.dumps(assets, ensure_ascii=False, separators=(",", ":")))
    f.write(";\n")
print("wrote", out, os.path.getsize(out) / 1024, "KiB")
