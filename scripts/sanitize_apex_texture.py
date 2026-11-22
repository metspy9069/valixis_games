from PIL import Image, ImageDraw, ImageFont
import numpy as np

# Load original tex_1
img = Image.open('scripts/extracted_textures/tex_1.png').convert('RGBA')
draw = ImageDraw.Draw(img)

RED_BODY = (203, 21, 21, 255)
DARK_RED = (145, 12, 12, 255)
CARBON_BLACK = (20, 22, 26, 255)
CYAN_ACCENT = (0, 217, 255, 255)
GOLD_ACCENT = (255, 184, 0, 255)
WHITE = (255, 255, 255, 255)

# Try loading a bold font, or default
try:
    font_lg = ImageFont.truetype("arialbd.ttf", 32)
    font_md = ImageFont.truetype("arialbd.ttf", 22)
    font_sm = ImageFont.truetype("arialbd.ttf", 15)
    font_xs = ImageFont.truetype("arialbd.ttf", 12)
except Exception:
    font_lg = font_md = font_sm = font_xs = ImageFont.load_default()

def draw_valixis_shield(center_x, center_y, size=50):
    # Draw a stylized Valixis "V" racing shield
    hw = size // 2
    hh = size // 2
    # Shield outline: top straight, sides curve down to a point
    pts = [
        (center_x - hw, center_y - hh),
        (center_x + hw, center_y - hh),
        (center_x + hw, center_y + hh // 4),
        (center_x, center_y + hh),
        (center_x - hw, center_y + hh // 4)
    ]
    draw.polygon(pts, fill=CARBON_BLACK, outline=CYAN_ACCENT, width=2)
    # Winged "V" inside
    v_pts = [
        (center_x - hw * 0.65, center_y - hh * 0.4),
        (center_x, center_y + hh * 0.55),
        (center_x + hw * 0.65, center_y - hh * 0.4),
        (center_x + hw * 0.35, center_y - hh * 0.4),
        (center_x, center_y + hh * 0.2),
        (center_x - hw * 0.35, center_y - hh * 0.4)
    ]
    draw.polygon(v_pts, fill=GOLD_ACCENT)

# 1. Clean upper and lower "SCUDERIA CORSA" banners -> "VALIXIS APEX"
# Upper banner:
draw.rectangle([55, 150, 365, 206], fill=CARBON_BLACK)
draw.text((210, 178), "VALIXIS APEX", fill=WHITE, font=font_md, anchor="mm")
# Lower banner:
draw.rectangle([75, 625, 385, 681], fill=CARBON_BLACK)
draw.text((230, 653), "VALIXIS APEX", fill=WHITE, font=font_md, anchor="mm")

# 2. Clean "HUBLOT" banners -> "VALIXIS GT"
draw.rectangle([520, 175, 730, 220], fill=CARBON_BLACK)
draw.text((625, 197), "VALIXIS GT", fill=CYAN_ACCENT, font=font_sm, anchor="mm")
draw.rectangle([520, 615, 730, 660], fill=CARBON_BLACK)
draw.text((625, 637), "VALIXIS GT", fill=CYAN_ACCENT, font=font_sm, anchor="mm")

# 3. Clean "FERRARI BEVERLY HILLS" & "FERRARI SILICON VALLEY" & Pacific Western Bank
# Top door panel:
draw.rectangle([440, 30, 620, 105], fill=RED_BODY)
draw.text((530, 65), "VALIXIS RACING", fill=WHITE, font=font_sm, anchor="mm")
# Bottom door panel:
draw.rectangle([440, 730, 620, 805], fill=RED_BODY)
draw.text((530, 765), "VALIXIS RACING", fill=WHITE, font=font_sm, anchor="mm")

# 4. Clean "WeatherTech" headers above #64 (Replace with "VALIXIS")
# Top door #64:
draw.rectangle([375, 60, 450, 85], fill=CARBON_BLACK)
draw.text((412, 72), "VALIXIS", fill=CYAN_ACCENT, font=font_xs, anchor="mm")
draw.rectangle([375, 120, 450, 135], fill=CARBON_BLACK) # inverted WeatherTech text
# Bottom door #64:
draw.rectangle([375, 695, 450, 720], fill=CARBON_BLACK)
draw.text((412, 707), "VALIXIS", fill=CYAN_ACCENT, font=font_xs, anchor="mm")
draw.rectangle([375, 765, 450, 795], fill=RED_BODY) # small Scuderia text under 64
# Hood #64:
draw.rectangle([195, 385, 275, 410], fill=CARBON_BLACK)
draw.text((235, 397), "VALIXIS", fill=CYAN_ACCENT, font=font_xs, anchor="mm")
draw.rectangle([250, 385, 275, 460], fill=CARBON_BLACK) # side WeatherTech text on hood

# 5. Clean Front Windshield Banner (was green with "Ferrari" & horse logos)
# Bottom-left: [0, 805, 275, 875]
draw.rectangle([0, 805, 275, 875], fill=CARBON_BLACK)
draw.rectangle([0, 805, 275, 818], fill=CYAN_ACCENT) # Cyan top racing stripe
draw.text((137, 842), "VALIXIS RACING", fill=WHITE, font=font_md, anchor="mm")

# 6. Clean "MOTUL", "AERO", "VP" logos
# Top-left:
draw.rectangle([70, 25, 215, 105], fill=RED_BODY)
draw.text((142, 62), "APEX AERO", fill=WHITE, font=font_xs, anchor="mm")
# Bottom-left:
draw.rectangle([70, 725, 215, 805], fill=RED_BODY)
draw.text((142, 762), "APEX AERO", fill=WHITE, font=font_xs, anchor="mm")
# VP logos:
draw.rectangle([890, 40, 970, 115], fill=RED_BODY)
draw.rectangle([890, 720, 970, 795], fill=RED_BODY)

# 7. Clean all Ferrari Shields & replace with Valixis Shields
# Top-right shield [910, 165, 1010, 270]
draw.rectangle([910, 165, 1010, 270], fill=RED_BODY)
draw_valixis_shield(955, 215, size=60)

# Bottom-right shield [915, 575, 1010, 675]
draw.rectangle([915, 575, 1010, 675], fill=RED_BODY)
draw_valixis_shield(960, 625, size=60)

# Small shield beside top #64 [370, 145, 450, 210]
draw.rectangle([370, 145, 450, 210], fill=RED_BODY)
draw_valixis_shield(410, 178, size=40)

# Clean remaining yellow edges on right edge
draw.rectangle([970, 165, 1024, 270], fill=RED_BODY)
draw.rectangle([970, 575, 1024, 675], fill=RED_BODY)

# Small shield black square [950, 260, 1005, 315]
draw.rectangle([950, 260, 1005, 315], fill=CARBON_BLACK)

# 8. Clean "GTD" badges -> "GT SPORT"
draw.rectangle([635, 30, 720, 65], fill=CARBON_BLACK)
draw.text((677, 47), "GT SPORT", fill=CYAN_ACCENT, font=font_xs, anchor="mm")
draw.rectangle([635, 765, 720, 800], fill=CARBON_BLACK)
draw.text((677, 782), "GT SPORT", fill=CYAN_ACCENT, font=font_xs, anchor="mm")

# 9. Clean Rear Bumper markings
# [740, 865, 875, 930]: "SCUDERIA CORSA" & "GTD" & Pacific Western
draw.rectangle([740, 865, 875, 930], fill=RED_BODY)
draw.text((805, 887), "VALIXIS APEX", fill=WHITE, font=font_xs, anchor="mm")
draw.rectangle([815, 895, 875, 925], fill=CARBON_BLACK)
draw.text((845, 910), "GT", fill=CYAN_ACCENT, font=font_xs, anchor="mm")
draw.rectangle([630, 875, 725, 930], fill=RED_BODY) # Pacific Western on rear

# 10. Angled "SCUDERIA CORSA" on rear quarter arches
draw.rectangle([360, 25, 455, 55], fill=RED_BODY)
draw.rectangle([720, 275, 845, 335], fill=RED_BODY)
draw.rectangle([720, 510, 845, 570], fill=RED_BODY)

# 11. White horse in top-left [0, 60, 65, 150]
draw.rectangle([0, 60, 65, 150], fill=RED_BODY)

# 12. Bottom center nose script & IMSA [420, 875, 490, 915]
draw.rectangle([420, 875, 490, 915], fill=RED_BODY)

img.save('scripts/extracted_textures/tex_1_sanitized.png')
print("Successfully generated tex_1_sanitized.png!")
