from __future__ import annotations


from backend.features.novel_processing.plain_text import collapse_blank_lines
from backend.features.novel_processing.models import Chapter
from backend.features.novel_processing.chapter_text_parser import parse_chapters


def format_chapter(chapter: Chapter) -> str:
    body = collapse_blank_lines(chapter.body, max_blank_lines=1).strip()
    return f"{chapter.heading}\n\n{body}\n"


def format_chapters(chapters: list[Chapter]) -> str:
    return "\n\n".join(format_chapter(chapter).strip() for chapter in chapters).strip() + "\n"


def format_novel_chapters(text: str) -> str:
    return format_chapters(parse_chapters(text))


