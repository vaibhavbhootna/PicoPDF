#!/usr/bin/env python3
"""
PicoPDF - Compressor CLI Wrapper
For full tools suite, see: pdf_tools_cli.py
"""
import sys
import pdf_tools_cli

if __name__ == "__main__":
    # If no subcommand provided, default to compress or menu
    if len(sys.argv) > 1 and sys.argv[1] not in ("compress", "split", "to-image", "encrypt", "decrypt", "-h", "--help"):
        # Legacy syntax: python compress_cli.py input.pdf --target 1MB
        sys.argv.insert(1, "compress")
    pdf_tools_cli.main()
