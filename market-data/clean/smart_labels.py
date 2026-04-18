"""智能化及其他：表头+值，避免单独出现「是/TRUE」等无语义片段。"""

from __future__ import annotations

from .zh_misc import translate_value_tokens


def smart_label_pair(header: str, value: str) -> str:
    """
    输出「表头：值」。值会先走常用词翻译（Yes/TRUE→是）。
    布尔或任意文本均带表头，便于阅读。
    """
    h = (header or "").strip()
    v = translate_value_tokens((value or "").strip())
    if not v:
        return ""
    if not h:
        return v
    return f"{h}：{v}"
