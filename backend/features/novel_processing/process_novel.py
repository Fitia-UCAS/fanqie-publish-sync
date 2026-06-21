from __future__ import annotations


from pathlib import Path
from typing import Any

from backend.features.novel_processing.chapter_formatter import format_chapters, format_novel_chapters
from backend.features.novel_processing.chapter_text_parser import chapters_to_preview, read_chapters, select_chapters
from backend.features.novel_processing.text_file_updater import update_text_file_in_place
from backend.runtime.jobs.callbacks import TaskCallbacks
from backend.infrastructure.files.discovery import iter_text_files
from backend.runtime.paths import PROCESS_BACKUP_DIR, PROCESS_OUTPUT_DIR
from backend.runtime.jobs.results import TaskResult
from backend.features.novel_processing.models import Chapter

FORMAT_BACKUP_DIR = PROCESS_BACKUP_DIR / "format_novel"


EXTRACT_TEXT_MODES = {"single", "around", "range"}


MODE_LABELS = {
    "single": "提取单章",
    "around": "提取前后章",
    "range": "提取范围",
    "organizeSingle": "整理单章",
    "organizeAround": "整理前后章",
    "organizeRange": "整理范围",
}


def analyze_novel_file(file_path: str) -> TaskResult:
    chapters = read_chapters(file_path)
    return TaskResult(True, f"已识别 {len(chapters)} 个章节。", data={"chapters": chapters_to_preview(chapters)})


def process_novel(payload: dict[str, Any], callbacks: TaskCallbacks | None = None) -> TaskResult:
    callbacks = callbacks or TaskCallbacks()
    mode = str(payload.get("mode") or "range")
    if mode == "formatFolder":
        return format_batch_files(payload, callbacks)

    novel_file = _require_file(payload.get("novelFile"))
    if mode == "formatNovel":
        return format_single_file(novel_file, callbacks)

    chapters = read_chapters(novel_file)
    callbacks.emit_progress(0, 1)
    callbacks.emit_log(f"已识别 {len(chapters)} 个章节。")
    selected = _select_by_mode(chapters, payload, mode)
    if not selected:
        return TaskResult(False, "没有匹配到目标章节。")

    selected_text = format_chapters(selected)
    target = _chapter_output_path(payload, novel_file, selected, mode)
    target.write_text(selected_text, encoding="utf-8")
    callbacks.emit_progress(1, 1)
    callbacks.emit_log(f"已写出：{target.name}", "success")
    data: dict[str, Any] = {}
    if mode in EXTRACT_TEXT_MODES:
        data["resultDisplayMode"] = "chapter_text"
        data["resultText"] = selected_text
    return TaskResult(
        True,
        f"{MODE_LABELS.get(mode, '处理')}完成。",
        path=target,
        result_kind="output_file",
        display_name=target.name,
        data=data,
    )


def _select_by_mode(chapters: list[Chapter], payload: dict[str, Any], mode: str) -> list[Chapter]:
    if mode in {"single", "organizeSingle"}:
        number = int(payload.get("chapter") or 1)
        return select_chapters(chapters, number, number)
    if mode in {"around", "organizeAround"}:
        number = int(payload.get("aroundChapter") or payload.get("chapter") or 1)
        return select_chapters(chapters, max(1, number - 1), number + 1)
    if mode in {"range", "organizeRange"}:
        return select_chapters(chapters, int(payload.get("start") or 1), int(payload.get("end") or 1))
    return chapters


def format_single_file(novel_file: Path, callbacks: TaskCallbacks) -> TaskResult:
    callbacks.emit_progress(0, 1)
    update = update_text_file_in_place(novel_file, format_novel_chapters, backup_dir=FORMAT_BACKUP_DIR, backup=True)
    callbacks.emit_progress(1, 1)
    data: dict[str, Any] = {"changed": update.changed}
    if update.backup_path:
        data["backupPath"] = str(update.backup_path)
        data["backupDir"] = str(update.backup_path.parent)
    return TaskResult(
        True,
        "格式化整本完成，已覆盖原文件。" if update.changed else "格式已规范，无需修改。",
        path=novel_file,
        result_kind="in_place",
        display_name=novel_file.name,
        data=data,
    )


def format_batch_files(payload: dict[str, Any], callbacks: TaskCallbacks) -> TaskResult:
    folder = str(payload.get("batchFolder") or "").strip()
    files = iter_text_files(folder)
    if not files:
        return TaskResult(False, "文件夹中没有 TXT 文件。")

    changed = 0
    backup_paths: list[str] = []
    for index, file_path in enumerate(files, start=1):
        update = update_text_file_in_place(
            file_path,
            format_novel_chapters,
            backup_dir=FORMAT_BACKUP_DIR / file_path.parent.name,
            backup=True,
        )
        if update.changed:
            changed += 1
        if update.backup_path:
            backup_paths.append(str(update.backup_path))
        callbacks.emit_progress(index, len(files))
        callbacks.emit_log(f"完成：{file_path.name}")
    message = f"批量格式化完成：{len(files)} 个文件，覆盖修改 {changed} 个。"
    callbacks.emit_log(message, "success")
    data: dict[str, Any] = {"changed": changed, "backupPaths": backup_paths}
    if backup_paths:
        data["backupPath"] = backup_paths[-1]
        data["backupDir"] = str(Path(backup_paths[-1]).parent)
    return TaskResult(
        True,
        message,
        path=Path(folder),
        result_kind="in_place_batch",
        display_name=Path(folder).name,
        data=data,
    )


def _chapter_output_path(payload: dict[str, Any], novel_file: Path, selected: list[Chapter], mode: str) -> Path:
    raw = str(payload.get("outputFile") or "").strip()
    if raw:
        target = Path(raw)
        if target.exists() and target.is_dir():
            target = target / _default_output_name(novel_file, selected, mode)
        elif not target.suffix:
            target = target / _default_output_name(novel_file, selected, mode)
    else:
        target = PROCESS_OUTPUT_DIR / _default_output_name(novel_file, selected, mode)
    target.parent.mkdir(parents=True, exist_ok=True)
    return target


def _default_output_name(novel_file: Path, selected: list[Chapter], mode: str) -> str:
    if not selected:
        return "章节输出.txt"
    first = selected[0]
    last = selected[-1]
    if first.number == last.number:
        return f"第{first.number}章.txt"
    return f"第{first.number}-{last.number}章.txt"


def _require_file(value: Any) -> Path:
    raw = str(value or "").strip()
    if not raw:
        raise RuntimeError("请先选择小说 TXT 文件。")
    path = Path(raw)
    if not path.exists() or not path.is_file():
        raise RuntimeError(f"请选择一个存在的小说 TXT 文件：{path}")
    return path


