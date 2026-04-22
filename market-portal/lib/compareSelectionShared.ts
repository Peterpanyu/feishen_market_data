/** 竞品多选对比：跨页签与详情页写入 sessionStorage 的键与事件名 */

export const COMPARE_MAX = 8;
export const COMPARE_STORAGE_KEY = "market-portal-compare-ids";
export const COMPARE_CHANGED_EVENT = "feishen-market-compare-changed";

export function readCompareIdsFromStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const x of arr) {
      if (typeof x !== "string" || !x.trim()) continue;
      const id = x.trim();
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      if (out.length >= COMPARE_MAX) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function writeCompareIdsToStorage(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const uniq: string[] = [];
    const seen = new Set<string>();
    for (const x of ids) {
      const id = typeof x === "string" ? x.trim() : "";
      if (!id || seen.has(id)) continue;
      seen.add(id);
      uniq.push(id);
      if (uniq.length >= COMPARE_MAX) break;
    }
    sessionStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(uniq));
  } catch {
    /* quota / private mode */
  }
}

export function notifyCompareSelectionChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COMPARE_CHANGED_EVENT));
}

export function buildCompareHref(ids: string[]): string {
  const q = ids.filter(Boolean).join(",");
  return q ? `/products/compare?ids=${encodeURIComponent(q)}` : "/products/compare";
}

/** 详情页等：加入一条并通知订阅方刷新 */
export function addCompareIdToStorage(id: string): { ok: boolean; reason?: "invalid" | "full" | "duplicate" } {
  const trimmed = typeof id === "string" ? id.trim() : "";
  if (!trimmed) return { ok: false, reason: "invalid" };
  const cur = readCompareIdsFromStorage();
  if (cur.includes(trimmed)) return { ok: false, reason: "duplicate" };
  if (cur.length >= COMPARE_MAX) return { ok: false, reason: "full" };
  writeCompareIdsToStorage([...cur, trimmed]);
  notifyCompareSelectionChanged();
  return { ok: true };
}
