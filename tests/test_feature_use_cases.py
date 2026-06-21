from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from backend.features.publishing.use_cases import PublishChapters
from backend.features.syncing.use_cases import SyncChapters


@dataclass
class Result:
    ok: bool
    chapter_no: int
    message: str = "ok"


def test_publish_use_case_maps_payload_to_platform_runner(tmp_path: Path) -> None:
    source = tmp_path / "novel.txt"
    source.write_text("第1章 标题\n\n正文", encoding="utf-8")
    received: dict[str, Any] = {}

    def runner(**kwargs: Any) -> list[Result]:
        received.update(kwargs)
        return [Result(True, 1), Result(True, 2)]

    result = PublishChapters(runner).execute(
        {
            "novelFile": str(source),
            "chapterManageUrl": "https://fanqienovel.com/manage",
            "start": 1,
            "end": 2,
            "useAi": True,
            "headless": True,
        }
    )

    assert result.ok is True
    assert received["novel_file"] == source
    assert received["chapters"] == [1, 2]
    assert received["use_ai"] is True
    assert received["headless"] is True


def test_sync_use_case_maps_compare_to_check_only(tmp_path: Path) -> None:
    source = tmp_path / "novel.txt"
    source.write_text("第1章 标题\n\n正文", encoding="utf-8")
    received: dict[str, Any] = {}

    def runner(**kwargs: Any) -> list[Result]:
        received.update(kwargs)
        return [Result(True, 1)]

    result = SyncChapters(runner).execute(
        {
            "novelFile": str(source),
            "chapterManageUrl": "https://fanqienovel.com/manage",
            "start": 1,
            "end": 1,
            "operation": "compare",
        }
    )

    assert result.ok is True
    assert received["direction"] == "local_to_remote"
    assert received["check_only"] is True
