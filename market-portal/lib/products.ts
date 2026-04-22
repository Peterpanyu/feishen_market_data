import { ObjectId, type Document } from "mongodb";
import type { MarketProductDoc, BrandStat } from "./types";
import { getMongoClient } from "./mongodb";
import { getMongoCollectionName, getMongoDbName } from "./config";
import { parseProductSearchQuery, structuredMatchDocument } from "./searchParse";
import type { ListSortKey } from "./listSortKey";

const F品牌 = "品牌";
const F型号 = "型号";
const F产品线 = "产品线";
const F品牌中文名 = "品牌中文名";
const F来源文件 = "来源文件";
const F规格参数 = "规格参数";
const F导入时间 = "导入时间";

function escapeRegexToken(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 聚合里把主档 + 规格参数键值拼成一段可正则检索的文本（数值等用 $toString） */
function searchBlobAddFields(): Document {
  return {
    $addFields: {
      _searchBlob: {
        $let: {
          vars: {
            kv: { $objectToArray: { $ifNull: [`$${F规格参数}`, {}] } },
          },
          in: {
            $trim: {
              input: {
                $reduce: {
                  input: "$$kv",
                  initialValue: {
                    $concat: [
                      { $ifNull: [`$${F品牌}`, ""] },
                      " ",
                      { $ifNull: [`$${F型号}`, ""] },
                      " ",
                      { $ifNull: [`$${F产品线}`, ""] },
                      " ",
                      { $ifNull: [`$${F来源文件}`, ""] },
                      " ",
                      { $ifNull: [`$${F品牌中文名}`, ""] },
                      " ",
                    ],
                  },
                  in: {
                    $concat: [
                      "$$value",
                      { $toString: "$$this.k" },
                      " ",
                      { $toString: "$$this.v" },
                      " ",
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

export async function countProducts(): Promise<number> {
  const client = await getMongoClient();
  const col = client.db(getMongoDbName()).collection<MarketProductDoc>(getMongoCollectionName());
  return col.countDocuments({});
}

export async function aggregateByBrand(): Promise<BrandStat[]> {
  const client = await getMongoClient();
  const col = client.db(getMongoDbName()).collection(getMongoCollectionName());
  const rows = await col
    .aggregate<{ _id: string; 数量: number }>([
      { $group: { _id: `$${F品牌}`, 数量: { $sum: 1 } } },
      { $sort: { 数量: -1 } },
    ])
    .toArray();
  return rows.map((r) => ({ 品牌: r._id || "（未填）", 数量: r.数量 }));
}

export async function listDistinctBrands(): Promise<string[]> {
  const client = await getMongoClient();
  const col = client.db(getMongoDbName()).collection(getMongoCollectionName());
  const v = await col.distinct(F品牌);
  return (v as string[])
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

export async function listDistinctProductLines(): Promise<string[]> {
  const client = await getMongoClient();
  const col = client.db(getMongoDbName()).collection(getMongoCollectionName());
  const v = await col.distinct(F产品线);
  return (v as string[])
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

const LIST_SORT_FIELDS: Record<ListSortKey, string> = {
  model: F型号,
  brand: F品牌,
  productLine: F产品线,
  importedAt: F导入时间,
};

function listSortToMongo(sort?: { key: ListSortKey; dir: "asc" | "desc" }): Record<string, 1 | -1> {
  const primary: Record<string, 1 | -1> = sort
    ? { [LIST_SORT_FIELDS[sort.key]]: sort.dir === "asc" ? 1 : -1 }
    : { [F导入时间]: -1 };
  return { ...primary, _id: 1 };
}

export type ListParams = {
  page: number;
  pageSize: number;
  /** 多选品牌（AND 其它条件） */
  brands?: string[];
  /** 多选产品线 */
  productLines?: string[];
  q?: string;
  /** 表头排序；缺省为按导入时间降序 */
  sort?: { key: ListSortKey; dir: "asc" | "desc" };
};

function rootMatchFilter(brands?: string[], productLines?: string[]): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  const bs = (brands ?? []).map((s) => s.trim()).filter(Boolean);
  if (bs.length === 1) filter[F品牌] = bs[0];
  else if (bs.length > 1) filter[F品牌] = { $in: bs };

  const ls = (productLines ?? []).map((s) => s.trim()).filter(Boolean);
  if (ls.length === 1) filter[F产品线] = ls[0];
  else if (ls.length > 1) filter[F产品线] = { $in: ls };

  return filter;
}

export async function listProducts(params: ListParams): Promise<{ items: MarketProductDoc[]; total: number }> {
  const { page, pageSize, brands, productLines, q, sort } = params;
  const client = await getMongoClient();
  const col = client.db(getMongoDbName()).collection<MarketProductDoc>(getMongoCollectionName());

  const skip = Math.max(0, (page - 1) * pageSize);
  const mongoSort = listSortToMongo(sort);

  if (q?.trim()) {
    const parsed = parseProductSearchQuery(q);
    const firstMatch = structuredMatchDocument({ brands, productLines }, parsed);

    const pipeline: Document[] = [];
    pipeline.push({ $match: firstMatch });

    if (parsed.textTokens.length > 0) {
      pipeline.push(searchBlobAddFields());
      const tokenPredicates = parsed.textTokens.map((t) => ({
        _searchBlob: { $regex: escapeRegexToken(t), $options: "i" as const },
      }));
      const textMatch: Document =
        tokenPredicates.length === 1 ? tokenPredicates[0]! : { $and: tokenPredicates };
      pipeline.push({ $match: textMatch });
    }

    pipeline.push({
      $facet: {
        meta: [{ $count: "n" }],
        data: [
          { $sort: mongoSort },
          { $skip: skip },
          { $limit: pageSize },
          { $project: { _searchBlob: 0 } },
        ],
      },
    });

    type FacetOut = { meta: { n: number }[]; data: MarketProductDoc[] };
    const [bucket] = await col.aggregate<FacetOut>(pipeline).toArray();
    const total = bucket?.meta?.[0]?.n ?? 0;
    const items = (bucket?.data ?? []) as MarketProductDoc[];
    return { items, total };
  }

  const filter = rootMatchFilter(brands, productLines);
  const [items, total] = await Promise.all([
    col.find(filter).sort(mongoSort).skip(skip).limit(pageSize).toArray(),
    col.countDocuments(filter),
  ]);
  return { items: items as MarketProductDoc[], total };
}

export async function getProductById(id: string): Promise<MarketProductDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  const client = await getMongoClient();
  const col = client.db(getMongoDbName()).collection<MarketProductDoc>(getMongoCollectionName());
  const doc = await col.findOne({ _id: new ObjectId(id) });
  return doc as MarketProductDoc | null;
}

/** 按 URL 传入顺序返回文档；无效 id 跳过；最多取 8 条以防过大响应 */
export async function getProductsByIds(ids: string[], max = 8): Promise<MarketProductDoc[]> {
  const ordered = Array.from(new Set(ids.map((s) => s.trim()).filter(Boolean))).slice(0, max);
  const oids = ordered.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (oids.length === 0) return [];
  const client = await getMongoClient();
  const col = client.db(getMongoDbName()).collection<MarketProductDoc>(getMongoCollectionName());
  const docs = (await col.find({ _id: { $in: oids } }).toArray()) as MarketProductDoc[];
  const map = new Map(docs.map((d) => [d._id.toString(), d]));
  return ordered.map((id) => map.get(id)).filter((d): d is MarketProductDoc => Boolean(d));
}
