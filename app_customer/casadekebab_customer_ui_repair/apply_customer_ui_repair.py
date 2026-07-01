from __future__ import annotations

import argparse
import re
import shutil
from datetime import datetime
from pathlib import Path

NEW_MARKER = "/* === Casa de Kebab Turco: customer UI repair v1 === */"

OLD_MARKERS = [
    "/* app-customer-safe-bottom-nav-v1 */",
    "/* === Casa de Kebab Turco: mobile system navigation safe-area fix v2 === */",
    "/* === Casa de Kebab Turco: optimized food images === */",
    NEW_MARKER,
]


def backup(path: Path, project: Path, backup_root: Path) -> None:
    rel = path.relative_to(project)
    dest = backup_root / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dest)


def remove_tail_from_marker(text: str, marker: str) -> str:
    index = text.find(marker)
    if index == -1:
        return text
    return text[:index].rstrip() + "\n"


def patch_styles(path: Path, repair_css: str) -> None:
    text = path.read_text(encoding="utf-8")

    # These patches were appended at the end of styles.css.
    # Remove them from the earliest matching marker onward.
    positions = [text.find(m) for m in OLD_MARKERS if text.find(m) != -1]
    if positions:
        text = text[:min(positions)].rstrip() + "\n"

    path.write_text(text.rstrip() + "\n\n" + repair_css.strip() + "\n", encoding="utf-8")


def patch_cloudinary_util(path: Path) -> None:
    if not path.exists():
        return

    text = path.read_text(encoding="utf-8")

    # Avoid c_fill/g_auto because it can crop and visually zoom food photos.
    text = text.replace('"c_fill",\n    "g_auto",', '"c_fit",')
    text = text.replace("'c_fill',\n    'g_auto',", "'c_fit',")
    text = text.replace('"c_fill", "g_auto",', '"c_fit",')
    text = text.replace("'c_fill', 'g_auto',", "'c_fit',")

    path.write_text(text, encoding="utf-8")


def patch_viewport(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    viewport = (
        '<meta name="viewport" '
        'content="width=device-width, initial-scale=1, viewport-fit=cover" />'
    )
    pattern = re.compile(r'<meta\s+name=["\']viewport["\'][^>]*>', re.I)

    if pattern.search(text):
        text = pattern.sub(viewport, text, count=1)
    elif "</head>" in text:
        text = text.replace("</head>", f"  {viewport}\n</head>", 1)

    path.write_text(text, encoding="utf-8")


def patch_manifest(path: Path) -> None:
    text = path.read_text(encoding="utf-8")

    if "android:windowSoftInputMode" in text:
        text = re.sub(
            r'android:windowSoftInputMode="[^"]*"',
            'android:windowSoftInputMode="adjustResize"',
            text,
            count=1,
        )
    else:
        text = text.replace(
            'android:exported="true"',
            'android:exported="true"\n'
            '            android:windowSoftInputMode="adjustResize"',
            1,
        )

    path.write_text(text, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Repair Casa de Kebab customer app UI after recent patches."
    )
    parser.add_argument(
        "--project",
        required=True,
        help=r'Example: D:\Python_project\casadekebab\app_customer',
    )
    args = parser.parse_args()

    project = Path(args.project).expanduser().resolve()
    styles = project / "src" / "styles.css"
    index = project / "index.html"
    manifest = project / "android" / "app" / "src" / "main" / "AndroidManifest.xml"
    cloudinary_util = project / "src" / "utils" / "cloudinaryImage.js"

    required = [styles, index, manifest]
    missing = [str(p) for p in required if not p.exists()]
    if missing:
        raise FileNotFoundError("Missing required files:\n" + "\n".join(missing))

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_root = project / f"_backup_before_ui_repair_{timestamp}"

    for path in required:
        backup(path, project, backup_root)
    if cloudinary_util.exists():
        backup(cloudinary_util, project, backup_root)

    package_root = Path(__file__).resolve().parent
    repair_css = (package_root / "files" / "ui_repair.css").read_text(encoding="utf-8")

    patch_styles(styles, repair_css)
    patch_cloudinary_util(cloudinary_util)
    patch_viewport(index)
    patch_manifest(manifest)

    print("Customer UI repaired successfully.")
    print(f"Backup created: {backup_root}")
    print(f"Updated: {styles}")
    print(f"Updated: {index}")
    print(f"Updated: {manifest}")
    if cloudinary_util.exists():
        print(f"Updated: {cloudinary_util}")


if __name__ == "__main__":
    main()
