/**
 * 竞品检索字符串解析：数值比较、布尔、表头@内容、其余为全文词（与 _searchBlob AND）。
 *
 * 语法（空格分隔多个条件，全部 AND）：
 * - 数值：字段>=n、字段<=n、字段>n、字段<n、字段=n（字段可在主档或规格参数）
 * - 布尔：字段:true / false / 是 / 否（中英文冒号均可）
 * - 仅写字段名：可拆卸电池 → 等价于 可拆卸电池:true（仅对白名单字段）
 * - 表头@内容：悬挂系统@阻尼、型号@Lite（在该字段值上做不区分大小写子串匹配）
 * - 其它片段：全文检索（表头+值拼接串）
 */

import type { Document } from "mongodb";

const F规格参数 = "规格参数";

const ROOT_FIELDS = new Set(["品牌", "型号", "产品线", "来源文件", "品牌中文名"]);

const BOOLEAN_FIELD_ALONE_MEANS_TRUE = new Set(["可拆卸电池"]);

const NUMERIC_OP_RE = /^([\w\u4e00-\u9fff]+)\s*(>=|<=|>|<|=)\s*([-+]?\d*\.?\d+)$/;
const BOOL_EXPLICIT_RE = /^([\w\u4e00-\u9fff]+)\s*[:：]\s*(true|false|是|否)$/i;

export type NumericPredicate = { path: string; mongoOp: "$gte" | "$lte" | "$gt" | "$lt" | "$eq"; value: number };
export type BoolPredicate = { path: string; value: boolean };
export type FieldSubstringPredicate = { path: string; pattern: string };

export type ParsedProductQuery = {
  numericPredicates: NumericPredicate[];
  booleanPredicates: BoolPredicate[];
  fieldSubstringPredicates: FieldSubstringPredicate[];
  textTokens: string[];
};

const OP_MAP: Record<string, NumericPredicate["mongoOp"]> = {
  ">=": "$gte",
  "<=": "$lte",
  ">": "$gt",
  "<": "$lt",
  "=": "$eq",
};

export function resolveMongoPath(field: string): string {
  const f = field.trim();
  if (!f) return f;
  if (ROOT_FIELDS.has(f)) return f;
  return `${F规格参数}.${f}`;
}

function parseBoolValue(s: string): boolean | null {
  const t = s.trim().toLowerCase();
  if (t === "true" || t === "是") return true;
  if (t === "false" || t === "否") return false;
  return null;
}

function splitFieldValueToken(t: string): { field: string; value: string } | null {
  const at = t.indexOf("@");
  const tilde = t.indexOf("~");
  const candidates = [at, tilde].filter((i) => i > 0);
  if (candidates.length === 0) return null;
  const sep = Math.min(...candidates);
  const field = t.slice(0, sep).trim();
  const value = t.slice(sep + 1).trim();
  if (!field || !value) return null;
  return { field, value };
}

export function parseProductSearchQuery(raw: string): ParsedProductQuery {
  const textTokens: string[] = [];
  const numericPredicates: NumericPredicate[] = [];
  const booleanPredicates: BoolPredicate[] = [];
  const fieldSubstringPredicates: FieldSubstringPredicate[] = [];

  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const t = token.trim();
    if (!t) continue;

    const numM = t.match(NUMERIC_OP_RE);
    if (numM) {
      const [, field, op, numStr] = numM;
      const n = parseFloat(numStr!);
      if (!Number.isFinite(n)) {
        textTokens.push(t);
        continue;
      }
      const mongoOp = OP_MAP[op!];
      if (!mongoOp) {
        textTokens.push(t);
        continue;
      }
      numericPredicates.push({ path: resolveMongoPath(field!), mongoOp, value: n });
      continue;
    }

    const boolM = t.match(BOOL_EXPLICIT_RE);
    if (boolM) {
      const [, field, valStr] = boolM;
      const b = parseBoolValue(valStr!);
      if (b === null) {
        textTokens.push(t);
        continue;
      }
      booleanPredicates.push({ path: resolveMongoPath(field!), value: b });
      continue;
    }

    const fv = splitFieldValueToken(t);
    if (fv) {
      fieldSubstringPredicates.push({
        path: resolveMongoPath(fv.field),
        pattern: fv.value,
      });
      continue;
    }

    if (BOOLEAN_FIELD_ALONE_MEANS_TRUE.has(t)) {
      booleanPredicates.push({ path: resolveMongoPath(t), value: true });
      continue;
    }

    textTokens.push(t);
  }

  return { numericPredicates, booleanPredicates, fieldSubstringPredicates, textTokens };
}

export type RootFieldFilters = {
  /** 多选品牌：0 个不传、1 个精确、多个 $in */
  brands?: string[];
  /** 多选产品线 */
  productLines?: string[];
};

export function structuredMatchDocument(root: RootFieldFilters, parsed: ParsedProductQuery): Document {
  const parts: Document[] = [];
  const bs = (root.brands ?? []).map((s) => s.trim()).filter(Boolean);
  if (bs.length === 1) parts.push({ 品牌: bs[0] });
  else if (bs.length > 1) parts.push({ 品牌: { $in: bs } });

  const ls = (root.productLines ?? []).map((s) => s.trim()).filter(Boolean);
  if (ls.length === 1) parts.push({ 产品线: ls[0] });
  else if (ls.length > 1) parts.push({ 产品线: { $in: ls } });

  for (const p of parsed.numericPredicates) {
    parts.push({ [p.path]: { [p.mongoOp]: p.value } });
  }
  for (const p of parsed.booleanPredicates) {
    parts.push({ [p.path]: p.value });
  }
  for (const p of parsed.fieldSubstringPredicates) {
    const esc = p.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    parts.push({ [p.path]: { $regex: esc, $options: "i" } });
  }

  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0]!;
  return { $and: parts };
}
