"""
将简化版竞品/自有 CSV 补全为与 clean/schema.CANONICAL_COLUMNS 一致的表头与列序，
并可选将非标准「产品线」取值统一到库内常用枚举（与 data/cleaned/电动摩托车_竞品汇总.csv 一致）。

默认：产品线「越野电摩」等映射为「电动摩托车」，原值写入「其它列_JSON」的「原产品线」键。

用法::

    py normalize_unified_csv.py --input "C:\\...\\飞神越野电摩参数翻译表格.csv"
    py normalize_unified_csv.py --input "..." --output "data\\cleaned\\飞神_统一.csv"
    py normalize_unified_csv.py --input "..." --no-product-line-normalize
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from clean.schema import CANONICAL_COLUMNS, 产品线_电动摩托车, 产品线_电动滑板车  # noqa: E402

from import_market_csv import read_csv_rows_try_encodings  # noqa: E402


def _strip_key(k: str | None) -> str:
    return (k or "").strip()


def _norm_line(s: str) -> str:
    return re.sub(r"\s+", "", (s or "").strip())


# 与库内竞品汇总一致：产品线枚举主要为「电动摩托车」「电动滑板车」
_OFFROAD_EMO_LINE_VALUES: frozenset[str] = frozenset(
    {
        "越野电摩",
        "越野电动摩托车",
        "电动越野",
        "越野电动车",
        "电越野",
    }
)


def _merge_others_json(existing: str, patch: dict[str, str]) -> str:
    base: dict[str, str] = {}
    raw = (existing or "").strip()
    if raw:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                for k, v in parsed.items():
                    if isinstance(v, (str, int, float, bool)):
                        base[str(k)] = "" if v is None else str(v)
        except json.JSONDecodeError:
            base["_原始其它列_JSON"] = raw
    base.update(patch)
    return json.dumps(base, ensure_ascii=False, sort_keys=True)


def normalize_row(
    raw: dict[str, str],
    *,
    normalize_product_line: bool,
    default_source: str,
) -> dict[str, str]:
    src: dict[str, str] = {}
    for k, v in raw.items():
        key = _strip_key(k)
        if not key:
            continue
        src[key] = (v if v is not None else "").strip()

    out: dict[str, str] = {k: "" for k in CANONICAL_COLUMNS}
    extras: dict[str, str] = {}

    for col in CANONICAL_COLUMNS:
        if col == "其它列_JSON":
            continue
        v = src.get(col, "")
        if v:
            out[col] = v

    raw_others = (src.get("其它列_JSON") or "").strip()
    line_in = out.get("产品线") or ""
    original_line: str | None = None

    if normalize_product_line:
        nl = _norm_line(line_in)
        compact = line_in.strip()
        if not compact:
            out["产品线"] = 产品线_电动摩托车
        elif compact in (产品线_电动摩托车, 产品线_电动滑板车):
            out["产品线"] = compact
        elif compact in _OFFROAD_EMO_LINE_VALUES or "越野" in compact and "摩" in compact:
            original_line = compact
            out["产品线"] = 产品线_电动摩托车
        elif nl in {_norm_line(x) for x in _OFFROAD_EMO_LINE_VALUES}:
            original_line = compact
            out["产品线"] = 产品线_电动摩托车

    if original_line:
        extras["原产品线"] = original_line

    if extras:
        out["其它列_JSON"] = _merge_others_json(raw_others, extras)
    elif raw_others:
        out["其它列_JSON"] = raw_others

    if not (out.get("原始来源文件") or "").strip():
        out["原始来源文件"] = default_source

    return out


def main() -> int:
    p = argparse.ArgumentParser(description="补全统一竞品 CSV 表头并对齐产品线枚举")
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--output", type=Path, default=None, help="默认 data/cleaned/<输入主名>_竞品统一.csv")
    p.add_argument(
        "--no-product-line-normalize",
        action="store_true",
        help="不将越野电摩等映射为电动摩托车",
    )
    p.add_argument(
        "--source-name",
        default=None,
        help="写入「原始来源文件」列的默认文件名（默认用输入文件 basename）",
    )
    args = p.parse_args()

    inp = args.input.expanduser()
    if not inp.is_file():
        print(f"文件不存在：{inp}", file=sys.stderr)
        return 2

    rows = read_csv_rows_try_encodings(inp, "utf-8-sig", "utf-8", "gb18030", "cp936")
    if not rows:
        print("未读到数据行", file=sys.stderr)
        return 2

    default_src = args.source_name or inp.name
    out_path = args.output or (ROOT / "data" / "cleaned" / f"{inp.stem}_竞品统一.csv")
    out_path = out_path.expanduser()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    norm_pl = not args.no_product_line_normalize
    out_rows = [normalize_row(r, normalize_product_line=norm_pl, default_source=default_src) for r in rows]

    with out_path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(CANONICAL_COLUMNS), extrasaction="ignore")
        w.writeheader()
        for r in out_rows:
            w.writerow(r)

    print(f"已写出 {len(out_rows)} 行 → {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
