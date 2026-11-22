from PIL import Image, ImageDraw, ImageFont

img = Image.open('scripts/extracted_textures/tex_1.png').convert('RGBA')
w, h = img.size
print(f"tex_1 size: {w}x{h}")

# The background color of the car body paint:
# Let's sample a few red points on the hood/doors
print("Red paint sample 1:", img.getpixel((500, 300)))
print("Red paint sample 2:", img.getpixel((500, 700)))
print("Red paint sample 3:", img.getpixel((200, 500)))
print("Carbon black sample:", img.getpixel((350, 500)))
