"use client";

import { useCatalogCompare } from "@/components/CatalogCompareProvider";

export function CompareSelectAllHeader({ pageIds }: { pageIds: string[] }) {
  const { pageAllSelected, pageSomeSelected, toggleSelectAllForPage } = useCatalogCompare();
  const all = pageAllSelected(pageIds);
  const some = pageSomeSelected(pageIds);
  return (
    <input
      type="checkbox"
      className="h-4 w-4 rounded border-zinc-600 bg-zinc-950 text-red-600 focus:ring-red-500/40"
      checked={all}
      ref={(el) => {
        if (el) el.indeterminate = !all && some;
      }}
      onChange={() => toggleSelectAllForPage(pageIds)}
      aria-label={all ? "取消本页全选" : "本页全选加入对比"}
      title="本页全选 / 取消本页"
    />
  );
}
