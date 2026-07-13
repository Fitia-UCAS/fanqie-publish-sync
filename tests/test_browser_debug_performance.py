from pathlib import Path

from backend.platforms.fanqie.browser import session


class FakePage:
    def __init__(self) -> None:
        self.context = object()
        self.screenshot_count = 0

    def evaluate(self, script: str) -> str:
        return "https://example.test\n章节编辑\n1200x800:1200x1600\n正文"

    def screenshot(self, full_page: bool) -> bytes:
        self.screenshot_count += 1
        return b"image"


def test_duplicate_debug_state_skips_screenshot_generation(tmp_path: Path, monkeypatch) -> None:
    page = FakePage()
    monkeypatch.setattr(session, "_debug_dir", lambda category: tmp_path)
    monkeypatch.setattr(session, "_debug_dedupe_enabled", lambda category: True)
    session._CONTEXT_DEBUG_FINGERPRINTS.clear()

    session._write_debug_image(page, "first", category="auto_publish")
    session._write_debug_image(page, "second", category="auto_publish")

    assert page.screenshot_count == 1
    assert len(list(tmp_path.glob("*.png"))) == 1
