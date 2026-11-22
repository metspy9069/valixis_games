from PIL import Image, ImageDraw, ImageFont
import os

try:
    font_xl = ImageFont.truetype("arialbd.ttf", 36)
    font_lg = ImageFont.truetype("arialbd.ttf", 28)
    font_md = ImageFont.truetype("arialbd.ttf", 20)
    font_sm = ImageFont.truetype("arialbd.ttf", 15)
    font_xs = ImageFont.truetype("arialbd.ttf", 12)
except Exception:
    font_xl = font_lg = font_md = font_sm = font_xs = ImageFont.load_default()

RED_BODY = (203, 21, 21, 255)
CARBON_BLACK = (20, 22, 26, 255)
CYAN_ACCENT = (0, 217, 255, 255)
GOLD_ACCENT = (255, 184, 0, 255)
WHITE = (255, 255, 255, 255)

def draw_valixis_shield(draw, center_x, center_y, size=50):
    hw = size // 2
    hh = size // 2
    pts = [
        (center_x - hw, center_y - hh),
        (center_x + hw, center_y - hh),
        (center_x + hw, center_y + hh // 4),
        (center_x, center_y + hh),
        (center_x - hw, center_y + hh // 4)
    ]
    draw.polygon(pts, fill=CARBON_BLACK, outline=CYAN_ACCENT, width=2)
    v_pts = [
        (center_x - hw * 0.65, center_y - hh * 0.4),
        (center_x, center_y + hh * 0.55),
        (center_x + hw * 0.65, center_y - hh * 0.4),
        (center_x + hw * 0.35, center_y - hh * 0.4),
        (center_x, center_y + hh * 0.2),
        (center_x - hw * 0.35, center_y - hh * 0.4)
    ]
    draw.polygon(v_pts, fill=GOLD_ACCENT)

# -------------------------------------------------------------
# 1. Sanitize tex_1.png (Apex GT Body Livery)
# -------------------------------------------------------------
def sanitize_tex_1():
    img = Image.open('scripts/extracted_textures/tex_1.png').convert('RGBA')
    draw = ImageDraw.Draw(img)

    # Upper/lower banners
    draw.rectangle([55, 145, 365, 210], fill=CARBON_BLACK)
    draw.text((210, 178), "VALIXIS APEX", fill=WHITE, font=font_md, anchor="mm")
    draw.rectangle([70, 620, 390, 685], fill=CARBON_BLACK)
    draw.text((230, 653), "VALIXIS APEX", fill=WHITE, font=font_md, anchor="mm")

    # Hublot banners
    draw.rectangle([510, 170, 740, 225], fill=CARBON_BLACK)
    draw.text((625, 197), "VALIXIS GT", fill=CYAN_ACCENT, font=font_sm, anchor="mm")
    draw.rectangle([510, 610, 740, 665], fill=CARBON_BLACK)
    draw.text((625, 637), "VALIXIS GT", fill=CYAN_ACCENT, font=font_sm, anchor="mm")

    # Doors
    draw.rectangle([430, 20, 630, 130], fill=RED_BODY)
    draw.text((530, 65), "VALIXIS RACING", fill=WHITE, font=font_sm, anchor="mm")
    draw.rectangle([430, 720, 630, 830], fill=RED_BODY)
    draw.text((530, 765), "VALIXIS RACING", fill=WHITE, font=font_sm, anchor="mm")

    # Numbers 64 & Weathertech
    draw.rectangle([365, 55, 455, 90], fill=CARBON_BLACK)
    draw.text((410, 72), "VALIXIS", fill=CYAN_ACCENT, font=font_xs, anchor="mm")
    draw.rectangle([365, 115, 455, 140], fill=CARBON_BLACK)

    draw.rectangle([365, 690, 455, 725], fill=CARBON_BLACK)
    draw.text((410, 707), "VALIXIS", fill=CYAN_ACCENT, font=font_xs, anchor="mm")
    draw.rectangle([365, 760, 455, 805], fill=RED_BODY) # clean under 64

    # Hood 64
    draw.rectangle([190, 380, 280, 415], fill=CARBON_BLACK)
    draw.text((235, 397), "VALIXIS", fill=CYAN_ACCENT, font=font_xs, anchor="mm")
    draw.rectangle([200, 380, 275, 465], fill=CARBON_BLACK) # sides of hood 64
    draw.text((237, 430), "64", fill=WHITE, font=font_lg, anchor="mm")

    # Windshield Banner (Entire green/white bar covered)
    draw.rectangle([0, 795, 285, 885], fill=CARBON_BLACK)
    draw.rectangle([0, 795, 285, 815], fill=CYAN_ACCENT)
    draw.text((140, 848), "VALIXIS RACING", fill=WHITE, font=font_md, anchor="mm")

    # MOTUL / AERO / VP
    draw.rectangle([65, 20, 220, 110], fill=RED_BODY)
    draw.text((142, 62), "APEX AERO", fill=WHITE, font=font_xs, anchor="mm")
    draw.rectangle([65, 720, 220, 810], fill=RED_BODY)
    draw.text((142, 762), "APEX AERO", fill=WHITE, font=font_xs, anchor="mm")
    draw.rectangle([880, 35, 975, 120], fill=RED_BODY)
    draw.rectangle([880, 715, 975, 800], fill=RED_BODY)

    # Ferrari Shields -> Valixis Shields
    draw.rectangle([900, 160, 1024, 275], fill=RED_BODY)
    draw_valixis_shield(draw, 955, 215, size=60)
    draw.rectangle([900, 570, 1024, 680], fill=RED_BODY)
    draw_valixis_shield(draw, 960, 625, size=60)
    draw.rectangle([360, 140, 455, 215], fill=RED_BODY)
    draw_valixis_shield(draw, 410, 178, size=40)
    draw.rectangle([945, 255, 1010, 320], fill=CARBON_BLACK) # horse square

    # Green Motegi logos -> Valixis Cyan badges
    draw.rectangle([790, 170, 900, 240], fill=CARBON_BLACK)
    draw.text((845, 205), "VALIXIS", fill=CYAN_ACCENT, font=font_xs, anchor="mm")
    draw.rectangle([805, 595, 910, 660], fill=CARBON_BLACK)
    draw.text((857, 627), "VALIXIS", fill=CYAN_ACCENT, font=font_xs, anchor="mm")

    # GTD -> GT SPORT
    draw.rectangle([630, 25, 725, 70], fill=CARBON_BLACK)
    draw.text((677, 47), "GT SPORT", fill=CYAN_ACCENT, font=font_xs, anchor="mm")
    draw.rectangle([630, 760, 725, 805], fill=CARBON_BLACK)
    draw.text((677, 782), "GT SPORT", fill=CYAN_ACCENT, font=font_xs, anchor="mm")

    # Rear Bumper
    draw.rectangle([625, 860, 885, 935], fill=RED_BODY)
    draw.rectangle([805, 890, 875, 930], fill=CARBON_BLACK)
    draw.text((840, 910), "GT", fill=CYAN_ACCENT, font=font_xs, anchor="mm")
    draw.text((795, 878), "VALIXIS APEX", fill=WHITE, font=font_xs, anchor="mm")

    # Angled logos & nose scripts
    draw.rectangle([355, 20, 460, 60], fill=RED_BODY)
    draw.rectangle([715, 270, 850, 340], fill=RED_BODY)
    draw.rectangle([715, 505, 850, 575], fill=RED_BODY)
    draw.rectangle([0, 55, 70, 155], fill=RED_BODY)
    draw.rectangle([415, 870, 495, 920], fill=RED_BODY)

    img.save('scripts/extracted_textures/tex_1.png')
    print("Sanitized tex_1.png")

# -------------------------------------------------------------
# 2. Sanitize tex_0.png (Apex GT Badges)
# -------------------------------------------------------------
def sanitize_tex_0():
    img = Image.open('scripts/extracted_textures/tex_0.png').convert('RGBA')
    draw = ImageDraw.Draw(img)
    # Wipe out Ferrari shields and replace with Valixis emblems
    # Shield left: [40, 320, 175, 490]
    draw.rectangle([35, 315, 180, 495], fill=CARBON_BLACK)
    draw_valixis_shield(draw, 107, 405, size=120)

    # Rectangle center: [215, 330, 315, 485]
    draw.rectangle([215, 330, 315, 485], fill=CARBON_BLACK)
    draw.rectangle([215, 330, 315, 350], fill=GOLD_ACCENT)
    draw.rectangle([215, 465, 315, 485], fill=CYAN_ACCENT)
    draw.text((265, 407), "VALIXIS", fill=WHITE, font=font_md, anchor="mm")

    # Horse right: [340, 320, 470, 490]
    draw.rectangle([340, 320, 470, 490], fill=CARBON_BLACK)
    draw_valixis_shield(draw, 405, 405, size=110)

    img.save('scripts/extracted_textures/tex_0.png')
    print("Sanitized tex_0.png")

# -------------------------------------------------------------
# 3. Sanitize tex_2.png (Apex GT MISC Banner)
# -------------------------------------------------------------
def sanitize_tex_2():
    img = Image.open('scripts/extracted_textures/tex_2.png').convert('RGBA')
    draw = ImageDraw.Draw(img)
    # Yellow banner with FERRARI [0, 180, 512, 285]
    draw.rectangle([0, 180, 512, 285], fill=CARBON_BLACK)
    draw.rectangle([0, 180, 512, 195], fill=CYAN_ACCENT)
    draw.rectangle([0, 270, 512, 285], fill=GOLD_ACCENT)
    draw.text((256, 232), "VALIXIS APEX GT", fill=WHITE, font=font_lg, anchor="mm")

    # Lower horse badge [390, 300, 490, 400]
    draw.rectangle([390, 300, 490, 400], fill=CARBON_BLACK)
    draw_valixis_shield(draw, 440, 350, size=75)

    img.save('scripts/extracted_textures/tex_2.png')
    print("Sanitized tex_2.png")

# -------------------------------------------------------------
# 4. Sanitize tex_6.png (Apex GT Steering Wheel)
# -------------------------------------------------------------
def sanitize_tex_6():
    img = Image.open('scripts/extracted_textures/tex_6.png').convert('RGBA')
    draw = ImageDraw.Draw(img)
    # Horn button at center of wheel: [360, 270, 395, 305]
    draw.ellipse([360, 270, 395, 305], fill=CARBON_BLACK, outline=CYAN_ACCENT, width=1)
    draw.text((377, 287), "V", fill=GOLD_ACCENT, font=font_xs, anchor="mm")

    img.save('scripts/extracted_textures/tex_6.png')
    print("Sanitized tex_6.png")

# -------------------------------------------------------------
# 5. Sanitize tex_9.png (Apex GT Tires)
# -------------------------------------------------------------
def sanitize_tex_9():
    img = Image.open('scripts/extracted_textures/tex_9.png').convert('RGBA')
    draw = ImageDraw.Draw(img)
    # Mask out "EAGLE" and "GOODYEAR" on tire sidewalls
    # "EAGLE" top: [140, 20, 370, 95]
    draw.rectangle([140, 20, 370, 95], fill=(22, 24, 28, 255))
    draw.text((256, 57), "VALIXIS", fill=GOLD_ACCENT, font=font_lg, anchor="mm")
    # "GOODYEAR" bottom: [60, 330, 450, 490]
    draw.rectangle([60, 330, 450, 490], fill=(22, 24, 28, 255))
    draw.text((256, 410), "APEX SPORT", fill=GOLD_ACCENT, font=font_lg, anchor="mm")

    img.save('scripts/extracted_textures/tex_9.png')
    print("Sanitized tex_9.png")

# -------------------------------------------------------------
# 6. Sanitize tex_12.png (Apex GT Horn/Badge)
# -------------------------------------------------------------
def sanitize_tex_12():
    img = Image.open('scripts/extracted_textures/tex_12.png').convert('RGBA')
    draw = ImageDraw.Draw(img)
    # Giant horse circle: [5, 5, 240, 240]
    draw.ellipse([5, 5, 240, 240], fill=CARBON_BLACK, outline=CYAN_ACCENT, width=3)
    draw_valixis_shield(draw, 122, 122, size=150)

    img.save('scripts/extracted_textures/tex_12.png')
    print("Sanitized tex_12.png")

# -------------------------------------------------------------
# 7. Sanitize Lambo Textures (Hyperion GTR)
# -------------------------------------------------------------
def sanitize_lambo_textures():
    # lambo_tex_10.png (License plate / rear deck, 512x256)
    p10 = 'scripts/extracted_lambo_textures/lambo_tex_10.png'
    if os.path.exists(p10):
        img = Image.open(p10).convert('RGBA')
        draw = ImageDraw.Draw(img)
        draw.rectangle([0, 0, 512, 256], fill=(230, 234, 240, 255))
        draw.text((256, 128), "VALIXIS HYPERION GTR", fill=(30, 35, 45, 255), font=font_lg, anchor="mm")
        img.save(p10)
        print("Sanitized lambo_tex_10.png")

    # lambo_tex_13.png (Badges & scripts, 256x256)
    p13 = 'scripts/extracted_lambo_textures/lambo_tex_13.png'
    if os.path.exists(p13):
        img = Image.open(p13).convert('RGBA')
        draw = ImageDraw.Draw(img)
        # Clear whole image
        draw.rectangle([0, 0, 256, 256], fill=(30, 32, 36, 255))
        # Draw Valixis Hyperion Crest on top-left shield area: [10, 10, 115, 125]
        draw_valixis_shield(draw, 62, 67, size=85)
        # Add "HYPERION" script across text strips
        draw.text((185, 20), "HYPERION", fill=GOLD_ACCENT, font=font_sm, anchor="mm")
        draw.text((185, 55), "VALIXIS", fill=CYAN_ACCENT, font=font_sm, anchor="mm")
        draw.text((128, 145), "VALIXIS HYPERDRIVE", fill=WHITE, font=font_sm, anchor="mm")
        draw.text((128, 185), "GTR HYPERCAR", fill=CYAN_ACCENT, font=font_xs, anchor="mm")
        img.save(p13)
        print("Sanitized lambo_tex_13.png")

    # lambo_tex_14.png (Normal map of badges)
    p14 = 'scripts/extracted_lambo_textures/lambo_tex_14.png'
    if os.path.exists(p14):
        # Fill with neutral normal color (128, 128, 255)
        img = Image.new('RGB', (256, 256), color=(128, 128, 255))
        img.save(p14)
        print("Sanitized lambo_tex_14.png")

if __name__ == "__main__":
    sanitize_tex_1()
    sanitize_tex_0()
    sanitize_tex_2()
    sanitize_tex_6()
    sanitize_tex_9()
    sanitize_tex_12()
    sanitize_lambo_textures()
    print("ALL TEXTURES SUCCESSFULLY SANITIZED!")
