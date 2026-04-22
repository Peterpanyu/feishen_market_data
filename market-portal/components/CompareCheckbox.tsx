"use client";

import { useCatalogCompare } from "@/components/CatalogCompareProvider";

export function CompareCheckbox({ productId }: { productId: string }) {
  const { isSelected, toggleId } = useCatalogCompare();
  const checked = isSelected(productId);
  return (
    <input
      type="checkbox"
      className="h-4 w-4 rounded border-zinc-600 bg-zinc-950 text-red-600 focus:ring-red-500/40"
      checked={checked}
      onChange={() => toggleId(productId)}
      aria-label="加入参数对比"
    />
  );
}
