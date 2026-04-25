"""
将竞品 CSV 导入 MongoDB（独立项目，不依赖 plm-backend）。

推荐流程：先用 ``clean_csv.py`` 生成统一表头 UTF-8 汇总 CSV，再导入。

用法（在 market-data 目录下）::

    py clean_csv.py --input-dir "C:\\Users\\...\\Desktop\\py"
    py import_market_csv.py
    py import_market_csv.py --csv "data\\cleaned\\电动摩托车_竞品汇总.csv" --dry-run

仍可从多文件原始目录导入（旧行为）::

    py import_market_csv.py --legacy-from-dir "C:\\Users\\...\\Desktop\\py"

配置：本目录 .env 中的 MONGO_URI、MONGO_DB_NAME（可复制 .env.example）。
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from pymongo import ASCENDING, MongoClient, ReplaceOne
    from pymongo.errors import PyMongoError
except ImportError as e:  # pragma: no cover
    print("请先安装依赖：pip install -r requirements.txt", file=sys.stderr)
    raise SystemExit(1) from e

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from settings import get_settings  # noqa: E402
from clean.schema import CANONICAL_COLUMNS  # noqa: E402

F产品线 = "产品线"
F品牌 = "品牌"
F品牌中文名 = "品牌中文名"
F型号 = "型号"
F规格参数 = "规格参数"
F来源文件 = "来源文件"
F数据指纹 = "数据指纹"
F导入时间 = "导入时间"
F解析警告 = "解析警告"

产品线值_电动摩托车 = "电动摩托车"
DEFAULT_COLLECTION = "竞品产品"

# 统一 CSV 中写入主档的列；其余（含「其它列_JSON」展开）进入「规格参数」
_SPECS_SKIP: frozenset[str] = frozenset(
    {"品牌", "品牌中文名", "型号", "产品线", "原始来源文件", "其它列_JSON"}
)

FILE_SPECS: list[dict[str, Any]] = [
    {"filename": "niu-total.csv", "encoding": "utf-8-sig", "brand": "NIU", "brand_local": "小牛"},
    {"filename": "Sur-Ron-total.csv", "encoding": "gb18030", "brand": "Sur-Ron", "brand_local": "虬龙"},
    {"filename": "RFN.csv", "encoding": "gb18030", "brand": "RFN", "brand_local": None},
    {"filename": "talaria.csv", "encoding": "cp1252", "brand": "Talaria", "brand_local": None},
    {"filename": "zeros.csv", "encoding": "cp1252", "brand": "Zero Motorcycles", "brand_local": None},
    {"filename": "stark.csv", "encoding": "cp1252", "brand": "Stark Future", "brand_local": None},
]

MODEL_HEADER_CANDIDATES = ("产品", "型号", "model")


def _strip_key(k: str | None) -> str:
    return (k or "").strip()


def repair_common_mojibake(text: str) -> str:
    if not text:
        return text
    for a, b in (("¡Á", "×"), ("¡ã", "°"), ("¡À", "±"), ("£¨", "（"), ("£©", "）")):
        text = text.replace(a, b)
    return text


def normalize_canonical_model(model: str) -> str:
    """主档「型号」：去掉误写入的「型号：」前缀，与列名重复时不再双重标注。"""
    m = repair_common_mojibake((model or "").strip())
    m = re.sub(r"^型号[：:]\s*", "", m).strip()
    return m


def model_field_query(model: str) -> str | dict[str, list[str]]:
    """Mongo 匹配用：兼容历史「SR/S」与曾写入的「型号：SR/S」。"""
    raw = repair_common_mojibake((model or "").strip())
    norm = normalize_canonical_model(raw)
    vals: list[str] = []
    for x in (norm, raw):
        if x and x not in vals:
            vals.append(x)
    if not vals:
        return ""
    if len(vals) == 1:
        return vals[0]
    return {"$in": vals}


def row_is_empty(row: dict[str, Any]) -> bool:
    for v in row.values():
        if v is None:
            continue
        if str(v).strip():
            return False
    return True


def pick_model(row: dict[str, Any]) -> tuple[str, list[str]]:
    warnings: list[str] = []
    normalized: dict[str, str] = {}
    for k, v in row.items():
        key = _strip_key(k)
        if not key:
            continue
        normalized[key] = (v if v is not None else "").strip()

    for cand in MODEL_HEADER_CANDIDATES:
        for k, v in normalized.items():
            if k.lower() == cand.lower() or k == cand:
                if v:
                    return repair_common_mojibake(v), warnings

    brand_v = normalized.get("品牌") or normalized.get("Æ·ÅÆ")
    model_v = normalized.get("型号") or normalized.get("ÐÍºÅ")
    if model_v:
        if brand_v:
            return repair_common_mojibake(f"{brand_v} {model_v}"), warnings
        return repair_common_mojibake(model_v), warnings

    warnings.append("未识别型号列，已用首列非空字段作为型号")
    for _k, v in normalized.items():
        if v:
            return repair_common_mojibake(v), warnings
    return "", warnings + ["整行无文本，跳过"]


def specs_from_row(row: dict[str, Any], model: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in row.items():
        key = _strip_key(k)
        if not key:
            continue
        val = (v if v is not None else "").strip()
        if not val:
            continue
        lk = key.lower()
        if lk == "model" or key in MODEL_HEADER_CANDIDATES:
            if val == model:
                continue
        out[key] = repair_common_mojibake(val)
    return out


def specs_from_canonical_row(row: dict[str, str]) -> tuple[dict[str, Any], list[str]]:
    """从 clean_csv 输出的行构建「规格参数」字典与解析提示（统一宽表多为展示字符串）。"""
    specs: dict[str, Any] = {}
    warnings: list[str] = []
    for col in CANONICAL_COLUMNS:
        if col in _SPECS_SKIP or col == "其它列_JSON":
            continue
        val = (row.get(col) if row.get(col) is not None else "").strip()
        if val:
            specs[col] = repair_common_mojibake(val)
    raw_others = (row.get("其它列_JSON") or "").strip()
    if raw_others:
        try:
            extra = json.loads(raw_others)
            if isinstance(extra, dict):
                for k, v in extra.items():
                    ks = (k or "").strip()
                    if not ks:
                        continue
                    if isinstance(v, (bool, int, float)):
                        specs[ks] = v
                        continue
                    vs = ("" if v is None else str(v)).strip()
                    if vs:
                        specs[ks] = repair_common_mojibake(vs)
            else:
                warnings.append("其它列_JSON 不是对象，已忽略")
        except json.JSONDecodeError:
            warnings.append("其它列_JSON 解析失败，已忽略")
    return specs, warnings


def _v7_clean_text(s: str) -> str:
    t = (s or "").strip()
    if not t:
        return ""
    t = t.replace("前:nan", "前：无").replace("后:nan", "后：无")
    if t.lower() == "nan":
        return ""
    return repair_common_mojibake(t)


def _v7_parse_number(raw: str | None) -> int | float | None:
    s = (raw if raw is not None else "").strip().replace(",", "")
    if not s or s.lower() == "nan":
        return None
    try:
        x = float(s)
        if abs(x - round(x)) < 1e-9:
            return int(round(x))
        return x
    except ValueError:
        return None


def _v7_parse_bool(raw: str | None) -> bool | None:
    s = (raw if raw is not None else "").strip().lower()
    if not s or s == "nan":
        return None
    if s in ("true", "1", "yes", "是", "y"):
        return True
    if s in ("false", "0", "no", "否", "n"):
        return False
    return None


# v7 中明确按文本保留的列（其余在可解析为数字时写入 int/float）
_V7_TEXT_COLUMNS: frozenset[str] = frozenset({"悬挂系统", "制动系统", "轮胎规格", "适用人群"})
_V7_DOC_COLUMNS: frozenset[str] = frozenset({"品牌", "型号", "产业线", "产品线"})


def specs_from_standardized_v7_row(row: dict[str, str]) -> tuple[dict[str, Any], list[str]]:
    """从 standardized v7 行构建「规格参数」：数值与布尔保持 BSON 原生类型，长文本为字符串。"""
    specs: dict[str, Any] = {}
    warnings: list[str] = []
    for col_raw, val_raw in row.items():
        col = _strip_key(col_raw)
        if not col or col in _V7_DOC_COLUMNS:
            continue
        if val_raw is None:
            continue
        raw = str(val_raw)
        if col == "可拆卸电池":
            b = _v7_parse_bool(raw)
            if b is not None:
                specs[col] = b
            else:
                t = _v7_clean_text(raw)
                if t:
                    specs[col] = t
            continue
        if col in _V7_TEXT_COLUMNS:
            t = _v7_clean_text(raw)
            if t:
                specs[col] = t
            continue
        n = _v7_parse_number(raw)
        if n is not None:
            specs[col] = n
            continue
        t = _v7_clean_text(raw)
        if t:
            specs[col] = t
    return specs, warnings


def build_documents_from_standardized_v7_csv(
    *, csv_path: Path, encoding: str | None = None
) -> list[dict[str, Any]]:
    """读取用户整理的 cleaned_ebike_standardized_v*.csv；规格参数中保留数值/布尔类型。"""
    if encoding:
        raw_rows = read_csv_rows(csv_path, encoding)
    else:
        raw_rows = read_csv_rows_try_encodings(csv_path, "utf-8-sig", "utf-8", "gb18030", "cp936")
    source = csv_path.name
    now = datetime.now(timezone.utc)
    docs: list[dict[str, Any]] = []
    for raw in raw_rows:

        def cell(*keys: str) -> str:
            for k in keys:
                v = raw.get(k)
                if v is not None and str(v).strip():
                    return str(v).strip()
            return ""

        model = normalize_canonical_model(cell("型号"))
        if not model:
            continue
        brand = cell("品牌") or "未知"
        line = cell("产业线", "产品线") or 产品线值_电动摩托车
        specs, mw = specs_from_standardized_v7_row(raw)
        rh = row_hash(source, brand, model, specs)
        doc: dict[str, Any] = {
            F产品线: line,
            F品牌: brand,
            F规格参数: specs,
            F来源文件: source,
            F数据指纹: rh,
            F导入时间: now,
            F解析警告: list(mw),
            F型号: model,
        }
        bl = cell("品牌中文名")
        if bl:
            doc[F品牌中文名] = bl
        docs.append(doc)
    return docs


def build_documents_from_unified_csv(
    *,
    csv_path: Path,
    encoding: str | None = None,
) -> list[dict[str, Any]]:
    if encoding:
        rows = read_csv_rows(csv_path, encoding)
    else:
        rows = read_csv_rows_try_encodings(csv_path, "utf-8-sig", "utf-8", "gb18030", "cp936")
    now = datetime.now(timezone.utc)
    docs: list[dict[str, Any]] = []
    for row in rows:
        model = normalize_canonical_model(row.get("型号") or "")
        if not model:
            continue
        brand = (row.get("品牌") or "").strip() or "未知"
        source = (row.get("原始来源文件") or "").strip() or csv_path.name
        line = (row.get("产品线") or "").strip() or 产品线值_电动摩托车
        specs, mw = specs_from_canonical_row(row)
        rh = row_hash(source, brand, model, specs)
        doc: dict[str, Any] = {
            F产品线: line,
            F品牌: brand,
            F规格参数: specs,
            F来源文件: source,
            F数据指纹: rh,
            F导入时间: now,
            F解析警告: list(mw),
            F型号: model,
        }
        bl = (row.get("品牌中文名") or "").strip()
        if bl:
            doc[F品牌中文名] = bl
        docs.append(doc)
    return docs


# 主档专用列：其余列原样进入「规格参数」，不改表头、不拼单位、不把数值改成中文描述
_NATIVE_RESERVED_TOP: frozenset[str] = frozenset(
    {"品牌", "品牌中文名", "型号", "产品线", "产业线", "原始来源文件"}
)


def _native_pick_product_line(row: dict[str, str]) -> str:
    for k in ("产品线", "产业线"):
        v = (row.get(k) or "").strip()
        if v:
            return v
    return ""


_BOOL_TRUE: frozenset[str] = frozenset({"true", "yes", "y", "是", "真", "on", "t"})
_BOOL_FALSE: frozenset[str] = frozenset({"false", "no", "n", "否", "假", "off", "f"})
# 纯数字 0/1 由 _native_try_number 解析为 int；「TRUE/FALSE」等走布尔


def _native_try_bool(s: str) -> bool | None:
    t = s.strip().lower()
    if t in _BOOL_TRUE:
        return True
    if t in _BOOL_FALSE:
        return False
    return None


def _native_try_number(s: str) -> int | float | None:
    t = s.replace(",", "").strip()
    if not t or t.lower() == "nan":
        return None
    try:
        if re.fullmatch(r"-?\d+", t):
            return int(t)
        x = float(t)
        if not math.isfinite(x):
            return None
        if abs(x - round(x)) < 1e-12:
            return int(round(x))
        return x
    except ValueError:
        return None


_NUMERIC_HEADER_SUFFIXES: tuple[str, ...] = (
    "_RMB",
    "_kW",
    "_Nm",
    "_kmh",
    "_km",
    "_V",
    "_Wh",
    "_h",
    "_kg",
    "_mm",
    "_%",
    "_cm",
)


def _native_header_suggests_number(key: str) -> bool:
    """列名含工程单位后缀时，辅助判断该列应以数值为主（仍优先按单元格内容解析）。"""
    k = (key or "").strip()
    return any(k.endswith(suf) for suf in _NUMERIC_HEADER_SUFFIXES)


def _native_strip_trailing_unit(s: str, key: str) -> str:
    """若内容形如「72V」「50 %」而列名已带单位，去掉冗余单位再尝试解析为数字。"""
    t = s.strip()
    if not t:
        return t
    if key.endswith("_V") and re.fullmatch(r"-?\d+(\.\d+)?\s*[vV]", t):
        return re.sub(r"\s*[vV]\s*$", "", t).strip()
    if key.endswith("_%") and re.fullmatch(r"-?\d+(\.\d+)?\s*%", t):
        return re.sub(r"\s*%\s*$", "", t).strip()
    return t


def _native_coerce_cell(raw: str, *, header_key: str = "") -> Any:
    """按单元格内容推断 BSON 类型；列名带单位后缀时在内容略模糊时辅助解析为数字。"""
    s = (raw or "").strip()
    if not s:
        return None
    s = repair_common_mojibake(s)
    n = _native_try_number(s)
    if n is not None:
        return n
    if _native_header_suggests_number(header_key):
        t2 = _native_strip_trailing_unit(s, header_key)
        if t2 != s:
            n2 = _native_try_number(t2)
            if n2 is not None:
                return n2
    b = _native_try_bool(s)
    if b is not None:
        return b
    return s


def build_documents_from_native_csv(
    *,
    csv_path: Path,
    encoding: str | None = None,
) -> list[dict[str, Any]]:
    """任意表头 CSV：列名原样写入规格参数；单元格按内容推断 int / float / bool / str。"""
    if encoding:
        rows = read_csv_rows(csv_path, encoding)
    else:
        rows = read_csv_rows_try_encodings(csv_path, "utf-8-sig", "utf-8", "gb18030", "cp936")
    now = datetime.now(timezone.utc)
    docs: list[dict[str, Any]] = []
    for row in rows:
        model = normalize_canonical_model(row.get("型号") or "")
        if not model:
            continue
        brand = (row.get("品牌") or "").strip() or "未知"
        line = _native_pick_product_line(row) or 产品线值_电动摩托车
        source = (row.get("原始来源文件") or "").strip() or csv_path.name
        specs: dict[str, Any] = {}
        warnings: list[str] = []
        for k_raw, v_raw in row.items():
            key = _strip_key(k_raw)
            if not key or key in _NATIVE_RESERVED_TOP:
                continue
            if v_raw is None:
                continue
            val = str(v_raw).strip()
            if not val:
                continue
            coerced = _native_coerce_cell(val, header_key=key)
            if coerced is None:
                continue
            specs[key] = coerced
        rh = row_hash(source, brand, model, specs)
        doc: dict[str, Any] = {
            F产品线: line,
            F品牌: brand,
            F规格参数: specs,
            F来源文件: source,
            F数据指纹: rh,
            F导入时间: now,
            F解析警告: warnings,
            F型号: model,
        }
        bl = (row.get("品牌中文名") or "").strip()
        if bl:
            doc[F品牌中文名] = bl
        docs.append(doc)
    return docs


def row_hash(source_file: str, brand: str, model: str, specs: dict[str, Any]) -> str:
    payload = json.dumps(
        {F来源文件: source_file, F品牌: brand, F型号: model, F规格参数: specs},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def read_csv_rows(path: Path, encoding: str) -> list[dict[str, str]]:
    with path.open(newline="", encoding=encoding) as f:
        reader = csv.DictReader(f)
        rows: list[dict[str, str]] = []
        for raw in reader:
            row: dict[str, str] = {}
            for k, v in raw.items():
                key = _strip_key(k)
                if not key:
                    continue
                row[key] = v if v is not None else ""
            if not row_is_empty(row):
                rows.append(row)
        return rows


def read_csv_rows_try_encodings(path: Path, *encodings: str) -> list[dict[str, str]]:
    last: UnicodeDecodeError | None = None
    for enc in encodings:
        try:
            return read_csv_rows(path, enc)
        except UnicodeDecodeError as e:
            last = e
    if last:
        raise last
    return []


def build_documents(
    *,
    data_dir: Path,
    source_file: str,
    encoding: str,
    brand: str,
    brand_local: str | None,
) -> list[dict[str, Any]]:
    path = data_dir / source_file
    if not path.is_file():
        return []
    if source_file == "RFN.csv":
        rows = read_csv_rows_try_encodings(path, "utf-8-sig", encoding)
    else:
        rows = read_csv_rows(path, encoding)
    now = datetime.now(timezone.utc)
    docs: list[dict[str, Any]] = []
    for row in rows:
        model, mw = pick_model(row)
        if not model:
            continue
        specs = specs_from_row(row, model)
        rh = row_hash(source_file, brand, model, specs)
        warnings = list(mw)
        doc: dict[str, Any] = {
            F产品线: 产品线值_电动摩托车,
            F品牌: brand,
            F规格参数: specs,
            F来源文件: source_file,
            F数据指纹: rh,
            F导入时间: now,
            F解析警告: warnings,
        }
        if brand_local is not None:
            doc[F品牌中文名] = brand_local
        doc[F型号] = model
        docs.append(doc)
    return docs


def ensure_indexes(collection: Any) -> None:
    collection.create_index(
        [(F来源文件, ASCENDING), (F数据指纹, ASCENDING)],
        unique=True,
        name="唯一索引_来源文件与数据指纹",
    )
    collection.create_index(
        [(F产品线, ASCENDING), (F品牌, ASCENDING), (F型号, ASCENDING)],
        name="索引_产品线品牌型号",
    )


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="导入市场竞品 CSV 到 MongoDB（market-data 独立项目）")
    p.add_argument(
        "--csv",
        type=Path,
        default=ROOT / "data" / "cleaned" / "电动摩托车_竞品汇总.csv",
        help="统一清洗后的汇总 CSV（默认 data/cleaned/电动摩托车_竞品汇总.csv）",
    )
    p.add_argument(
        "--legacy-from-dir",
        type=Path,
        default=None,
        metavar="DIR",
        help="从多厂商原始 CSV 目录导入（旧行为），与 --csv 二选一",
    )
    p.add_argument("--dry-run", action="store_true", help="只解析并打印统计，不写库")
    p.add_argument("--mongo-uri", default=None, help="覆盖 .env 中的 MONGO_URI")
    p.add_argument(
        "--wipe",
        action="store_true",
        help=f"导入前清空集合「{DEFAULT_COLLECTION}」（或 --collection）",
    )
    p.add_argument(
        "--delete-product-line",
        default=None,
        metavar="产品线",
        help="导入前仅删除该「产品线」的文档（如 电动摩托车）；与 --wipe 二选一更安全，可保留其它产品线",
    )
    p.add_argument(
        "--csv-format",
        choices=("unified", "standardized_v7", "native"),
        default="unified",
        help="unified=clean_csv 汇总表；standardized_v7=cleaned_ebike_standardized；"
        "native=表头原样写入规格参数（不改列名与单元格格式）",
    )
    p.add_argument(
        "--drop-entire-database",
        action="store_true",
        help="删除整个 MONGO_DB_NAME 数据库；须与 --confirm-db-name 同用",
    )
    p.add_argument("--confirm-db-name", default=None, metavar="NAME", help="与 --drop-entire-database 连用，须与配置一致")
    p.add_argument("--collection", default=None, help="集合名（默认环境变量或「竞品产品」）")
    p.add_argument(
        "--encoding",
        default=None,
        metavar="ENC",
        help="CSV 编码（如 gb18030）；不传则按 utf-8-sig → utf-8 → gb18030 → cp936 自动探测",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    settings = get_settings()
    coll_name = args.collection or os.environ.get("MARKET_PRODUCTS_COLLECTION") or DEFAULT_COLLECTION

    all_docs: list[dict[str, Any]] = []
    if args.legacy_from_dir is not None:
        if args.csv_format != "unified":
            print("--csv-format 仅在与默认 --csv 联用时生效，不能与 --legacy-from-dir 同用", file=sys.stderr)
            return 2
        data_dir = args.legacy_from_dir.expanduser()
        if not data_dir.is_dir():
            print(f"数据目录不存在：{data_dir}", file=sys.stderr)
            return 2
        for spec in FILE_SPECS:
            docs = build_documents(
                data_dir=data_dir,
                source_file=spec["filename"],
                encoding=spec["encoding"],
                brand=spec["brand"],
                brand_local=spec.get("brand_local"),
            )
            print(f"{spec['filename']}: {len(docs)} 条")
            all_docs.extend(docs)
    else:
        csv_path = args.csv.expanduser()
        if not csv_path.is_file():
            print(
                f"未找到统一 CSV：{csv_path}\n"
                "请先运行：py clean_csv.py --input-dir \"...\"\n"
                "或指定：--csv <路径>；仍要从原始多文件导入请使用 --legacy-from-dir",
                file=sys.stderr,
            )
            return 2
        enc = args.encoding or None
        if args.csv_format == "standardized_v7":
            all_docs = build_documents_from_standardized_v7_csv(csv_path=csv_path, encoding=enc)
            print(f"{csv_path.name}: {len(all_docs)} 条（standardized_v7）")
        elif args.csv_format == "native":
            all_docs = build_documents_from_native_csv(csv_path=csv_path, encoding=enc)
            print(f"{csv_path.name}: {len(all_docs)} 条（native 原表头）")
        else:
            all_docs = build_documents_from_unified_csv(csv_path=csv_path, encoding=enc)
            print(f"{csv_path.name}: {len(all_docs)} 条（统一表头）")

    print(f"合计可写入：{len(all_docs)} 条 → 库 {settings.MONGO_DB_NAME!r} 集合 {coll_name!r}")

    if args.drop_entire_database:
        if not args.confirm_db_name:
            print("使用 --drop-entire-database 时必须传入 --confirm-db-name", file=sys.stderr)
            return 4
        if args.confirm_db_name != settings.MONGO_DB_NAME:
            print(
                f"--confirm-db-name {args.confirm_db_name!r} 与 MONGO_DB_NAME={settings.MONGO_DB_NAME!r} 不一致",
                file=sys.stderr,
            )
            return 4

    if args.dry_run:
        if args.drop_entire_database:
            print(f"[干跑] 将删除数据库 {settings.MONGO_DB_NAME!r}，再写入 {coll_name!r}")
        return 0

    mongo_uri = args.mongo_uri or settings.MONGO_URI
    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=8000)
        client.admin.command("ping")
    except PyMongoError as e:
        print(f"无法连接 MongoDB：{e}", file=sys.stderr)
        return 3

    db_name = settings.MONGO_DB_NAME
    if args.drop_entire_database:
        db = client[db_name]
        try:
            names = db.list_collection_names()
        except PyMongoError:
            names = []
        print(f"即将删除整个数据库 {db_name!r}，现有集合：{names or '(无或不可列)'}")
        client.drop_database(db_name)
        print(f"已删除数据库 {db_name!r}")

    coll = client[db_name][coll_name]
    if args.wipe and not args.drop_entire_database:
        print(f"已清空集合 {coll_name!r}，删除 {coll.delete_many({}).deleted_count} 条")
    elif args.delete_product_line:
        dq = coll.delete_many({F产品线: args.delete_product_line}).deleted_count
        print(f"已按产品线删除 {args.delete_product_line!r}：{dq} 条")

    ensure_indexes(coll)
    ops = [
        ReplaceOne({F来源文件: d[F来源文件], F数据指纹: d[F数据指纹]}, d, upsert=True) for d in all_docs
    ]
    if not ops:
        print("没有可写入的文档。")
        client.close()
        return 0

    r = coll.bulk_write(ops, ordered=False)
    print(f"bulk_write：matched={r.matched_count}, modified={r.modified_count}, upserted={r.upserted_count}")
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
