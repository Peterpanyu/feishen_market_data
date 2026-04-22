"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { safeProductsListReturn } from "@/lib/listSearchParams";
import { readLastCatalogPath } from "@/lib/catalogLastPath";

type Props = {
  returnRaw: string | undefined;
  className?: string;
  children: React.ReactNode;
};

/** 优先使用详情链入的 return；否则用最近一次目录 session 记录 */
export function DetailBackToCatalog({ returnRaw, className, children }: Props) {
  const explicit = returnRaw?.trim();
  const [href, setHref] = useState(() => safeProductsListReturn(explicit));

  useEffect(() => {
    if (explicit) {
      setHref(safeProductsListReturn(explicit));
      return;
    }
    setHref(readLastCatalogPath());
  }, [explicit]);

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
