"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { writeLastCatalogPath } from "@/lib/catalogLastPath";

/** 在竞品目录页把当前 URL（含筛选）写入 sessionStorage，供其它页返回 */
export function LastCatalogUrlSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname !== "/products") return;
    const qs = searchParams.toString();
    const full = qs ? `/products?${qs}` : "/products";
    writeLastCatalogPath(full);
  }, [pathname, searchParams]);

  return null;
}
