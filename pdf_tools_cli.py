#!/usr/bin/env python3
"""
PicoPDF - Command-Line Interface (CLI)
Minimalist, cross-platform, private PDF toolkit for macOS and Windows.

Supported Operations:
  1. compress   - Compress PDF to an intended target size limit (e.g. 500KB, 1MB, 2MB)
  2. split      - Extract page ranges (e.g. 1-2, 3) or burst all pages
  3. to-image   - Convert PDF pages/images to PNG or JPEG
  4. encrypt    - Password protect PDF with AES-256 encryption
  5. decrypt    - Remove password lock and restrictions permanently
"""

import sys
import os
import argparse
import io
import math
import re

try:
    import pypdf
    from PIL import Image
except ImportError:
    print("\n[ERROR] Missing required libraries: 'pypdf' or 'Pillow'")
    print("Please install them using:")
    print("    pip install -r requirements.txt\n")
    sys.exit(1)


def parse_size_string(size_str: str) -> int:
    """Parse size strings like '500KB', '1.5MB', '2M', '800k', '1048576' into bytes."""
    size_str = size_str.strip().upper()
    match = re.match(r"^([0-9]+(?:\.[0-9]+)?)\s*([KMGT]?B?)?$", size_str)
    if not match:
        raise ValueError(f"Invalid size format: '{size_str}'. Examples: 500KB, 1.5MB, 2M, 800000")

    val = float(match.group(1))
    unit = match.group(2) or "B"

    if "G" in unit:
        return int(val * 1024 * 1024 * 1024)
    elif "M" in unit:
        return int(val * 1024 * 1024)
    elif "K" in unit:
        return int(val * 1024)
    else:
        return int(val)


def format_bytes(num_bytes: int) -> str:
    """Format bytes into readable string."""
    if num_bytes < 1024:
        return f"{num_bytes} Bytes"
    elif num_bytes < 1024 * 1024:
        return f"{num_bytes / 1024:.2f} KB"
    else:
        return f"{num_bytes / (1024 * 1024):.2f} MB"


def clean_path(raw_path: str) -> str:
    """Clean surrounding quotes from drag-and-drop paths."""
    return raw_path.strip('\'"')


# ===================================================================
# 1. COMPRESS PDF TO TARGET SIZE
# ===================================================================
def compress_pdf_to_target(input_path: str, output_path: str, target_bytes: int) -> bool:
    if not os.path.isfile(input_path):
        print(f"[ERROR] Input file does not exist: {input_path}")
        return False

    orig_size = os.path.getsize(input_path)
    print("\n" + "=" * 60)
    print("  PicoPDF - Adaptive Target Size Compressor")
    print("=" * 60)
    print(f"  Input File:     {os.path.abspath(input_path)}")
    print(f"  Original Size:  {format_bytes(orig_size)} ({orig_size:,} bytes)")
    print(f"  Target Limit:   {format_bytes(target_bytes)} ({target_bytes:,} bytes)")
    print("=" * 60)

    reader = pypdf.PdfReader(input_path)
    page_count = len(reader.pages)
    total_images = sum(len(p.images) for p in reader.pages)
    print(f"  Pages: {page_count} | Embedded Images Found: {total_images}")

    # Phase 1: Lossless Stream Compression
    print("\n[Phase 1] Testing lossless object stream deflating...")
    writer_lossless = pypdf.PdfWriter()
    for p in reader.pages:
        added_page = writer_lossless.add_page(p)
        try:
            added_page.compress_content_streams()
        except Exception:
            pass

    buf = io.BytesIO()
    writer_lossless.write(buf)
    lossless_size = buf.tell()
    print(f"  Lossless result: {format_bytes(lossless_size)}")

    if lossless_size <= target_bytes or total_images == 0:
        if lossless_size <= target_bytes:
            print("  [SUCCESS] Target met losslessly without image downsampling!")
        else:
            print("  [INFO] No embedded raster images to compress. Using lossless stream compression.")
        with open(output_path, "wb") as f_out:
            f_out.write(buf.getvalue())
        print(f"  Saved to: {output_path}")
        return True

    # Phase 2: Adaptive Optimizer
    print("\n[Phase 2] Launching Adaptive Image Resolution & Quality Optimizer...")
    target_budget_per_image = target_bytes / max(1, total_images)
    if target_budget_per_image >= 250 * 1024:
        scale = 1.0; quality = 80
    elif target_budget_per_image >= 100 * 1024:
        scale = 0.85; quality = 70
    elif target_budget_per_image >= 40 * 1024:
        scale = 0.70; quality = 55
    else:
        scale = 0.50; quality = 40

    max_passes = 3
    final_buf = None

    for pass_num in range(1, max_passes + 1):
        print(f"\n  >> Pass {pass_num}/{max_passes}: Scale = {scale:.2f}x, JPEG Quality = {quality}%")

        fresh_reader = pypdf.PdfReader(input_path)
        writer = pypdf.PdfWriter()
        for page in fresh_reader.pages:
            writer.add_page(page)

        for page in writer.pages:
            for img in page.images:
                try:
                    pil_img = img.image
                    new_w = max(50, int(pil_img.width * scale))
                    new_h = max(50, int(pil_img.height * scale))
                    if pil_img.mode in ("RGBA", "P"):
                        pil_img = pil_img.convert("RGB")
                    resized = pil_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                    img.replace(resized, quality=quality)
                except Exception:
                    pass

        cur_buf = io.BytesIO()
        writer.write(cur_buf)
        cur_size = cur_buf.tell()
        print(f"     Output Size: {format_bytes(cur_size)} ({cur_size:,} bytes)")
        final_buf = cur_buf

        if cur_size <= target_bytes:
            print(f"     [SUCCESS] Output is within target limit!")
            break
        else:
            overshoot = cur_size / target_bytes
            print(f"     Overshot target by {int((overshoot - 1) * 100)}%. Adjusting parameters...")
            scale = max(0.35, scale * (1 / math.sqrt(overshoot)) * 0.95)
            quality = max(20, int(quality * (1 / (overshoot ** 0.35))))

    with open(output_path, "wb") as f_out:
        f_out.write(final_buf.getvalue())

    final_size = os.path.getsize(output_path)
    savings = orig_size - final_size
    savings_pct = (savings / orig_size) * 100 if orig_size > 0 else 0

    print("\n" + "=" * 60)
    print("  COMPRESSION COMPLETED")
    print("=" * 60)
    print(f"  Final File:     {os.path.abspath(output_path)}")
    print(f"  Final Size:     {format_bytes(final_size)} ({final_size:,} bytes)")
    print(f"  Total Saved:    {format_bytes(savings)} (-{savings_pct:.1f}%)")
    print("=" * 60 + "\n")
    return True


# ===================================================================
# 2. SPLIT PDF
# ===================================================================
def parse_range_list(range_str: str, max_pages: int):
    """Parse range string like '1-2, 5, 7-9' into 0-indexed page integers."""
    pages = []
    for part in range_str.split(','):
        part = part.strip()
        if not part: continue
        if '-' in part:
            s, e = part.split('-')
            for p in range(int(s), int(e) + 1):
                if 1 <= p <= max_pages:
                    pages.append(p - 1)
        else:
            p = int(part)
            if 1 <= p <= max_pages:
                pages.append(p - 1)
    return sorted(list(set(pages)))


def split_pdf(input_path: str, range_str: str, output_path: str = None) -> bool:
    if not os.path.isfile(input_path):
        print(f"[ERROR] Input file not found: {input_path}")
        return False

    reader = pypdf.PdfReader(input_path)
    total_pages = len(reader.pages)
    print(f"\nDocument has {total_pages} page(s).")

    if not range_str or range_str.lower() == 'all':
        # Burst all pages into separate files
        base, ext = os.path.splitext(input_path)
        out_dir = base + "_pages"
        os.makedirs(out_dir, exist_ok=True)
        print(f"Extracting all {total_pages} pages into '{out_dir}/'...")
        for i, page in enumerate(reader.pages):
            writer = pypdf.PdfWriter()
            writer.add_page(page)
            p_out = os.path.join(out_dir, f"page_{i+1}.pdf")
            with open(p_out, "wb") as f:
                writer.write(f)
        print(f"[SUCCESS] Extracted {total_pages} individual PDF files to: {out_dir}\n")
        return True

    selected_indices = parse_range_list(range_str, total_pages)
    if not selected_indices:
        print("[ERROR] No valid pages selected.")
        return False

    if not output_path:
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_split{ext}"

    writer = pypdf.PdfWriter()
    for idx in selected_indices:
        writer.add_page(reader.pages[idx])

    with open(output_path, "wb") as f:
        writer.write(f)

    print(f"[SUCCESS] Extracted {len(selected_indices)} page(s) to: {output_path}\n")
    return True


# ===================================================================
# 3. PDF TO IMAGE
# ===================================================================
def convert_pdf_to_images(input_path: str, output_dir: str = None, img_format: str = "PNG") -> bool:
    if not os.path.isfile(input_path):
        print(f"[ERROR] Input file not found: {input_path}")
        return False

    reader = pypdf.PdfReader(input_path)
    base, ext = os.path.splitext(input_path)
    if not output_dir:
        output_dir = f"{base}_images"
    os.makedirs(output_dir, exist_ok=True)

    fmt = img_format.upper()
    ext_img = "jpg" if fmt == "JPEG" else fmt.lower()
    saved_count = 0

    print(f"\nExtracting images from {len(reader.pages)} page(s) to: {output_dir}/")
    for p_idx, page in enumerate(reader.pages):
        for img_idx, img_obj in enumerate(page.images):
            try:
                pil_im = img_obj.image
                if pil_im.mode in ("RGBA", "P") and fmt == "JPEG":
                    pil_im = pil_im.convert("RGB")
                filename = f"page_{p_idx+1}_img_{img_idx+1}.{ext_img}"
                out_path = os.path.join(output_dir, filename)
                pil_im.save(out_path, format=fmt, quality=90)
                saved_count += 1
            except Exception as e:
                pass

    print(f"[SUCCESS] Exported {saved_count} image(s) to directory: {output_dir}\n")
    return True


# ===================================================================
# 4. ENCRYPT PDF
# ===================================================================
def encrypt_pdf(input_path: str, password: str, output_path: str = None) -> bool:
    if not os.path.isfile(input_path):
        print(f"[ERROR] Input file not found: {input_path}")
        return False

    if not password:
        print("[ERROR] Password cannot be empty.")
        return False

    if not output_path:
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_encrypted{ext}"

    reader = pypdf.PdfReader(input_path)
    writer = pypdf.PdfWriter()
    for p in reader.pages:
        writer.add_page(p)

    writer.encrypt(password, algorithm="AES-256")
    with open(output_path, "wb") as f:
        writer.write(f)

    print(f"\n[SUCCESS] Document protected with AES-256 encryption!")
    print(f"Output File: {output_path}")
    print(f"Password required to open: {'*' * len(password)}\n")
    return True


# ===================================================================
# 5. DECRYPT PDF / REMOVE LOCK
# ===================================================================
def decrypt_pdf(input_path: str, password: str, output_path: str = None) -> bool:
    if not os.path.isfile(input_path):
        print(f"[ERROR] Input file not found: {input_path}")
        return False

    reader = pypdf.PdfReader(input_path)
    if not reader.is_encrypted:
        print("[INFO] Document is not password-protected! It is already unlocked.")
        return True

    res = reader.decrypt(password)
    if res == 0:
        print("[ERROR] Incorrect password entered! Could not decrypt PDF.")
        return False

    if not output_path:
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_unlocked{ext}"

    writer = pypdf.PdfWriter()
    for p in reader.pages:
        writer.add_page(p)

    with open(output_path, "wb") as f:
        writer.write(f)

    print(f"\n[SUCCESS] Document password and restrictions permanently removed!")
    print(f"Unlocked PDF saved to: {output_path}\n")
    return True


# ===================================================================
# INTERACTIVE MAIN MENU
# ===================================================================
def interactive_menu():
    print("=" * 60)
    print("  PicoPDF - Interactive CLI Suite")
    print("  Runs identically on macOS & Windows")
    print("=" * 60)
    print("  1. Compress PDF to Target Size Limit")
    print("  2. Split / Extract PDF Pages")
    print("  3. Convert PDF to Images (PNG/JPG)")
    print("  4. Encrypt PDF (Set AES-256 Password)")
    print("  5. Decrypt PDF (Remove Password Lock)")
    print("  0. Exit")
    print("=" * 60)

    try:
        choice = input("\nSelect a tool [1-5]: ").strip()
    except (KeyboardInterrupt, EOFError):
        print("\nExiting.")
        sys.exit(0)

    if choice == '1':
        in_path = clean_path(input("Enter PDF file path: "))
        target_str = input("Enter intended size limit (e.g. 500KB, 1MB, 2MB): ")
        target_bytes = parse_size_string(target_str)
        out_path = clean_path(input("Enter output path [leave empty for auto]: "))
        if not out_path:
            b, e = os.path.splitext(in_path)
            out_path = f"{b}_compressed{e}"
        compress_pdf_to_target(in_path, out_path, target_bytes)

    elif choice == '2':
        in_path = clean_path(input("Enter PDF file path: "))
        range_str = input("Enter page range (e.g. 1-2, 3 or 'all'): ")
        out_path = clean_path(input("Enter output path [leave empty for auto]: "))
        split_pdf(in_path, range_str, out_path or None)

    elif choice == '3':
        in_path = clean_path(input("Enter PDF file path: "))
        fmt = input("Enter format (PNG / JPEG) [Default: PNG]: ").strip().upper() or "PNG"
        convert_pdf_to_images(in_path, None, fmt)

    elif choice == '4':
        in_path = clean_path(input("Enter PDF file path: "))
        pwd = input("Enter password to protect document: ")
        out_path = clean_path(input("Enter output path [leave empty for auto]: "))
        encrypt_pdf(in_path, pwd, out_path or None)

    elif choice == '5':
        in_path = clean_path(input("Enter PDF file path: "))
        pwd = input("Enter current document password: ")
        out_path = clean_path(input("Enter output path [leave empty for auto]: "))
        decrypt_pdf(in_path, pwd, out_path or None)

    else:
        print("Goodbye!")


def main():
    parser = argparse.ArgumentParser(
        description="PDF ShrinkPro & Tools Suite CLI - Compress, Split, Convert, Encrypt, Decrypt"
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Compress
    p_comp = subparsers.add_parser("compress", help="Compress PDF to target size limit")
    p_comp.add_argument("input", help="Input PDF file")
    p_comp.add_argument("-t", "--target", required=True, help="Intended size limit (e.g. 500KB, 1.5MB)")
    p_comp.add_argument("-o", "--output", help="Output file path")

    # Split
    p_split = subparsers.add_parser("split", help="Split or extract pages from PDF")
    p_split.add_argument("input", help="Input PDF file")
    p_split.add_argument("-r", "--range", default="all", help="Page range (e.g. 1-3, 5 or 'all')")
    p_split.add_argument("-o", "--output", help="Output file path")

    # To-Image
    p_img = subparsers.add_parser("to-image", help="Convert PDF pages to images")
    p_img.add_argument("input", help="Input PDF file")
    p_img.add_argument("-f", "--format", default="PNG", help="Image format (PNG or JPEG)")
    p_img.add_argument("-o", "--output-dir", help="Output directory")

    # Encrypt
    p_enc = subparsers.add_parser("encrypt", help="Encrypt PDF with password")
    p_enc.add_argument("input", help="Input PDF file")
    p_enc.add_argument("-p", "--password", required=True, help="Password to protect PDF")
    p_enc.add_argument("-o", "--output", help="Output file path")

    # Decrypt
    p_dec = subparsers.add_parser("decrypt", help="Decrypt and remove password lock from PDF")
    p_dec.add_argument("input", help="Input PDF file")
    p_dec.add_argument("-p", "--password", required=True, help="Current document password")
    p_dec.add_argument("-o", "--output", help="Output file path")

    args = parser.parse_args()

    if not args.command:
        interactive_menu()
    elif args.command == "compress":
        target_bytes = parse_size_string(args.target)
        b, e = os.path.splitext(args.input)
        out = args.output or f"{b}_compressed{e}"
        compress_pdf_to_target(args.input, out, target_bytes)
    elif args.command == "split":
        split_pdf(args.input, args.range, args.output)
    elif args.command == "to-image":
        convert_pdf_to_images(args.input, args.output_dir, args.format)
    elif args.command == "encrypt":
        encrypt_pdf(args.input, args.password, args.output)
    elif args.command == "decrypt":
        decrypt_pdf(args.input, args.password, args.output)


if __name__ == "__main__":
    main()
