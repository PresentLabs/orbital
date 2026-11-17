"""Offline independent PDF417 readback. Requires pymupdf, pillow and zxing-cpp.
Usage: python verify-pdf.py /path/to/test-artifacts
"""
import sys
from pathlib import Path
import fitz
import zxingcpp
from PIL import Image
root = Path(sys.argv[1])
for suffix in ('', '1'):
    pdf = fitz.open(root / f'sample-{suffix}.pdf')
    pix = pdf[0].get_pixmap(matrix=fitz.Matrix(5, 5))
    picture = Image.frombytes('RGB', [pix.width, pix.height], pix.samples)
    results = zxingcpp.read_barcodes(picture)
    expected = (root / f'sample-{suffix}.ted').read_bytes()
    assert len(results) == 1 and results[0].bytes == expected, 'PDF417 differs from signed TED'
    print(f'PASS PDF417 exact byte readback: {len(expected)} bytes, {len(pdf)} PDF page(s)')
