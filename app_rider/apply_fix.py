from pathlib import Path
import re
import shutil
import sys
from datetime import datetime

DEFAULT_PATH = Path(r"D:\Python_project\casadekebab\app_rider\src\main.jsx")

def remove_duplicate_push_effect_from_chat(text: str):
    chat_match = re.search(r'function\s+Chat\s*\([^)]*\)\s*\{', text)
    dashboard_match = re.search(r'function\s+Dashboard\s*\([^)]*\)\s*\{', text)
    if not chat_match or not dashboard_match:
        raise RuntimeError("Could not locate Chat or Dashboard component.")

    chat_start = chat_match.start()
    dashboard_start = dashboard_match.start()
    chat_block = text[chat_start:dashboard_start]

    candidates = []
    pos = 0
    pattern = r'useEffect\s*\(\s*\(\s*\)\s*=>\s*\{'
    while True:
        m = re.search(pattern, chat_block[pos:])
        if not m:
            break
        start = pos + m.start()
        tail = chat_block[start:]
        end_m = re.search(r'\}\s*,\s*\[\s*rider\?\.token\s*\]\s*\)\s*;', tail)
        if end_m:
            end = start + end_m.end()
            block = chat_block[start:end]
            if "setupRiderPushNotifications" in block and "openOrderByCode" in block:
                candidates.append((start, end))
        pos = start + 10

    if not candidates:
        return text, False

    start, end = candidates[0]
    absolute_start = chat_start + start
    absolute_end = chat_start + end
    new_text = text[:absolute_start] + "\n\n" + text[absolute_end:]
    return new_text, True

def ensure_capacitor_import(text: str):
    if re.search(r'import\s*\{\s*Capacitor\s*\}\s*from\s*["\']@capacitor/core["\']', text):
        return text, False

    core_import = re.search(r'import\s*\{([^}]*)\}\s*from\s*["\']@capacitor/core["\']\s*;', text)
    if core_import:
        names = [x.strip() for x in core_import.group(1).split(",") if x.strip()]
        if "Capacitor" not in names:
            names.append("Capacitor")
        replacement = f'import {{ {", ".join(names)} }} from "@capacitor/core";'
        return text[:core_import.start()] + replacement + text[core_import.end():], True

    imports = list(re.finditer(r'^import\b.*?;\s*$', text, flags=re.MULTILINE))
    insertion = 'import { Capacitor } from "@capacitor/core";\n'
    if imports:
        idx = imports[-1].end()
        return text[:idx] + "\n" + insertion + text[idx:], True
    return insertion + text, True

def ensure_web_guard(text: str):
    fn = re.search(
        r'async\s+function\s+setupRiderPushNotifications\s*\(\s*rider\s*,\s*onOrderOpen\s*,\s*onMessage\s*\)\s*\{',
        text
    )
    if not fn:
        raise RuntimeError("Could not locate setupRiderPushNotifications function.")

    body_start = fn.end()
    next_part = text[body_start:body_start + 600]
    if "Capacitor.isNativePlatform()" in next_part:
        return text, False

    guard = '''
  if (!Capacitor.isNativePlatform()) {
    console.info("RIDER_PUSH_SKIPPED_ON_WEB");
    return () => {};
  }
'''
    return text[:body_start] + guard + text[body_start:], True

def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PATH
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    original = path.read_text(encoding="utf-8")
    backup = path.with_name(f"main_before_white_screen_fix_{datetime.now():%Y%m%d_%H%M%S}.jsx")
    shutil.copy2(path, backup)

    text, removed = remove_duplicate_push_effect_from_chat(original)
    text, import_added = ensure_capacitor_import(text)
    text, guard_added = ensure_web_guard(text)

    path.write_text(text, encoding="utf-8")

    chat_pos = text.find("function Chat")
    dash_pos = text.find("function Dashboard")
    chat_section = text[chat_pos:dash_pos] if chat_pos != -1 and dash_pos != -1 else ""
    duplicate_left = "setupRiderPushNotifications" in chat_section
    total_occurrences = len(re.findall(r'setupRiderPushNotifications\s*\(', text))

    print("FIX COMPLETED")
    print(f"File: {path}")
    print(f"Backup: {backup}")
    print(f"Removed duplicate Chat push effect: {removed}")
    print(f"Added/updated Capacitor import: {import_added}")
    print(f"Added web guard: {guard_added}")
    print(f"Push setup occurrences: {total_occurrences}")
    print(f"Duplicate push call still inside Chat: {duplicate_left}")

    if duplicate_left:
        print("WARNING: duplicate still exists inside Chat.")
        sys.exit(2)

if __name__ == "__main__":
    main()
