/** 记住最近一次「竞品目录」完整路径（含查询），便于从详情/对比/顶栏返回时恢复筛选 */

export const CATALOG_LAST_PATH_KEY = "market-portal-last-catalog-path";

export function isSafeCatalogListPath(path: string): boolean {
  const p = path.trim();
  if (!p.startsWith("/products")) return false;
  if (p.startsWith("//") || p.includes("://")) return false;
  /** 仅 `/products` 或 `/products?…`，排除 `/products/[id]`、`/products/compare` */
  if (p.startsWith("/products/")) return false;
  return true;
}

export function readLastCatalogPath(): string {
  if (typeof window === "undefined") return "/products";
  try {
    const s = sessionStorage.getItem(CATALOG_LAST_PATH_KEY)?.trim();
    if (s && isSafeCatalogListPath(s)) return s;
  } catch {
    /* ignore */
  }
  return "/products";
}

export function writeLastCatalogPath(fullPath: string): void {
  if (typeof window === "undefined") return;
  if (!isSafeCatalogListPath(fullPath)) return;
  try {
    sessionStorage.setItem(CATALOG_LAST_PATH_KEY, fullPath);
  } catch {
    /* quota / private mode */
  }
}
