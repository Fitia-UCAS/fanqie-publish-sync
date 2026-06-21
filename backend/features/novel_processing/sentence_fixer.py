from __future__ import annotations


import re


_SENTENCE_END = r"。！？……!?."
_CLOSE_PAIRED = (
    r"\u201d\u2019"   
    r"\】\」\』\》\］\｣"  
    r"\）\)\]\}"       
)
_OPEN_PAIRED = (
    r"\u201c\u2018"   
    r"\【\「\『\《\［\｢"
    r"\（\(\[\{"
)
_EOL_MARKERS = r"\~\-\—\…\.\`\|\/\\"


def fix_sentences(text: str, normalize_punctuation: bool = True, max_move_chars: int = 120) -> str:
    value = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    if normalize_punctuation:
        value = value.translate(str.maketrans({"：": "：", "。": "。", "！": "！", "？": "？"}))
    lines = value.split("\n")
    merged: list[str] = []
    for line in lines:
        if merged and _should_merge_line(merged[-1], line, max_move_chars):
            merged[-1] = merged[-1].rstrip() + line.lstrip()
            continue
        merged.append(line)
    value = "\n".join(merged)
    value = re.sub(r"\n{4,}", "\n\n\n", value)
    return value.strip() + "\n"


def _should_merge_line(previous: str, current: str, max_move_chars: int) -> bool:
    previous = str(previous or "")
    current = str(current or "")
    if not previous.strip() or not current.strip():
        return False
    if len(current.strip()) > max(1, int(max_move_chars or 120)):
        return False
    if previous.rstrip()[-1:] in _SENTENCE_END + _CLOSE_PAIRED + _EOL_MARKERS:
        return False
    if current.lstrip()[:1] in _OPEN_PAIRED:
        return False
    if current.lstrip().startswith("第"):
        return False
    return True


