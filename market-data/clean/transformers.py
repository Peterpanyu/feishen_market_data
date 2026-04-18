from __future__ import annotations

import json
import re
from typing import Any

from .schema import CANONICAL_COLUMNS, empty_row, 产品线_电动摩托车, 产品线_电动滑板车
from .zh_misc import refine_smart_and_misc_zh, translate_key_to_zh
from .smart_labels import smart_label_pair
from .units_normalize import normalize_canonical_row
from .price_hints_cny import apply_prices_to_row


def _norm(s: str | None) -> str:
    return (s or "").strip()


def _norm_key(k: str | None) -> str:
    return re.sub(r"\s+", " ", (k or "").strip())


def _join_parts(*parts: str, sep: str = " ") -> str:
    return sep.join(p for p in (_norm(x) for x in parts) if p)


def _others_json(r: dict[str, str], used: set[str]) -> str:
    rest = {
        _norm_key(k): _norm(v)
        for k, v in r.items()
        if _norm_key(k) and _norm(v) and _norm_key(k) not in used
    }
    if not rest:
        return ""
    return json.dumps(rest, ensure_ascii=False, sort_keys=True)


def _niu_is_user_cleaned_schema(r: dict[str, str]) -> bool:
    """识别用户在 Desktop/py 中上传的新版 NIU 表头（含 产品名、续航(km) 等）。"""
    return any(
        k in r
        for k in (
            "产品名",
            "续航(km)",
            "电机功率(kw)",
            "峰值功率(kw)",
            "最高时速(km/h)",
        )
    )


def transform_niu_row(raw: dict[str, str], source: str) -> dict[str, str]:
    r = {_norm_key(k): _norm(v) for k, v in raw.items()}
    used: set[str] = set()
    o = empty_row()
    o["品牌"] = "NIU"
    o["品牌中文名"] = "小牛"
    o["产品线"] = 产品线_电动摩托车
    o["原始来源文件"] = source

    def take(keys: list[str], target: str, join: bool = False) -> None:
        vals = []
        for k in keys:
            if k in r and r[k]:
                used.add(k)
                vals.append(r[k])
        if vals:
            o[target] = " ".join(vals) if join else vals[0]

    if _niu_is_user_cleaned_schema(r):
        if r.get("品牌"):
            used.add("品牌")
            if r["品牌"] not in ("NIU", "niu"):
                o["品牌中文名"] = r["品牌"]
        take(["产品名", "产品"], "型号")
        take(["续航(km)", "理论续航"], "续航")
        take(["最高时速(km/h)", "最高时速"], "最高时速")
        take(
            [
                "电池技术",
                "电池科技",
                "电池类型",
                "电压(V)",
                "电压",
                "电池容量(wh)",
                "电池容量(Wh)",
                "电池容量",
                "电池重量(kg)",
                "电池包重量",
            ],
            "电池说明",
            join=True,
        )
        take(["电机功率(kw)", "电机功率"], "电机功率")
        take(["峰值功率(kw)", "最大输出功率"], "峰值功率")
        take(
            ["充电时长(h)", "充电时间", "充电方式", "快充技术", "支持速冲"],
            "充电器与充电时间",
            join=True,
        )
        take(["刹车系统", "制动系统"], "制动")
        take(["避震", "减震"], "减震")
        take(["车架材料", "车架材质"], "车架材质")
        take(["最大载重(kg)", "额定最大载质量"], "最大载重")
        take(["APP", "智能 APP"], "智能化及其他")
        raw_app = r.get("APP") or r.get("智能 APP") or ""
        if raw_app.strip():
            o["智能化及其他"] = smart_label_pair("APP", raw_app)
        take(["长(mm)", "宽(mm)", "高(mm)", "长", "宽", "高"], "长宽高", join=True)
        take(["离地间距(mm)", "最小离地间隙"], "离地间隙")
        take(["轮胎尺寸(inch)", "轮圈尺寸"], "轮胎轮圈")
    else:
        take(["产品"], "型号")
        take(["理论续航"], "续航")
        take(["最高时速"], "最高时速")
        take(["电池科技", "电池类型", "电压", "电池容量", "电池包重量"], "电池说明", join=True)
        take(["电机功率"], "电机功率")
        take(["最大输出功率"], "峰值功率")
        take(["充电时间", "充电方式", "支持速冲"], "充电器与充电时间", join=True)
        take(["制动系统"], "制动")
        take(["减震"], "减震")
        take(["车架材质"], "车架材质")
        take(["额定最大载质量"], "最大载重")
        take(["智能 APP"], "智能化及其他")
        raw_app = r.get("智能 APP") or ""
        if raw_app.strip():
            o["智能化及其他"] = smart_label_pair("智能 APP", raw_app)
        take(["长", "宽", "高"], "长宽高", join=True)
        take(["最小离地间隙"], "离地间隙")
        take(["轮圈尺寸"], "轮胎轮圈")

    o["其它列_JSON"] = _others_json(r, used)
    return o


def transform_surron_row(raw: dict[str, str], source: str) -> dict[str, str]:
    r = {_norm_key(k): _norm(v) for k, v in raw.items()}
    used: set[str] = set()
    o = empty_row()
    o["品牌"] = "Sur-Ron"
    o["品牌中文名"] = "虬龙"
    o["产品线"] = 产品线_电动摩托车
    o["原始来源文件"] = source

    def take(keys: list[str], target: str, join: bool = False) -> None:
        vals = [r[k] for k in keys if k in r and r[k]]
        for k in keys:
            if k in r and r[k]:
                used.add(k)
        if vals:
            o[target] = " | ".join(vals) if join else vals[0]

    take(["产品"], "型号")
    take(["价格"], "价格")
    take(["电池规格/类型"], "电池说明")
    take(["峰值功率"], "峰值功率")
    take(["动力系统", "传动方式", "电门曲线"], "电机功率", join=True)
    take(["充电器规格", "充电时间（20%-80%）"], "充电器与充电时间", join=True)
    take(["最高车速"], "最高时速")
    take(["道路续航里程"], "续航")
    take(["前悬挂系统", "后悬挂系统", "前叉行程", "后减/轮行程"], "减震", join=True)
    take(["轮胎类型"], "轮胎轮圈")
    take(["车架型式"], "车架材质")
    take(["整车质量（含电池）"], "整车质量")
    take(["设计载重"], "最大载重")
    take(["轴距"], "轴距")
    take(["座高"], "座高")
    take(["最小离地间隙"], "离地间隙")
    take(["尺寸"], "长宽高")
    _smart_keys = [
        "动力模式",
        "动力辅助功能",
        "GPS定位系统",
        "遥控功能",
        "安全功能",
        "倾倒保护",
        "蠕行模式",
    ]
    _smart_parts: list[str] = []
    for sk in _smart_keys:
        if sk in r and r[sk]:
            used.add(sk)
            _smart_parts.append(smart_label_pair(sk, r[sk]))
    if _smart_parts:
        o["智能化及其他"] = "；".join(_smart_parts)
    if "驱动轮最大扭矩" in r and r["驱动轮最大扭矩"]:
        used.add("驱动轮最大扭矩")
        o["峰值功率"] = _join_parts(o["峰值功率"], r["驱动轮最大扭矩"], sep=" | ")
    o["其它列_JSON"] = _others_json(r, used)
    return o


def transform_rfn_row(raw: dict[str, str], source: str) -> dict[str, str]:
    r = {_norm_key(k): _norm(v) for k, v in raw.items()}
    used: set[str] = set()
    o = empty_row()
    o["产品线"] = 产品线_电动摩托车
    o["原始来源文件"] = source

    def take(keys: list[str], target: str, join: bool = False) -> None:
        vals = [r[k] for k in keys if k in r and r[k]]
        for k in keys:
            if k in r and r[k]:
                used.add(k)
        if vals:
            o[target] = " ".join(vals) if join else vals[0]

    take(["品牌"], "品牌")
    take(["型号"], "型号")
    take(["电池种类", "电池容量（Wh）", "电池容量(Wh)", "电池容量（wh）"], "电池说明", join=True)
    take(["电机(kw)"], "电机功率")
    take(["续航（km）"], "续航")
    take(["最高时速（）"], "最高时速")
    if "最高时速" in r and r["最高时速"] and not o["最高时速"]:
        take(["最高时速"], "最高时速")
    take(["座垫高度"], "座高")
    take(["轴距"], "轴距")
    take(["前悬挂", "后悬挂"], "减震", join=True)
    take(["制动盘直径"], "制动")
    take(["APP"], "智能化及其他")
    raw_app = r.get("APP") or ""
    if raw_app.strip():
        o["智能化及其他"] = smart_label_pair("APP", raw_app)
    o["其它列_JSON"] = _others_json(r, used)
    return o


def transform_ninebot_row(raw: dict[str, str], source: str) -> dict[str, str]:
    """九号（Segway-Ninebot）电动滑板车：Desktop ninebot-esc.csv 表头。"""
    r = {_norm_key(k): _norm(v) for k, v in raw.items()}
    used: set[str] = set()
    o = empty_row()
    o["产品线"] = 产品线_电动滑板车
    o["原始来源文件"] = source
    o["品牌"] = "Ninebot"
    zh = r.get("品牌", "").strip()
    if zh:
        used.add("品牌")
        o["品牌中文名"] = zh if zh != "Ninebot" else "九号"
    else:
        o["品牌中文名"] = "九号"

    def take(keys: list[str], target: str, join: bool = False, sep: str = " ") -> None:
        vals = [r[k] for k in keys if k in r and r[k]]
        for k in keys:
            if k in r and r[k]:
                used.add(k)
        if vals:
            o[target] = sep.join(vals) if join else vals[0]

    take(["产品型号"], "型号")
    for pk in ("价格（RMB）", "价格(RMB)", "价格（rmb）"):
        if pk in r and r[pk]:
            used.add(pk)
            o["价格"] = r[pk]
            break
    for dk in (
        "尺寸大小(l*w*h）(mm)",
        "尺寸大小(l*w*h)(mm)",
        "尺寸大小(l×w×h）(mm)",
    ):
        if dk in r and r[dk]:
            used.add(dk)
            o["长宽高"] = r[dk].replace("*", "×").replace("x", "×").replace("X", "×")
            break
    take(["最大载重(kg)"], "最大载重")
    take(["重量(kg)"], "整车质量")
    parts_r: list[str] = []
    if r.get("续航(km)"):
        used.add("续航(km)")
        parts_r.append(f"标称续航 {r['续航(km)']} 公里")
    if r.get("最大续航(km)"):
        used.add("最大续航(km)")
        parts_r.append(f"最大续航 {r['最大续航(km)']} 公里")
    if r.get("最大骑行时间(min)"):
        used.add("最大骑行时间(min)")
        parts_r.append(f"最长骑行约 {r['最大骑行时间(min)']} 分钟")
    if parts_r:
        o["续航"] = "；".join(parts_r)
    take(["额定功率(w)"], "电机功率")
    take(["最大峰值功率(w)"], "峰值功率")
    take(["最高时速(km/h)"], "最高时速")

    def _watt_label(cell: str) -> str:
        t = _norm(cell)
        if not t or re.search(r"[瓦千瓦Ww]", t):
            return t
        if re.fullmatch(r"\d+\.?\d*", t):
            return f"{t} 瓦"
        return t

    o["电机功率"] = _watt_label(o.get("电机功率", ""))
    o["峰值功率"] = _watt_label(o.get("峰值功率", ""))
    take(["刹车系统"], "制动")
    take(["悬挂系统"], "减震")
    take(["车架材料"], "车架材质")
    take(["tail_type"], "轮胎轮圈")
    take(
        [
            "电池电压 (v)",
            "电池电压(v)",
            "电池最大电压 (v)",
            "电池最大电压(v)",
            "电池能量(kwh)",
            "电池容量(mah)",
            "BMS",
        ],
        "电池说明",
        join=True,
    )
    take(["充电时间(h)"], "充电器与充电时间")
    if r.get("防水等级"):
        used.add("防水等级")
        o["充电器与充电时间"] = _join_parts(o["充电器与充电时间"], f"防水 {r['防水等级']}", sep="；")
    _nb_smart_keys = [
        "可折叠",
        "折叠后尺寸大小(l*w*h) (mm)",
        "折叠后尺寸大小(l*w*h）(mm)",
        "折叠后尺寸大小(l*w*h)(mm)",
        "最大爬坡角度(°)",
        "推荐高度(cm)",
        "推荐年龄(year)",
        "APP",
        "灯光系统",
        "蓝牙音箱",
        "LED",
        "LED ",
        "antivol",
        "antivol ",
        "gps定位系统",
        "车道保持",
        "喇叭",
        "tcs_抗滑动",
        "SegRide",
        "AirLock",
    ]
    _nb_smart: list[str] = []
    for sk in _nb_smart_keys:
        if sk in r and r[sk]:
            used.add(sk)
            _nb_smart.append(smart_label_pair(sk, r[sk]))
    if _nb_smart:
        o["智能化及其他"] = "；".join(_nb_smart)
    o["其它列_JSON"] = _others_json(r, used)
    return o


def _talaria_pick(r: dict[str, str], *keys: str) -> str:
    for k in keys:
        if k in r and r[k]:
            return r[k]
    return ""


def transform_talaria_row(raw: dict[str, str], source: str) -> dict[str, str]:
    r = {_norm_key(k): _norm(v) for k, v in raw.items()}
    used: set[str] = set()
    o = empty_row()
    o["品牌"] = "Talaria"
    o["产品线"] = 产品线_电动摩托车
    o["原始来源文件"] = source

    mapping: list[tuple[str, list[str]]] = [
        ("型号", ["Model"]),
        ("电机功率", ["NORMINAL POWER", "MOTOR TYPE"]),
        ("峰值功率", ["PEAK POWER"]),
        ("电池说明", ["BATTERY PACK", "BATTERY CELL", "NORMINAL VOLTAGE"]),
        ("最高时速", ["TOP SPEED"]),
        ("续航", ["MAX. RANGE"]),
        ("制动", ["BRAKE"]),
        ("减震", ["FRONT FORK", "REAR ABSORBER"]),
        ("车架材质", ["CHASISS MATERIAL", "CHASSIS MATERIAL", "CHASISS PROCESS METHOD", "CHASSIS PROCESS METHOD"]),
        ("整车质量", ["N.W."]),
        ("轴距", ["WHEELBASE"]),
        ("座高", ["SEAT HEIGHT"]),
        ("长宽高", ["VEHICLE DIMENTION", "VEHICLE DIMENSION"]),
        ("离地间隙", ["MIN. GROUND CLEARANCE"]),
        ("轮胎轮圈", ["TIRE BRAND & SIZE"]),
        ("充电器与充电时间", ["DASH", "REGEN", "RIDING MODES"]),
    ]
    for target, keys in mapping:
        parts = [_talaria_pick(r, k) for k in keys]
        v = _join_parts(*parts, sep=" | ")
        if v:
            o[target] = v
            for k in keys:
                if k in r and r[k]:
                    used.add(k)
    _tal_smart_keys = [
        "CONTROLLER TYPE",
        "GEAR RATIO",
        "1st TRANSMISSION",
        "2nd TRANSMISSION",
        "HEADLIGHT",
    ]
    _tal_parts: list[str] = []
    for sk in _tal_smart_keys:
        if sk in r and r[sk]:
            used.add(sk)
            _tal_parts.append(smart_label_pair(translate_key_to_zh(sk) or sk, r[sk]))
    if _tal_parts:
        o["智能化及其他"] = "；".join(_tal_parts)
    o["其它列_JSON"] = _others_json(r, used)
    return o


# Zero CSV 表头（strip 后）小写 -> 规范列（多列合并到同一规范列时用追加）
_ZERO_MAP: dict[str, str] = {
    "model": "型号",
    "price": "价格",
    "range-city": "续航",
    "range-high-speed highway commuting": "续航",
    "peak torque": "电机功率",
    "peak rear wheel torque": "峰值功率",
    "peak power": "峰值功率",
    "top speed (max)": "最高时速",
    "top speed (sustained)": "最高时速",
    "type": "电机功率",
    "controller": "智能化及其他",
    "power pack": "电池说明",
    "max capacity": "电池说明",
    "nominal capacity": "电池说明",
    "charger type": "充电器与充电时间",
    "charge time (standard household)": "充电器与充电时间",
    "charge time (level 2)": "充电器与充电时间",
    "front suspension": "减震",
    "rear suspension": "减震",
    "front suspension travel": "减震",
    "rear suspension travel": "减震",
    "front brakes": "制动",
    "rear brakes": "制动",
    "front tire": "轮胎轮圈",
    "rear tire": "轮胎轮圈",
    "front wheel": "轮胎轮圈",
    "rear wheel": "轮胎轮圈",
    "wheelbase": "轴距",
    "seat height": "座高",
    "curb weight": "整车质量",
    "carrying capacity": "最大载重",
}


def transform_zero_row(raw: dict[str, str], source: str) -> dict[str, str]:
    r = {_norm_key(k): _norm(v) for k, v in raw.items()}
    used: set[str] = set()
    o = empty_row()
    o["品牌"] = "Zero Motorcycles"
    o["产品线"] = 产品线_电动摩托车
    o["原始来源文件"] = source

    for k, v in r.items():
        if not v:
            continue
        lk = _norm_key(k).lower()
        canon = _ZERO_MAP.get(lk)
        if canon:
            used.add(k)
            # 「型号」主键列已有表头，不再写成「型号：SR/S」以免与库内旧数据不一致
            if canon == "型号":
                piece = v
            else:
                lbl = translate_key_to_zh(k) or k
                piece = smart_label_pair(lbl, v)
            if o[canon]:
                o[canon] = o[canon] + "；" + piece
            else:
                o[canon] = piece
    o["其它列_JSON"] = _others_json(r, used)
    return o


_STARK_MAP: dict[str, str] = {
    "model": "型号",
    "price": "价格",
    "motor": "电机功率",
    "battery": "电池说明",
    "charger": "充电器与充电时间",
    "charge time": "充电器与充电时间",
    "drive": "智能化及其他",
    "power": "峰值功率",
    "torque": "峰值功率",
    "frame": "车架材质",
    "suspension": "减震",
    "brakes": "制动",
    "tires": "轮胎轮圈",
    "rake": "智能化及其他",
    "wheelbase": "轴距",
    "ground clearance": "离地间隙",
    "seat height": "座高",
    "weight": "整车质量",
}


def transform_stark_row(raw: dict[str, str], source: str) -> dict[str, str]:
    r = {_norm_key(k): _norm(v) for k, v in raw.items()}
    used: set[str] = set()
    o = empty_row()
    o["品牌"] = "Stark Future"
    o["产品线"] = 产品线_电动摩托车
    o["原始来源文件"] = source

    for k, v in r.items():
        if not v:
            continue
        lk = _norm_key(k).lower()
        canon = _STARK_MAP.get(lk)
        if canon:
            used.add(k)
            if canon == "型号":
                piece = v
            else:
                lbl = translate_key_to_zh(k) or k
                piece = smart_label_pair(lbl, v)
            if o[canon]:
                o[canon] = o[canon] + "；" + piece
            else:
                o[canon] = piece
    o["其它列_JSON"] = _others_json(r, used)
    return o


def repair_mojibake(s: str) -> str:
    for a, b in (("¡Á", "×"), ("¡ã", "°"), ("¡À", "±"), ("£¨", "（"), ("£©", "）")):
        s = s.replace(a, b)
    return s


def clean_cell(s: str) -> str:
    s = repair_mojibake(_norm(s))
    s = s.replace("Yes、", "Yes").replace("N/A", "无")
    return s


def finalize_row(o: dict[str, str]) -> dict[str, str]:
    out = {k: clean_cell(v) for k, v in o.items()}
    out = refine_smart_and_misc_zh(out)
    out = normalize_canonical_row(out)
    out = apply_prices_to_row(out)
    return out
