"""Rebuild local APK evidence indexes without running app code or contacting its API."""
from pathlib import Path
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent
DEC = ROOT / "decompiled"
SRC = DEC / "sources"
RES = DEC / "resources" / "res"
A = "{http://schemas.android.com/apk/res/android}"


def save(name, value):
    (ROOT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


manifest = ET.parse(DEC / "resources" / "AndroidManifest.xml").getroot()
app = manifest.find("application")
assert app is not None
inventory = json.loads((ROOT / "apk-inventory.json").read_text(encoding="utf-8"))
strings = {e.get("name"): "".join(e.itertext()) for e in ET.parse(RES / "values" / "strings.xml").getroot()}
java_files = list(SRC.rglob("*.java"))
gaps = []
for path in java_files:
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if "Method not decompiled:" in line:
            gaps.append({"file": str(path.relative_to(DEC)), "line": line_no, "method": line.strip()})
save("decompilation-gaps.json", gaps)

motion = []
for path in (SRC / "info/fiboapp/fibo/Class").glob("*.java"):
    content = path.read_text(encoding="utf-8")
    markers = [m for m in ["onDraw(", "onTouchEvent(", "postInvalidateOnAnimation", "areAnimatorsEnabled", "RiveAnimationView", "performHapticFeedback", "setDuration("] if m in content]
    if not markers:
        continue
    refs = [{"line": n, "marker": m} for n, line in enumerate(content.splitlines(), 1) for m in markers if m in line]
    motion.append({"class": path.stem, "source": str(path.relative_to(DEC)), "markers": markers, "references": refs})
save("motion-source-index.json", motion)

lotties = []
for path in (RES / "raw").glob("*.json"):
    data = json.loads(path.read_text(encoding="utf-8"))
    if "fr" not in data:
        continue
    lotties.append({"file": path.name, "format_version": data.get("v"), "fps": data["fr"], "width": data["w"], "height": data["h"], "duration_seconds": round((data["op"] - data["ip"]) / data["fr"], 4), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "source": str(path.relative_to(DEC))})
save("animation-assets.json", lotties)

screens = []
for path in (RES / "layout").glob("*.xml"):
    if not path.name.startswith(("activity_", "fragment", "intro_", "dialog_bottom_sheet_")):
        continue
    texts, custom = [], []
    for element in ET.parse(path).getroot().iter():
        text = element.get(A + "text") or element.get(A + "hint")
        if text:
            if text.startswith("@string/"):
                text = strings.get(text[8:], text)
            texts.append({"id": element.get(A + "id", ""), "text": text})
        if element.tag.startswith("info.fiboapp"):
            custom.append(element.tag)
    screens.append({"layout": path.name, "texts": texts, "custom_views": custom})
save("screen-index.json", screens)

permissions = [{"name": e.get(A + "name"), "max_sdk": e.get(A + "maxSdkVersion")} for e in manifest.findall("uses-permission")]
activities = [{"name": e.get(A + "name"), "exported": e.get(A + "exported", "unspecified")} for e in app.findall("activity")]
summary = {
    "analysis_date_local": "2026-11-14",
    "timezone": "Asia/Tehran",
    "input_path": inventory["input_path"],
    "apk_sha256": inventory["sha256"],
    "apk_bytes": inventory["size"],
    "package": manifest.get("package"),
    "version_name": manifest.get(A + "versionName"),
    "version_code": manifest.get(A + "versionCode"),
    "min_sdk": manifest.find("uses-sdk").get(A + "minSdkVersion"),
    "target_sdk": manifest.find("uses-sdk").get(A + "targetSdkVersion"),
    "java_output_files": len(java_files),
    "app_namespace_java_files": len(list((SRC / "info/fiboapp/fibo").rglob("*.java"))),
    "obfuscated_Q6_java_files": len(list((SRC / "Q6").glob("*.java"))),
    "layout_files": len(list((RES / "layout").glob("*.xml"))),
    "strings_in_default_values": len(strings),
    "manifest_activities_total": len(activities),
    "manifest_app_activities": sum(a["name"].startswith("info.fiboapp.fibo.") for a in activities),
    "permission_count": len(permissions),
    "application_flags": {k: app.get(A + k) for k in ["allowBackup", "usesCleartextTraffic", "supportsRtl"]},
    "jadx_reported_error_count": 65,
    "method_not_decompiled_markers": len(gaps),
    "app_namespace_unrecovered_methods": sum(g["file"].startswith("sources\\info\\fiboapp\\fibo\\") for g in gaps),
    "Q6_unrecovered_methods": sum(g["file"].startswith("sources\\Q6\\") for g in gaps),
    "motion_index_classes": len(motion),
    "custom_onDraw_classes": sum("onDraw(" in m["markers"] for m in motion),
    "lottie_files": lotties,
    "rive_file": "decompiled/resources/res/raw/fibo_sobo.riv",
    "permissions": permissions,
    "activities": activities,
    "runtime_status": json.loads((ROOT / "runtime-status.json").read_text(encoding="utf-8"))["status"] if (ROOT / "runtime-status.json").exists() else "not_attempted",
    "limits": ["Counts describe decompiler output, including third-party libraries; they are not counts of product features.", "JADX errors and method markers are different metrics.", "Signature verified locally, not matched against an independently obtained official certificate.", "Server code, server database contents, and end-to-end feature behavior are not recoverable from static APK inspection alone."]
}
save("analysis-summary.json", summary)
print(json.dumps({k: v for k, v in summary.items() if k not in ["permissions", "activities", "lottie_files", "limits"]}, ensure_ascii=False, indent=2))
