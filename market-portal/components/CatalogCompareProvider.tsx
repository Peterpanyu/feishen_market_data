"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  COMPARE_MAX,
  COMPARE_STORAGE_KEY,
  buildCompareHref,
  readCompareIdsFromStorage,
  writeCompareIdsToStorage,
  COMPARE_CHANGED_EVENT,
} from "@/lib/compareSelectionShared";

type Ctx = {
  ids: string[];
  toggleId: (id: string) => void;
  clear: () => void;
  mergePageIds: (pageIds: string[]) => void;
  /** 本页全选 / 若已全选则取消本页已选 */
  toggleSelectAllForPage: (pageIds: string[]) => void;
  isSelected: (id: string) => boolean;
  pageAllSelected: (pageIds: string[]) => boolean;
  pageSomeSelected: (pageIds: string[]) => boolean;
};

const CatalogCompareContext = createContext<Ctx | null>(null);

export function useCatalogCompare(): Ctx {
  const v = useContext(CatalogCompareContext);
  if (!v) throw new Error("useCatalogCompare must be used within CatalogCompareProvider");
  return v;
}

export function CatalogCompareProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);

  const refreshFromStorage = useCallback(() => {
    setIds(readCompareIdsFromStorage());
  }, []);

  useEffect(() => {
    refreshFromStorage();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === COMPARE_STORAGE_KEY) refreshFromStorage();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(COMPARE_CHANGED_EVENT, refreshFromStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(COMPARE_CHANGED_EVENT, refreshFromStorage);
    };
  }, [refreshFromStorage]);

  const toggleId = useCallback((id: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    setIds((cur) => {
      const i = cur.indexOf(trimmed);
      let next: string[];
      if (i >= 0) next = cur.filter((x) => x !== trimmed);
      else if (cur.length >= COMPARE_MAX) next = cur;
      else next = [...cur, trimmed];
      writeCompareIdsToStorage(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    writeCompareIdsToStorage([]);
    setIds([]);
  }, []);

  const mergePageIds = useCallback((pageIds: string[]) => {
    const cleaned = pageIds.map((s) => s.trim()).filter(Boolean);
    setIds((cur) => {
      const next = [...cur];
      const seen = new Set(next);
      for (const id of cleaned) {
        if (seen.has(id)) continue;
        if (next.length >= COMPARE_MAX) break;
        next.push(id);
        seen.add(id);
      }
      writeCompareIdsToStorage(next);
      return next;
    });
  }, []);

  const toggleSelectAllForPage = useCallback((pageIds: string[]) => {
    const cleaned = pageIds.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length === 0) return;
    setIds((cur) => {
      const allIn = cleaned.every((id) => cur.includes(id));
      let next: string[];
      if (allIn) {
        const drop = new Set(cleaned);
        next = cur.filter((id) => !drop.has(id));
      } else {
        next = [...cur];
        const seen = new Set(next);
        for (const id of cleaned) {
          if (seen.has(id)) continue;
          if (next.length >= COMPARE_MAX) break;
          next.push(id);
          seen.add(id);
        }
      }
      writeCompareIdsToStorage(next);
      return next;
    });
  }, []);

  const isSelected = useCallback((id: string) => ids.includes(id.trim()), [ids]);

  const pageAllSelected = useCallback(
    (pageIds: string[]) => {
      const p = pageIds.map((s) => s.trim()).filter(Boolean);
      if (p.length === 0) return false;
      return p.every((id) => ids.includes(id));
    },
    [ids],
  );

  const pageSomeSelected = useCallback(
    (pageIds: string[]) => {
      const p = pageIds.map((s) => s.trim()).filter(Boolean);
      return p.some((id) => ids.includes(id));
    },
    [ids],
  );

  const value = useMemo(
    () => ({
      ids,
      toggleId,
      clear,
      mergePageIds,
      toggleSelectAllForPage,
      isSelected,
      pageAllSelected,
      pageSomeSelected,
    }),
    [ids, toggleId, clear, mergePageIds, toggleSelectAllForPage, isSelected, pageAllSelected, pageSomeSelected],
  );

  const n = ids.length;
  const compareHref = buildCompareHref(ids);

  return (
    <CatalogCompareContext.Provider value={value}>
      {children}
      {n > 0 ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
          role="status"
          aria-live="polite"
        >
          <div className="pointer-events-auto flex max-w-2xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-red-900/45 bg-zinc-950/95 px-4 py-3 shadow-lg shadow-black/50 backdrop-blur-md sm:gap-3">
            <span className="text-sm text-zinc-200">
              已选 <span className="font-semibold tabular-nums text-red-200/95">{n}</span> 款
              {n >= COMPARE_MAX ? (
                <span className="ml-1.5 text-xs text-amber-400/95">（最多 {COMPARE_MAX} 款）</span>
              ) : null}
            </span>
            <button type="button" onClick={clear} className="fs-btn-ghost text-xs">
              清空
            </button>
            <Link
              href={compareHref}
              className={`fs-btn-ghost text-xs ${n < 2 ? "pointer-events-none opacity-40" : ""}`}
              aria-disabled={n < 2}
              title={n < 2 ? "请至少选择 2 款产品" : "打开参数对比表"}
            >
              参数对比
            </Link>
          </div>
        </div>
      ) : null}
    </CatalogCompareContext.Provider>
  );
}
