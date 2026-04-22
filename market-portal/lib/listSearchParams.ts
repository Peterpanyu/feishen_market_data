/**
 * 列表页 URL 参数（品牌 + 字段/操作符/值 + 补充全文）合并为 parseProductSearchQuery 使用的 q。
 */

import type { ListSortKey } from "./listSortKey";
import { isListSortKey } from "./listSortKey";
import { isSafeCatalogListPath } from "./catalogLastPath";

/** 单条字段条件（多条件 AND 时用多行） */
export type SearchRuleRow = {
  sf: string;
  so: string;
  sv: string;
};

/** @deprecated 单组字段；请用 SearchRuleRow[] + composeListSearchQFromRules */
export type ProductListSearchState = {
  sf?: string;
  so?: string;
  sv?: string;
  q?: string;
};

const NUM_SYM: Record<string, string> = {
  gte: ">=",
  lte: "<=",
  gt: ">",
  lt: "<",
  eq: "=",
};

/** 下拉可选字段（value 与库内键一致） */
export const SEARCH_FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "（不按字段，仅全文）" },
  { value: "型号", label: "型号（主档）" },
  { value: "品牌", label: "品牌（主档）" },
  { value: "产品线", label: "产品线（主档）" },
  { value: "来源文件", label: "来源文件（主档）" },
  { value: "品牌中文名", label: "品牌中文名（主档）" },
  { value: "价格_RMB", label: "价格_RMB" },
  { value: "电机功率_kW", label: "电机功率_kW" },
  { value: "最大扭矩_Nm", label: "最大扭矩_Nm" },
  { value: "最高时速_kmh", label: "最高时速_kmh" },
  { value: "续航里程_km", label: "续航里程_km" },
  { value: "电池容量_Wh", label: "电池容量_Wh" },
  { value: "充电时间_h", label: "充电时间_h" },
  { value: "整备质量_kg", label: "整备质量_kg" },
  { value: "座高_mm", label: "座高_mm" },
  { value: "轴距_mm", label: "轴距_mm" },
  { value: "长度_mm", label: "长度_mm" },
  { value: "宽度_mm", label: "宽度_mm" },
  { value: "高度_mm", label: "高度_mm" },
  { value: "悬挂系统", label: "悬挂系统" },
  { value: "制动系统", label: "制动系统" },
  { value: "轮胎规格", label: "轮胎规格" },
  { value: "产业线", label: "产业线" },
  { value: "适用人群", label: "适用人群" },
  { value: "最低建议年龄", label: "最低建议年龄" },
  { value: "最高建议年龄", label: "最高建议年龄" },
  { value: "最低建议身高_cm", label: "最低建议身高_cm" },
  { value: "最高建议身高_cm", label: "最高建议身高_cm" },
  { value: "可拆卸电池", label: "可拆卸电池" },
  { value: "最大载重_kg", label: "最大载重_kg" },
];

export const SEARCH_OP_OPTIONS: { value: string; label: string }[] = [
  { value: "contains", label: "包含（子串）" },
  { value: "eq", label: "等于（数值）" },
  { value: "gte", label: "大于等于" },
  { value: "lte", label: "小于等于" },
  { value: "gt", label: "大于" },
  { value: "lt", label: "小于" },
  { value: "bool_true", label: "为真" },
  { value: "bool_false", label: "为假" },
];

/** 单条规则 → parseProductSearchQuery 可识别的一段 */
export function oneRuleToQueryPart(sfRaw: string, soRaw: string, svRaw: string): string | null {
  const sf = (sfRaw || "").trim();
  const so = (soRaw || "").trim();
  const sv = (svRaw ?? "").trim();
  if (!sf || !so) return null;
  if (so === "contains" && sv) return `${sf}@${sv}`;
  if (so === "bool_true") return `${sf}:true`;
  if (so === "bool_false") return `${sf}:false`;
  const sym = NUM_SYM[so];
  if (sym !== undefined && sv !== "") return `${sf}${sym}${sv}`;
  return null;
}

/** 多组字段条件 + 补充全文 → 传给 listProducts 的 q（各规则 AND） */
export function composeListSearchQFromRules(rules: SearchRuleRow[], qFree?: string): string | undefined {
  const parts: string[] = [];
  for (const row of rules) {
    const bit = oneRuleToQueryPart(row.sf, row.so, row.sv);
    if (bit) parts.push(bit);
  }
  if (qFree?.trim()) parts.push(qFree.trim());
  const out = parts.join(" ").trim();
  return out || undefined;
}

/** @deprecated 使用 composeListSearchQFromRules */
export function composeListSearchQ(s: ProductListSearchState): string | undefined {
  return composeListSearchQFromRules(
    [{ sf: s.sf?.trim() ?? "", so: s.so?.trim() || "contains", sv: s.sv?.trim() ?? "" }],
    s.q,
  );
}

function pickParam(v: string | string[] | undefined): string {
  if (v === undefined) return "";
  return Array.isArray(v) ? (v[0] ?? "").trim() : String(v).trim();
}

/** 从 URL 解析表头排序；无效组合视为未排序（后端默认按录入时间降序） */
export function parseListSortFromParams(
  sp: Record<string, string | string[] | undefined>,
): { key: ListSortKey; dir: "asc" | "desc" } | undefined {
  const sort = pickParam(sp.sort);
  const dir = pickParam(sp.dir);
  if (!sort || !isListSortKey(sort)) return undefined;
  if (dir !== "asc" && dir !== "desc") return undefined;
  return { key: sort, dir };
}

/**
 * 同一列三态：无 → 降序 → 升序 → 无；换列则从该列降序开始。
 */
export function cycleListSort(
  clicked: ListSortKey,
  current: { key: ListSortKey; dir: "asc" | "desc" } | undefined,
): { key: ListSortKey; dir: "asc" | "desc" } | undefined {
  if (!current || current.key !== clicked) return { key: clicked, dir: "desc" };
  if (current.dir === "desc") return { key: clicked, dir: "asc" };
  return undefined;
}

/** 同一 query 键多次出现（如 brand=a&brand=b）或单值，解析为去重后的非空列表 */
export function parseMultiValues(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string[] {
  const raw = sp[key];
  if (raw === undefined) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const t = (x ?? "").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * 从 URL 解析多组 r0_sf / r0_so / r0_sv …；若无则回退旧版 sf/so/sv。
 * 始终至少返回一行（可能字段为空，供表单展示）。
 */
export function parseSearchRulesFromParams(
  sp: Record<string, string | string[] | undefined>,
): SearchRuleRow[] {
  const map = new Map<number, SearchRuleRow>();
  let hasIndexed = false;
  for (const key of Object.keys(sp)) {
    const m = key.match(/^r(\d+)_(sf|so|sv)$/);
    if (!m) continue;
    hasIndexed = true;
    const idx = parseInt(m[1]!, 10);
    const sub = m[2] as "sf" | "so" | "sv";
    const cur = map.get(idx) ?? { sf: "", so: "contains", sv: "" };
    cur[sub] = pickParam(sp[key]);
    map.set(idx, cur);
  }

  if (hasIndexed) {
    const indices = Array.from(map.keys()).sort((a, b) => a - b);
    const rows = indices.map((i) => {
      const r = map.get(i)!;
      return {
        sf: r.sf || "",
        so: r.so || "contains",
        sv: r.sv || "",
      };
    });
    return rows.length ? rows : [{ sf: "", so: "contains", sv: "" }];
  }

  const sf = pickParam(sp.sf);
  const so = pickParam(sp.so) || "contains";
  const sv = pickParam(sp.sv);
  if (sf || sv || (so !== "contains" && so)) return [{ sf, so, sv }];
  return [{ sf: "", so: "contains", sv: "" }];
}

/** 生成列表页 querystring（多 brand / 多 line + r0_, r1_…） */
export function productsListQueryString(
  rules: SearchRuleRow[],
  extras: {
    brands?: string[];
    productLines?: string[];
    q?: string;
    page?: number;
    sort?: ListSortKey;
    dir?: "asc" | "desc";
  },
): string {
  const p = new URLSearchParams();
  for (const b of extras.brands ?? []) {
    const t = b.trim();
    if (t) p.append("brand", t);
  }
  for (const line of extras.productLines ?? []) {
    const t = line.trim();
    if (t) p.append("line", t);
  }
  let idx = 0;
  for (const row of rules) {
    const sf = row.sf?.trim();
    if (!sf) continue;
    p.set(`r${idx}_sf`, sf);
    p.set(`r${idx}_so`, (row.so || "contains").trim() || "contains");
    if (row.sv?.trim()) p.set(`r${idx}_sv`, row.sv.trim());
    idx++;
  }
  if (extras.q?.trim()) p.set("q", extras.q.trim());
  if (extras.page && extras.page > 1) p.set("page", String(extras.page));
  if (
    extras.sort &&
    extras.dir &&
    isListSortKey(extras.sort) &&
    (extras.dir === "asc" || extras.dir === "desc")
  ) {
    p.set("sort", extras.sort);
    p.set("dir", extras.dir);
  }
  return p.toString();
}

export function buildProductsListPath(o: {
  brands?: string[];
  productLines?: string[];
  rules: SearchRuleRow[];
  q?: string;
  page?: number;
  sort?: ListSortKey;
  dir?: "asc" | "desc";
}): string {
  const qs = productsListQueryString(o.rules, {
    brands: o.brands,
    productLines: o.productLines,
    q: o.q,
    page: o.page,
    sort: o.sort,
    dir: o.dir,
  });
  return qs ? `/products?${qs}` : "/products";
}

/** 仅允许站内竞品目录路径（/products 或 /products?…），防止开放重定向 */
export function safeProductsListReturn(raw: string | undefined): string {
  if (!raw || typeof raw !== "string") return "/products";
  let path: string;
  try {
    path = decodeURIComponent(raw.trim());
  } catch {
    return "/products";
  }
  if (!isSafeCatalogListPath(path)) return "/products";
  return path;
}
