#!/usr/bin/env python3
"""
Converts all DDS icon files to PNG for use in the web app.
Removes magenta (255, 0, 255) color key transparency used by Flyff.
"""
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).parent
ICON_SRC_DIRS = [
    BASE_DIR / "Bilder" / "Icon",
    BASE_DIR / "Bilder" / "Item",
]
ICON_OUT_DIR = BASE_DIR / "flyff-app" / "public" / "icons"
ICON_OUT_DIR.mkdir(parents=True, exist_ok=True)

converted = 0
skipped = 0
errors = 0

dds_files = []
for src_dir in ICON_SRC_DIRS:
    dds_files.extend(src_dir.rglob("*.dds"))
total = len(dds_files)
print(f"Found {total} DDS files to convert...")

for i, dds_path in enumerate(dds_files):
    out_path = ICON_OUT_DIR / (dds_path.stem.lower() + ".png")

    result = subprocess.run(
        [
            "magick", str(dds_path),
            "-fuzz", "5%",
            "-transparent", "magenta",
            str(out_path)
        ],
        capture_output=True
    )

    if result.returncode == 0:
        converted += 1
    else:
        errors += 1

    if (i + 1) % 200 == 0:
        print(f"  {i+1}/{total} - converted: {converted}, errors: {errors}")

print(f"\nDone! Converted: {converted}, Errors: {errors}")
