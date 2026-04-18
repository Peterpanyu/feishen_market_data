"""
为规范列补全公制单位；除「轮胎轮圈」外将常见英制写法换算为公制（优先采用括号内公制）。
"""

from __future__ import annotations

import json
import re
from typing import Any

from .schema import CANONICAL_COLUMNS

_TIRE_COL = "轮胎轮圈"

# 轮胎规格：宽/扁平比-轮毂直径（英寸），不换算轮辋英寸
_TIRE_SPEC = re.compile(
    r"\b\d{2,3}\s*/\s*\d{2,3}\s*-\s*\d{2}\b|\b\d+\.\d+\s*-\s*\d{2}\b",
    re.IGNORECASE,
)


def _strip_commas_int(s: str) -> str:
    return s.replace(",", "").replace("，", "")


def _fmt_num(n: float, nd: int = 1) -> str:
    if abs(n - round(n)) < 1e-6:
        return str(int(round(n)))
    return str(round(n, nd)).rstrip("0").rstrip(".")


def _replace_paren_metric(s: str) -> str:
    """x in (y mm) / x lb (y kg) / x mph (y km/h) → 公制侧。"""
    s = re.sub(
        r"(\d+\.?\d*)\s*in\s*\(\s*([\d,\.]+)\s*mm\s*\)",
        lambda m: f"{_fmt_num(float(_strip_commas_int(m.group(2))))} 毫米",
        s,
        flags=re.IGNORECASE,
    )
    s = re.sub(
        r"(\d+\.?\d*)\s*lb\s*\(\s*(\d+)\s*kg\s*\)",
        lambda m: f"{m.group(2)} 千克",
        s,
        flags=re.IGNORECASE,
    )
    s = re.sub(
        r"(\d+\.?\d*)\s*lbs\s*\(\s*(\d+)\s*kg\s*\)",
        lambda m: f"{m.group(2)} 千克",
        s,
        flags=re.IGNORECASE,
    )
    s = re.sub(
        r"(\d+\.?\d*)\s*mph\s*\(\s*(\d+)\s*km/h\s*\)",
        lambda m: f"{m.group(2)} 千米/时",
        s,
        flags=re.IGNORECASE,
    )
    s = re.sub(
        r"(\d+\.?\d*)\s*mi\s*\(\s*([\d,\.]+)\s*km\s*\)",
        lambda m: f"{_fmt_num(float(_strip_commas_int(m.group(2))))} 公里",
        s,
        flags=re.IGNORECASE,
    )
    return s


def _convert_imperial_no_inch(s: str) -> str:
    """mph / lb / mi / ft → 公制，不换算英寸（供轮胎列使用）。"""

    def mph_sub(m: re.Match[str]) -> str:
        v = float(m.group(1))
        return f"{_fmt_num(v * 1.609344, 0)} 千米/时"

    s = re.sub(r"\b(\d+\.?\d*)\s*mph\b", mph_sub, s, flags=re.IGNORECASE)

    def lb_sub(m: re.Match[str]) -> str:
        v = float(m.group(1))
        return f"{_fmt_num(v * 0.45359237, 1)} 千克"

    s = re.sub(r"\b(\d+\.?\d*)\s*(?:lb|lbs)\b", lb_sub, s, flags=re.IGNORECASE)

    def mi_sub(m: re.Match[str]) -> str:
        v = float(m.group(1))
        return f"{_fmt_num(v * 1.609344, 0)} 公里"

    s = re.sub(r"\b(\d+\.?\d*)\s*(?:mi|miles)\b", mi_sub, s, flags=re.IGNORECASE)

    def ft_sub(m: re.Match[str]) -> str:
        v = float(m.group(1))
        return f"{_fmt_num(v * 0.3048 * 1000, 0)} 毫米"

    s = re.sub(r"\b(\d+\.?\d*)\s*(?:ft|feet)\b", ft_sub, s, flags=re.IGNORECASE)
    return s


def _convert_free_imperial(s: str) -> str:
    """无括号公制时的 mph / lb / mi / ft / inch 词。"""
    s = _convert_imperial_no_inch(s)

    def inch_word_sub(m: re.Match[str]) -> str:
        v = float(m.group(1))
        return f"{_fmt_num(v * 25.4, 0)} 毫米"

    s = re.sub(r"(?<![/\-\d])(\d+\.?\d*)\s*(?:inch|inches)\b", inch_word_sub, s, flags=re.IGNORECASE)
    s = re.sub(
        r"(?<![/\-\d])(\d+\.?\d*)\s+in\b(?!\s*\()",
        inch_word_sub,
        s,
        flags=re.IGNORECASE,
    )
    return s


def _annotate_tire_inch_words(s: str) -> str:
    """轮胎列中「21 in」等记为英寸，不换算毫米。"""
    return re.sub(r"\b(\d{1,2})\s+in\b", r"\1 英寸", s, flags=re.IGNORECASE)


def _annotate_tire_column(s: str) -> str:
    """轮胎列：保留 70/100-19 等记法；孤立轮辋寸如末尾「17」标为英寸，不换算毫米。"""
    if not s.strip():
        return s
    lines = s.splitlines()
    out: list[str] = []
    for line in lines:
        t = line.strip()
        if not t:
            out.append(line)
            continue
        if _TIRE_SPEC.search(t):
            out.append(t)
            continue
        # 单行仅数字 → 轮辋英寸
        if re.fullmatch(r"\d{2}", t):
            out.append(f"{t} 英寸")
        else:
            out.append(t)
    return "\n".join(out)


def _append_units_for_column(col: str, val: str) -> str:
    v = val.strip()
    if not v or v in ("无", "—", "-", "N/A"):
        return val
    if col == "价格":
        return val
    if col == "续航":
        if re.search(r"(公里|km)\b", v, re.I):
            return re.sub(r"\bkm\b", "公里", v, flags=re.IGNORECASE)
        if re.match(r"^[\d.\s|＞>+]+$", v.replace("km", "").replace("KM", "")) and "km" in v.lower():
            return re.sub(r"(\d+\.?\d*)\s*km\b", r"\1 公里", v, flags=re.IGNORECASE)
        if re.match(r"^[\d.]+", v) and "公里" not in v and "km" not in v.lower():
            return re.sub(r"^([\d.]+)", r"\1 公里", v, count=1)
        return v
    if col == "最高时速":
        v2 = re.sub(r"(\d+\.?\d*)\s*(?:km/h|kmh|KM/H)\b", r"\1 千米/时", v, flags=re.IGNORECASE)
        if "千米/时" not in v2 and "km" not in v2.lower() and re.match(r"^[\d.＞>]+", v2):
            v2 = re.sub(r"^([\d.＞>]+)", r"\1 千米/时", v2, count=1)
        return v2
    if col in ("轴距", "座高", "离地间隙"):
        if "毫米" in v or re.search(r"\d+\s*mm\b", v, re.I):
            return re.sub(r"\bmm\b", "毫米", v, flags=re.IGNORECASE)
        if re.match(r"^[\d./\s\-–—]+$", v) or re.match(r"^[\d.]+\s*mm", v, re.I):
            return re.sub(r"(\d+\.?\d*)\s*mm\b", r"\1 毫米", v, flags=re.IGNORECASE)
        return v
    if col == "长宽高":
        if "毫米" in v or "mm" in v.lower() or "×" in v or "*" in v or "x" in v.lower():
            v2 = re.sub(r"\bmm\b", "毫米", v, flags=re.IGNORECASE)
            return v2
        parts = re.split(r"[\s×*xX]+", v)
        if len(parts) >= 3 and all(re.match(r"^\d+\.?\d*$", p) for p in parts[:3]):
            return f"{parts[0]}×{parts[1]}×{parts[2]} 毫米"
        return v
    if col in ("整车质量", "最大载重"):
        if "千克" in v or re.search(r"\d\s*kg\b", v, re.I):
            return re.sub(r"\bkg\b", "千克", v, flags=re.IGNORECASE)
        if re.search(r"\d+\s*/\s*\d+\s*kg", v, re.I):
            return re.sub(r"\bkg\b", "千克", v, flags=re.IGNORECASE)
        return v
    if col in ("电机功率", "峰值功率"):
        v2 = re.sub(r"(\d+\.?\d*)\s*[kK][wW]\b", r"\1 千瓦", v)
        v2 = re.sub(r"(\d+)\s*[wW]\b(?!\w)", r"\1 瓦", v2)
        if re.match(r"^[\d.]+$", v2.strip()):
            return f"{v2.strip()} 千瓦"
        return v2
    if col == "电池说明":
        v2 = re.sub(r"(\d+\.?\d*)\s*[kK][wW][hH]\b", r"\1 千瓦时", v)
        v2 = re.sub(r"(\d+\.?\d*)\s*[vV]\b", r"\1 伏", v2)
        v2 = re.sub(r"(\d+\.?\d*)\s*[wW][hH]\b", r"\1 瓦时", v2)
        return v2
    return val


def _normalize_free_text(s: str, *, tire_column: bool) -> str:
    t = _replace_paren_metric(s)
    if tire_column:
        t = _convert_imperial_no_inch(t)
        t = _annotate_tire_inch_words(t)
    else:
        t = _convert_free_imperial(t)
    return t


def _normalize_json_values(raw: str) -> str:
    raw = raw.strip()
    if not raw:
        return raw
    try:
        d = json.loads(raw)
    except json.JSONDecodeError:
        return raw
    if not isinstance(d, dict):
        return raw
    out: dict[str, Any] = {}
    for k, v in d.items():
        if isinstance(v, str):
            vv = v.strip()
            if not vv:
                continue
            vv = _replace_paren_metric(vv)
            vv = _convert_free_imperial(vv)
            out[k] = vv
        else:
            out[k] = v
    return json.dumps(out, ensure_ascii=False, sort_keys=True)


def normalize_canonical_row(row: dict[str, str]) -> dict[str, str]:
    o = dict(row)
    for col in CANONICAL_COLUMNS:
        if col == "其它列_JSON":
            continue
        val = o.get(col) or ""
        if not val.strip():
            continue
        if col == _TIRE_COL:
            v = _normalize_free_text(val, tire_column=True)
            v = _annotate_tire_column(v)
        else:
            v = _normalize_free_text(val, tire_column=False)
        v = _append_units_for_column(col, v)
        o[col] = v
    if (o.get("其它列_JSON") or "").strip():
        o["其它列_JSON"] = _normalize_json_values(o["其它列_JSON"])
    return o
