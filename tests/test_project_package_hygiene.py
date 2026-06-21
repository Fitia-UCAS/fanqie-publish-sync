from __future__ import annotations

from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]


def test_no_empty_frontend_placeholder_components() -> None:
    assert not (ROOT_DIR / "frontend" / "assets" / "components").exists()


def test_file_helpers_are_grouped_in_infrastructure() -> None:
    files_dir = ROOT_DIR / "backend" / "infrastructure" / "files"
    assert (files_dir / "storage.py").exists()
    assert (files_dir / "discovery.py").exists()


def test_package_project_excludes_runtime_caches() -> None:
    from tools.package_project import should_include

    cache_paths = [
        ROOT_DIR / ".pytest_cache" / "README.md",
        ROOT_DIR / "backend" / "__pycache__" / "config.cpython-313.pyc",
        ROOT_DIR / ".mypy_cache" / "state.json",
        ROOT_DIR / ".ruff_cache" / "content",
        ROOT_DIR / "PATCH_NOTES_AUTO_PUBLISH_FIX.md",
        ROOT_DIR / "data" / "fanqie_web" / "state.json",
        ROOT_DIR / "data" / "fanqie_web" / "chapter_sync_state.json",
        ROOT_DIR / "data" / "fanqie_web" / "browser_edge_profile" / "Default" / "Cookies",
    ]
    assert [should_include(path) for path in cache_paths] == [False] * len(cache_paths)
