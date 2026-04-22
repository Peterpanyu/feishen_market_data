"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { readLastCatalogPath } from "@/lib/catalogLastPath";
import { safeProductsListReturn } from "@/lib/listSearchParams";

type Props = {
  className?: string;
  children: React.ReactNode;
  /** 服务端从 URL 解析出的 return（如对比页 ?return=），优先于 session */
  serverHint?: string;
};

/** 指向竞品目录：在目录页内用当前 URL；否则用 serverHint 或 session 中最近一次查询 */
export function ProductsCatalogReturnLink({ className, children, serverHint }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [href, setHref] = useState(() =>
    serverHint?.trim() ? safeProductsListReturn(serverHint) : "/products",
  );

  useEffect(() => {
    if (pathname === "/products") {
      const qs = searchParams.toString();
      setHref(qs ? `/products?${qs}` : "/products");
      return;
    }
    if (serverHint?.trim()) {
      setHref(safeProductsListReturn(serverHint));
      return;
    }
    setHref(readLastCatalogPath());
  }, [pathname, searchParams, serverHint]);

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
