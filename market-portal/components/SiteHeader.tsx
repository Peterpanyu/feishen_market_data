import Link from "next/link";
import { Suspense } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { SiteNav } from "@/components/SiteNav";

export function SiteHeader() {
  return (
    <header className="fs-header-enter sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/70 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.65)] backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/55">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent"
        aria-hidden
      />
      <div className="mx-auto flex h-[3.75rem] max-w-6xl items-center justify-between gap-4 px-4 sm:h-[3.65rem] sm:px-6">
        <Link
          href="/"
          className="group min-w-0 shrink rounded-lg outline-none ring-red-500/0 transition-[transform,opacity,box-shadow] duration-300 hover:opacity-95 focus-visible:ring-2 focus-visible:ring-red-500/40 active:scale-[0.99]"
        >
          <span className="inline-block transition-transform duration-300 group-hover:scale-[1.02]">
            <BrandLogo />
          </span>
        </Link>
        <Suspense fallback={<div className="h-10 w-[min(100%,18rem)] shrink-0 rounded-xl bg-zinc-900/40" aria-hidden />}>
          <SiteNav />
        </Suspense>
      </div>
    </header>
  );
}
