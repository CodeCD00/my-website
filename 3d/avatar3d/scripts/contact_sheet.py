"""Assemble the web-renderer stills into one review sheet:  python3 3d/avatar3d/scripts/contact_sheet.py [name]"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

P = Path(__file__).resolve().parents[1] / "previews"
name = sys.argv[1] if len(sys.argv) > 1 else "draft1_sheet"
views = [("front", "web_front"), ("3/4", "web_three_quarter"), ("side", "web_side"), ("back", "web_back")]
exprs = ["not_talking", "talking", "smug", "sure", "evil"]
sheet = Image.new("RGB", (1600, 820), (32, 28, 44))
d = ImageDraw.Draw(sheet)
try:
    f = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 20)
except OSError:
    f = None
for i, (lab, n) in enumerate(views):
    im = Image.open(P / f"{n}.png").convert("RGB").crop((100, 60, 700, 860)).resize((337, 450))
    x = i * 400 + 31
    sheet.paste(im, (x, 0))
    d.text((x + 8, 8), lab, fill=(30, 20, 10), font=f)
for i, e in enumerate(exprs):
    im = Image.open(P / f"web_expr_{e}.png").convert("RGB").resize((300, 300))
    x = i * 320 + 10
    sheet.paste(im, (x, 470))
    d.text((x + 8, 778), e, fill=(246, 231, 210), font=f)
sheet.save(P / f"{name}.png")
print("wrote", P / f"{name}.png")
