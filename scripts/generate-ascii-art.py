#!/usr/bin/env python3
"""
Mimi Code - Photo to ANSI Terminal Art Generator
Converts a parrot photo into colored terminal ASCII art at multiple sizes.

Usage:
    python3 generate-ascii-art.py <image_path> [--width 80] [--output-dir ../assets/ascii/]
"""

import sys
import os
import argparse
from PIL import Image, ImageEnhance, ImageFilter

# ─── Character ramps (dark → light) ────────────────────────────────────────
CHARS_DETAILED = " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"
CHARS_SIMPLE   = " .:-=+*#%@"
CHARS_BLOCK    = " ░▒▓█"

# ─── ANSI color utilities ──────────────────────────────────────────────────

def rgb_to_ansi256(r, g, b):
    """Convert RGB to closest ANSI 256-color code."""
    if r == g == b:
        if r < 8: return 16
        if r > 248: return 231
        return round((r - 8) / 247 * 24) + 232
    return 16 + (36 * round(r / 255 * 5)) + (6 * round(g / 255 * 5)) + round(b / 255 * 5)

def rgb_to_truecolor_fg(r, g, b):
    """ANSI true-color foreground escape."""
    return f"\033[38;2;{r};{g};{b}m"

def rgb_to_truecolor_bg(r, g, b):
    """ANSI true-color background escape."""
    return f"\033[48;2;{r};{g};{b}m"

RESET = "\033[0m"

# ─── Image preprocessing ──────────────────────────────────────────────────

def preprocess_parrot(img, enhance_yellow=True):
    """Enhance the yellow parrot colors for better terminal display."""
    img = img.convert("RGB")

    # Boost saturation
    enhancer = ImageEnhance.Color(img)
    img = enhancer.enhance(1.6)

    # Boost brightness slightly
    enhancer = ImageEnhance.Brightness(img)
    img = enhancer.enhance(1.2)

    # Boost contrast
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(1.3)

    if enhance_yellow:
        # Shift colors toward golden yellow for the parrot
        pixels = img.load()
        w, h = img.size
        for y in range(h):
            for x in range(w):
                r, g, b = pixels[x, y]
                # Detect yellowish pixels and enhance them
                if r > 80 and g > 60 and b < r * 0.7:
                    # Push toward bright golden yellow
                    r = min(255, int(r * 1.3))
                    g = min(255, int(g * 1.2))
                    b = max(0, int(b * 0.6))
                    pixels[x, y] = (r, g, b)

    return img

def crop_subject(img, padding=0.05):
    """Auto-crop to the main subject (the parrot) with some padding."""
    gray = img.convert("L")
    # Find bounding box of non-background pixels
    # Use edge detection to find the subject
    edges = gray.filter(ImageFilter.FIND_EDGES)
    bbox = edges.getbbox()
    if bbox:
        w, h = img.size
        pad_x = int(w * padding)
        pad_y = int(h * padding)
        x1 = max(0, bbox[0] - pad_x)
        y1 = max(0, bbox[1] - pad_y)
        x2 = min(w, bbox[2] + pad_x)
        y2 = min(h, bbox[3] + pad_y)
        return img.crop((x1, y1, x2, y2))
    return img

# ─── ASCII Art Generators ─────────────────────────────────────────────────

def image_to_colored_ascii(img, width=80, char_ramp=CHARS_DETAILED):
    """Convert image to colored ASCII art with true-color ANSI codes."""
    w_orig, h_orig = img.size
    aspect = h_orig / w_orig
    height = int(width * aspect * 0.45)  # Terminal chars are ~2x tall

    img_resized = img.resize((width, height), Image.Resampling.LANCZOS)

    lines = []
    for y in range(height):
        line = ""
        for x in range(width):
            r, g, b = img_resized.getpixel((x, y))
            brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255
            char_idx = int(brightness * (len(char_ramp) - 1))
            char = char_ramp[char_idx]
            line += rgb_to_truecolor_fg(r, g, b) + char
        line += RESET
        lines.append(line)

    return "\n".join(lines)

def image_to_block_art(img, width=40):
    """Convert image to half-block (▀▄) art — 2 pixels per character."""
    w_orig, h_orig = img.size
    aspect = h_orig / w_orig
    height = int(width * aspect * 0.9)  # Each char = 2 vertical pixels
    if height % 2 != 0:
        height += 1

    img_resized = img.resize((width, height), Image.Resampling.LANCZOS)

    lines = []
    for y in range(0, height, 2):
        line = ""
        for x in range(width):
            r1, g1, b1 = img_resized.getpixel((x, y))
            if y + 1 < height:
                r2, g2, b2 = img_resized.getpixel((x, y + 1))
            else:
                r2, g2, b2 = 0, 0, 0

            # Upper half = foreground color, lower half = background color
            fg = rgb_to_truecolor_fg(r1, g1, b1)
            bg = rgb_to_truecolor_bg(r2, g2, b2)
            line += fg + bg + "▀"
        line += RESET
        lines.append(line)

    return "\n".join(lines)

def image_to_plain_ascii(img, width=80, char_ramp=CHARS_SIMPLE):
    """Convert image to plain (no color) ASCII art."""
    w_orig, h_orig = img.size
    aspect = h_orig / w_orig
    height = int(width * aspect * 0.45)

    gray = img.convert("L")
    gray = gray.resize((width, height), Image.Resampling.LANCZOS)

    lines = []
    for y in range(height):
        line = ""
        for x in range(width):
            brightness = gray.getpixel((x, y)) / 255
            char_idx = int(brightness * (len(char_ramp) - 1))
            line += char_ramp[char_idx]
        lines.append(line)

    return "\n".join(lines)

# ─── Banner generation ─────────────────────────────────────────────────────

def generate_startup_banner(version="0.1.0"):
    """Hand-crafted small startup banner with ANSI colors."""

    Y = "\033[38;2;255;215;0m"    # Golden yellow
    LY = "\033[38;2;255;245;157m"  # Light yellow (highlights)
    DY = "\033[38;2;204;164;0m"    # Dark yellow (shadows)
    BK = "\033[38;2;40;40;40m"     # Black (eye)
    BR = "\033[38;2;120;80;40m"    # Brown (beak)
    PK = "\033[38;2;220;170;170m"  # Pink (feet)
    GR = "\033[38;2;100;100;100m"  # Gray (text)
    WH = "\033[38;2;255;255;255m"  # White
    CY = "\033[38;2;100;200;200m"  # Cyan (accent)
    R = "\033[0m"

    banner = f"""
{GR}    ╭───────────────────────────────────────╮{R}
{GR}    │{R}  {DY}       ▄▄▄▄▄{R}                          {GR}│{R}
{GR}    │{R}  {Y}     ▄█▓▓▓▓▓█▄{R}                        {GR}│{R}
{GR}    │{R}  {Y}    █▓▓▓▓▓▓▓▓▓█{R}                       {GR}│{R}
{GR}    │{R}  {Y}   █▓▓{BK}◕{Y}▓▓▓▓▓▓▓█{R}                      {GR}│{R}
{GR}    │{R}  {Y}   █▓▓▓{BR}◗{Y}▓▓▓▓▓▓█{R}    {WH}M I M I  C O D E{R}  {GR}│{R}
{GR}    │{R}  {Y}    █▓▓▓▓▓▓▓▓█{R}     {GR}~chirp chirp!~{R}    {GR}│{R}
{GR}    │{R}  {LY}   █▓▓▓▓▓▓▓▓▓▓█{R}                      {GR}│{R}
{GR}    │{R}  {DY}    █▓▓▓▓▓▓▓▓█{R}    {GR}v{version}{R}             {GR}│{R}
{GR}    │{R}  {DY}     ▀█▓▓▓█▀{R}                          {GR}│{R}
{GR}    │{R}  {PK}       ╫╫ ╫╫{R}                          {GR}│{R}
{GR}    │{R}  {GR}      ─┴┴─┴┴─{R}                         {GR}│{R}
{GR}    ╰───────────────────────────────────────╯{R}
"""
    return banner

def generate_minimal_prompt():
    """Ultra-minimal parrot for use in prompts."""
    Y = "\033[38;2;255;215;0m"
    BK = "\033[38;2;40;40;40m"
    BR = "\033[38;2;120;80;40m"
    R = "\033[0m"
    return f"{Y}({BK}◕{Y}▓{BR}◗{Y}){R}"

def generate_thinking_frames():
    """Animated thinking spinner frames."""
    Y = "\033[38;2;255;215;0m"
    BK = "\033[38;2;40;40;40m"
    BR = "\033[38;2;120;80;40m"
    GR = "\033[38;2;150;150;150m"
    R = "\033[0m"

    bird = f"{Y}({BK}◕{Y}▓{BR}◗{Y}){R}"
    frames = [
        f"  {bird} {GR}～{R}",
        f"  {bird} {GR}～～{R}",
        f"  {bird} {GR}～～～{R}",
        f"  {bird} {GR}～～～～{R}",
    ]
    return frames

def generate_error_face():
    """Sad parrot for errors."""
    Y = "\033[38;2;255;215;0m"
    BK = "\033[38;2;40;40;40m"
    BR = "\033[38;2;120;80;40m"
    RD = "\033[38;2;255;80;80m"
    R = "\033[0m"
    return f"  {Y}({BK}◕{Y}﹏{BR}◗{Y}){R}  {RD}oops!{R}"

def generate_success_face():
    """Happy parrot for success."""
    Y = "\033[38;2;255;215;0m"
    BK = "\033[38;2;40;40;40m"
    BR = "\033[38;2;120;80;40m"
    GN = "\033[38;2;80;200;120m"
    R = "\033[0m"
    return f"  {Y}({BK}◕{Y}ᴗ{BR}◗{Y}){R}  {GN}done!{R}"

# ─── Main ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Mimi Code ASCII Art Generator")
    parser.add_argument("image", nargs="?", help="Path to parrot image")
    parser.add_argument("--width", type=int, default=80, help="Width in characters")
    parser.add_argument("--output-dir", default="../assets/ascii/", help="Output directory")
    parser.add_argument("--mode", choices=["all", "banner", "photo"], default="all")
    parser.add_argument("--preview", action="store_true", help="Preview in terminal")
    args = parser.parse_args()

    output_dir = os.path.abspath(args.output_dir)
    os.makedirs(output_dir, exist_ok=True)

    # ── Always generate hand-crafted banners ──
    if args.mode in ("all", "banner"):
        print("🦜 Generating hand-crafted banners...")

        banner = generate_startup_banner()
        with open(os.path.join(output_dir, "banner-startup.ansi"), "w") as f:
            f.write(banner)

        prompt = generate_minimal_prompt()
        with open(os.path.join(output_dir, "prompt-icon.ansi"), "w") as f:
            f.write(prompt)

        frames = generate_thinking_frames()
        with open(os.path.join(output_dir, "spinner-frames.ansi"), "w") as f:
            f.write("\n---\n".join(frames))

        error = generate_error_face()
        with open(os.path.join(output_dir, "face-error.ansi"), "w") as f:
            f.write(error)

        success = generate_success_face()
        with open(os.path.join(output_dir, "face-success.ansi"), "w") as f:
            f.write(success)

        if args.preview:
            print("\n━━━ Startup Banner ━━━")
            print(banner)
            print("━━━ Prompt Icon ━━━")
            print(f"  {prompt}")
            print("\n━━━ Thinking Frames ━━━")
            for f in frames:
                print(f"  {f}")
            print(f"\n━━━ Error: {error}")
            print(f"━━━ Success: {success}")

        print(f"  ✓ Saved to {output_dir}/")

    # ── Generate from photo if provided ──
    if args.image and args.mode in ("all", "photo"):
        print(f"\n🦜 Processing {args.image}...")
        img = Image.open(args.image)
        img = preprocess_parrot(img)

        sizes = {
            "small":  {"width": 40, "suffix": "sm"},
            "medium": {"width": 60, "suffix": "md"},
            "large":  {"width": 80, "suffix": "lg"},
            "xlarge": {"width": 120, "suffix": "xl"},
        }

        for name, cfg in sizes.items():
            w = cfg["width"]
            suffix = cfg["suffix"]

            # Colored ASCII art
            colored = image_to_colored_ascii(img, width=w)
            with open(os.path.join(output_dir, f"parrot-colored-{suffix}.ansi"), "w") as f:
                f.write(colored)

            # Block art (half the width needed)
            block = image_to_block_art(img, width=w // 2)
            with open(os.path.join(output_dir, f"parrot-block-{suffix}.ansi"), "w") as f:
                f.write(block)

            # Plain ASCII (no color)
            plain = image_to_plain_ascii(img, width=w)
            with open(os.path.join(output_dir, f"parrot-plain-{suffix}.txt"), "w") as f:
                f.write(plain)

            print(f"  ✓ {name}: {w} chars wide")

        if args.preview:
            print("\n━━━ Medium Colored ASCII ━━━")
            print(image_to_colored_ascii(img, width=60))
            print("\n━━━ Small Block Art ━━━")
            print(image_to_block_art(img, width=25))

    if not args.image and args.mode == "photo":
        print("Error: --mode photo requires an image path")
        sys.exit(1)

    print("\n🦜 All done! chirp chirp!")

if __name__ == "__main__":
    main()
