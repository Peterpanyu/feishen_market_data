import type { ObjectId } from "mongodb";

/** 与 market-data 导入脚本一致的中文字段 */
export type MarketProductDoc = {
  _id: ObjectId;
  产品线: string;
  品牌: string;
  品牌中文名?: string | null;
  型号: string;
  规格参数: Record<string, unknown>;
  来源文件: string;
  数据指纹: string;
  导入时间: Date;
  解析警告?: string[];
};

export type BrandStat = { 品牌: string; 数量: number };
