"""
人民币价格：优先解析「价格」列中的 USD/RMB；否则使用公开渠道整理的指导价/参考价。
海外 MSRP 按固定汇率换算时标注「参考汇率」；实际成交价以经销商为准。
"""

from __future__ import annotations

import re

# 与录入说明一致：仅作人民币参考展示（2026 初近似中间价）
USD_CNY_REFERENCE = 7.25

_BM = lambda b, m: (b.strip(), m.strip())

# （品牌, 型号）→ 人民币说明（无则走 USD 换算或留空）
PRICE_HINTS_CNY: dict[tuple[str, str], str] = {
    _BM("NIU", "RQi CBS 动力版"): "29980 元（厂商指导价，汽车之家等）",
    _BM("NIU", "RQi ABS 动力版"): "32980 元（厂商指导价）",
    _BM("NIU", "X3 Sport 电轻摩版"): "23980 元（指导价参考，略低于电摩版）",
    _BM("NIU", "X3 Sport 电摩版"): "24980 元（厂商指导价，58摩托等）",
    _BM("Sur-Ron", "幼蜂"): "约 19580 元（轻蜂系列国内参考价）",
    _BM("Sur-Ron", "2025轻蜂X"): "19800 元（2025 款指导价，58摩托）",
    _BM("Sur-Ron", "2025轻蜂3C"): "19800 元（与同系列轻蜂 X 指导价参考）",
    _BM("Sur-Ron", "2025 轻蜂电轻摩"): "约 18800 元（电轻摩版参考）",
    _BM("Sur-Ron", "极蜂3C 性能版"): "29520 元（指导价）",
    _BM("Sur-Ron", "极蜂3C 全地形"): "23800 元（指导价）",
    _BM("Sur-Ron", "极蜂3C 越野版"): "约 24800 元（指导价参考）",
    _BM("RFN", "SX-E2"): "约 13000 元（海外约 1799 USD×7.25，非国内零售价）",
    _BM("RFN", "SX-E3"): "约 13000 元（海外约 1799 USD×7.25，非国内零售价）",
    _BM("RFN", "SX-E5"): "约 17400 元（海外约 2399 USD×7.25）",
    _BM("RFN", "SX-E8"): "约 24700 元（海外约 3399 USD×7.25）",
    _BM("RFN", "SX-E10"): "约 29000 元（海外约 3999 USD×7.25）",
    _BM("RFN", "SX-E15"): "约 38400 元（海外约 5299 USD×7.25）",
    _BM("RFN", "SX-E15 Plus"): "约 41300 元（海外约 5699 USD×7.25）",
    _BM("RFN", "RALLY"): "约 25400 元（海外约 3499 USD×7.25）",
    _BM("RFN", "RALLY PRO"): "约 29000 元（海外约 3999 USD×7.25）",
    _BM("RFN", "ENDURANCE"): "约 21700 元（海外约 2999 USD×7.25）",
    _BM("RFN", "ROAD"): "约 21700 元（海外约 2999 USD×7.25）",
    _BM("RFN", "SX-E150"): "约 5800 元（海外约 799 USD×7.25）",
    _BM("RFN", "SX-E250"): "约 8700 元（海外约 1199 USD×7.25）",
    _BM("RFN", "SX-E350"): "约 10100 元（海外约 1399 USD×7.25）",
    _BM("RFN", "SX-E500"): "约 11600 元（海外约 1599 USD×7.25）",
    _BM("Talaria", "Komodo_Mx"): "约 32800 元（Komodo 系列国内/出口参考价区间）",
    _BM("Talaria", "Komodo_L3E"): "约 32800 元（同上）",
    _BM("Talaria", "xXx_PRO_MX"): "约 23800 元（海外 Sting/xxx 系参考）",
    _BM("Talaria", "xXx_PRO_L1E"): "约 22800 元（L1e 版参考）",
    _BM("Talaria", "STING_PRO_MX"): "约 28300 元（Sting Pro 参考）",
    _BM("Talaria", "STING_PRO_L1E"): "约 26800 元（L1e 版参考）",
}


def _fmt_cny_int(n: float) -> str:
    return str(int(round(n)))


def resolve_price_cny(brand: str, model: str, price_cell: str) -> str:
    p = (price_cell or "").strip()
    k = _BM(brand, model)
    hint = PRICE_HINTS_CNY.get(k, "")

    m_usd = re.search(r"([\d,]+(?:\.\d+)?)\s*USD\b", p, re.IGNORECASE)
    if m_usd:
        usd = float(m_usd.group(1).replace(",", ""))
        cny = usd * USD_CNY_REFERENCE
        return (
            f"约 {_fmt_cny_int(cny)} 元（MSRP {usd:g} USD × {USD_CNY_REFERENCE} 参考汇率，"
            "非中国官方零售价）"
        )

    m_rmb = re.search(r"([\d,]+(?:\.\d+)?)\s*RMB\b", p, re.IGNORECASE)
    if m_rmb:
        v = float(m_rmb.group(1).replace(",", ""))
        return f"{_fmt_cny_int(v)} 元（人民币标价）"

    if "元" in p and re.search(r"\d", p):
        return p

    if not p or p in ("无", "—", "-"):
        return hint

    return p


def apply_prices_to_row(row: dict[str, str]) -> dict[str, str]:
    o: dict[str, str] = dict(row)
    brand = o.get("品牌", "") or ""
    model = o.get("型号", "") or ""
    cur = o.get("价格", "") or ""
    new = resolve_price_cny(brand, model, cur)
    if new:
        o["价格"] = new
    return o
