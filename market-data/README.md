# 市场数据库（market-data）

与 **PLM（`plm-backend` / `plm-frontend`）无关** 的独立小项目：把桌面上的竞品 CSV 导入 MongoDB。

## 安装

```powershell
cd market-data
pip install -r requirements.txt
copy .env.example .env
```

按需编辑 `.env`：`MONGO_URI`、`MONGO_DB_NAME`。

- 默认 **`MONGO_DB_NAME=市场洞察库`**，与 PLM 使用的 **`市场数据库`** 分库（同一台 Mongo 上两个 database）。
- 若历史数据仍在 **`市场数据库`**，在 `.env` 里把 `MONGO_DB_NAME` 改成 `市场数据库` 即可。

## 清洗与导入（推荐）

1. **清洗**：读取各厂商原始 CSV，映射为统一表头，写出 UTF-8（带 BOM）汇总文件（默认 `data/cleaned/电动摩托车_竞品汇总.csv`）。

```powershell
py clean_csv.py --input-dir "C:\Users\panyu\Desktop\py"
py clean_csv.py --input-dir "..." --output "data\cleaned\电动摩托车_竞品汇总.csv"
```

2. **导入**：默认读取上一步生成的汇总 CSV 写入 Mongo。

```powershell
py import_market_csv.py
py import_market_csv.py --csv "data\cleaned\电动摩托车_竞品汇总.csv" --dry-run
```

若仍需从**多文件原始目录**直接导入（旧行为）：

```powershell
py import_market_csv.py --legacy-from-dir "C:\Users\panyu\Desktop\py"
```

干跑：`--dry-run`  
仅清空集合再导：`--wipe`  
整库删除再导（慎用）：`--drop-entire-database --confirm-db-name <与 .env 中 MONGO_DB_NAME 一致>`

数据写入集合 **`竞品产品`**（可用环境变量 `MARKET_PRODUCTS_COLLECTION` 覆盖）。

浏览数据可使用同级 **`../market-portal`**（见该目录 `README.md`）。

## 历史英文键 / 枚举中文化迁移

若库里仍有旧版英文字段名或英文枚举值，可执行（先干跑）::

    py migrate_all_zh.py --dry-run
    py migrate_all_zh.py

多库（例如 `市场洞察库` 与 `市场数据库`）::

    py migrate_all_zh.py --db 市场洞察库 --db 市场数据库

或在 `.env` 中设置 `MONGO_MIGRATE_DBS=市场洞察库,市场数据库` 后不带 `--db` 运行。

**说明**：`规格参数` 等长文本中的英文产品描述不会被批量替换，仅处理映射表中的字段名与短枚举值。
