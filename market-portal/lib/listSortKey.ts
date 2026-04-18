/** 竞品目录表头排序键（URL `sort=`），勿从依赖 mongodb 的模块再导出以免打入 client bundle */

export const LIST_SORT_KEYS = ["model", "brand", "productLine", "importedAt"] as const;
export type ListSortKey = (typeof LIST_SORT_KEYS)[number];

export function isListSortKey(s: string): s is ListSortKey {
  return (LIST_SORT_KEYS as readonly string[]).includes(s);
}
