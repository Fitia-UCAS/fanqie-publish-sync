from __future__ import annotations


import re


def normalize_newlines(text: str) -> str:
    return str(text or "").replace("\r\n", "\n").replace("\r", "\n")


def collapse_blank_lines(text: str, max_blank_lines: int = 1) -> str:
    normalized = normalize_newlines(text)
    count = max(1, max_blank_lines) + 1
    return re.sub(r"\n{%d,}" % (count + 1), "\n" * count, normalized).strip() + "\n"


