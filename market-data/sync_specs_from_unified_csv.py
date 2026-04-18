"""
用统一汇总 CSV 重算「规格参数」「数据指纹」，更新 Mongo 中已存在的竞品文档。

用于在清洗规则变更后，无需 wipe 即可对齐库内字段（如「智能化及其他」表头标注）。

用法::

    py sync_specs_from_unified_csv.py
    py sync_specs_from_unified_csv.py --csv "C:\\Users\\...\\电动摩托车_竞品汇总.csv"
    py sync_specs_from_unified_csv.py --dry-run
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    from pymongo import MongoClient
    from pymongo.errors import PyMongoError
except ImportError as e:  # pragma: no cover
    print("请先安装依赖：pip install -r requirements.txt", file=sys.stderr)
    raise SystemExit(1) from e

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import import_market_csv as im  # noqa: E402
from settings import get_settings  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser(description="从统一 CSV 同步规格参数与数据指纹到 Mongo")
    p.add_argument(
        "--csv",
        type=Path,
        default=ROOT / "data" / "cleaned" / "电动摩托车_竞品汇总.csv",
        help="统一汇总 CSV（UTF-8 BOM）",
    )
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--mongo-uri", default=None)
    p.add_argument("--collection", default=None)
    args = p.parse_args()

    csv_path = args.csv.expanduser()
    if not csv_path.is_file():
        print(f"未找到 CSV：{csv_path}", file=sys.stderr)
        return 2

    rows = im.read_csv_rows(csv_path, "utf-8-sig")
    settings = get_settings()
    coll_name = args.collection or os.environ.get("MARKET_PRODUCTS_COLLECTION") or im.DEFAULT_COLLECTION

    updates: list[tuple[dict[str, object], dict[str, object]]] = []
    for row in rows:
        model_raw = (row.get(im.F型号) or "").strip()
        model_norm = im.normalize_canonical_model(model_raw)
        if not model_norm:
            continue
        brand = (row.get(im.F品牌) or "").strip() or "未知"
        source = (row.get("原始来源文件") or "").strip() or csv_path.name
        specs, mw = im.specs_from_canonical_row(row)
        rh = im.row_hash(source, brand, model_norm, specs)
        model_q = im.model_field_query(model_raw)
        filt: dict[str, object] = {im.F品牌: brand, im.F型号: model_q, im.F来源文件: source}
        payload = {
            im.F规格参数: specs,
            im.F数据指纹: rh,
            im.F解析警告: list(mw),
            im.F型号: model_norm,
        }
        updates.append((filt, payload))

    print(f"将尝试更新 {len(updates)} 条（匹配 品牌+型号+来源文件）")

    if args.dry_run:
        return 0

    mongo_uri = args.mongo_uri or settings.MONGO_URI
    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=8000)
        client.admin.command("ping")
    except PyMongoError as e:
        print(f"无法连接 MongoDB：{e}", file=sys.stderr)
        return 3

    coll = client[settings.MONGO_DB_NAME][coll_name]
    n_ok = 0
    n_fb = 0
    n_miss = 0
    for filt, payload in updates:
        r = coll.update_one(filt, {"$set": payload})
        if r.matched_count:
            n_ok += 1
            continue
        # 历史导入可能「来源文件」与当前汇总里「原始来源文件」不一致，回退为品牌+型号
        fb = {im.F品牌: filt[im.F品牌], im.F型号: filt[im.F型号]}  # 型号键上可为 str 或 $in
        r2 = coll.update_one(fb, {"$set": payload})
        if r2.matched_count:
            n_fb += 1
        else:
            n_miss += 1
    print(
        f"已匹配并更新：{n_ok} 条（品牌+型号+来源文件）；"
        f"回退匹配更新：{n_fb} 条（仅品牌+型号）；"
        f"仍未匹配：{n_miss} 条"
    )
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
