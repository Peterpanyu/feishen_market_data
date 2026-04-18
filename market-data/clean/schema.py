"""统一竞品 CSV 表头（UTF-8，与 Mongo 文档主字段对齐）。"""

from __future__ import annotations

产品线_电动摩托车 = "电动摩托车"
产品线_电动滑板车 = "电动滑板车"

# 输出列顺序（含原始追溯）
CANONICAL_COLUMNS: tuple[str, ...] = (
    "品牌",
    "品牌中文名",
    "型号",
    "产品线",
    "价格",
    "续航",
    "最高时速",
    "电池说明",
    "电机功率",
    "峰值功率",
    "充电器与充电时间",
    "制动",
    "减震",
    "车架材质",
    "整车质量",
    "最大载重",
    "轴距",
    "座高",
    "长宽高",
    "离地间隙",
    "轮胎轮圈",
    "智能化及其他",
    "其它列_JSON",
    "原始来源文件",
)


def empty_row() -> dict[str, str]:
    return {k: "" for k in CANONICAL_COLUMNS}
