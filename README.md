# PicoPDF 📄⚡

> **A minimalist, privacy-first, cross-platform PDF tools suite.**  
> Compress to exact target size limits, Split, Convert to Image, Encrypt with AES-256, and Decrypt/Unlock PDFs.  
> Runs locally with 100% privacy on **macOS** and **Windows** — zero cloud uploads.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://python.org/)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-lightgrey.svg)]()

---

## 🌟 Features

### 1. 🗜️ Target-Size PDF Compression
- **Exact Size Ceiling**: Specify an intended limit in **MB** or **KB** (e.g. `500 KB`, `1.0 MB`, `2.0 MB`).
- **Adaptive Multi-Pass Engine**: Automatically tests lossless stream compression first. If raster content exceeds the target, it intelligently modulates render DPI (72–180) and calibrated JPEG quantization passes to hit your exact target without over-degrading quality.
- **Side-by-Side Visual Inspection**: Inspect before/after pages side-by-side to verify sharpness before downloading.
- **Quick Presets**: `Strict 500 KB`, `Web / Form 1 MB`, `Email 2 MB`, `50% of Original`.

### 2. ✂️ Visual Page Splitter & Extractor
- **Interactive Visual Page Selector**: Click page thumbnail cards to select/deselect specific pages.
- **Custom Page Ranges**: Type comma-separated ranges (e.g. `1-3, 5, 8-10`).
- **Burst All Pages**: Explode every page into standalone PDFs packaged in a **ZIP archive**.
- **Split Every N Pages**: Chunk multi-page documents into equal parts of N pages.

### 3. 🖼️ PDF to High-Resolution Images
- **Formats Supported**: **PNG** (Lossless), **JPEG** (Compressed), and **WebP** (Modern Web).
- **Resolution Control**: **72 DPI** (Web / Fast), **150 DPI** (Standard / Print), and **300 DPI** (Ultra-HD Crisp).
- **Batch Export**: 1-click download for any individual page, or click **"Download All Images (ZIP)"**.

### 4. 🔒 AES-256 PDF Encryption
- **Acrobat-Standard Security**: Protect sensitive contracts, invoices, and legal docs with military-grade **AES-256 bit** encryption.
- **Password Strength Meter**: Real-time entropy checking to ensure robust passwords.
- Requires password to open, view, print, or extract contents.

### 5. 🔓 Decrypt PDF / Remove Lock
- **Automatic Lock Detection**: Instantly detects password-locked PDF uploads.
- **Permanent Lock Removal**: Enter the document password once to decrypt all content streams and permanently strip all security restrictions.
- Yields a clean, unrestricted PDF file.

---

## 🚀 Quick Start (Web Application)

### Option 1: Using Node.js (macOS & Windows)

```bash
# Clone the repository
git clone https://github.com/vaibhavbhootna/PicoPDF.git
cd PicoPDF

# Start local server and open in default browser
npm start
```

Or run directly:

```bash
node server.js --open
```

> **Local URL**: Open [http://localhost:3000](http://localhost:3000)

---

### Option 2: Using Python (macOS & Windows)

```bash
# macOS / Linux
python3 -m http.server 3000 -d public

# Windows (PowerShell or Command Prompt)
python -m http.server 3000 -d public
```

---

## 💻 Cross-Platform CLI Tool (`pdf_tools_cli.py`)

For terminal power users, automation, and batch processing on macOS and Windows.

### One-Time Setup

```bash
pip install -r requirements.txt
```

### Interactive Menu Mode

Simply run the script with no arguments to launch the guided interactive wizard:

```bash
# macOS
python3 pdf_tools_cli.py

# Windows
python pdf_tools_cli.py
```

### Direct CLI Commands

```bash
# 1. Compress to Target Size Limit
python3 pdf_tools_cli.py compress document.pdf --target 1MB --output compressed.pdf
python3 pdf_tools_cli.py compress document.pdf --target 500KB

# 2. Split Pages
python3 pdf_tools_cli.py split document.pdf --range "1-3, 5" --output extracted.pdf
python3 pdf_tools_cli.py split document.pdf --range all

# 3. PDF to Images
python3 pdf_tools_cli.py to-image document.pdf --format PNG --output-dir ./images
python3 pdf_tools_cli.py to-image document.pdf --format JPEG

# 4. Encrypt PDF
python3 pdf_tools_cli.py encrypt document.pdf --password "SecretPassword123" --output protected.pdf

# 5. Decrypt / Remove Lock
python3 pdf_tools_cli.py decrypt protected.pdf --password "SecretPassword123" --output unlocked.pdf
```

---

## 📁 Project Structure

```text
PicoPDF/
├── public/
│   ├── index.html                     # Semantic dark glassmorphic UI layout
│   ├── style.css                      # Modern responsive design system
│   ├── app.js                         # Front-end controllers for all 5 tools
│   ├── sample_large_presentation.pdf  # Built-in 2.66 MB test presentation
│   └── vendor/
│       ├── pdf-lib.min.js             # Client-side PDF manipulation
│       ├── pdf.min.js                 # PDF page rendering
│       ├── pdf.worker.min.js          # Fast background worker
│       └── jszip.min.js               # In-browser ZIP archive generator
├── pdf_tools_cli.py                   # Full-featured CLI for macOS & Windows
├── compress_cli.py                    # Backwards-compatible CLI alias
├── server.js                          # Local Node.js server with AES encryption bridge
├── package.json                       # Scripts: npm start, npm run cli
├── requirements.txt                   # CLI dependencies (pypdf, Pillow, cryptography)
├── .gitignore                         # Standard git ignore rules
└── README.md                          # Documentation
```

---

## 🔒 Privacy & Security

- **100% Local Processing**: All compression, page extraction, and image conversions happen in local memory.
- No documents are ever transmitted to third-party servers or external APIs.
- Operates completely offline without an internet connection.

---

## 🛡️ License

MIT License. Free for personal and commercial use.
