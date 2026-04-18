"""
汇总表「智能化及其他」「其它列_JSON」的后处理：中文键名、常用词翻译、智能/非智能归类。
"""

from __future__ import annotations

import json
import re
from typing import Any


def repair_mojibake_text(s: str) -> str:
    for a, b in (
        ("¡Á", "×"),
        ("¡ã", "°"),
        ("¡À", "±"),
        ("£¨", "（"),
        ("£©", "）"),
        ("¡ª", "–"),
        ("Â", ""),
    ):
        s = s.replace(a, b)
    return s


# 英文/缩写列名 → 中文（用于 其它列_JSON 键）
_KEY_ZH: tuple[tuple[str, str], ...] = (
    ("model", "型号"),
    ("price", "价格"),
    ("motor", "电机"),
    ("battery", "电池"),
    ("charger", "充电器"),
    ("charge time", "充电时间"),
    ("drive", "驱动说明"),
    ("power", "功率"),
    ("torque", "扭矩"),
    ("frame", "车架"),
    ("suspension", "悬挂"),
    ("brakes", "制动"),
    ("tires", "轮胎"),
    ("rake", "前倾角"),
    ("wheelbase", "轴距"),
    ("ground clearance", "离地间隙"),
    ("seat height", "座高"),
    ("weight", "重量"),
    ("controller", "控制器"),
    ("type", "类型"),
    ("peak torque", "峰值扭矩"),
    ("peak rear wheel torque", "后轮峰值扭矩"),
    ("peak power", "峰值功率"),
    ("top speed (max)", "最高时速"),
    ("top speed (sustained)", "持续最高时速"),
    ("range-city", "城市续航"),
    ("range-high-speed highway commuting", "高速/通勤续航"),
    ("power pack", "动力电池包"),
    ("max capacity", "最大容量"),
    ("nominal capacity", "标称容量"),
    ("charger type", "充电器类型"),
    ("charge time (standard household)", "家用充电时间"),
    ("charge time (level 2)", "二级充电时间"),
    ("front suspension", "前悬挂"),
    ("rear suspension", "后悬挂"),
    ("front suspension travel", "前悬挂行程"),
    ("rear suspension travel", "后悬挂行程"),
    ("front brakes", "前制动"),
    ("rear brakes", "后制动"),
    ("front tire", "前轮胎"),
    ("rear tire", "后轮胎"),
    ("front wheel", "前轮"),
    ("rear wheel", "后轮"),
    ("curb weight", "整备质量"),
    ("carrying capacity", "载重能力"),
    ("norminal power", "额定功率"),
    ("nominal power", "额定功率"),
    ("motor type", "电机类型"),
    ("peak power", "峰值功率"),
    ("battery pack", "电池包"),
    ("battery cell", "电芯"),
    ("norminal voltage", "标称电压"),
    ("nominal voltage", "标称电压"),
    ("top speed", "最高时速"),
    ("max. range", "最大续航"),
    ("brake", "制动"),
    ("front fork", "前叉"),
    ("rear absorber", "后减震"),
    ("chasiss material", "车架材质"),
    ("chassis material", "车架材质"),
    ("chasiss process method", "车架工艺"),
    ("chassis process method", "车架工艺"),
    ("n.w.", "净重"),
    ("vehicle dimention", "整车尺寸"),
    ("vehicle dimension", "整车尺寸"),
    ("min. ground clearance", "最小离地间隙"),
    ("tire brand & size", "轮胎品牌与规格"),
    ("dash", "仪表"),
    ("regen", "能量回收"),
    ("riding modes", "骑行模式"),
    ("controller type", "控制器类型"),
    ("gear ratio", "齿比"),
    ("1st transmission", "一级传动"),
    ("2nd transmission", "二级传动"),
    ("headlight", "大灯"),
    ("产品", "产品"),
    ("尺寸", "尺寸"),
)

# 额外英文键（小写全串）→ 中文
_EXTRA_KEY_ZH: dict[str, str] = {
    "equivalent fuel economy (city)": "城市工况等价燃油经济性",
    "ip rating": "防护等级",
    "input": "电气输入",
    "trail": "越野离地间隙",
    "transmission": "传动方式",
    "typical cost to recharge": "单次充电参考费用",
    "cypher iii+ operating system": "操作系统",
    "cypher iii operating system": "操作系统",
    "– accessory, low": "选装座高（低）",
    "– accessory, tall": "选装座高（高）",
    "accessory, low": "选装座高（低）",
    "accessory, tall": "选装座高（高）",
    "-with 6 kw rapid charger": "选配 6 千瓦快充",
    "final drive": "末级传动",
    "power pack warranty*": "电池包质保",
    "power pack warranty": "电池包质保",
    "standard motorcycle warranty*": "整车质保",
    "standard motorcycle warranty": "整车质保",
    "removable battery": "可拆卸电池",
    "– with max accessory chargers": "配备最多选装充电器时",
    "– with one accessory charger": "配备单只选装充电器时",
    "with max accessory chargers": "配备最多选装充电器时",
    "with one accessory charger": "配备单只选装充电器时",
}

# 子串匹配（小写）→ 该字段整体更偏「智能化 / 电控 / 互联」
_SMART_SUBSTR = (
    "app",
    "gps",
    "ota",
    "usb",
    "蓝牙",
    "互联",
    "导航",
    "智能",
    "遥控",
    "手机",
    "仪表",
    "驾驶模式",
    "动力模式",
    "动力辅助",
    "蠕行",
    "倾倒保护",
    "安全功能",
    "互联",
    "tcs",
    "牵引力",
    "防滑",
    "能量回收",
    "动能回收",
    "骑行模式",
    "controller",
    "riding mode",
    "regen",
    "dash",
    "对讲",
    "陀螺仪",
    "app连接",
)


def _lower(s: str) -> str:
    return s.lower()


def translate_key_to_zh(key: str) -> str:
    k = repair_mojibake_text((key or "").strip())
    if not k:
        return key
    lk = _lower(re.sub(r"[？?*]", "", k))
    lk = re.sub(r"\s+", " ", lk).strip()
    if lk in _EXTRA_KEY_ZH:
        return _EXTRA_KEY_ZH[lk]
    for en, zh in _KEY_ZH:
        if lk == en or lk.replace(".", "") == en.replace(".", ""):
            return zh
    if re.search(r"[\u4e00-\u9fff]", k):
        return k
    return k


def translate_value_tokens(s: str) -> str:
    if not s:
        return s
    t = repair_mojibake_text(s.strip())
    rep = (
        (r"\bTRUE\b", "是"),
        (r"\bFALSE\b", "否"),
        (r"\bTrue\b", "是"),
        (r"\bFalse\b", "否"),
        (r"\bYes\b", "是"),
        (r"\bNo\b", "否"),
        (r"\bN/A\b", "无"),
        (r"\bn/a\b", "无"),
        (r"\bNone\b", "无"),
    )
    for pat, to in rep:
        t = re.sub(pat, to, t, flags=re.IGNORECASE)
    unit_map = (
        (r"(\d+(?:\.\d+)?)\s*kw\b", r"\1 千瓦"),
        (r"(\d+(?:\.\d+)?)\s*kwh\b", r"\1 千瓦时"),
        (r"(\d+(?:\.\d+)?)\s*wh\b", r"\1 瓦时"),
        (r"(\d+(?:\.\d+)?)\s*kg\b", r"\1 千克"),
        (r"(\d+(?:\.\d+)?)\s*mm\b", r"\1 毫米"),
        (r"(\d+(?:\.\d+)?)\s*cm\b", r"\1 厘米"),
        (r"(\d+(?:\.\d+)?)\s*inch\b", r"\1 英寸"),
        (r"(\d+(?:\.\d+)?)\s*kmh\b", r"\1 千米/时"),
        (r"(\d+(?:\.\d+)?)\s*km/h\b", r"\1 千米/时"),
    )
    for pat, to in unit_map:
        t = re.sub(pat, to, t, flags=re.IGNORECASE)
    phrases: tuple[tuple[str, str], ...] = (
        ("high efficiency and power dense", "高效率、高功率密度"),
        ("900 amp, 3-phase ac controller with regenerative deceleration", "900 安培三相交流控制器，带再生制动减速"),
        ("3-phase ac controller", "三相交流控制器"),
        ("regenerative deceleration", "再生制动减速"),
        ("clutchless direct drive", "无离合器直驱"),
        ("app连接功能", "手机应用互联"),
        ("滑行动能回收", "滑行能量回收"),
        ("前进1/2/3/倒挡r", "前进一至三挡与倒挡 R"),
        ("磁吸紧急开关", "磁吸式紧急断电开关"),
        ("遥控紧急断电", "遥控紧急断电"),
        ("40hq:", "40 英尺高柜约"),
    )
    low = _lower(t)
    for en, zh in sorted(phrases, key=lambda x: -len(x[0])):
        if en in low:
            t = re.sub(re.escape(en), zh, t, flags=re.IGNORECASE)
            low = _lower(t)
    t = re.sub(r"\bpcs\b", "台", t, flags=re.IGNORECASE)
    t = re.sub(r"\$\s*([\d.]+)", r"约 \1 美元", t)
    t = re.sub(r"\b(\d+)\s*years?\b", r"\1 年", t, flags=re.IGNORECASE)
    t = re.sub(r"\bmiles?\b", "英里", t, flags=re.IGNORECASE)
    t = re.sub(r"\bunlimited\b", "不限", t, flags=re.IGNORECASE)
    t = re.sub(r"\b(\d+(?:\.\d+)?)\s*minutes?\b", r"\1 分钟", t, flags=re.IGNORECASE)
    t = re.sub(r"\b(\d+(?:\.\d+)?)\s*hours?\b", r"\1 小时", t, flags=re.IGNORECASE)
    t = re.sub(r"\(\s*(\d+)\s*-\s*(\d+)\s*%\s*\)", r"（\1–\2%）", t)
    t = re.sub(r"\bpoly chain\b", "Poly 链条", t, flags=re.IGNORECASE)
    t = re.sub(r"\bcarbon\b", "碳纤维", t, flags=re.IGNORECASE)
    t = re.sub(r"\bbelt\b", "皮带", t, flags=re.IGNORECASE)
    return t


def _is_smart_key(k: str) -> bool:
    lk = _lower(k)
    return any(s in lk for s in _SMART_SUBSTR)


def _is_packaging_or_channel(k: str, v: str) -> bool:
    """仓储、包装、渠道类，不归入智能化。"""
    s = _lower(k) + " " + _lower(v)
    return any(x in s for x in ("40hq", "包装", "装箱", "container", "pcs", "托盘", "hq:"))


def _is_smart_free_text(blob: str) -> bool:
    if _is_packaging_or_channel("", blob):
        return False
    lb = _lower(blob)
    return any(s in lb for s in _SMART_SUBSTR)


def _split_smart_blob(blob: str) -> tuple[list[str], list[str]]:
    """将无键名的长句按分隔符拆开；含智能关键词的归智能，其余归其它说明。"""
    parts = re.split(r"\s*[|｜]\s*", blob)
    smart: list[str] = []
    other: list[str] = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if _is_smart_free_text(p):
            smart.append(translate_value_tokens(p))
        else:
            other.append(translate_value_tokens(p))
    return smart, other


def refine_smart_and_misc_zh(o: dict[str, str]) -> dict[str, str]:
    """
    根据键名与内容，把「其它列_JSON」中偏智能的项并入「智能化及其他」，
    其余项保留 JSON 且键名尽量中文化；自由文本型「智能化及其他」做拆分与翻译。
    """
    smart_bits: list[str] = []
    misc: dict[str, str] = {}

    raw_json = (o.get("其它列_JSON") or "").strip()
    parsed: dict[str, Any] | None = None
    if raw_json:
        try:
            j = json.loads(raw_json)
            if isinstance(j, dict):
                parsed = j
        except json.JSONDecodeError:
            misc["原始未解析片段"] = translate_value_tokens(raw_json[:800])
    if parsed:
        for raw_k, raw_v in parsed.items():
            vk = (raw_v if isinstance(raw_v, str) else str(raw_v)).strip()
            if not vk:
                continue
            k_raw = str(raw_k).strip()
            k_zh = translate_key_to_zh(k_raw)
            v_zh = translate_value_tokens(vk)
            if _is_packaging_or_channel(k_raw, vk):
                misc[k_zh] = v_zh
            elif _is_smart_key(k_raw) or _is_smart_key(k_zh) or _is_smart_free_text(v_zh):
                smart_bits.append(f"{k_zh}：{v_zh}")
            else:
                misc[k_zh] = v_zh

    blob = (o.get("智能化及其他") or "").strip()
    if blob:
        if re.fullmatch(r"(?i)(true|yes|1)", blob):
            smart_bits.append("手机应用：支持")
            blob = ""
        elif re.fullmatch(r"(?i)(false|no|0)", blob):
            smart_bits.append("手机应用：不支持")
            blob = ""
    if blob:
        # 已有「键：值」形态的多段
        if "：" in blob or ":" in blob:
            segments = re.split(r"\s*[；;]\s*", blob.replace(":", "："))
            for seg in segments:
                seg = seg.strip()
                if not seg:
                    continue
                if "：" in seg:
                    a, b = seg.split("：", 1)
                    a, b = a.strip(), b.strip()
                    v_zh = translate_value_tokens(b)
                    if _is_smart_key(a) or _is_smart_free_text(v_zh):
                        smart_bits.append(f"{translate_key_to_zh(a)}：{v_zh}")
                    else:
                        misc[translate_key_to_zh(a)] = v_zh
                else:
                    sm, ot = _split_smart_blob(seg)
                    smart_bits.extend(sm)
                    if ot:
                        joined = "；".join(ot)
                        misc["补充说明"] = (misc.get("补充说明", "") + ("；" if misc.get("补充说明") else "") + joined).strip(
                            "；"
                        )
        else:
            sm, ot = _split_smart_blob(blob)
            smart_bits.extend(sm)
            if ot:
                joined = "；".join(ot)
                misc["补充说明"] = (misc.get("补充说明", "") + ("；" if misc.get("补充说明") else "") + joined).strip("；")

    # 去重保序
    seen: set[str] = set()
    smart_ordered: list[str] = []
    for s in smart_bits:
        s = s.strip()
        if s and s not in seen:
            seen.add(s)
            smart_ordered.append(s)

    o["智能化及其他"] = "；".join(smart_ordered)
    misc = {k: v for k, v in misc.items() if (v or "").strip()}
    if misc:
        o["其它列_JSON"] = json.dumps(misc, ensure_ascii=False, sort_keys=True)
    else:
        o["其它列_JSON"] = ""
    return o


def json_safe_for_csv(d: dict[str, Any]) -> str:
    if not d:
        return ""
    return json.dumps(d, ensure_ascii=False, sort_keys=True)
