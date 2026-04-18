"""
读取各厂商原始 CSV，清洗并输出统一格式 UTF-8（带 BOM）汇总表。

输出默认：data/cleaned/电动摩托车_竞品汇总.csv

用法::

    py clean_csv.py --input-dir "C:\\Users\\panyu\\Desktop\\py"
    py clean_csv.py --input-dir "..." --output "data/cleaned/电动摩托车_竞品汇总.csv"
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from clean.schema import CANONICAL_COLUMNS  # noqa: E402
from clean.transformers import (  # noqa: E402
    finalize_row,
    transform_ninebot_row,
    transform_niu_row,
    transform_rfn_row,
    transform_stark_row,
    transform_surron_row,
    transform_talaria_row,
    transform_zero_row,
)

SOURCES: list[tuple[str, str, str]] = [
    ("niu-total.csv", "utf-8-sig", "niu"),
    ("Sur-Ron-total.csv", "gb18030", "surron"),
    ("RFN.csv", "utf-8-sig", "rfn"),
    ("talaria.csv", "cp1252", "talaria"),
    ("zeros.csv", "cp1252", "zero"),
    ("stark.csv", "cp1252", "stark"),
]


def _norm_header_key(k: str | None) -> str:
    """表头内换行、多空格合并为单行键（如 ninebot 电池电压列）。"""
    return re.sub(r"\s+", " ", (k or "").strip())


def read_rows(path: Path, encoding: str) -> list[dict[str, str]]:
    with path.open(newline="", encoding=encoding) as f:
        reader = csv.DictReader(f)
        rows: list[dict[str, str]] = []
        for raw in reader:
            row = {_norm_header_key(k): (v if v is not None else "") for k, v in raw.items()}
            if not any(str(v).strip() for v in row.values()):
                continue
            rows.append(row)
    return rows


def read_rows_try_encodings(path: Path, *encodings: str) -> list[dict[str, str]]:
    """依次尝试编码（新版 RFN 多为 UTF-8，旧版多为 GB18030）。"""
    last: UnicodeDecodeError | None = None
    for enc in encodings:
        try:
            return read_rows(path, enc)
        except UnicodeDecodeError as e:
            last = e
    if last:
        raise last
    return []


def transform_row(name: str, row: dict[str, str], source: str) -> dict[str, str]:
    if name == "niu":
        return finalize_row(transform_niu_row(row, source))
    if name == "surron":
        return finalize_row(transform_surron_row(row, source))
    if name == "rfn":
        return finalize_row(transform_rfn_row(row, source))
    if name == "talaria":
        return finalize_row(transform_talaria_row(row, source))
    if name == "zero":
        return finalize_row(transform_zero_row(row, source))
    if name == "stark":
        return finalize_row(transform_stark_row(row, source))
    if name == "ninebot":
        return finalize_row(transform_ninebot_row(row, source))
    raise ValueError(name)


def main() -> int:
    p = argparse.ArgumentParser(description="清洗并统一竞品 CSV")
    p.add_argument("--input-dir", type=Path, default=Path.home() / "Desktop" / "py")
    p.add_argument(
        "--output",
        type=Path,
        default=ROOT / "data" / "cleaned" / "电动摩托车_竞品汇总.csv",
        help="输出 UTF-8 BOM 汇总 CSV",
    )
    args = p.parse_args()
    inp: Path = args.input_dir.expanduser()
    if not inp.is_dir():
        print(f"输入目录不存在：{inp}", file=sys.stderr)
        return 2

    out: Path = args.output
    out.parent.mkdir(parents=True, exist_ok=True)

    all_rows: list[dict[str, str]] = []
    for filename, enc, kind in SOURCES:
        path = inp / filename
        if not path.is_file():
            print(f"跳过（不存在）：{filename}")
            continue
        n = 0
        if filename == "RFN.csv":
            file_rows = read_rows_try_encodings(path, "utf-8-sig", "gb18030")
        else:
            file_rows = read_rows(path, enc)
        for row in file_rows:
            all_rows.append(transform_row(kind, row, filename))
            n += 1
        print(f"{filename}: {n} 行")

    ninebot_path = inp / "ninebot-esc.csv"
    if not ninebot_path.is_file():
        ninebot_path = inp.parent / "ninebot-esc.csv"
    if ninebot_path.is_file():
        n = 0
        for row in read_rows(ninebot_path, "utf-8-sig"):
            all_rows.append(transform_row("ninebot", row, "ninebot-esc.csv"))
            n += 1
        print(f"ninebot-esc.csv: {n} 行（{ninebot_path}）")
    else:
        print("跳过（不存在）：ninebot-esc.csv（可放在输入目录或上一级 Desktop）")

    with out.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(CANONICAL_COLUMNS), extrasaction="ignore")
        w.writeheader()
        w.writerows(all_rows)

    print(f"已写入 {len(all_rows)} 行 → {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
