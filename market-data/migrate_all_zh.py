"""
将 MongoDB 指定库中各集合文档的英文字段名（及部分枚举英文值）批量改为中文。

默认处理 .env 中 MONGO_DB_NAME；可用 --db 多次指定多个库（如 市场洞察库 与 市场数据库）。

干跑::

    py migrate_all_zh.py --dry-run

执行写入::

    py migrate_all_zh.py

环境变量 MONGO_MIGRATE_DBS 可为逗号分隔的多个库名（无 --db 时使用）。
"""

from __future__ import annotations

import argparse
import copy
import json
import sys
from typing import Any

try:
    from pymongo import MongoClient
    from pymongo.errors import PyMongoError
except ImportError as e:
    print("请先安装：pip install -r requirements.txt", file=sys.stderr)
    raise SystemExit(1) from e

ROOT = __import__("pathlib").Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from settings import get_settings  # noqa: E402

# 英文字段名 -> 中文字段名（与 plm-backend doc_keys、market 导入脚本一致）
KEY_EN_TO_ZH: dict[str, str] = {
    # 用户 / 通用
    "username": "用户名",
    "passwordHash": "密码哈希",
    "createdAt": "创建时间",
    "updatedAt": "更新时间",
    "userId": "用户标识",
    "roleName": "角色名",
    "tokenHash": "令牌哈希",
    "expiresAt": "过期时间",
    "revokedAt": "吊销时间",
    "lastUsedAt": "最后使用时间",
    # 策略
    "action": "动作",
    "resourceType": "资源类型",
    "scopeType": "范围类型",
    "scopeId": "范围标识",
    "effect": "效果",
    # 图纸
    "drawingCode": "图号",
    "title": "标题",
    "productId": "产品标识",
    "categoryId": "类别标识",
    "currentRevisionId": "当前版本标识",
    "currentStatus": "当前状态",
    "drawingId": "图纸标识",
    # 版本
    "revisionId": "版本标识",
    "revisionNo": "版本号",
    "fileMeta": "文件信息",
    "originalName": "原始文件名",
    "storedName": "存储文件名",
    "relativePath": "相对路径",
    "size": "字节大小",
    "mimeType": "媒体类型",
    "changeSummary": "变更摘要",
    "createdBy": "创建人",
    "reviewProductId": "校对产品标识",
    "reviewCategoryId": "校对类别标识",
    # 工作流
    "eventType": "事件类型",
    "fromStatus": "原状态",
    "toStatus": "新状态",
    "actedBy": "操作人",
    "actedAt": "操作时间",
    "comment": "备注",
    # 版本编辑
    "changeType": "变更类型",
    "fields": "变更快照",
    "before": "变更前",
    "after": "变更后",
    "reason": "原因",
    # 竞品（旧版导入脚本）
    "product_line": "产品线",
    "brand": "品牌",
    "brand_local": "品牌中文名",
    "model": "型号",
    "specs": "规格参数",
    "source_file": "来源文件",
    "row_hash": "数据指纹",
    "imported_at": "导入时间",
    "parse_warnings": "解析警告",
    # API 残留
    "accessToken": "访问令牌",
    "reviewContext": "校对上下文",
    "obsoleteRevisionIds": "作废版本标识列表",
    "items": "条目",
}

# 在「状态类」字段下常见的英文枚举值 -> 中文（与 app/models/enums 一致）
STATUS_VALUES: dict[str, str] = {
    "Draft": "草稿",
    "InReview": "审核中",
    "Released": "已发布",
    "Obsolete": "已废止",
    "active": "启用",
    "inactive": "停用",
}

# 其它可安全替换的枚举/固定词（避免误伤长英文描述，仅短 token）
OTHER_VALUES: dict[str, str] = {
    "ALLOW": "允许",
    "DENY": "拒绝",
    "Admin": "管理员",
    "Engineer": "工程师",
    "Manager": "经理",
    "CATEGORY": "类别",
    "PRODUCT": "产品",
    "ALL": "全部",
    "drawing_file": "图纸文件",
    "revision_workflow": "版本流程",
    "revision_admin_edit": "版本管理员编辑",
    "DRAWINGS_VIEW": "图纸查看",
    "DRAWINGS_DOWNLOAD": "图纸下载",
    "DRAWINGS_UPLOAD_VERSION": "图纸上传版本",
    "REVISION_SUBMIT_FOR_REVIEW": "版本提交审核",
    "REVISION_APPROVE_PUBLISH": "版本批准发布",
    "REVISION_REJECT_TO_DRAFT": "版本驳回草稿",
    "DRAWINGS_HISTORY_EDIT": "图纸历史编辑",
    "SUBMIT_FOR_REVIEW": "提交审核",
    "APPROVE_PUBLISH": "批准发布",
    "REJECT_TO_DRAFT": "驳回草稿",
    "ADMIN_SET_STATUS": "管理员设状态",
    "ADMIN_REPLACE_FILE": "管理员替换文件",
    "ADMIN_SET_OBSOLETE": "管理员设废止",
    "electric_motorcycle": "电动摩托车",
}


def _migrate_keys(obj: Any, key_map: dict[str, str]) -> Any:
    if isinstance(obj, dict):
        out: dict[str, Any] = {}
        for k, v in obj.items():
            nk = key_map.get(k, k)
            v2 = _migrate_keys(v, key_map)
            if nk in out:
                if isinstance(out[nk], dict) and isinstance(v2, dict):
                    out[nk] = {**out[nk], **v2}
                elif out[nk] in (None, "", [], {}) and v2 not in (None, "", [], {}):
                    out[nk] = v2
            else:
                out[nk] = v2
        return out
    if isinstance(obj, list):
        return [_migrate_keys(x, key_map) for x in obj]
    return obj


# 仅在这些「键名」下替换整串值（避免改 规格参数 里的长英文说明）
_VALUE_KEYS_FOR_ENUM = frozenset(
    {
        "状态",
        "原状态",
        "新状态",
        "当前状态",
        "效果",
        "动作",
        "资源类型",
        "范围类型",
        "角色名",
        "事件类型",
        "变更类型",
        "产品线",
    }
)


def _translate_values(obj: Any, parent_key: str | None = None) -> Any:
    if isinstance(obj, dict):
        return {k: _translate_values(v, k) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_translate_values(x, parent_key) for x in obj]
    if isinstance(obj, str) and parent_key in _VALUE_KEYS_FOR_ENUM:
        if obj in STATUS_VALUES:
            return STATUS_VALUES[obj]
        if obj in OTHER_VALUES:
            return OTHER_VALUES[obj]
    return obj


def migrate_database(client: MongoClient, db_name: str, dry_run: bool) -> tuple[int, int]:
    """返回 (扫描文档数, 实际更新数)。"""
    db = client[db_name]
    scanned = 0
    updated = 0
    try:
        coll_names = [n for n in db.list_collection_names() if not n.startswith("system.")]
    except PyMongoError:
        return 0, 0

    for cname in coll_names:
        col = db[cname]
        for doc in col.find({}):
            scanned += 1
            oid = doc.get("_id")
            if oid is None:
                continue
            body = {k: v for k, v in doc.items() if k != "_id"}
            transformed = _translate_values(_migrate_keys(copy.deepcopy(body), KEY_EN_TO_ZH))
            if "_id" in transformed:
                transformed.pop("_id", None)
            new_doc = {"_id": oid, **transformed}
            if json.dumps(doc, sort_keys=True, default=str) == json.dumps(new_doc, sort_keys=True, default=str):
                continue
            updated += 1
            if not dry_run:
                col.replace_one({"_id": oid}, new_doc)
    return scanned, updated


def main() -> int:
    p = argparse.ArgumentParser(description="Mongo 文档字段/枚举值中文化迁移")
    p.add_argument("--mongo-uri", default=None)
    p.add_argument(
        "--db",
        action="append",
        dest="dbs",
        default=None,
        help="数据库名，可重复传入；默认 .env 的 MONGO_DB_NAME 或 MONGO_MIGRATE_DBS",
    )
    p.add_argument("--dry-run", action="store_true", help="只统计将要更新的文档数，不写库")
    args = p.parse_args()

    settings = get_settings()
    import os

    uri = args.mongo_uri or settings.MONGO_URI
    if args.dbs:
        db_names = args.dbs
    else:
        raw = os.environ.get("MONGO_MIGRATE_DBS", "").strip()
        if raw:
            db_names = [x.strip() for x in raw.split(",") if x.strip()]
        else:
            db_names = [settings.MONGO_DB_NAME]

    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=8000)
        client.admin.command("ping")
    except PyMongoError as e:
        print(f"连接失败：{e}", file=sys.stderr)
        return 2

    total_scan = 0
    total_upd = 0
    for name in db_names:
        print(f"=== 数据库 {name!r} ===")
        s, u = migrate_database(client, name, args.dry_run)
        print(f"  扫描 {s} 条，{'将更新' if args.dry_run else '已更新'} {u} 条")
        total_scan += s
        total_upd += u

    print(f"合计：扫描 {total_scan}，{'将更新' if args.dry_run else '已更新'} {total_upd}")
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
