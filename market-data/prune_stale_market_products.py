"""
删除「竞品产品」集合中不在当前统一汇总 CSV 内的文档（通常为旧版 legacy 导入）。

默认干跑；确认后加 --execute 真正删除。

用法::

    py prune_stale_market_products.py
    py prune_stale_market_products.py --execute
    py prune_stale_market_products.py --csv "data\\cleaned\\电动摩托车_竞品汇总.csv" --execute
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
    p = argparse.ArgumentParser(description="按统一 CSV 数据指纹删除旧版竞品文档")
    p.add_argument(
        "--csv",
        type=Path,
        default=ROOT / "data" / "cleaned" / "电动摩托车_竞品汇总.csv",
        help="与 import_market_csv 使用的统一汇总表",
    )
    p.add_argument("--execute", action="store_true", help="执行删除（默认仅统计）")
    p.add_argument("--mongo-uri", default=None, help="覆盖 .env 中的 MONGO_URI")
    p.add_argument("--collection", default=None, help="集合名（默认与导入脚本一致）")
    args = p.parse_args()

    csv_path = args.csv.expanduser()
    if not csv_path.is_file():
        print(f"未找到 CSV：{csv_path}", file=sys.stderr)
        return 2

    docs = im.build_documents_from_unified_csv(csv_path=csv_path)
    allowed = {d[im.F数据指纹] for d in docs}
    print(f"当前汇总表有效指纹数：{len(allowed)}（文档 {len(docs)} 条）")

    settings = get_settings()
    coll_name = args.collection or os.environ.get("MARKET_PRODUCTS_COLLECTION") or im.DEFAULT_COLLECTION
    mongo_uri = args.mongo_uri or settings.MONGO_URI

    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=8000)
        client.admin.command("ping")
    except PyMongoError as e:
        print(f"无法连接 MongoDB：{e}", file=sys.stderr)
        return 3

    coll = client[settings.MONGO_DB_NAME][coll_name]
    q = {im.F数据指纹: {"$nin": list(allowed)}}
    n_stale = coll.count_documents(q)
    n_keep = coll.count_documents({im.F数据指纹: {"$in": list(allowed)}})
    print(f"库 {settings.MONGO_DB_NAME!r} 集合 {coll_name!r}：将保留（指纹在表内）≈ {n_keep} 条，将删除（不在表内）{n_stale} 条")

    if not args.execute:
        print("干跑结束。确认无误后追加参数：--execute")
        client.close()
        return 0

    r = coll.delete_many(q)
    print(f"已删除 {r.deleted_count} 条。")
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
