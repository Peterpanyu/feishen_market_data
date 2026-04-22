"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { readLastCatalogPath } from "@/lib/catalogLastPath";

export function SiteNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [catalogHref, setCatalogHref] = useState("/products");
  const [compareHref, setCompareHref] = useState("/products/compare");

  useEffect(() => {
    if (pathname === "/products") {
      const qs = searchParams.toString();
      setCatalogHref(qs ? `/products?${qs}` : "/products");
    } else {
      setCatalogHref(readLastCatalogPath());
    }
    const ret = readLastCatalogPath();
    const q = `return=${encodeURIComponent(ret)}`;
    setCompareHref(`/products/compare?${q}`);
  }, [pathname, searchParams]);

  const items = useMemo(
    () => [
      { key: "home", href: "/", label: "概览", active: (p: string) => p === "/" },
      {
        key: "catalog",
        href: catalogHref,
        label: "竞品目录",
        active: (p: string) => p.startsWith("/products") && !p.startsWith("/products/compare"),
      },
      {
        key: "compare",
        href: compareHref,
        label: "参数对比",
        active: (p: string) => p.startsWith("/products/compare"),
      },
    ],
    [catalogHref, compareHref],
  );

  return (
    <nav className="fs-nav-enter flex shrink-0 items-center gap-1 rounded-xl border border-zinc-800/50 bg-black/30 p-0.5 shadow-inner shadow-black/20 sm:gap-0.5">
      {items.map(({ key, href, label, active }) => {
        const isActive = active(pathname);
        return (
          <Link
            key={key}
            href={href}
            className={`relative rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200 ${
              isActive
                ? "text-red-50"
                : "text-zinc-500 hover:bg-zinc-900/70 hover:text-zinc-200"
            }`}
          >
            {isActive ? (
              <span
                className="absolute inset-0 -z-10 rounded-md border border-red-500/30 bg-gradient-to-b from-red-950/55 to-red-950/25 shadow-fs-glow-sm"
                aria-hidden
              />
            ) : null}
            <span className="relative">{label}</span>
            {isActive ? (
              <span
                className="absolute bottom-0.5 left-1/2 h-0.5 w-7 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-red-400/90 to-transparent"
                aria-hidden
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
