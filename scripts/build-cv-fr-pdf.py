#!/usr/bin/env python3
"""Generate cv-norberto-brude_fr.pdf from HTML (Chrome headless, fallback PyMuPDF)."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML_PATH = Path(__file__).resolve().parent / "cv-norberto-brude-fr.html"
PDF_PATH = ROOT / "cv-norberto-brude_fr.pdf"

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    shutil.which("google-chrome"),
    shutil.which("chromium"),
]


def build_with_chrome() -> bool:
    chrome = next((p for p in CHROME_CANDIDATES if p and Path(p).exists()), None)
    if not chrome:
        return False

    html_url = HTML_PATH.resolve().as_uri()
    result = subprocess.run(
        [
            chrome,
            "--headless=new",
            "--disable-gpu",
            "--no-pdf-header-footer",
            f"--print-to-pdf={PDF_PATH.resolve()}",
            html_url,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(result.stderr or result.stdout)
        return False
    return PDF_PATH.exists()


def build_with_pymupdf() -> None:
    import fitz

    html = HTML_PATH.read_text(encoding="utf-8")
    story = fitz.Story(html=html)
    writer = fitz.DocumentWriter(str(PDF_PATH))
    mediabox = fitz.paper_rect("a4")
    more = True
    while more:
        device = writer.begin_page(mediabox)
        more, _ = story.place(mediabox)
        story.draw(device)
        writer.end_page()
    writer.close()


def main() -> None:
    if build_with_chrome():
        print(f"Wrote {PDF_PATH} via Chrome ({PDF_PATH.stat().st_size} bytes)")
        return
    print("Chrome not available; falling back to PyMuPDF Story.")
    build_with_pymupdf()
    print(f"Wrote {PDF_PATH} via PyMuPDF ({PDF_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
