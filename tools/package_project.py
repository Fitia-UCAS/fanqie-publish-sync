from __future__ import annotations

import shutil
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT.parent / "Fanqie-Publish-Sync-Assistant.zip"
EXCLUDED_PARTS = {"__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".git", "browser_edge_profile"}
EXCLUDED_SUFFIXES = {".pyc", ".pyo", ".orig"}
EXCLUDED_NAME_PREFIXES = ("PATCH_NOTES_",)
EXCLUDED_RUNTIME_RELATIVE_PATHS = {"data/fanqie_web/state.json"}


def should_include(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    if any(part in EXCLUDED_PARTS for part in relative.parts):
        return False
    if relative.as_posix() in EXCLUDED_RUNTIME_RELATIVE_PATHS:
        return False
    if relative.parts[:2] == ("data", "fanqie_web") and path.suffix == ".json":
        return False
    if path.suffix in EXCLUDED_SUFFIXES:
        return False
    if path.name.startswith(EXCLUDED_NAME_PREFIXES):
        return False
    return True


def clean_runtime_caches() -> None:
    for pattern in ("**/__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache"):
        for path in ROOT.glob(pattern):
            if path.is_dir():
                shutil.rmtree(path, ignore_errors=True)


def package_project(output: Path = OUTPUT) -> Path:
    clean_runtime_caches()
    if output.exists():
        output.unlink()
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        for path in sorted(ROOT.rglob("*")):
            if path.is_file() and should_include(path):
                archive.write(path, Path(ROOT.name) / path.relative_to(ROOT))
    return output


if __name__ == "__main__":
    output = Path(sys.argv[1]) if len(sys.argv) > 1 else OUTPUT
    print(package_project(output))
