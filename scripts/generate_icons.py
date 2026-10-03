import os
from PIL import Image, ImageDraw, ImageFilter

def create_brand_icon():
    size = 1024
    # Create base image with dark background and vibrant purple/violet gradient overlay
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background rounded rectangle (for full icon.png)
    # Deep violet/dark purple background: #0f172a / #4c1d95 / #6d28d9
    bg_img = Image.new("RGBA", (size, size), (15, 23, 42, 255))
    bg_draw = ImageDraw.Draw(bg_img)
    
    # Smooth gradient background
    for y in range(size):
        r = int(15 + (109 - 15) * (y / size))
        g = int(23 + (40 - 23) * (y / size))
        b = int(42 + (217 - 42) * (y / size))
        bg_draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # Draw rounded shield / speech bubble icon in foreground
    fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    fg_draw = ImageDraw.Draw(fg)

    # Center coordinates
    cx, cy = size // 2, size // 2 - 20

    # Draw Outer Glowing Speech Bubble
    bubble_box = [cx - 260, cy - 240, cx + 260, cy + 200]
    fg_draw.rounded_rectangle(bubble_box, radius=90, fill=(124, 58, 237, 240), outline=(167, 139, 250, 255), width=12)
    
    # Bubble tail (bottom left curved notch)
    tail_pts = [(cx - 140, cy + 180), (cx - 210, cy + 290), (cx - 70, cy + 195)]
    fg_draw.polygon(tail_pts, fill=(124, 58, 237, 240), outline=(167, 139, 250, 255))
    # Fill inner junction overlap
    fg_draw.rounded_rectangle([cx - 250, cy + 150, cx - 80, cy + 195], radius=20, fill=(124, 58, 237, 240))

    # Soundwave & Privacy Lock icon overlay inside bubble
    # Soundwave bars
    wave_color = (255, 255, 255, 240)
    bar_width = 24
    heights = [70, 130, 190, 130, 70]
    offsets = [-160, -80, 0, 80, 160]

    for offset, h in zip(offsets, heights):
        bx = cx + offset
        by1 = cy - h // 2
        by2 = cy + h // 2
        fg_draw.rounded_rectangle([bx - bar_width // 2, by1, bx + bar_width // 2, by2], radius=12, fill=wave_color)

    # Keyhole/Privacy dot overlay at center
    fg_draw.ellipse([cx - 30, cy - 35, cx + 30, cy + 25], fill=(79, 70, 229, 255))
    fg_draw.polygon([(cx - 18, cy + 15), (cx + 18, cy + 15), (cx + 25, cy + 75), (cx - 25, cy + 75)], fill=(79, 70, 229, 255))

    # Composite base image
    final_icon = Image.alpha_composite(bg_img, fg)

    # Save directories
    dirs = [
        "c:/Private Voices/apps/mobile/assets/images",
        "c:/Private Voices/apps/mobile/assets"
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)
        # 1. full icon.png
        final_icon.save(os.path.join(d, "icon.png"))
        # 2. adaptive-icon.png (foreground transparent)
        fg.save(os.path.join(d, "adaptive-icon.png"))
        # 3. splash-icon.png (512x512)
        splash_icon = final_icon.resize((512, 512), Image.Resampling.LANCZOS)
        splash_icon.save(os.path.join(d, "splash-icon.png"))
        # 4. favicon.png (48x48)
        fav_icon = final_icon.resize((48, 48), Image.Resampling.LANCZOS)
        fav_icon.save(os.path.join(d, "favicon.png"))

    print("Icons successfully generated!")

if __name__ == "__main__":
    create_brand_icon()
